-- ==============================================================================
-- 12_owner_requirements_upgrade.sql
-- Al-Khedewy Restaurant Bot & Dashboard - Owner Requirements Migration
--
-- 1. Temporarily drop triggers that depend on status columns.
-- 2. Streamline orders.status to ('pending', 'confirmed') only.
-- 3. Streamline complaints.status to ('open', 'resolved') only.
-- 4. Recreate triggers for complaints side effects & auto-resolve timestamp.
-- 5. Drop complaints.priority and complaint_priority enum.
-- 6. Create branches & branch_delivery_zones tables with RLS and indexes.
-- 7. Add branch_id and offer_id to orders table; make payment_method optional.
-- 8. Add start_date to offers; drop offers.sort_order.
-- 9. Add realtime publication for branches and zones safely.
-- ==============================================================================

-- 1. Drop existing triggers that reference complaints.status
DROP TRIGGER IF EXISTS trg_complaints_side_effects ON public.complaints;
DROP TRIGGER IF EXISTS trg_complaints_status_resolved ON public.complaints;

-- 2. Update handle_complaint_side_effects trigger function to avoid referencing removed 'issue' status
CREATE OR REPLACE FUNCTION public.handle_complaint_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    should_pause BOOLEAN;
BEGIN
    -- Pause AI if auto_pause_on_complaint is enabled
    IF TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL THEN
        SELECT auto_pause_on_complaint INTO should_pause FROM public.bot_settings LIMIT 1;
        IF COALESCE(should_pause, false) THEN
            UPDATE public.contacts 
            SET ai_enabled = false, needs_human = true, needs_human_at = now() 
            WHERE id = NEW.contact_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Update orders status enum to ('pending', 'confirmed') only
DROP TYPE IF EXISTS public.order_status_old CASCADE;

DO $$
BEGIN
    -- Only migrate order_status if it still contains old values or if it exists
    IF EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'order_status' AND e.enumlabel NOT IN ('pending', 'confirmed')
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
        ALTER TYPE public.order_status RENAME TO order_status_old;
        CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed');
        ALTER TABLE public.orders ALTER COLUMN status TYPE public.order_status 
          USING (CASE WHEN status::text = 'confirmed' THEN 'confirmed'::public.order_status ELSE 'pending'::public.order_status END);
        ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending'::public.order_status;
        DROP TYPE IF EXISTS public.order_status_old CASCADE;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed');
        ALTER TABLE public.orders ALTER COLUMN status TYPE public.order_status USING 'pending'::public.order_status;
        ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending'::public.order_status;
    END IF;
END $$;

-- 4. Update complaints status enum to ('open', 'resolved') only
DROP TYPE IF EXISTS public.complaint_status_old CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'complaint_status' AND e.enumlabel NOT IN ('open', 'resolved')
    ) THEN
        ALTER TABLE public.complaints ALTER COLUMN status DROP DEFAULT;
        ALTER TYPE public.complaint_status RENAME TO complaint_status_old;
        CREATE TYPE public.complaint_status AS ENUM ('open', 'resolved');
        ALTER TABLE public.complaints ALTER COLUMN status TYPE public.complaint_status 
          USING (CASE WHEN status::text = 'resolved' OR status::text = 'closed' THEN 'resolved'::public.complaint_status ELSE 'open'::public.complaint_status END);
        ALTER TABLE public.complaints ALTER COLUMN status SET DEFAULT 'open'::public.complaint_status;
        DROP TYPE IF EXISTS public.complaint_status_old CASCADE;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status') THEN
        CREATE TYPE public.complaint_status AS ENUM ('open', 'resolved');
        ALTER TABLE public.complaints ALTER COLUMN status TYPE public.complaint_status USING 'open'::public.complaint_status;
        ALTER TABLE public.complaints ALTER COLUMN status SET DEFAULT 'open'::public.complaint_status;
    END IF;
END $$;

-- 5. Recreate trigger function & triggers on complaints
CREATE OR REPLACE FUNCTION public.handle_complaint_status_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'resolved' AND (TG_OP = 'INSERT' OR OLD.status != 'resolved') AND NEW.resolved_at IS NULL) THEN
        NEW.resolved_at = NOW();
    ELSIF (NEW.status != 'resolved') THEN
        NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaints_status_resolved
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_status_update();

CREATE TRIGGER trg_complaints_side_effects
    AFTER INSERT OR UPDATE OF order_id, status ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_side_effects();

-- 6. Drop priority column from complaints
DROP INDEX IF EXISTS public.idx_complaints_priority;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS priority;
DROP TYPE IF EXISTS public.complaint_priority;

-- 7. Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    google_maps_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create branch_delivery_zones table (zones and pricing per branch)
CREATE TABLE IF NOT EXISTS public.branch_delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    zone_name TEXT NOT NULL,
    delivery_fee NUMERIC NOT NULL DEFAULT 15,
    estimated_delivery_time TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_branch_delivery_zones_updated_at ON public.branch_delivery_zones;
CREATE TRIGGER trg_branch_delivery_zones_updated_at BEFORE UPDATE ON public.branch_delivery_zones
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for branches and zones
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branch_delivery_zones_branch_id ON public.branch_delivery_zones(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_delivery_zones_active ON public.branch_delivery_zones(is_active);

-- 9. Add branch_id and offer_id to orders; make payment_method optional
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_method SET DEFAULT 'cash';

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_offer_id ON public.orders(offer_id);

-- 10. Alter offers table: add start_date, drop sort_order
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.offers DROP COLUMN IF EXISTS sort_order;

-- 11. Row Level Security policies for branches and zones
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_select_all" ON public.branches;
CREATE POLICY "branches_select_all" ON public.branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "branches_modify_admin" ON public.branches;
CREATE POLICY "branches_modify_admin" ON public.branches FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
);

DROP POLICY IF EXISTS "branch_zones_select_all" ON public.branch_delivery_zones;
CREATE POLICY "branch_zones_select_all" ON public.branch_delivery_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "branch_zones_modify_admin" ON public.branch_delivery_zones;
CREATE POLICY "branch_zones_modify_admin" ON public.branch_delivery_zones FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
);

-- Service role bypass
DROP POLICY IF EXISTS "service_role_branches" ON public.branches;
CREATE POLICY "service_role_branches" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_branch_zones" ON public.branch_delivery_zones;
CREATE POLICY "service_role_branch_zones" ON public.branch_delivery_zones FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. Realtime replication for branches and zones (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'branches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'branch_delivery_zones'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.branch_delivery_zones;
    END IF;
END $$;
