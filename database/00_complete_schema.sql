-- ==============================================================================
-- 01_schema.sql: Core PostgreSQL Schema, Enums, Tables, Triggers & Indexes
-- Project: Intelligent Messenger Bot & Operations Control Dashboard (Al-Khedewy)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumerations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'order_agent', 'support_agent');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status') THEN
        CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_priority') THEN
        CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_match_type') THEN
        CREATE TYPE rule_match_type AS ENUM ('any', 'keywords');
    END IF;
END $$;

-- 3. Auth Schema Compatibility (Ensures local/testing compatibility if not on hosted Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- ==============================================================================
-- 4. Tables Definition
-- ==============================================================================

-- 4.1 Profiles (User Management & Role-Based Access Control linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'order_agent',
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Bot Settings (Dynamic Master Configuration for Bot & Automation Workflows)
CREATE TABLE IF NOT EXISTS public.bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auto_pause_on_complaint BOOLEAN NOT NULL DEFAULT TRUE,
    notify_telegram BOOLEAN NOT NULL DEFAULT TRUE,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    facebook_page_id TEXT,
    facebook_page_access_token TEXT,
    notify_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
    business_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    open_time TIME,
    close_time TIME,
    off_hours_message TEXT DEFAULT 'نحن خارج أوقات العمل الرسمية حالياً. سنتواصل معك فور بدء العمل!',
    ai_system_prompt TEXT DEFAULT 'أنت المساعد الذكي لمطعم الخديوي، أجب بلباقة وسرعة واجمع طلبات العملاء.',
    menu_full_image_url TEXT,
    menu_full_pdf_url TEXT,
    currency TEXT NOT NULL DEFAULT 'EGP',
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.3 Global Comment Rules (Fallback Auto-Replies for Unspecified Facebook Posts)
CREATE TABLE IF NOT EXISTS public.global_comment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auto_like_comment BOOLEAN NOT NULL DEFAULT TRUE,
    comment_replies TEXT[] NOT NULL DEFAULT ARRAY[
        'شرفتنا يا فندم! بعتنالك التفاصيل في رسايل الصفحة 📩❤️',
        'أهلاً بك! تم الرد على حضرتك في الخاص بكل التفاصيل 🌟',
        'منورنا دائماً! شيك على رسايلك الخاصة بعتنالك كل التفاصيل 💬✨'
    ],
    send_dm BOOLEAN NOT NULL DEFAULT TRUE,
    dm_message TEXT DEFAULT 'أهلاً بحضرتك في مطعم الخديوي! كيف نقدر نساعدك اليوم؟ تقدر تطلب الأوردر مباشرة أو تشوف عروضنا الحصرية 🌟',
    dm_image_url TEXT,
    dm_buttons JSONB DEFAULT '[
        {"title": "قائمة المنيو 🍔", "payload": "VIEW_MENU"},
        {"title": "العروض الحالية 🏷️", "payload": "VIEW_OFFERS"},
        {"title": "تحدث مع موظف 👨‍💼", "payload": "HUMAN_AGENT"}
    ]'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.4 Post Rules (Post-Specific Comment & DM Triggers for Marketing Funnels)
CREATE TABLE IF NOT EXISTS public.post_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    facebook_post_id TEXT NOT NULL UNIQUE,
    post_thumbnail_url TEXT,
    post_url TEXT,
    post_caption TEXT,
    match_type rule_match_type NOT NULL DEFAULT 'any',
    trigger_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    auto_like_comment BOOLEAN NOT NULL DEFAULT TRUE,
    comment_replies TEXT[] NOT NULL,
    dm_message TEXT NOT NULL,
    dm_image_url TEXT,
    dm_buttons JSONB DEFAULT '[]'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_triggers INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.5 Offers (Promotions & Marketing Banners)
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    price_before NUMERIC(10, 2),
    price_after NUMERIC(10, 2) NOT NULL,
    banner_url TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.6 Menu Categories (Food Categories)
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.7 Menu Items (Food Items Catalog)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    sale_price NUMERIC(10, 2),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    badges TEXT[] DEFAULT ARRAY[]::TEXT[],
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.8 Contacts (Customer Profiles & AI State Management)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform TEXT NOT NULL DEFAULT 'facebook',
    platform_user_id TEXT NOT NULL UNIQUE,
    name TEXT,
    phone TEXT,
    address TEXT,
    ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    total_orders INTEGER NOT NULL DEFAULT 0,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.9 Messages (Customer Engagement & Live Chat Log)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'bot', 'agent')),
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.10 Orders (Order Fulfillment Pipeline)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number BIGSERIAL UNIQUE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status order_status NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
    internal_notes TEXT,
    source TEXT NOT NULL DEFAULT 'messenger',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.11 Order Items (Line Items for Each Order)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    notes TEXT
);

-- 4.12 Complaints (CRM Ticket Resolution)
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number BIGSERIAL UNIQUE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    priority complaint_priority NOT NULL DEFAULT 'medium',
    status complaint_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ==============================================================================
-- 5. Triggers & Trigger Functions
-- ==============================================================================

-- 5.1 Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Updated At Triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bot_settings_updated_at ON public.bot_settings;
CREATE TRIGGER trg_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_global_comment_rules_updated_at ON public.global_comment_rules;
CREATE TRIGGER trg_global_comment_rules_updated_at
    BEFORE UPDATE ON public.global_comment_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_post_rules_updated_at ON public.post_rules;
CREATE TRIGGER trg_post_rules_updated_at
    BEFORE UPDATE ON public.post_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER trg_menu_categories_updated_at
    BEFORE UPDATE ON public.menu_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5.2 Auto-Resolved Timestamp Trigger for Complaints
CREATE OR REPLACE FUNCTION public.handle_complaint_status_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('resolved', 'closed') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('resolved', 'closed')) AND NEW.resolved_at IS NULL) THEN
        NEW.resolved_at = NOW();
    ELSIF (NEW.status NOT IN ('resolved', 'closed')) THEN
        NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_status_resolved ON public.complaints;
CREATE TRIGGER trg_complaints_status_resolved
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_status_update();

-- 5.3 Auto-Profile Creation Trigger on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    assigned_role public.user_role := 'order_agent'::public.user_role;
    user_app_role TEXT;
    user_meta_role TEXT;
BEGIN
    -- Extract roles from metadata
    user_app_role := NEW.raw_app_meta_data->>'role';
    user_meta_role := NEW.raw_user_meta_data->>'role';

    -- Security: Only trusted raw_app_meta_data can assign 'admin'.
    -- Client-supplied raw_user_meta_data is untrusted and strictly prevented from self-assigning 'admin'.
    IF user_app_role = 'admin' THEN
        assigned_role := 'admin'::public.user_role;
    ELSIF user_app_role IN ('order_agent', 'support_agent') THEN
        assigned_role := user_app_role::public.user_role;
    ELSIF user_meta_role IN ('order_agent', 'support_agent') THEN
        assigned_role := user_meta_role::public.user_role;
    ELSE
        assigned_role := 'order_agent'::public.user_role;
    END IF;

    INSERT INTO public.profiles (id, full_name, role, avatar_url, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
        assigned_role,
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 6. Indexes for Performance & Query Optimization
-- ==============================================================================

-- Singleton Integrity (Single-Row Configuration Tables)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_settings_singleton ON public.bot_settings ((true));
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_comment_rules_singleton ON public.global_comment_rules ((true));

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Post Rules (facebook_post_id has UNIQUE constraint so it is already indexed)
CREATE INDEX IF NOT EXISTS idx_post_rules_is_active ON public.post_rules(is_active);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_active_dates ON public.offers(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offers_sort_order ON public.offers(sort_order);

-- Menu Categories & Items
CREATE INDEX IF NOT EXISTS idx_menu_categories_is_active ON public.menu_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON public.menu_items(sort_order);

-- Contacts (platform_user_id has UNIQUE constraint so it is already indexed)
CREATE INDEX IF NOT EXISTS idx_contacts_ai_enabled ON public.contacts(ai_enabled);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON public.contacts(last_interaction_at DESC);

-- Messages (Composite Index for conversation history queries)
CREATE INDEX IF NOT EXISTS idx_messages_contact_created ON public.messages(contact_id, created_at ASC);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_contact_id ON public.orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items(menu_item_id);

-- Complaints
CREATE INDEX IF NOT EXISTS idx_complaints_contact_id ON public.complaints(contact_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON public.complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);


-- ==============================================================================
-- 02_storage_and_realtime.sql: Supabase Storage Buckets, RLS Policies & Realtime CDC
-- Project: Intelligent Messenger Bot & Operations Control Dashboard (Al-Khedewy)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- ==============================================================================
-- 1. Storage Buckets Configuration
-- Creates 'menu-assets' (images & PDF) and 'offer-banners' (images only) with 10MB limit
-- (storage.buckets and storage.objects are pre-managed by Supabase)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'menu-assets',
        'menu-assets',
        true,
        10485760, -- 10MB (10 * 1024 * 1024 bytes)
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    ),
    (
        'offer-banners',
        'offer-banners',
        true,
        10485760, -- 10MB (10 * 1024 * 1024 bytes)
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    updated_at = NOW();

-- ==============================================================================
-- 2. Storage Row-Level Security Policies for storage.objects
-- ==============================================================================

-- 2.1 Public Read Access for menu assets and promotional offer banners
DROP POLICY IF EXISTS "Public read access for menu-assets and offer-banners" ON storage.objects;
CREATE POLICY "Public read access for menu-assets and offer-banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('menu-assets', 'offer-banners'));

-- 2.2 Admin Upload (INSERT) Access
DROP POLICY IF EXISTS "Admin insert access for menu-assets and offer-banners" ON storage.objects;
CREATE POLICY "Admin insert access for menu-assets and offer-banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('menu-assets', 'offer-banners')
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.is_active = true
    )
);

-- 2.3 Admin Modification (UPDATE) Access
DROP POLICY IF EXISTS "Admin update access for menu-assets and offer-banners" ON storage.objects;
CREATE POLICY "Admin update access for menu-assets and offer-banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id IN ('menu-assets', 'offer-banners')
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.is_active = true
    )
)
WITH CHECK (
    bucket_id IN ('menu-assets', 'offer-banners')
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.is_active = true
    )
);

-- 2.4 Admin Deletion (DELETE) Access
DROP POLICY IF EXISTS "Admin delete access for menu-assets and offer-banners" ON storage.objects;
CREATE POLICY "Admin delete access for menu-assets and offer-banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('menu-assets', 'offer-banners')
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.is_active = true
    )
);

-- ==============================================================================
-- 3. Supabase Realtime Publication Configuration
-- Enables real-time event broadcasting for live dashboard monitoring and chat synchronization
-- ==============================================================================
DO $$
BEGIN
    -- 3.1 Ensure supabase_realtime publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 3.2 Add public.orders to realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- 3.3 Add public.complaints to realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'complaints'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
    END IF;

    -- 3.4 Add public.messages to realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- 3.5 Add public.contacts to realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'contacts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    END IF;
END $$;

-- ==============================================================================
-- 4. Replica Identity Settings
-- Sets REPLICA IDENTITY FULL to guarantee full row images in UPDATE/DELETE CDC events
-- ==============================================================================
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;



-- ==============================================================================
-- 03_rls_policies.sql: Row-Level Security (RLS) & Granular 3-Tier RBAC Policies
-- Project: Intelligent Messenger Bot & Operations Control Dashboard (Al-Khedewy)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- ==============================================================================
-- 1. Security Definer Helper Functions
-- ==============================================================================

-- 2.1 Get User Role Helper
-- Returns public.user_role for a specified user_id, validating active status
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT role FROM public.profiles WHERE id = user_id AND is_active = true;
$$;

-- Overload with zero arguments defaulting to auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT public.get_user_role(auth.uid());
$$;

-- 2.2 Is Active Staff Helper
-- Returns boolean indicating whether the specified user_id is an active staff profile
CREATE OR REPLACE FUNCTION public.is_active_staff(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT is_active FROM public.profiles WHERE id = user_id),
        false
    );
$$;

-- Overload with zero arguments defaulting to auth.uid()
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT public.is_active_staff(auth.uid());
$$;

-- 2.3 Grant execution permissions on helper functions to all connected client roles
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_staff(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, anon, service_role;

-- ==============================================================================
-- 3. Enable Row-Level Security on All 12 Core Tables
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. Schema-Level Privileges
-- (Ensures Supabase and local roles have standard table privileges before RLS filtering)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.menu_categories, public.menu_items, public.offers TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ==============================================================================
-- 5. Granular RBAC Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 5.1 Profiles (RBAC & Staff Profiles)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on profiles" ON public.profiles;
CREATE POLICY "Admin full access on profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Staff: View Active Staff Profiles (Allows viewing colleagues on tickets and assigned orders)
DROP POLICY IF EXISTS "Active staff view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff view own profile" ON public.profiles;
CREATE POLICY "Active staff view active profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()) AND is_active = true);

-- Staff: Update Own Profile (Restricted from privilege escalation)
DROP POLICY IF EXISTS "Staff update own profile" ON public.profiles;
CREATE POLICY "Staff update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() AND public.is_active_staff(auth.uid()))
WITH CHECK (id = auth.uid() AND role = public.get_user_role(auth.uid()) AND is_active = true);

-- Service Role: Full access for automation
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
ON public.profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.2 Bot Settings (Master Configuration)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on bot_settings" ON public.bot_settings;
CREATE POLICY "Admin full access on bot_settings"
ON public.bot_settings FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n engine
DROP POLICY IF EXISTS "Service role full access on bot_settings" ON public.bot_settings;
CREATE POLICY "Service role full access on bot_settings"
ON public.bot_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.3 Global Comment Rules (Auto-Reply Fallbacks)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on global_comment_rules" ON public.global_comment_rules;
CREATE POLICY "Admin full access on global_comment_rules"
ON public.global_comment_rules FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n engine
DROP POLICY IF EXISTS "Service role full access on global_comment_rules" ON public.global_comment_rules;
CREATE POLICY "Service role full access on global_comment_rules"
ON public.global_comment_rules FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.4 Post Rules (Post-Specific Triggers)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on post_rules" ON public.post_rules;
CREATE POLICY "Admin full access on post_rules"
ON public.post_rules FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n engine
DROP POLICY IF EXISTS "Service role full access on post_rules" ON public.post_rules;
CREATE POLICY "Service role full access on post_rules"
ON public.post_rules FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.5 Offers (Promotions & Marketing Banners)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on offers" ON public.offers;
CREATE POLICY "Admin full access on offers"
ON public.offers FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Staff: Read-only access (Order Agents & Support Agents)
DROP POLICY IF EXISTS "Staff read access on offers" ON public.offers;
CREATE POLICY "Staff read access on offers"
ON public.offers FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()) AND public.get_user_role(auth.uid()) IN ('order_agent', 'support_agent'));

-- Public / Anon: Read-only access for active offers within valid date range
DROP POLICY IF EXISTS "Public read access on active offers" ON public.offers;
CREATE POLICY "Public read access on active offers"
ON public.offers FOR SELECT
TO anon, authenticated
USING (
    is_active = true 
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
);

-- Service Role: Full access
DROP POLICY IF EXISTS "Service role full access on offers" ON public.offers;
CREATE POLICY "Service role full access on offers"
ON public.offers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.6 Menu Categories (Catalog Categories)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on menu_categories" ON public.menu_categories;
CREATE POLICY "Admin full access on menu_categories"
ON public.menu_categories FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Staff: Read-only access (Order Agents & Support Agents)
DROP POLICY IF EXISTS "Staff read access on menu_categories" ON public.menu_categories;
CREATE POLICY "Staff read access on menu_categories"
ON public.menu_categories FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()) AND public.get_user_role(auth.uid()) IN ('order_agent', 'support_agent'));

-- Public / Anon: Read-only access on active menu categories
DROP POLICY IF EXISTS "Public read access on active menu_categories" ON public.menu_categories;
CREATE POLICY "Public read access on active menu_categories"
ON public.menu_categories FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Service Role: Full access
DROP POLICY IF EXISTS "Service role full access on menu_categories" ON public.menu_categories;
CREATE POLICY "Service role full access on menu_categories"
ON public.menu_categories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.7 Menu Items (Catalog Food Items)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on menu_items" ON public.menu_items;
CREATE POLICY "Admin full access on menu_items"
ON public.menu_items FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Staff: Read-only access (Order Agents & Support Agents)
DROP POLICY IF EXISTS "Staff read access on menu_items" ON public.menu_items;
CREATE POLICY "Staff read access on menu_items"
ON public.menu_items FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()) AND public.get_user_role(auth.uid()) IN ('order_agent', 'support_agent'));

-- Public / Anon: Read-only access on available items within active categories
DROP POLICY IF EXISTS "Public read access on available menu_items" ON public.menu_items;
CREATE POLICY "Public read access on available menu_items"
ON public.menu_items FOR SELECT
TO anon, authenticated
USING (
    is_available = true 
    AND EXISTS (
        SELECT 1 FROM public.menu_categories c 
        WHERE c.id = menu_items.category_id 
          AND c.is_active = true
    )
);

-- Service Role: Full access
DROP POLICY IF EXISTS "Service role full access on menu_items" ON public.menu_items;
CREATE POLICY "Service role full access on menu_items"
ON public.menu_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.8 Contacts (Customer CRM Profiles)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on contacts" ON public.contacts;
CREATE POLICY "Admin full access on contacts"
ON public.contacts FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Staff: Read-only access (Order Agents & Support Agents)
DROP POLICY IF EXISTS "Staff read access on contacts" ON public.contacts;
CREATE POLICY "Staff read access on contacts"
ON public.contacts FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()) AND public.get_user_role(auth.uid()) IN ('order_agent', 'support_agent'));

-- Support Agent: Update access (Toggle ai_enabled for live takeover)
DROP POLICY IF EXISTS "Support agent update on contacts" ON public.contacts;
CREATE POLICY "Support agent update on contacts"
ON public.contacts FOR UPDATE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n bot
DROP POLICY IF EXISTS "Service role full access on contacts" ON public.contacts;
CREATE POLICY "Service role full access on contacts"
ON public.contacts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.9 Messages (Customer Engagement & Live Chat Log)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on messages" ON public.messages;
CREATE POLICY "Admin full access on messages"
ON public.messages FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Support Agent: Read access to chat history
DROP POLICY IF EXISTS "Support agent select on messages" ON public.messages;
CREATE POLICY "Support agent select on messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Support Agent: Insert access for manual takeover replies
DROP POLICY IF EXISTS "Support agent insert on messages" ON public.messages;
CREATE POLICY "Support agent insert on messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n webhook engine
DROP POLICY IF EXISTS "Service role full access on messages" ON public.messages;
CREATE POLICY "Service role full access on messages"
ON public.messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.10 Orders (Order Fulfillment Pipeline)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on orders" ON public.orders;
CREATE POLICY "Admin full access on orders"
ON public.orders FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Order Agent: Read access
DROP POLICY IF EXISTS "Order agent select on orders" ON public.orders;
CREATE POLICY "Order agent select on orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Order Agent: Insert access (Manual phone/counter order creation)
DROP POLICY IF EXISTS "Order agent insert on orders" ON public.orders;
CREATE POLICY "Order agent insert on orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Order Agent: Update access (Update order status, delivery notes)
DROP POLICY IF EXISTS "Order agent update on orders" ON public.orders;
CREATE POLICY "Order agent update on orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n AI ordering
DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;
CREATE POLICY "Service role full access on orders"
ON public.orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.11 Order Items (Line Items for Each Order)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on order_items" ON public.order_items;
CREATE POLICY "Admin full access on order_items"
ON public.order_items FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Order Agent: Read access
DROP POLICY IF EXISTS "Order agent select on order_items" ON public.order_items;
CREATE POLICY "Order agent select on order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Order Agent: Insert access
DROP POLICY IF EXISTS "Order agent insert on order_items" ON public.order_items;
CREATE POLICY "Order agent insert on order_items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Order Agent: Update access
DROP POLICY IF EXISTS "Order agent update on order_items" ON public.order_items;
CREATE POLICY "Order agent update on order_items"
ON public.order_items FOR UPDATE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n AI ordering
DROP POLICY IF EXISTS "Service role full access on order_items" ON public.order_items;
CREATE POLICY "Service role full access on order_items"
ON public.order_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.12 Complaints (CRM Ticket Resolution)
-- ------------------------------------------------------------------------------

-- Admin: Full CRUD
DROP POLICY IF EXISTS "Admin full access on complaints" ON public.complaints;
CREATE POLICY "Admin full access on complaints"
ON public.complaints FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

-- Support Agent: Read access
DROP POLICY IF EXISTS "Support agent select on complaints" ON public.complaints;
CREATE POLICY "Support agent select on complaints"
ON public.complaints FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Support Agent: Insert access
DROP POLICY IF EXISTS "Support agent insert on complaints" ON public.complaints;
CREATE POLICY "Support agent insert on complaints"
ON public.complaints FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Support Agent: Update access (Update resolution notes, priority, status)
DROP POLICY IF EXISTS "Support agent update on complaints" ON public.complaints;
CREATE POLICY "Support agent update on complaints"
ON public.complaints FOR UPDATE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

-- Service Role: Full access for n8n complaint filing
DROP POLICY IF EXISTS "Service role full access on complaints" ON public.complaints;
CREATE POLICY "Service role full access on complaints"
ON public.complaints FOR ALL
TO service_role
USING (true)
WITH CHECK (true);





-- ==============================================================================
-- 05_create_admin.sql: Automated Master Admin User Provisioning
-- Project: Intelligent Messenger Bot & Operations Control Dashboard (Al-Khedewy)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================
-- Usage:
-- Run this script in the Supabase SQL Editor to create or update an Admin account.
-- You can change the DEFAULT_EMAIL and DEFAULT_PASSWORD below as desired.
-- ==============================================================================

DO $$
DECLARE
    -- Configure your desired Admin credentials here:
    target_email TEXT := 'admin@pr-media.forum';
    target_password TEXT := 'Admin102938@';
    target_name TEXT := 'مدير النظام (Admin)';
    target_phone TEXT := '+201000000000';
    
    existing_user_id UUID;
    new_user_id UUID := gen_random_uuid();
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE email = target_email;

    IF existing_user_id IS NULL THEN
        -- 1. Insert new authenticated user into Supabase Auth
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            target_email,
            crypt(target_password, gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
            jsonb_build_object(
                'full_name', target_name,
                'phone', target_phone,
                'role', 'admin'
            ),
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        -- 2. Insert or update the public profile with admin role
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            phone,
            is_active
        ) VALUES (
            new_user_id,
            target_name,
            'admin',
            target_phone,
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            is_active = true,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone;

        RAISE NOTICE 'Admin user created successfully: % (Password: %)', target_email, target_password;
    ELSE
        -- If user already exists, update their password and elevate profile to admin
        UPDATE auth.users
        SET 
            encrypted_password = crypt(target_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'),
            updated_at = NOW()
        WHERE id = existing_user_id;

        UPDATE public.profiles
        SET 
            role = 'admin',
            is_active = true,
            full_name = COALESCE(full_name, target_name)
        WHERE id = existing_user_id;

        RAISE NOTICE 'Existing user updated to Admin: % (Password updated)', target_email;
    END IF;
END $$;






-- ==============================================================================
-- 04_v2_upgrade.sql: v2 Upgrade (Channels, Comment Control Center, Simplified
--                    Orders, Image/PDF Menu, Price List, Fried Chicken Defaults)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================
-- RUN ORDER:  01_schema.sql -> 02_storage_and_realtime.sql -> 03_rls_policies.sql
--             -> 04_v2_upgrade.sql (this file) -> 05_create_admin.sql
--
-- SAFE TO RE-RUN: every statement is idempotent (IF NOT EXISTS / DROP IF EXISTS /
-- guarded DO blocks). Existing users, profiles, contacts, messages, orders,
-- complaints, offers and bot settings are preserved.
--
-- REMOVES (no longer used by the dashboard):
--   menu_categories, menu_items (menu is now images/PDF only)
--   post_rules, global_comment_rules (merged into comment_rules; any existing
--   rows are copied over before the old tables are dropped)
--   bot_settings.facebook_page_id / facebook_page_access_token (moved to channels)
-- ==============================================================================


-- ==============================================================================
-- 1. Shared helper: updated_at trigger function (already exists from 01, re-declared safely)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. Channels & Meta Apps (multi-page, multi-app ready)
-- ==============================================================================

-- 2.1 Meta developer apps (App ID / App Secret managed from the dashboard)
--     SECRET TABLE: no client access at all. Read/written only by server routes
--     (service role) and by n8n.
CREATE TABLE IF NOT EXISTS public.meta_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    app_id TEXT NOT NULL UNIQUE,
    app_secret TEXT NOT NULL,
    webhook_verify_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Connected channels (one row per Facebook Page; Instagram/WhatsApp later)
--     Public metadata only. Tokens live in channel_secrets.
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_app_id UUID REFERENCES public.meta_apps(id) ON DELETE SET NULL,
    platform TEXT NOT NULL DEFAULT 'facebook'
        CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
    external_id TEXT NOT NULL,                 -- Facebook Page ID (= webhook entry.id)
    name TEXT,
    picture_url TEXT,
    status TEXT NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'error', 'disconnected')),
    token_expires_at TIMESTAMPTZ,              -- NULL = never expires
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channels_platform_external_id_key UNIQUE (platform, external_id)
);

-- 2.3 Channel secrets (page access tokens). SECRET TABLE: service role only.
CREATE TABLE IF NOT EXISTS public.channel_secrets (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 3. Bot Settings: restaurant name, menu images/PDF, price list, bot texts
-- ==============================================================================
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS restaurant_name TEXT NOT NULL DEFAULT 'اسم المطعم';
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS menu_images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS menu_pdf_url TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS price_list TEXT;              -- plain text / Markdown, used in n8n expressions
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS human_handoff_message TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;         -- shown in /channels as the Meta Callback URL

-- 3.1 Carry over old single menu image / PDF (if present) then drop the old columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'menu_full_image_url') THEN
        EXECUTE $q$
            UPDATE public.bot_settings
            SET menu_images = ARRAY[menu_full_image_url]
            WHERE menu_full_image_url IS NOT NULL
              AND menu_full_image_url <> ''
              AND menu_full_image_url NOT LIKE '/storage/v1/object/public/menu-assets/khedewy-%'
              AND cardinality(menu_images) = 0
        $q$;
        ALTER TABLE public.bot_settings DROP COLUMN menu_full_image_url;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'menu_full_pdf_url') THEN
        EXECUTE $q$
            UPDATE public.bot_settings
            SET menu_pdf_url = menu_full_pdf_url
            WHERE menu_full_pdf_url IS NOT NULL
              AND menu_full_pdf_url <> ''
              AND menu_full_pdf_url NOT LIKE '/storage/v1/object/public/menu-assets/khedewy-%'
              AND menu_pdf_url IS NULL
        $q$;
        ALTER TABLE public.bot_settings DROP COLUMN menu_full_pdf_url;
    END IF;
END $$;

-- 3.2 Facebook credentials move to channels / channel_secrets
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS facebook_page_id;
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS facebook_page_access_token;

-- 3.3 Ensure the single settings row exists, with fried chicken defaults
INSERT INTO public.bot_settings (
    bot_enabled, auto_pause_on_complaint, notify_telegram, notify_dashboard,
    business_hours_enabled, open_time, close_time, currency, delivery_fee,
    restaurant_name, off_hours_message, ai_system_prompt, welcome_message, human_handoff_message
)
SELECT
    true, true, true, true,
    false, '12:00:00'::time, '02:00:00'::time, 'EGP', 0.00,
    'اسم المطعم',
    'أهلاً بحضرتك 🍗 إحنا حالياً خارج مواعيد العمل. سيب طلبك أو استفسارك هنا وهنرد عليك أول ما نفتح ❤️',
    NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.bot_settings);

-- 3.4 Fill fried chicken default texts where empty or still on the old grill wording
UPDATE public.bot_settings SET ai_system_prompt =
'أنت المساعد الذكي لمطعم فراخ مقلية (بروستد وكريسبي). اتكلم بلهجة مصرية ودودة ومختصرة (يا فندم، تحت أمرك، بالهنا والشفا).
مهامك:
1) الترحيب بالعميل وعرض المنيو والعروض الحالية.
2) مساعدة العميل في اختيار الوجبات (بروستد، كريسبي، استربس، ساندوتشات، وجبات عائلية، بطاطس، صوصات، مشروبات) والكميات.
3) استخدم قائمة الأسعار المرفقة فقط عند ذكر أي سعر، ولا تخترع أي سعر غير موجود فيها.
4) اجمع بيانات التوصيل: الاسم، رقم الموبايل، العنوان بالتفصيل.
5) قبل تأكيد الأوردر اعرض ملخص كامل (الأصناف والكميات والإجمالي ومصاريف التوصيل) واطلب موافقة العميل صراحة.
6) لو العميل عنده شكوى، اعتذر بلطف وسجّل الشكوى فوراً وطمّنه إن الإدارة هتتواصل معاه.'
WHERE ai_system_prompt IS NULL
   OR ai_system_prompt = ''
   OR ai_system_prompt LIKE '%المشويات%'
   OR ai_system_prompt = 'أنت المساعد الذكي لمطعم الخديوي، أجب بلباقة وسرعة واجمع طلبات العملاء.';

UPDATE public.bot_settings SET welcome_message =
'أهلاً بيك 🍗🔥 نورتنا! تحب تشوف المنيو، العروض، ولا تطلب على طول؟'
WHERE welcome_message IS NULL OR welcome_message = '';

UPDATE public.bot_settings SET human_handoff_message =
'تمام يا فندم 🙏 تم تحويلك لموظف خدمة العملاء، وهيرد على حضرتك في أقرب وقت.'
WHERE human_handoff_message IS NULL OR human_handoff_message = '';


-- ==============================================================================
-- 4. Contacts & Messages: channel link, needs-human flag, dedupe keys
-- ==============================================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS needs_human BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS needs_human_at TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS platform_message_id TEXT;   -- Messenger "mid", blocks duplicate webhook deliveries
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;  -- staff member for agent messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS send_error TEXT;            -- e.g. outside Facebook's 24h window

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_message_id
    ON public.messages(platform_message_id) WHERE platform_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_channel_id ON public.contacts(channel_id);
CREATE INDEX IF NOT EXISTS idx_contacts_needs_human ON public.contacts(needs_human) WHERE needs_human = true;


-- ==============================================================================
-- 5. Orders: 3 statuses (confirmed / issue / cancelled), free-text items
-- ==============================================================================

-- 5.1 Replace order_status enum (pending/confirmed/preparing/out_for_delivery/delivered/cancelled)
--     with (confirmed/issue/cancelled). Existing rows: cancelled stays cancelled, all others -> confirmed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'order_status' AND e.enumlabel = 'issue'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
        ALTER TYPE public.order_status RENAME TO order_status_v1;
        CREATE TYPE public.order_status AS ENUM ('confirmed', 'issue', 'cancelled');
        ALTER TABLE public.orders
            ALTER COLUMN status TYPE public.order_status
            USING (CASE WHEN status::text = 'cancelled' THEN 'cancelled' ELSE 'confirmed' END)::public.order_status;
        DROP TYPE public.order_status_v1;
    END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_channel_id ON public.orders(channel_id);

-- 5.2 Order items become free text (no dish catalog). Prices optional.
ALTER TABLE public.order_items DROP COLUMN IF EXISTS menu_item_id;
ALTER TABLE public.order_items ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN total_price DROP NOT NULL;


-- ==============================================================================
-- 6. Comment Control Center
-- ==============================================================================

-- 6.1 Global comment behaviour (single row): complaint words, anti-spam, complaint replies
CREATE TABLE IF NOT EXISTS public.comment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensitive_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    complaint_public_reply TEXT,
    complaint_dm_message TEXT,
    complaint_hide_comment BOOLEAN NOT NULL DEFAULT FALSE,
    complaint_create_ticket BOOLEAN NOT NULL DEFAULT TRUE,
    complaint_notify_staff BOOLEAN NOT NULL DEFAULT TRUE,
    dm_cooldown_hours INTEGER NOT NULL DEFAULT 24 CHECK (dm_cooldown_hours >= 0),
    reply_delay_min_sec INTEGER NOT NULL DEFAULT 5 CHECK (reply_delay_min_sec >= 0),
    reply_delay_max_sec INTEGER NOT NULL DEFAULT 40 CHECK (reply_delay_max_sec >= 0),
    ignore_nested_replies BOOLEAN NOT NULL DEFAULT TRUE,
    ignore_mentions_only BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_settings_delay_range CHECK (reply_delay_max_sec >= reply_delay_min_sec)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_settings_singleton ON public.comment_settings ((true));

-- 6.2 Per-post settings (bot on/off for a post + cached post preview for the dashboard)
CREATE TABLE IF NOT EXISTS public.post_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    facebook_post_id TEXT NOT NULL UNIQUE,
    bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    post_caption TEXT,
    post_thumbnail_url TEXT,
    post_url TEXT,
    post_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.3 Comment rules (replaces post_rules + global_comment_rules)
--     Resolution order used by the bot:
--       1. post rules with keywords  2. post rule "any"  3. global keyword rules  4. global "any" (fallback)
--     Lower priority number = checked first within the same level.
CREATE TABLE IF NOT EXISTS public.comment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,   -- NULL = all channels
    scope TEXT NOT NULL CHECK (scope IN ('post', 'global')),
    facebook_post_id TEXT,
    name TEXT NOT NULL,
    trigger_type public.rule_match_type NOT NULL DEFAULT 'any',
    keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    priority INTEGER NOT NULL DEFAULT 100,
    -- actions
    reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reply_variations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    like_comment BOOLEAN NOT NULL DEFAULT TRUE,
    dm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dm_message TEXT,
    dm_image_url TEXT,
    dm_buttons JSONB NOT NULL DEFAULT '[]'::JSONB,
    dm_send_menu BOOLEAN NOT NULL DEFAULT FALSE,
    dm_send_offers BOOLEAN NOT NULL DEFAULT FALSE,
    hide_comment BOOLEAN NOT NULL DEFAULT FALSE,
    create_complaint BOOLEAN NOT NULL DEFAULT FALSE,
    notify_staff BOOLEAN NOT NULL DEFAULT FALSE,
    -- state & stats
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_triggers INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_rules_scope_post_id CHECK (
        (scope = 'post' AND facebook_post_id IS NOT NULL) OR
        (scope = 'global' AND facebook_post_id IS NULL)
    ),
    CONSTRAINT comment_rules_keywords_required CHECK (
        trigger_type = 'any' OR cardinality(keywords) > 0
    )
);
CREATE INDEX IF NOT EXISTS idx_comment_rules_lookup ON public.comment_rules(scope, facebook_post_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_comment_rules_channel ON public.comment_rules(channel_id);

-- 6.4 Comment events: one row per incoming comment = live inbox + audit log + dedupe lock
CREATE TABLE IF NOT EXISTS public.comment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    comment_id TEXT NOT NULL UNIQUE,            -- Facebook comment id (dedupe key)
    post_id TEXT,
    parent_comment_id TEXT,                     -- set when it is a reply to another comment
    commenter_id TEXT,
    commenter_name TEXT,
    comment_text TEXT,
    comment_created_at TIMESTAMPTZ,
    decision TEXT NOT NULL DEFAULT 'pending'
        CHECK (decision IN ('pending', 'replied', 'ignored', 'complaint', 'failed', 'manual')),
    ignore_reason TEXT,                         -- e.g. bot_off, post_off, nested_reply, mentions_only, cooldown, no_rule
    matched_rule_id UUID REFERENCES public.comment_rules(id) ON DELETE SET NULL,
    public_reply_text TEXT,
    public_reply_id TEXT,
    replied BOOLEAN NOT NULL DEFAULT FALSE,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    dm_sent BOOLEAN NOT NULL DEFAULT FALSE,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
    handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- staff member for manual actions
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comment_events_created_at ON public.comment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_events_post_id ON public.comment_events(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_events_decision ON public.comment_events(decision);
CREATE INDEX IF NOT EXISTS idx_comment_events_cooldown ON public.comment_events(commenter_id, created_at DESC) WHERE dm_sent = true;


-- ==============================================================================
-- 7. Complaints: link to order, source, comment event; phone optional
-- ==============================================================================
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'messenger';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS comment_event_id UUID REFERENCES public.comment_events(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ALTER COLUMN customer_phone DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_source_check') THEN
        ALTER TABLE public.complaints
            ADD CONSTRAINT complaints_source_check CHECK (source IN ('messenger', 'comment', 'dashboard', 'phone'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_complaints_order_id ON public.complaints(order_id);


-- ==============================================================================
-- 8. Offers: price and image become optional (quick add for the owner)
-- ==============================================================================
ALTER TABLE public.offers ALTER COLUMN price_after DROP NOT NULL;
ALTER TABLE public.offers ALTER COLUMN banner_url DROP NOT NULL;


-- ==============================================================================
-- 9. Copy any existing old comment rules into comment_rules, then drop old tables
-- ==============================================================================
DO $$
BEGIN
    -- 9.1 post_rules -> comment_rules (scope = post) + post_settings preview
    IF to_regclass('public.post_rules') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'post') THEN
        EXECUTE $q$
            INSERT INTO public.comment_rules (
                scope, facebook_post_id, name, trigger_type, keywords, priority,
                reply_enabled, reply_variations, like_comment,
                dm_enabled, dm_message, dm_image_url, dm_buttons,
                is_active, total_triggers, created_at, updated_at
            )
            SELECT
                'post', facebook_post_id, title, match_type,
                CASE WHEN match_type = 'keywords' THEN COALESCE(trigger_keywords, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
                100,
                cardinality(comment_replies) > 0, comment_replies, auto_like_comment,
                dm_message IS NOT NULL AND dm_message <> '', dm_message, dm_image_url, COALESCE(dm_buttons, '[]'::JSONB),
                is_active, total_triggers, created_at, updated_at
            FROM public.post_rules
            WHERE match_type = 'any' OR cardinality(COALESCE(trigger_keywords, ARRAY[]::TEXT[])) > 0
        $q$;

        EXECUTE $q$
            INSERT INTO public.post_settings (facebook_post_id, bot_enabled, post_caption, post_thumbnail_url, post_url)
            SELECT facebook_post_id, true, post_caption, post_thumbnail_url, post_url
            FROM public.post_rules
            ON CONFLICT (facebook_post_id) DO NOTHING
        $q$;
    END IF;

    -- 9.2 global_comment_rules -> comment_rules (scope = global, trigger = any, fallback)
    IF to_regclass('public.global_comment_rules') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global') THEN
        EXECUTE $q$
            INSERT INTO public.comment_rules (
                scope, name, trigger_type, priority,
                reply_enabled, reply_variations, like_comment,
                dm_enabled, dm_message, dm_image_url, dm_buttons, is_active
            )
            SELECT
                'global', 'الرد العام على أي تعليق', 'any', 1000,
                cardinality(comment_replies) > 0, comment_replies, auto_like_comment,
                send_dm, dm_message, dm_image_url, COALESCE(dm_buttons, '[]'::JSONB), is_enabled
            FROM public.global_comment_rules
            LIMIT 1
        $q$;
    END IF;
END $$;

DROP TABLE IF EXISTS public.post_rules;
DROP TABLE IF EXISTS public.global_comment_rules;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.menu_categories;


-- ==============================================================================
-- 10. Fried chicken defaults for the Comment Control Center (only if empty)
-- ==============================================================================
INSERT INTO public.comment_settings (
    sensitive_keywords, complaint_public_reply, complaint_dm_message
)
SELECT
    ARRAY[
        'شكوى', 'شكوي', 'وحش', 'وحشة', 'سيء', 'سئ', 'زفت', 'مقرف', 'معفن', 'ريحة',
        'بارد', 'ساقع', 'نيء', 'ني', 'مش مستوي', 'محروق', 'مزيت', 'زيت كتير', 'ناشف',
        'اتأخر', 'اتاخر', 'متأخر', 'تأخير', 'ناقص', 'غلط', 'مش هو', 'حرام عليكم', 'نصب'
    ],
    'نعتذر جداً لحضرتك 🙏 تواصلنا معاك في الخاص عشان نحل المشكلة فوراً.',
    'أهلاً بحضرتك، إحنا آسفين جداً على اللي حصل 🙏 ممكن توضحلنا المشكلة ورقم الأوردر أو رقم الموبايل اللي طلبت بيه؟ الإدارة هتتواصل معاك فوراً.'
WHERE NOT EXISTS (SELECT 1 FROM public.comment_settings);

-- 10.1 Default global keyword rules: menu / prices, offers
INSERT INTO public.comment_rules (
    scope, name, trigger_type, keywords, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_send_menu, dm_buttons
)
SELECT
    'global', 'طلب المنيو والأسعار', 'keywords',
    ARRAY['منيو', 'المنيو', 'menu', 'قائمة', 'الاسعار', 'الأسعار', 'اسعار', 'أسعار', 'بكام', 'سعر', 'السعر'],
    10,
    true,
    ARRAY[
        'بعتنالك المنيو كامل بالأسعار في الخاص 🍗📩',
        'شوف رسايلك يا فندم، المنيو والأسعار عندك 🔥',
        'تم إرسال المنيو في الخاص، بالهنا مقدماً 😋'
    ],
    true,
    true,
    'أهلاً بحضرتك 🍗 ده المنيو كامل بالأسعار. لو حابب تطلب ابعتلنا الأصناف هنا وإحنا نجهزهالك على طول 🔥',
    true,
    '[{"title": "اطلب دلوقتي 🛵", "payload": "START_ORDER"}, {"title": "العروض 🔥", "payload": "VIEW_OFFERS"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND trigger_type = 'keywords');

INSERT INTO public.comment_rules (
    scope, name, trigger_type, keywords, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_send_offers, dm_buttons
)
SELECT
    'global', 'السؤال عن العروض', 'keywords',
    ARRAY['عرض', 'عروض', 'العرض', 'العروض', 'خصم', 'خصومات', 'offer'],
    20,
    true,
    ARRAY[
        'بعتنالك كل العروض الحالية في الخاص 🔥📩',
        'العروض مستنياك في رسايلك يا فندم 🍗',
        'شوف الخاص، فيه عروض هتعجبك 😍'
    ],
    true,
    true,
    'دي أحدث العروض عندنا 🔥 اختار اللي يعجبك وابعتلنا، وإحنا نجهزهولك على طول 🍗',
    true,
    '[{"title": "اطلب دلوقتي 🛵", "payload": "START_ORDER"}, {"title": "المنيو 🍗", "payload": "VIEW_MENU"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND name = 'السؤال عن العروض');

-- 10.2 Default global fallback ("any" comment)
INSERT INTO public.comment_rules (
    scope, name, trigger_type, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_buttons
)
SELECT
    'global', 'الرد العام على أي تعليق', 'any', 1000,
    true,
    ARRAY[
        'نورتنا يا فندم 🍗 بعتنالك التفاصيل في الخاص 📩',
        'شكراً لتعليقك ❤️ شوف رسايلك، بعتنالك كل حاجة',
        'منور دايماً 🔥 رديّنا عليك في الخاص'
    ],
    true,
    true,
    'أهلاً بيك 🍗🔥 نورتنا! تحب تشوف المنيو، العروض، ولا تطلب على طول؟',
    '[{"title": "المنيو 🍗", "payload": "VIEW_MENU"}, {"title": "العروض 🔥", "payload": "VIEW_OFFERS"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND trigger_type = 'any');


-- ==============================================================================
-- 11. Database logic shared by every workflow (triggers)
-- ==============================================================================

-- 11.1 updated_at triggers for new tables
DROP TRIGGER IF EXISTS trg_meta_apps_updated_at ON public.meta_apps;
CREATE TRIGGER trg_meta_apps_updated_at BEFORE UPDATE ON public.meta_apps
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_channels_updated_at ON public.channels;
CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON public.channels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_channel_secrets_updated_at ON public.channel_secrets;
CREATE TRIGGER trg_channel_secrets_updated_at BEFORE UPDATE ON public.channel_secrets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_settings_updated_at ON public.comment_settings;
CREATE TRIGGER trg_comment_settings_updated_at BEFORE UPDATE ON public.comment_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_post_settings_updated_at ON public.post_settings;
CREATE TRIGGER trg_post_settings_updated_at BEFORE UPDATE ON public.post_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_rules_updated_at ON public.comment_rules;
CREATE TRIGGER trg_comment_rules_updated_at BEFORE UPDATE ON public.comment_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_events_updated_at ON public.comment_events;
CREATE TRIGGER trg_comment_events_updated_at BEFORE UPDATE ON public.comment_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11.2 Complaint opened on an order -> order becomes "issue"
--      Complaint created for a contact -> pause AI (if bot_settings.auto_pause_on_complaint)
CREATE OR REPLACE FUNCTION public.handle_complaint_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    should_pause BOOLEAN;
BEGIN
    IF NEW.order_id IS NOT NULL AND NEW.status IN ('open', 'in_progress') THEN
        UPDATE public.orders
        SET status = 'issue'
        WHERE id = NEW.order_id AND status = 'confirmed';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL THEN
        SELECT auto_pause_on_complaint INTO should_pause FROM public.bot_settings LIMIT 1;
        IF COALESCE(should_pause, false) THEN
            UPDATE public.contacts SET ai_enabled = false WHERE id = NEW.contact_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaints_side_effects ON public.complaints;
CREATE TRIGGER trg_complaints_side_effects
    AFTER INSERT OR UPDATE OF order_id, status ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_side_effects();

-- 11.3 New order -> contact total_orders + last interaction
CREATE OR REPLACE FUNCTION public.handle_new_order_contact_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.contact_id IS NOT NULL THEN
        UPDATE public.contacts
        SET total_orders = total_orders + 1,
            last_interaction_at = NOW()
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_contact_stats ON public.orders;
CREATE TRIGGER trg_orders_contact_stats
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_contact_stats();

-- 11.4 New message -> contact last interaction; staff reply clears "needs human"
CREATE OR REPLACE FUNCTION public.handle_new_message_contact_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.contacts
    SET last_interaction_at = NEW.created_at,
        needs_human = CASE WHEN NEW.sender_type = 'agent' AND NEW.send_error IS NULL THEN false ELSE needs_human END
    WHERE id = NEW.contact_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_contact_state ON public.messages;
CREATE TRIGGER trg_messages_contact_state
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_contact_state();

-- 11.5 needs_human_at follows needs_human
CREATE OR REPLACE FUNCTION public.handle_contact_needs_human()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.needs_human AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.needs_human, false)) THEN
        NEW.needs_human_at = NOW();
    ELSIF NOT NEW.needs_human THEN
        NEW.needs_human_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_needs_human ON public.contacts;
CREATE TRIGGER trg_contacts_needs_human
    BEFORE INSERT OR UPDATE OF needs_human ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.handle_contact_needs_human();

-- 11.6 Restaurant name for all staff (bot_settings itself stays admin-only)
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT json_build_object('restaurant_name', restaurant_name)
    FROM public.bot_settings
    WHERE public.is_active_staff(auth.uid())
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO authenticated, service_role;


-- ==============================================================================
-- 12. Row-Level Security & privileges for new tables
-- ==============================================================================
ALTER TABLE public.meta_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_events ENABLE ROW LEVEL SECURITY;

-- 12.1 Privileges: secret tables are invisible to browser roles entirely
REVOKE ALL ON public.meta_apps, public.channel_secrets FROM anon, authenticated;
GRANT ALL ON public.meta_apps, public.channel_secrets TO service_role;

REVOKE ALL ON public.channels, public.comment_settings, public.post_settings,
              public.comment_rules, public.comment_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels, public.comment_settings, public.post_settings,
              public.comment_rules, public.comment_events TO authenticated;
GRANT ALL ON public.channels, public.comment_settings, public.post_settings,
             public.comment_rules, public.comment_events TO service_role;

-- 12.2 meta_apps & channel_secrets: service role only
DROP POLICY IF EXISTS "Service role full access on meta_apps" ON public.meta_apps;
CREATE POLICY "Service role full access on meta_apps"
ON public.meta_apps FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on channel_secrets" ON public.channel_secrets;
CREATE POLICY "Service role full access on channel_secrets"
ON public.channel_secrets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.3 channels: all active staff can read (names / status); writes via server routes only
DROP POLICY IF EXISTS "Active staff read channels" ON public.channels;
CREATE POLICY "Active staff read channels"
ON public.channels FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on channels" ON public.channels;
CREATE POLICY "Service role full access on channels"
ON public.channels FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.4 comment_settings, post_settings, comment_rules: admin manages, support agent reads
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['comment_settings', 'post_settings', 'comment_rules'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin full access on %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Admin full access on %1$s" ON public.%1$I FOR ALL TO authenticated
            USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
            WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
        $p$, t);

        EXECUTE format('DROP POLICY IF EXISTS "Support agent read %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Support agent read %1$s" ON public.%1$I FOR SELECT TO authenticated
            USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
        $p$, t);

        EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Service role full access on %1$s" ON public.%1$I FOR ALL TO service_role
            USING (true) WITH CHECK (true)
        $p$, t);
    END LOOP;
END $$;

-- 12.5 comment_events: admin full, support agent read + update (manual reply / hide)
DROP POLICY IF EXISTS "Admin full access on comment_events" ON public.comment_events;
CREATE POLICY "Admin full access on comment_events"
ON public.comment_events FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent read comment_events" ON public.comment_events;
CREATE POLICY "Support agent read comment_events"
ON public.comment_events FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent update comment_events" ON public.comment_events;
CREATE POLICY "Support agent update comment_events"
ON public.comment_events FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on comment_events" ON public.comment_events;
CREATE POLICY "Service role full access on comment_events"
ON public.comment_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.6 Cross-links between orders, complaints and chat
-- Order agents: see complaints (to show "open complaint" on orders) and open the customer chat from an order
DROP POLICY IF EXISTS "Order agent select on complaints" ON public.complaints;
CREATE POLICY "Order agent select on complaints"
ON public.complaints FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent select on messages" ON public.messages;
CREATE POLICY "Order agent select on messages"
ON public.messages FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent insert on messages" ON public.messages;
CREATE POLICY "Order agent insert on messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent update on contacts" ON public.contacts;
CREATE POLICY "Order agent update on contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Support agents: see orders (to open the order linked to a complaint)
DROP POLICY IF EXISTS "Support agent select on orders" ON public.orders;
CREATE POLICY "Support agent select on orders"
ON public.orders FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent update on orders" ON public.orders;
CREATE POLICY "Support agent update on orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent select on order_items" ON public.order_items;
CREATE POLICY "Support agent select on order_items"
ON public.order_items FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));


-- ==============================================================================
-- 13. Realtime: live comment inbox
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_rel pr
           JOIN pg_publication p ON p.oid = pr.prpubid
           JOIN pg_class c ON c.oid = pr.prrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'comment_events'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_events;
    END IF;
END $$;

ALTER TABLE public.comment_events REPLICA IDENTITY FULL;


-- ==============================================================================
-- Done. Next: run 05_create_admin.sql (if you have not created your admin yet).
-- ==============================================================================





-- ==============================================================================
-- 04_v2_upgrade.sql: v2 Upgrade (Channels, Comment Control Center, Simplified
--                    Orders, Image/PDF Menu, Price List, Fried Chicken Defaults)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================
-- RUN ORDER:  01_schema.sql -> 02_storage_and_realtime.sql -> 03_rls_policies.sql
--             -> 04_v2_upgrade.sql (this file) -> 05_create_admin.sql
--
-- SAFE TO RE-RUN: every statement is idempotent (IF NOT EXISTS / DROP IF EXISTS /
-- guarded DO blocks). Existing users, profiles, contacts, messages, orders,
-- complaints, offers and bot settings are preserved.
--
-- REMOVES (no longer used by the dashboard):
--   menu_categories, menu_items (menu is now images/PDF only)
--   post_rules, global_comment_rules (merged into comment_rules; any existing
--   rows are copied over before the old tables are dropped)
--   bot_settings.facebook_page_id / facebook_page_access_token (moved to channels)
-- ==============================================================================


-- ==============================================================================
-- 1. Shared helper: updated_at trigger function (already exists from 01, re-declared safely)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. Channels & Meta Apps (multi-page, multi-app ready)
-- ==============================================================================

-- 2.1 Meta developer apps (App ID / App Secret managed from the dashboard)
--     SECRET TABLE: no client access at all. Read/written only by server routes
--     (service role) and by n8n.
CREATE TABLE IF NOT EXISTS public.meta_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    app_id TEXT NOT NULL UNIQUE,
    app_secret TEXT NOT NULL,
    webhook_verify_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Facebook Login for Business apps use a Configuration ID instead of a scope list (NULL = classic scope login)
ALTER TABLE public.meta_apps ADD COLUMN IF NOT EXISTS login_config_id TEXT;

-- 2.2 Connected channels (one row per Facebook Page; Instagram/WhatsApp later)
--     Public metadata only. Tokens live in channel_secrets.
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_app_id UUID REFERENCES public.meta_apps(id) ON DELETE SET NULL,
    platform TEXT NOT NULL DEFAULT 'facebook'
        CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
    external_id TEXT NOT NULL,                 -- Facebook Page ID (= webhook entry.id)
    name TEXT,
    picture_url TEXT,
    status TEXT NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'error', 'disconnected')),
    token_expires_at TIMESTAMPTZ,              -- NULL = never expires
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channels_platform_external_id_key UNIQUE (platform, external_id)
);

-- 2.3 Channel secrets (page access tokens). SECRET TABLE: service role only.
CREATE TABLE IF NOT EXISTS public.channel_secrets (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 3. Bot Settings: restaurant name, menu images/PDF, price list, bot texts
-- ==============================================================================
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS restaurant_name TEXT NOT NULL DEFAULT 'اسم المطعم';
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS menu_images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS menu_pdf_url TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS price_list TEXT;              -- plain text / Markdown, used in n8n expressions
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS human_handoff_message TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;         -- shown in /channels as the Meta Callback URL

-- 3.1 Carry over old single menu image / PDF (if present) then drop the old columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'menu_full_image_url') THEN
        EXECUTE $q$
            UPDATE public.bot_settings
            SET menu_images = ARRAY[menu_full_image_url]
            WHERE menu_full_image_url IS NOT NULL
              AND menu_full_image_url <> ''
              AND menu_full_image_url NOT LIKE '/storage/v1/object/public/menu-assets/khedewy-%'
              AND cardinality(menu_images) = 0
        $q$;
        ALTER TABLE public.bot_settings DROP COLUMN menu_full_image_url;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'menu_full_pdf_url') THEN
        EXECUTE $q$
            UPDATE public.bot_settings
            SET menu_pdf_url = menu_full_pdf_url
            WHERE menu_full_pdf_url IS NOT NULL
              AND menu_full_pdf_url <> ''
              AND menu_full_pdf_url NOT LIKE '/storage/v1/object/public/menu-assets/khedewy-%'
              AND menu_pdf_url IS NULL
        $q$;
        ALTER TABLE public.bot_settings DROP COLUMN menu_full_pdf_url;
    END IF;
END $$;

-- 3.2 Facebook credentials move to channels / channel_secrets
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS facebook_page_id;
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS facebook_page_access_token;

-- 3.3 Ensure the single settings row exists, with fried chicken defaults
INSERT INTO public.bot_settings (
    bot_enabled, auto_pause_on_complaint, notify_telegram, notify_dashboard,
    business_hours_enabled, open_time, close_time, currency, delivery_fee,
    restaurant_name, off_hours_message, ai_system_prompt, welcome_message, human_handoff_message
)
SELECT
    true, true, true, true,
    false, '12:00:00'::time, '02:00:00'::time, 'EGP', 0.00,
    'اسم المطعم',
    'أهلاً بحضرتك 🍗 إحنا حالياً خارج مواعيد العمل. سيب طلبك أو استفسارك هنا وهنرد عليك أول ما نفتح ❤️',
    NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.bot_settings);

-- 3.4 Fill fried chicken default texts where empty or still on the old grill wording
UPDATE public.bot_settings SET ai_system_prompt =
'أنت المساعد الذكي لمطعم فراخ مقلية (بروستد وكريسبي). اتكلم بلهجة مصرية ودودة ومختصرة (يا فندم، تحت أمرك، بالهنا والشفا).
مهامك:
1) الترحيب بالعميل وعرض المنيو والعروض الحالية.
2) مساعدة العميل في اختيار الوجبات (بروستد، كريسبي، استربس، ساندوتشات، وجبات عائلية، بطاطس، صوصات، مشروبات) والكميات.
3) استخدم قائمة الأسعار المرفقة فقط عند ذكر أي سعر، ولا تخترع أي سعر غير موجود فيها.
4) اجمع بيانات التوصيل: الاسم، رقم الموبايل، العنوان بالتفصيل.
5) قبل تأكيد الأوردر اعرض ملخص كامل (الأصناف والكميات والإجمالي ومصاريف التوصيل) واطلب موافقة العميل صراحة.
6) لو العميل عنده شكوى، اعتذر بلطف وسجّل الشكوى فوراً وطمّنه إن الإدارة هتتواصل معاه.'
WHERE ai_system_prompt IS NULL
   OR ai_system_prompt = ''
   OR ai_system_prompt LIKE '%المشويات%'
   OR ai_system_prompt = 'أنت المساعد الذكي لمطعم الخديوي، أجب بلباقة وسرعة واجمع طلبات العملاء.';

UPDATE public.bot_settings SET welcome_message =
'أهلاً بيك 🍗🔥 نورتنا! تحب تشوف المنيو، العروض، ولا تطلب على طول؟'
WHERE welcome_message IS NULL OR welcome_message = '';

UPDATE public.bot_settings SET human_handoff_message =
'تمام يا فندم 🙏 تم تحويلك لموظف خدمة العملاء، وهيرد على حضرتك في أقرب وقت.'
WHERE human_handoff_message IS NULL OR human_handoff_message = '';


-- ==============================================================================
-- 4. Contacts & Messages: channel link, needs-human flag, dedupe keys
-- ==============================================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS needs_human BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS needs_human_at TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS platform_message_id TEXT;   -- Messenger "mid", blocks duplicate webhook deliveries
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;  -- staff member for agent messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS send_error TEXT;            -- e.g. outside Facebook's 24h window

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_message_id
    ON public.messages(platform_message_id) WHERE platform_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_channel_id ON public.contacts(channel_id);
CREATE INDEX IF NOT EXISTS idx_contacts_needs_human ON public.contacts(needs_human) WHERE needs_human = true;


-- ==============================================================================
-- 5. Orders: 3 statuses (confirmed / issue / cancelled), free-text items
-- ==============================================================================

-- 5.1 Replace order_status enum (pending/confirmed/preparing/out_for_delivery/delivered/cancelled)
--     with (confirmed/issue/cancelled). Existing rows: cancelled stays cancelled, all others -> confirmed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'order_status' AND e.enumlabel = 'issue'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
        ALTER TYPE public.order_status RENAME TO order_status_v1;
        CREATE TYPE public.order_status AS ENUM ('confirmed', 'issue', 'cancelled');
        ALTER TABLE public.orders
            ALTER COLUMN status TYPE public.order_status
            USING (CASE WHEN status::text = 'cancelled' THEN 'cancelled' ELSE 'confirmed' END)::public.order_status;
        DROP TYPE public.order_status_v1;
    END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_channel_id ON public.orders(channel_id);

-- 5.2 Order items become free text (no dish catalog). Prices optional.
ALTER TABLE public.order_items DROP COLUMN IF EXISTS menu_item_id;
ALTER TABLE public.order_items ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN total_price DROP NOT NULL;


-- ==============================================================================
-- 6. Comment Control Center
-- ==============================================================================

-- 6.1 Global comment behaviour (single row): complaint words, anti-spam, complaint replies
CREATE TABLE IF NOT EXISTS public.comment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensitive_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    complaint_public_reply TEXT,
    complaint_dm_message TEXT,
    complaint_hide_comment BOOLEAN NOT NULL DEFAULT FALSE,
    complaint_create_ticket BOOLEAN NOT NULL DEFAULT TRUE,
    complaint_notify_staff BOOLEAN NOT NULL DEFAULT TRUE,
    dm_cooldown_hours INTEGER NOT NULL DEFAULT 24 CHECK (dm_cooldown_hours >= 0),
    reply_delay_min_sec INTEGER NOT NULL DEFAULT 5 CHECK (reply_delay_min_sec >= 0),
    reply_delay_max_sec INTEGER NOT NULL DEFAULT 40 CHECK (reply_delay_max_sec >= 0),
    ignore_nested_replies BOOLEAN NOT NULL DEFAULT TRUE,
    ignore_mentions_only BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_settings_delay_range CHECK (reply_delay_max_sec >= reply_delay_min_sec)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_settings_singleton ON public.comment_settings ((true));

-- 6.2 Per-post settings (bot on/off for a post + cached post preview for the dashboard)
CREATE TABLE IF NOT EXISTS public.post_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    facebook_post_id TEXT NOT NULL UNIQUE,
    bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    post_caption TEXT,
    post_thumbnail_url TEXT,
    post_url TEXT,
    post_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.3 Comment rules (replaces post_rules + global_comment_rules)
--     Resolution order used by the bot:
--       1. post rules with keywords  2. post rule "any"  3. global keyword rules  4. global "any" (fallback)
--     Lower priority number = checked first within the same level.
CREATE TABLE IF NOT EXISTS public.comment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,   -- NULL = all channels
    scope TEXT NOT NULL CHECK (scope IN ('post', 'global')),
    facebook_post_id TEXT,
    name TEXT NOT NULL,
    trigger_type public.rule_match_type NOT NULL DEFAULT 'any',
    keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    priority INTEGER NOT NULL DEFAULT 100,
    -- actions
    reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reply_variations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    like_comment BOOLEAN NOT NULL DEFAULT TRUE,
    dm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dm_message TEXT,
    dm_image_url TEXT,
    dm_buttons JSONB NOT NULL DEFAULT '[]'::JSONB,
    dm_send_menu BOOLEAN NOT NULL DEFAULT FALSE,
    dm_send_offers BOOLEAN NOT NULL DEFAULT FALSE,
    hide_comment BOOLEAN NOT NULL DEFAULT FALSE,
    create_complaint BOOLEAN NOT NULL DEFAULT FALSE,
    notify_staff BOOLEAN NOT NULL DEFAULT FALSE,
    -- state & stats
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_triggers INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_rules_scope_post_id CHECK (
        (scope = 'post' AND facebook_post_id IS NOT NULL) OR
        (scope = 'global' AND facebook_post_id IS NULL)
    ),
    CONSTRAINT comment_rules_keywords_required CHECK (
        trigger_type = 'any' OR cardinality(keywords) > 0
    )
);
CREATE INDEX IF NOT EXISTS idx_comment_rules_lookup ON public.comment_rules(scope, facebook_post_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_comment_rules_channel ON public.comment_rules(channel_id);

-- 6.4 Comment events: one row per incoming comment = live inbox + audit log + dedupe lock
CREATE TABLE IF NOT EXISTS public.comment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    comment_id TEXT NOT NULL UNIQUE,            -- Facebook comment id (dedupe key)
    post_id TEXT,
    parent_comment_id TEXT,                     -- set when it is a reply to another comment
    commenter_id TEXT,
    commenter_name TEXT,
    comment_text TEXT,
    comment_created_at TIMESTAMPTZ,
    decision TEXT NOT NULL DEFAULT 'pending'
        CHECK (decision IN ('pending', 'replied', 'ignored', 'complaint', 'failed', 'manual')),
    ignore_reason TEXT,                         -- e.g. bot_off, post_off, nested_reply, mentions_only, cooldown, no_rule
    matched_rule_id UUID REFERENCES public.comment_rules(id) ON DELETE SET NULL,
    public_reply_text TEXT,
    public_reply_id TEXT,
    replied BOOLEAN NOT NULL DEFAULT FALSE,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    dm_sent BOOLEAN NOT NULL DEFAULT FALSE,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
    handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- staff member for manual actions
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comment_events_created_at ON public.comment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_events_post_id ON public.comment_events(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_events_decision ON public.comment_events(decision);
CREATE INDEX IF NOT EXISTS idx_comment_events_cooldown ON public.comment_events(commenter_id, created_at DESC) WHERE dm_sent = true;


-- ==============================================================================
-- 7. Complaints: link to order, source, comment event; phone optional
-- ==============================================================================
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'messenger';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS comment_event_id UUID REFERENCES public.comment_events(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ALTER COLUMN customer_phone DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_source_check') THEN
        ALTER TABLE public.complaints
            ADD CONSTRAINT complaints_source_check CHECK (source IN ('messenger', 'comment', 'dashboard', 'phone'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_complaints_order_id ON public.complaints(order_id);


-- ==============================================================================
-- 8. Offers: price and image become optional (quick add for the owner)
-- ==============================================================================
ALTER TABLE public.offers ALTER COLUMN price_after DROP NOT NULL;
ALTER TABLE public.offers ALTER COLUMN banner_url DROP NOT NULL;


-- ==============================================================================
-- 9. Copy any existing old comment rules into comment_rules, then drop old tables
-- ==============================================================================
DO $$
BEGIN
    -- 9.1 post_rules -> comment_rules (scope = post) + post_settings preview
    IF to_regclass('public.post_rules') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'post') THEN
        EXECUTE $q$
            INSERT INTO public.comment_rules (
                scope, facebook_post_id, name, trigger_type, keywords, priority,
                reply_enabled, reply_variations, like_comment,
                dm_enabled, dm_message, dm_image_url, dm_buttons,
                is_active, total_triggers, created_at, updated_at
            )
            SELECT
                'post', facebook_post_id, title, match_type,
                CASE WHEN match_type = 'keywords' THEN COALESCE(trigger_keywords, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
                100,
                cardinality(comment_replies) > 0, comment_replies, auto_like_comment,
                dm_message IS NOT NULL AND dm_message <> '', dm_message, dm_image_url, COALESCE(dm_buttons, '[]'::JSONB),
                is_active, total_triggers, created_at, updated_at
            FROM public.post_rules
            WHERE match_type = 'any' OR cardinality(COALESCE(trigger_keywords, ARRAY[]::TEXT[])) > 0
        $q$;

        EXECUTE $q$
            INSERT INTO public.post_settings (facebook_post_id, bot_enabled, post_caption, post_thumbnail_url, post_url)
            SELECT facebook_post_id, true, post_caption, post_thumbnail_url, post_url
            FROM public.post_rules
            ON CONFLICT (facebook_post_id) DO NOTHING
        $q$;
    END IF;

    -- 9.2 global_comment_rules -> comment_rules (scope = global, trigger = any, fallback)
    IF to_regclass('public.global_comment_rules') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global') THEN
        EXECUTE $q$
            INSERT INTO public.comment_rules (
                scope, name, trigger_type, priority,
                reply_enabled, reply_variations, like_comment,
                dm_enabled, dm_message, dm_image_url, dm_buttons, is_active
            )
            SELECT
                'global', 'الرد العام على أي تعليق', 'any', 1000,
                cardinality(comment_replies) > 0, comment_replies, auto_like_comment,
                send_dm, dm_message, dm_image_url, COALESCE(dm_buttons, '[]'::JSONB), is_enabled
            FROM public.global_comment_rules
            LIMIT 1
        $q$;
    END IF;
END $$;

DROP TABLE IF EXISTS public.post_rules;
DROP TABLE IF EXISTS public.global_comment_rules;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.menu_categories;


-- ==============================================================================
-- 10. Fried chicken defaults for the Comment Control Center (only if empty)
-- ==============================================================================
INSERT INTO public.comment_settings (
    sensitive_keywords, complaint_public_reply, complaint_dm_message
)
SELECT
    ARRAY[
        'شكوى', 'شكوي', 'وحش', 'وحشة', 'سيء', 'سئ', 'زفت', 'مقرف', 'معفن', 'ريحة',
        'بارد', 'ساقع', 'نيء', 'ني', 'مش مستوي', 'محروق', 'مزيت', 'زيت كتير', 'ناشف',
        'اتأخر', 'اتاخر', 'متأخر', 'تأخير', 'ناقص', 'غلط', 'مش هو', 'حرام عليكم', 'نصب'
    ],
    'نعتذر جداً لحضرتك 🙏 تواصلنا معاك في الخاص عشان نحل المشكلة فوراً.',
    'أهلاً بحضرتك، إحنا آسفين جداً على اللي حصل 🙏 ممكن توضحلنا المشكلة ورقم الأوردر أو رقم الموبايل اللي طلبت بيه؟ الإدارة هتتواصل معاك فوراً.'
WHERE NOT EXISTS (SELECT 1 FROM public.comment_settings);

-- 10.1 Default global keyword rules: menu / prices, offers
INSERT INTO public.comment_rules (
    scope, name, trigger_type, keywords, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_send_menu, dm_buttons
)
SELECT
    'global', 'طلب المنيو والأسعار', 'keywords',
    ARRAY['منيو', 'المنيو', 'menu', 'قائمة', 'الاسعار', 'الأسعار', 'اسعار', 'أسعار', 'بكام', 'سعر', 'السعر'],
    10,
    true,
    ARRAY[
        'بعتنالك المنيو كامل بالأسعار في الخاص 🍗📩',
        'شوف رسايلك يا فندم، المنيو والأسعار عندك 🔥',
        'تم إرسال المنيو في الخاص، بالهنا مقدماً 😋'
    ],
    true,
    true,
    'أهلاً بحضرتك 🍗 ده المنيو كامل بالأسعار. لو حابب تطلب ابعتلنا الأصناف هنا وإحنا نجهزهالك على طول 🔥',
    true,
    '[{"title": "اطلب دلوقتي 🛵", "payload": "START_ORDER"}, {"title": "العروض 🔥", "payload": "VIEW_OFFERS"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND trigger_type = 'keywords');

INSERT INTO public.comment_rules (
    scope, name, trigger_type, keywords, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_send_offers, dm_buttons
)
SELECT
    'global', 'السؤال عن العروض', 'keywords',
    ARRAY['عرض', 'عروض', 'العرض', 'العروض', 'خصم', 'خصومات', 'offer'],
    20,
    true,
    ARRAY[
        'بعتنالك كل العروض الحالية في الخاص 🔥📩',
        'العروض مستنياك في رسايلك يا فندم 🍗',
        'شوف الخاص، فيه عروض هتعجبك 😍'
    ],
    true,
    true,
    'دي أحدث العروض عندنا 🔥 اختار اللي يعجبك وابعتلنا، وإحنا نجهزهولك على طول 🍗',
    true,
    '[{"title": "اطلب دلوقتي 🛵", "payload": "START_ORDER"}, {"title": "المنيو 🍗", "payload": "VIEW_MENU"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND name = 'السؤال عن العروض');

-- 10.2 Default global fallback ("any" comment)
INSERT INTO public.comment_rules (
    scope, name, trigger_type, priority,
    reply_enabled, reply_variations, like_comment,
    dm_enabled, dm_message, dm_buttons
)
SELECT
    'global', 'الرد العام على أي تعليق', 'any', 1000,
    true,
    ARRAY[
        'نورتنا يا فندم 🍗 بعتنالك التفاصيل في الخاص 📩',
        'شكراً لتعليقك ❤️ شوف رسايلك، بعتنالك كل حاجة',
        'منور دايماً 🔥 رديّنا عليك في الخاص'
    ],
    true,
    true,
    'أهلاً بيك 🍗🔥 نورتنا! تحب تشوف المنيو، العروض، ولا تطلب على طول؟',
    '[{"title": "المنيو 🍗", "payload": "VIEW_MENU"}, {"title": "العروض 🔥", "payload": "VIEW_OFFERS"}, {"title": "كلم موظف 👨‍💼", "payload": "HUMAN_AGENT"}]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.comment_rules WHERE scope = 'global' AND trigger_type = 'any');


-- ==============================================================================
-- 11. Database logic shared by every workflow (triggers)
-- ==============================================================================

-- 11.1 updated_at triggers for new tables
DROP TRIGGER IF EXISTS trg_meta_apps_updated_at ON public.meta_apps;
CREATE TRIGGER trg_meta_apps_updated_at BEFORE UPDATE ON public.meta_apps
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_channels_updated_at ON public.channels;
CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON public.channels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_channel_secrets_updated_at ON public.channel_secrets;
CREATE TRIGGER trg_channel_secrets_updated_at BEFORE UPDATE ON public.channel_secrets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_settings_updated_at ON public.comment_settings;
CREATE TRIGGER trg_comment_settings_updated_at BEFORE UPDATE ON public.comment_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_post_settings_updated_at ON public.post_settings;
CREATE TRIGGER trg_post_settings_updated_at BEFORE UPDATE ON public.post_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_rules_updated_at ON public.comment_rules;
CREATE TRIGGER trg_comment_rules_updated_at BEFORE UPDATE ON public.comment_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comment_events_updated_at ON public.comment_events;
CREATE TRIGGER trg_comment_events_updated_at BEFORE UPDATE ON public.comment_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11.2 Complaint opened on an order -> order becomes "issue"
--      Complaint created for a contact -> pause AI (if bot_settings.auto_pause_on_complaint)
CREATE OR REPLACE FUNCTION public.handle_complaint_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    should_pause BOOLEAN;
BEGIN
    IF NEW.order_id IS NOT NULL AND NEW.status IN ('open', 'in_progress') THEN
        UPDATE public.orders
        SET status = 'issue'
        WHERE id = NEW.order_id AND status = 'confirmed';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.contact_id IS NOT NULL THEN
        SELECT auto_pause_on_complaint INTO should_pause FROM public.bot_settings LIMIT 1;
        IF COALESCE(should_pause, false) THEN
            UPDATE public.contacts SET ai_enabled = false WHERE id = NEW.contact_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaints_side_effects ON public.complaints;
CREATE TRIGGER trg_complaints_side_effects
    AFTER INSERT OR UPDATE OF order_id, status ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_side_effects();

-- 11.3 New order -> contact total_orders + last interaction
CREATE OR REPLACE FUNCTION public.handle_new_order_contact_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.contact_id IS NOT NULL THEN
        UPDATE public.contacts
        SET total_orders = total_orders + 1,
            last_interaction_at = NOW()
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_contact_stats ON public.orders;
CREATE TRIGGER trg_orders_contact_stats
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_contact_stats();

-- 11.4 New message -> contact last interaction; staff reply clears "needs human"
CREATE OR REPLACE FUNCTION public.handle_new_message_contact_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.contacts
    SET last_interaction_at = NEW.created_at,
        needs_human = CASE WHEN NEW.sender_type = 'agent' AND NEW.send_error IS NULL THEN false ELSE needs_human END
    WHERE id = NEW.contact_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_contact_state ON public.messages;
CREATE TRIGGER trg_messages_contact_state
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_contact_state();

-- 11.5 needs_human_at follows needs_human
CREATE OR REPLACE FUNCTION public.handle_contact_needs_human()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.needs_human AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.needs_human, false)) THEN
        NEW.needs_human_at = NOW();
    ELSIF NOT NEW.needs_human THEN
        NEW.needs_human_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_needs_human ON public.contacts;
CREATE TRIGGER trg_contacts_needs_human
    BEFORE INSERT OR UPDATE OF needs_human ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.handle_contact_needs_human();

-- 11.6 Restaurant name for all staff (bot_settings itself stays admin-only)
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT json_build_object('restaurant_name', restaurant_name)
    FROM public.bot_settings
    WHERE public.is_active_staff(auth.uid())
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO authenticated, service_role;


-- ==============================================================================
-- 12. Row-Level Security & privileges for new tables
-- ==============================================================================
ALTER TABLE public.meta_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_events ENABLE ROW LEVEL SECURITY;

-- 12.1 Privileges: secret tables are invisible to browser roles entirely
REVOKE ALL ON public.meta_apps, public.channel_secrets FROM anon, authenticated;
GRANT ALL ON public.meta_apps, public.channel_secrets TO service_role;

REVOKE ALL ON public.channels, public.comment_settings, public.post_settings,
              public.comment_rules, public.comment_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels, public.comment_settings, public.post_settings,
              public.comment_rules, public.comment_events TO authenticated;
GRANT ALL ON public.channels, public.comment_settings, public.post_settings,
             public.comment_rules, public.comment_events TO service_role;

-- 12.2 meta_apps & channel_secrets: service role only
DROP POLICY IF EXISTS "Service role full access on meta_apps" ON public.meta_apps;
CREATE POLICY "Service role full access on meta_apps"
ON public.meta_apps FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on channel_secrets" ON public.channel_secrets;
CREATE POLICY "Service role full access on channel_secrets"
ON public.channel_secrets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.3 channels: all active staff can read (names / status); writes via server routes only
DROP POLICY IF EXISTS "Active staff read channels" ON public.channels;
CREATE POLICY "Active staff read channels"
ON public.channels FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on channels" ON public.channels;
CREATE POLICY "Service role full access on channels"
ON public.channels FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.4 comment_settings, post_settings, comment_rules: admin manages, support agent reads
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['comment_settings', 'post_settings', 'comment_rules'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin full access on %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Admin full access on %1$s" ON public.%1$I FOR ALL TO authenticated
            USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
            WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
        $p$, t);

        EXECUTE format('DROP POLICY IF EXISTS "Support agent read %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Support agent read %1$s" ON public.%1$I FOR SELECT TO authenticated
            USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
        $p$, t);

        EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %1$s" ON public.%1$I', t);
        EXECUTE format($p$
            CREATE POLICY "Service role full access on %1$s" ON public.%1$I FOR ALL TO service_role
            USING (true) WITH CHECK (true)
        $p$, t);
    END LOOP;
END $$;

-- 12.5 comment_events: admin full, support agent read + update (manual reply / hide)
DROP POLICY IF EXISTS "Admin full access on comment_events" ON public.comment_events;
CREATE POLICY "Admin full access on comment_events"
ON public.comment_events FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'admin' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent read comment_events" ON public.comment_events;
CREATE POLICY "Support agent read comment_events"
ON public.comment_events FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent update comment_events" ON public.comment_events;
CREATE POLICY "Support agent update comment_events"
ON public.comment_events FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role full access on comment_events" ON public.comment_events;
CREATE POLICY "Service role full access on comment_events"
ON public.comment_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12.6 Cross-links between orders, complaints and chat
-- Order agents: see complaints (to show "open complaint" on orders) and open the customer chat from an order
DROP POLICY IF EXISTS "Order agent select on complaints" ON public.complaints;
CREATE POLICY "Order agent select on complaints"
ON public.complaints FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent select on messages" ON public.messages;
CREATE POLICY "Order agent select on messages"
ON public.messages FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent insert on messages" ON public.messages;
CREATE POLICY "Order agent insert on messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Order agent update on contacts" ON public.contacts;
CREATE POLICY "Order agent update on contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'order_agent' AND public.is_active_staff(auth.uid()));

-- Support agents: see orders (to open the order linked to a complaint)
DROP POLICY IF EXISTS "Support agent select on orders" ON public.orders;
CREATE POLICY "Support agent select on orders"
ON public.orders FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent update on orders" ON public.orders;
CREATE POLICY "Support agent update on orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()))
WITH CHECK (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Support agent select on order_items" ON public.order_items;
CREATE POLICY "Support agent select on order_items"
ON public.order_items FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'support_agent' AND public.is_active_staff(auth.uid()));


-- ==============================================================================
-- 13. Realtime: live comment inbox
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_rel pr
           JOIN pg_publication p ON p.oid = pr.prpubid
           JOIN pg_class c ON c.oid = pr.prrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'comment_events'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_events;
    END IF;
END $$;

ALTER TABLE public.comment_events REPLICA IDENTITY FULL;


-- ==============================================================================
-- Done. Next: run 05_create_admin.sql (if you have not created your admin yet).
-- ==============================================================================




-- =============================================================================
-- 06 · Patch: meta_apps.login_config_id
-- -----------------------------------------------------------------------------
-- This column was added to 04_v2_upgrade.sql after you had already run 04, so
-- your database is missing it. Without it, saving a Meta app in /channels fails with:
--   "Could not find the 'login_config_id' column of 'meta_apps' in the schema cache"
--
-- Safe to run more than once. It does not touch any existing data.
-- Run it in Supabase → SQL Editor.
-- =============================================================================

-- Facebook Login for Business apps use a Configuration ID instead of a scope list
-- (NULL = classic scope login)
ALTER TABLE public.meta_apps ADD COLUMN IF NOT EXISTS login_config_id TEXT;

-- Make PostgREST (the Supabase API) pick up the new column right away
NOTIFY pgrst, 'reload schema';




-- =============================================================================
-- 07 · Patch: comment_settings.ai_enabled & comment_settings.ai_system_prompt
-- -----------------------------------------------------------------------------
-- Adds AI Moderation and Dynamic Reply control for Facebook Comments.
-- Enables the AI Comment Agent to evaluate comment intent, automatically hide spam,
-- answer customer inquiries using the restaurant menu/prices, and detect complaints.
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;

-- Set a rich, Egyptian fried chicken default prompt if currently empty
UPDATE public.comment_settings
SET ai_system_prompt = 
'أنت المساعد الذكي لمطعم فراخ مقلية (بروستد وكريسبي)، ومسؤول عن الرد على تعليقات العملاء على منشورات فيسبوك وإدارتها باحترافية.

## شخصيتك وأسلوبك:
- لهجة مصرية ودودة، سريعة، تشهي العميل (يا فندم، نورتنا، بالهنا والشفا، ألف هنا).
- الردود قصيرة ومباشرة (من سطر لسطرين فقط وبدون إطالة).
- ممنوع استخدام تنسيقات Markdown (لا تستخدم نجوم ** أو هاشتاجات #) لأنها لا تظهر بشكل صحيح في تعليقات فيسبوك.

## مهامك في تحليل كل تعليق وتحديد القرار (JSON):
1. **الاستفسار عن الأسعار أو المنيو (inquiry):**
   - رد بلباقة واذكر السعر بدقة إذا كان مذكوراً في قائمة الأسعار، وشجع العميل.
   - إذا سأل عن المنيو أو تفاصيل كثيرة، اذكر له أنك أرسلت له المنيو والعروض في رسالة خاصة (send_dm: true).
2. **المدح والإشادة (praise):**
   - اشكر العميل بحرارة وتمنّى له أوقات سعيدة دائماً.
3. **الشكاوى والاستياء (complaint):**
   - اعتذر بأعلى درجات الأدب والاهتمام.
   - حدد is_complaint: true و notify_staff: true لفتح تذكرة فورية وإبلاغ الإدارة على تليجرام.
   - إذا كانت الشكوى شديدة أو بها غضب، اجعل should_hide: true لحماية سمعة الصفحة حتى تتواصل معه الإدارة في الخاص.
4. **السب أو الإعلانات أو الروابط المضللة (spam_abuse):**
   - اجعل should_hide: true فوراً بدون رد علني (public_reply: null) وبدون رسائل خاصة.

## المخرجات المطلوبة دائماً (JSON Schema):
{
  "intent": "inquiry" | "complaint" | "spam_abuse" | "praise" | "general",
  "should_hide": boolean,
  "public_reply": string | null,
  "send_dm": boolean,
  "dm_message": string | null,
  "is_complaint": boolean,
  "notify_staff": boolean
}'
WHERE ai_system_prompt IS NULL OR ai_system_prompt = '';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';




-- =============================================================================
-- 06 · Patch: meta_apps.login_config_id
-- -----------------------------------------------------------------------------
-- This column was added to 04_v2_upgrade.sql after you had already run 04, so
-- your database is missing it. Without it, saving a Meta app in /channels fails with:
--   "Could not find the 'login_config_id' column of 'meta_apps' in the schema cache"
--
-- Safe to run more than once. It does not touch any existing data.
-- Run it in Supabase → SQL Editor.
-- =============================================================================

-- Facebook Login for Business apps use a Configuration ID instead of a scope list
-- (NULL = classic scope login)
ALTER TABLE public.meta_apps ADD COLUMN IF NOT EXISTS login_config_id TEXT;

-- Make PostgREST (the Supabase API) pick up the new column right away
NOTIFY pgrst, 'reload schema';






UPDATE public.comment_settings
SET ai_system_prompt = 
'أنت المشرف الذكي وممثل خدمة العملاء لمطعم فراخ مقلية وبروستد كريسبي في مصر. تتميز بالود، اللهجة المصرية الدارجة السريعة والمحترمة، واستخدام الإيموجي المناسب (🍗🔥🛵❤️).

مهمتك تحليل كل تعليق واتخاذ القرارات التالية فقط:

### 1. قواعد القرار (decision):
- اختر (DELETE): إذا احتوى التعليق على سباب، ألفاظ خارجة، إعلانات، روابط، ترويج لمنافسين، أو تعليق هجومي مسيء جداً.
- اختر (KEEP): لجميع التعليقات الأخرى (استفسار عن أسعار، منيو، عروض، مجاملة، منشن أصدقاء، أسئلة فروع وتوصيل).

### 2. الشكاوى (is_complaint):
- اجعلها true: إذا اشتكى العميل من تجربة سيئة (أكل بارد، تأخير أوردر، طلب ناقص، زيت كتير، مش مستوي).
- اجعلها false: في أي تعليق عادي أو استفسار.

### 3. الرد العلني (public_reply):
- اكتب ردك باللهجة المصرية (سطر إلى سطرين وبدون تنسيقات نجوم أو ماركداون).
- إذا كان القرار DELETE: اتركه فارغاً "".

### 4. الرسالة الخاصة (send_dm & dm_message):
- اجعل send_dm: true واكتب رسالة خاصة مناسبة في dm_message إذا:
  * كان التعليق شكوى (اعتذر باهتمام واطلب رقم الموبايل أو رقم الأوردر فوراً).
  * طلب العميل المنيو أو تفاصيل كثيرة ومفصلة.
- في غير ذلك، اجعل send_dm: false و dm_message: "".

### صيغة الإخراج الإلزامية (JSON فقط):
{
  "decision": "KEEP" | "DELETE",
  "is_complaint": true | false,
  "public_reply": "نص الرد العام هنا",
  "send_dm": true | false,
  "dm_message": "نص الرسالة الخاصة هنا"
}';






-- =============================================================================
-- 08 · Patch: Dynamic Action Assets & Images for Comment AI Bot
-- -----------------------------------------------------------------------------
-- Adds `action_assets` JSONB array to `comment_settings` so staff can configure
-- arbitrary named actions and attach images (e.g. menu, branches, offers, wheel, etc.)
-- with custom intent descriptions that are dynamically fed to the AI bot in n8n.
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

-- 1. Add action_assets JSONB array to comment_settings
ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS action_assets JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Also retain legacy image columns for compatibility
ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS branches_image_url TEXT,
  ADD COLUMN IF NOT EXISTS menu_image_url TEXT,
  ADD COLUMN IF NOT EXISTS offers_image_url TEXT;

-- 2. Populate default action assets if action_assets is currently empty
UPDATE public.comment_settings
SET action_assets = jsonb_build_array(
  jsonb_build_object(
    'id', 'branches',
    'name', 'branches',
    'label', 'عناوين وفروع المطعم',
    'description', 'إذا سأل العميل عن الفروع، أماكن التواجد، العناوين، أو هل ليكم فرع في منطقة معينة',
    'image_url', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800'
  ),
  jsonb_build_object(
    'id', 'menu',
    'name', 'menu',
    'label', 'قائمة المنيو والأسعار',
    'description', 'إذا طلب العميل المنيو، قائمة الطعام، أسعار الوجبات، أو صور الأصناف',
    'image_url', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
  ),
  jsonb_build_object(
    'id', 'offers',
    'name', 'offers',
    'label', 'عروض التوفير والخصومات',
    'description', 'إذا سأل العميل عن العروض، الخصومات الحالية، عروض التوفير، أو وجبات التوفير',
    'image_url', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800'
  )
)
WHERE action_assets IS NULL OR jsonb_array_length(action_assets) = 0;

-- 3. Update the AI System Prompt with the dynamic action evaluation instructions
UPDATE public.comment_settings
SET ai_system_prompt = 
'أنت المشرف الذكي وممثل خدمة العملاء لمطعم فراخ مقلية وبروستد كريسبي في مصر. تتميز بالود، اللهجة المصرية الدارجة السريعة والمحترمة، واستخدام الإيموجي المناسب (🍗🔥🛵❤️).

مهمتك تحليل كل تعليق وتحديد الإجراء المطلوب والرد المناسب.

### 1. تحديد القرار (decision):
- اختر (DELETE): إذا احتوى التعليق على سباب، ألفاظ خارجة، إعلانات، روابط، ترويج لمنافسين، أو تعليق هجومي مسيء جداً.
- اختر (KEEP): لجميع التعليقات الأخرى المقبولة.

### 2. تحديد نوع الإجراء والصورة المرفقة (action):
- اختر "normal": لأي تعليق عام، استفسار عادي، شكر ومجاملة، أو سؤال لا يحتاج صورة مرفقة في الكومنت.
- اختر اسم الإجراء المناسب من قائمة الإجراءات المحددة في النظام بناءً على قصد العميل (مثل branches إذا سأل عن الفروع، menu إذا طلب المنيو، offers إذا سأل عن العروض، إلخ). سيقوم النظام بإرفاق الصورة المخصصة لهذا الإجراء تلقائياً مع الرد.

### 3. الشكاوى (is_complaint):
- اجعلها true: إذا اشتكى العميل من تجربة سيئة (أكل بارد، تأخير في التوصيل، أوردر ناقص، فراخ مش مستوية).
- اجعلها false: في أي تعليق عادي أو استفسار.

### 4. الرد العلني (public_reply):
- اكتب ردك بأسلوب جذاب باللهجة المصرية (سطر إلى سطرين).
- إذا كان action ليس "normal" (أي يتضمن صورة مرفقة كالفروع أو المنيو أو العروض)، أشر في الرد باختصار إلى أن التفاصيل موضحة في الصورة المرفقة بالتعليق.
- إذا كان القرار DELETE: اتركه فارغاً "".

### 5. الرسالة الخاصة (send_dm & dm_message):
- اجعل send_dm: true واكتب رسالة خاصة لطيفة في dm_message لتشجيع العميل على الطلب أو حل مشكلته إذا كان تعليقه شكوى أو طلباً خاصاً.

### صيغة الإخراج الإلزامية (JSON فقط بدون أي نص إضافي):
{
  "decision": "KEEP" | "DELETE",
  "action": "normal" | "<اسم_الإجراء>",
  "is_complaint": true | false,
  "public_reply": "نص الرد العام هنا",
  "send_dm": true | false,
  "dm_message": "نص الرسالة الخاصة هنا"
}'
WHERE ai_system_prompt IS NOT NULL;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';






-- =============================================================================
-- 09 · Patch: comment_settings.fallback_dm_message
-- -----------------------------------------------------------------------------
-- Adds `fallback_dm_message` to `comment_settings` so restaurant staff can
-- customize the default private Messenger greeting sent to customers who comment.
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS fallback_dm_message TEXT 
  DEFAULT 'أهلاً بحضرتك يا فندم نورتنا! 🍗 تقدر تطلب أو تستفسر عن أي حاجة من هنا مباشرة 🛵';

UPDATE public.comment_settings
SET fallback_dm_message = 'أهلاً بحضرتك يا فندم نورتنا! 🍗 تقدر تطلب أو تستفسر عن أي حاجة من هنا مباشرة 🛵'
WHERE fallback_dm_message IS NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';





-- =============================================================================
-- 10 · Patch: Post Rule Enhancements & Uniqueness
-- -----------------------------------------------------------------------------
-- 1. Adds `comment_image_url` for attaching images in public Facebook comment replies.
-- 2. Adds `delete_keywords` and `auto_delete` for automatic deletion/hiding on toxic words.
-- 3. Enforces one active rule per post (UNIQUE index on facebook_post_id for post scope).
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

-- 1. Add comment_image_url, delete_keywords, and auto_delete columns
ALTER TABLE public.comment_rules 
  ADD COLUMN IF NOT EXISTS comment_image_url TEXT,
  ADD COLUMN IF NOT EXISTS delete_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS auto_delete BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Deduplicate any existing duplicate rules per post before creating the unique index
DELETE FROM public.comment_rules a
USING public.comment_rules b
WHERE a.scope = 'post' 
  AND b.scope = 'post'
  AND a.facebook_post_id = b.facebook_post_id 
  AND a.facebook_post_id IS NOT NULL
  AND a.id > b.id;

-- 3. Enforce strictly ONE rule per Facebook Post
DROP INDEX IF EXISTS idx_comment_rules_post_unique;
CREATE UNIQUE INDEX idx_comment_rules_post_unique 
  ON public.comment_rules(facebook_post_id) 
  WHERE scope = 'post' AND facebook_post_id IS NOT NULL;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';






-- =============================================================================
-- 11 · Messenger Queue (Debounce & Message Aggregation)
-- -----------------------------------------------------------------------------
-- Stores incoming user messages temporarily during a 10-second debounce window.
-- When a user sends rapid sequential messages, they are aggregated into one combined prompt.
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.queue (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by sender (PSID)
CREATE INDEX IF NOT EXISTS idx_queue_sender_id ON public.queue(sender_id);

-- Optional: auto-clean queue messages older than 1 hour just in case
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON public.queue(created_at);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';






-- ==============================================================================
-- 12_owner_requirements_upgrade.sql
-- Al-Khedewy Restaurant Bot & Dashboard - Owner Requirements Migration
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






-- ==============================================================================
-- 13_seed_branches_and_zones.sql
-- Seed sample branches, delivery zones, and promotional offers for Al-Khedewy Restaurant
-- Safe & Idempotent (will not create duplicates if run multiple times)
-- ==============================================================================

DO $$
DECLARE
    v_branch_wust_elbalad UUID;
    v_branch_nasr_city UUID;
    v_branch_maadi UUID;
BEGIN
    -- =========================================================================
    -- 1. الفروع ومناطق التوصيل (Branches & Delivery Zones)
    -- =========================================================================

    -- [1] فرع وسط البلد
    SELECT id INTO v_branch_wust_elbalad FROM public.branches WHERE name = 'فرع وسط البلد' LIMIT 1;
    IF v_branch_wust_elbalad IS NULL THEN
        INSERT INTO public.branches (name, phone, address, google_maps_url, is_active)
        VALUES (
            'فرع وسط البلد',
            '01012345671',
            '25 شارع طلعت حرب، وسط البلد، القاهرة',
            'https://maps.google.com/?q=Talaat+Harb+Street+Cairo',
            true
        ) RETURNING id INTO v_branch_wust_elbalad;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_wust_elbalad AND zone_name = 'وسط البلد وعابدين') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_wust_elbalad, 'وسط البلد وعابدين', 15.00, '30 - 40 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_wust_elbalad AND zone_name = 'الزمالك') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_wust_elbalad, 'الزمالك', 25.00, '35 - 45 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_wust_elbalad AND zone_name = 'الدقي والمهندسين') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_wust_elbalad, 'الدقي والمهندسين', 25.00, '40 - 50 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_wust_elbalad AND zone_name = 'المنيل وجاردن سيتي') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_wust_elbalad, 'المنيل وجاردن سيتي', 20.00, '30 - 45 دقيقة', true);
    END IF;


    -- [2] فرع مدينة نصر
    SELECT id INTO v_branch_nasr_city FROM public.branches WHERE name = 'فرع مدينة نصر' LIMIT 1;
    IF v_branch_nasr_city IS NULL THEN
        INSERT INTO public.branches (name, phone, address, google_maps_url, is_active)
        VALUES (
            'فرع مدينة نصر',
            '01012345672',
            '45 شارع عباس العقاد، بجوار الجامعة العمالية، مدينة نصر',
            'https://maps.google.com/?q=Abbas+El+Akkad+Nasr+City',
            true
        ) RETURNING id INTO v_branch_nasr_city;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_nasr_city AND zone_name = 'مدينة نصر (أول وثان)') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_nasr_city, 'مدينة نصر (أول وثان)', 20.00, '30 - 45 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_nasr_city AND zone_name = 'مصر الجديدة') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_nasr_city, 'مصر الجديدة', 25.00, '35 - 50 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_nasr_city AND zone_name = 'التجمع الأول والخامس') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_nasr_city, 'التجمع الأول والخامس', 35.00, '45 - 60 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_nasr_city AND zone_name = 'شيراتون والنزهة') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_nasr_city, 'شيراتون والنزهة', 25.00, '40 - 50 دقيقة', true);
    END IF;


    -- [3] فرع المعادي
    SELECT id INTO v_branch_maadi FROM public.branches WHERE name = 'فرع المعادي' LIMIT 1;
    IF v_branch_maadi IS NULL THEN
        INSERT INTO public.branches (name, phone, address, google_maps_url, is_active)
        VALUES (
            'فرع المعادي',
            '01012345673',
            '12 شارع النصر، دجلة المعادي، القاهرة',
            'https://maps.google.com/?q=Degla+Maadi+Cairo',
            true
        ) RETURNING id INTO v_branch_maadi;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_maadi AND zone_name = 'المعادي ودجلة') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_maadi, 'المعادي ودجلة', 15.00, '25 - 40 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_maadi AND zone_name = 'زهراء المعادي') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_maadi, 'زهراء المعادي', 20.00, '30 - 45 دقيقة', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE branch_id = v_branch_maadi AND zone_name = 'المقطم والهضبة') THEN
        INSERT INTO public.branch_delivery_zones (branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active)
        VALUES (v_branch_maadi, 'المقطم والهضبة', 30.00, '40 - 55 دقيقة', true);
    END IF;


    -- =========================================================================
    -- 2. عروض ترويجية تجريبية (Sample Offers)
    -- =========================================================================
    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE title = 'عرض التوفير — 4 قطع بروستد') THEN
        INSERT INTO public.offers (title, description, price_before, price_after, is_active, start_date)
        VALUES (
            'عرض التوفير — 4 قطع بروستد',
            '4 قطع دجاج بروستد مقرمش + بطاطس حجم وسط + كول سلو + خبز طازج + كولا',
            140.00,
            110.00,
            true,
            now()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE title = 'وجبة الملوك — 8 قطع بروستد') THEN
        INSERT INTO public.offers (title, description, price_before, price_after, is_active, start_date)
        VALUES (
            'وجبة الملوك — 8 قطع بروستد',
            '8 قطع دجاج مقرمش (عادي أو حار) + بطاطس عائلي + 2 كول سلو + 4 خبز + لتر كولا',
            270.00,
            220.00,
            true,
            now()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE title = 'عرض دابل كرانشي استربس') THEN
        INSERT INTO public.offers (title, description, price_before, price_after, is_active, start_date)
        VALUES (
            'عرض دابل كرانشي استربس',
            '6 قطع استربس دجاج مقرمش + صوص جبنة شيدر + بطاطس + كانز',
            120.00,
            95.00,
            true,
            now()
        );
    END IF;

END $$;





-- ==============================================================================
-- 15_chicken_maraei_branding.sql
-- Branding update for Chicken Maraei (تشيكن مراعي)
-- Updates restaurant_name, price_list, ai_system_prompt, and the 6 official branches
-- ==============================================================================

-- 1. تحديث إعدادات البوت والاسم وقائمة الأسعار المعتمدة
UPDATE public.bot_settings
SET 
    restaurant_name = 'تشيكن مراعي',
    ai_system_prompt = 'أنت المساعد الذكي وممثل خدمة العملاء لمطعم تشيكن مراعي - Chicken Maraei (بروستد وكريسبي وبرجر لأكيلة مراعي) على فيسبوك ماسنجر 🍗👑.
تتحدث بلهجة مصرية ودودة ومهذبة ("يا فندم"، "تحت أمرك"، "منورنا"، "بالهنا والشفا مقدماً").

مهامك الأساسية:
1. الترحيب بالعملاء وعرض المنيو والعروض الترويجية الحالية عند الطلب (الخط الساخن الموحد 17330).
2. مساعدة العميل في اختيار الوجبات (بروستد، استربس، ميكس، برجر بيف ودجاج، بطاطس، صوصات) والإجابة عن استفسارات الأسعار بدقة تامة من المنيو.
3. جمع بيانات الأوردر خطوة بخطوة: الأصناف والكميات -> الفرع المختار -> منطقة التوصيل -> اسم العميل -> رقم الموبايل -> العنوان التفصيلي.
4. عرض ملخص شامل للطلب مع الإجمالي النهائي شاملاً التوصيل، وانتظار موافقة وتأكيد العميل الصريحة قبل تسجيل الأوردر.
5. في حالة الشكاوى: الاعتذار بلباقة شديدة، الاستفسار عن تفاصيل المشكلة وطلب رقم هاتف العميل، وتأكيد تحويل المشكلة للمدير لحلها فوراً (لا تُسجل الشكوى إلا بعد أخذ تفاصيل المشكلة ورقم الهاتف معاً).

قواعد صارمة:
- لا تخترع أي سعر أو صنف غير موجود في قائمة الأسعار أو العروض المعتمدة.
- لا تذكر أي مصطلحات تقنية (مثل JSON أو AI أو بوت أو intent) داخل الردود.
- في حالة طلب التحدث مع إنسان أو خدمة العملاء: اطلب منه الاسم ورقم الموبايل وموضوع الاستفسار ليتواصل معه المسؤول هاتفياً، ولا تقل أبداً "لحظات وأحولك" أو "انتظر" حتى لا ينتظر العميل بدون جدوى.',
    price_list = '# منيو وقائمة أسعار تشيكن مراعي (Chicken Maraei) 🍗👑
> **الخط الساخن:** 17330 | **الشعار:** لأكيلة مراعي 🍟🔥

## 🍗 وجبات البروست (Broast Meals)
*مع بطاطس، خبز، كلوسلو أو تومية، وكاتشب*
- **سناك بوكس (2 قطعة)**: 140 ج.م
- **دينر بوكس (3 قطع)**: 195 ج.م
- **سوبر دينر بوكس (4 قطع)**: 240 ج.م
- **مراعي دينر بوكس (5 قطع)**: 310 ج.م
- **فاملي بوكس (9 قطع)**: 540 ج.م
- **شير بوكس (12 قطعة)**: 675 ج.م
- **مراعي فاملي بوكس (15 قطعة)**: 790 ج.م
- **بارتي بوكس (21 قطعة)**: 1125 ج.م

## 🍟 وجبات استربس (Strips Meals)
*مع بطاطس، خبز، كلوسلو أو تومية، وكاتشب*
- **وجبة استربس 3 قطع**: 130 ج.م
- **وجبة استربس 5 قطع**: 180 ج.م
- **وجبة استربس 10 قطع**: 350 ج.م
- **وجبة استربس 15 قطعة**: 500 ج.م

## 🍗🍟 وجبات ميكس (دجاج + استربس)
- **ميكس 2 قطعة دجاج + 2 استربس**: 210 ج.م
- **ميكس 3 قطع دجاج + 3 استربس**: 295 ج.م
- **ميكس 5 قطع دجاج + 5 استربس**: 450 ج.م

## 💰 وجبات التوفير (دجاج + خبز)
- **وجبة سناك التوفير (2 قطعة دجاج)**: 125 ج.م
- **وجبة دينر التوفير (3 قطع دجاج)**: 175 ج.م
- **وجبة مراعي التوفير (8 قطع دجاج)**: 450 ج.م

## 🍚 وجبات الأرز والريزو
- **أرز دجاج (2 قطعة بروست + أرز مبهر كبير + تومية + بطاطس)**: 165 ج.م
- **أرز استربس (4 قطع استربس + أرز مبهر كبير + تومية + بطاطس)**: 165 ج.م
- **ريزو مراعي (سبايسي أو باربكيو)**: 85 ج.م

## 🥪 سندوتشات فرايد تشيكن المميزة
- **تشيكن زنجر**: سنجل 100 ج.م / دبل 150 ج.م
- **تشيكن سوبريم (مع تركي وجبنة)**: سنجل 115 ج.م / دبل 170 ج.م
- **تشيكن هالبينو (سبايسي)**: سنجل 110 ج.م / دبل 160 ج.م
- **تويستر رول استربس**: 85 ج.م
- **فاير جن (مع شيدر هالبينو وصوص تايجر)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **جودزيلا ستيكس (مع أصابع موتزاريلا)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **مراعي بوووم (مع روزبيف وتكساس)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **بركان مراعي (3 طبقات كرسبي وغرقان شيدر)**: تريبل 215 ج.م
- **مراعي ميكس (بيف برجر + دجاج كرسبي)**: 175 ج.م

## 🥖 ساندوتشات فرنساوي
- **ميجا زنجر فرنساوي**: 125 ج.م
- **ميجا سوبريم فرنساوي**: 140 ج.م
- **بيج فيلر مراعي فرنساوي**: 140 ج.م
- **بطاطس سوري**: 35 ج.م

## 🍔 ساندوتشات بيف برجر مشوي
- **كلاسيك كينج**: سنجل (150جم) 115 ج.م / دبل (300جم) 195 ج.م / محشو جبنة (250جم) 195 ج.م
- **مراعي كينج**: سنجل 135 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م
- **ستيكس كينج (مع موتزاريلا ستيكس)**: سنجل 140 ج.م / دبل 205 ج.م / محشو جبنة 205 ج.م
- **هالبينو كينج**: سنجل 120 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م
- **رينجز كينج (مع حلقات بصل)**: سنجل 125 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م

## 🍔 ساندوتشات تشيكن برجر
- **تشيز برجر**: سنجل 110 ج.م / دبل 160 ج.م / تريبل 205 ج.م
- **ستيكس برجر**: سنجل 120 ج.م / دبل 165 ج.م / تريبل 215 ج.م
- **رينجز برجر**: سنجل 110 ج.م / دبل 160 ج.م / تريبل 205 ج.م

## 🍟 بطاطس وسناكس وإضافات
- **فرايز مراعي (صوص جبنة + استربس)**: 60 ج.م
- **فرايز تشيز (صوص جبنة)**: 50 ج.م
- **فرايز هالبينو (جبنة + هالبينو)**: 55 ج.م
- **باكت بطاطس**: صغير 20 ج.م / كبير 35 ج.م
- **3 أصابع موتزاريلا + صوص جبنة**: 55 ج.م
- **4 حلقات بصل مقرمشة + صوص باربكيو**: 45 ج.م
- **3 أصابع شيدر هالبينو + صوص تايجر**: 55 ج.م
- **أرز مبهر**: صغير 25 ج.م / كبير 35 ج.م
- **كلوسلو**: صغير 20 ج.م / كبير 35 ج.م
- **تومية**: 15 ج.م | **جار جبنة**: 85 ج.م
- **قطعة بروست**: 75 ج.م | **قطعة استربس**: 45 ج.م
- **أي صوص إضافي (شيدر، باربكيو، تايجر، تاي شيلي، رانش، تكساس، 1000 جزيرة)**: 25 ج.م

## 🍔🍟 عروض الكومبو
- **كومبو 1 (فرايز + كانز)**: 35 ج.م
- **كومبو 2 (فرايز + كانز + كلوسلو)**: 50 ج.م

## 👶 وجبات الأطفال
- **وجبة دجاج أو استربس (دبوس أو 2 استربس + بطاطس + عصير + لعبة)**: 130 ج.م
- **وجبة تشيكن برجر (ساندوتش + بطاطس + عصير + لعبة)**: 140 ج.م

## 🍫 عرض الحلو
- **شوكو بامب (نوتيلا / وايت / لوتس)**: 40 ج.م
- **عرض 3 شوكو بامب**: 100 ج.م
- **عرض 6 شوكو بامب**: 180 ج.م

## 🥤 المشروبات
- **مياه صغيرة**: 10 ج.م | **كانز**: 20 ج.م | **عصير**: 20 ج.م | **1 لتر**: 35 ج.م

---
📍 **الفروع:** فيصل • إمبابة • حدائق أكتوبر • الهرم • الوراق • السيدة زينب  
📞 **الخط الساخن:** 17330',
    updated_at = NOW()
WHERE id IS NOT NULL;


-- 2. إدخال وتحديث الفروع الستة الرسمية لمطعم تشيكن مراعي
-- استخدام كود آمن ومحمي 100% يعمل بدون اشتراط وجود قيد فريد (Unique Constraint) مسبق
DO $$
DECLARE
    r RECORD;
    v_branches jsonb := '[
        {"name": "فرع فيصل", "phone": "17330", "address": "شارع جلال - قرية اللوتس - اللبيني - فيصل"},
        {"name": "فرع إمبابة", "phone": "17330", "address": "156 شارع إمبابة الرياضي - مدينة التحرير - إمبابة"},
        {"name": "فرع حدائق أكتوبر", "phone": "17330", "address": "الممشى السياحي - أمام مول الحسن - حدائق أكتوبر"},
        {"name": "فرع الهرم", "phone": "17330", "address": "49 شارع الهنيدي مع خاتم المرسلين - الهرم"},
        {"name": "فرع الوراق", "phone": "17330", "address": "بنزينة الوطنية - سنترال وراق العرب - الوراق"},
        {"name": "فرع السيدة زينب", "phone": "17330", "address": "حديقة أم هاشم - من ميدان السيدة زينب"}
    ]'::jsonb;
BEGIN
    FOR r IN SELECT * FROM jsonb_to_recordset(v_branches) AS x(name text, phone text, address text)
    LOOP
        UPDATE public.branches 
        SET phone = r.phone, address = r.address, is_active = true, updated_at = now()
        WHERE name = r.name;
        
        IF NOT FOUND THEN
            INSERT INTO public.branches (name, phone, address, is_active)
            VALUES (r.name, r.phone, r.address, true);
        END IF;
    END LOOP;
END $$;




-- 1. Allow modification staging rows to share the original order's order_number
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 2. Let the BEFORE INSERT trigger control when the sequence advances
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

-- 3. Smart trigger: only advance sequence for real new orders; inherit original number for modifications
CREATE OR REPLACE FUNCTION public.assign_sequential_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_orig_order_number BIGINT;
  v_clean_phone TEXT;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.customer_notes, '') LIKE '%تعديل على الأوردر المؤكد%'
     OR COALESCE(NEW.payment_method, '') IN ('mod_merged', 'mod_declined') THEN

    v_clean_phone := RIGHT(REGEXP_REPLACE(COALESCE(NEW.customer_phone, ''), '\D', '', 'g'), 9);

    SELECT o.order_number
      INTO v_orig_order_number
      FROM public.orders o
     WHERE o.created_at >= (NOW() - INTERVAL '18 hours')
       AND COALESCE(o.customer_notes, '') NOT LIKE '%تعديل على الأوردر المؤكد%'
       AND COALESCE(o.payment_method, '') NOT IN ('mod_merged', 'mod_declined')
       AND COALESCE(o.status::text, '') <> 'cancelled'
       AND (
         (NEW.contact_id IS NOT NULL AND o.contact_id = NEW.contact_id)
         OR (LENGTH(v_clean_phone) >= 8 AND RIGHT(REGEXP_REPLACE(COALESCE(o.customer_phone, ''), '\D', '', 'g'), 9) = v_clean_phone)
       )
     ORDER BY o.created_at DESC
     LIMIT 1;

    IF v_orig_order_number IS NOT NULL THEN
      NEW.order_number := v_orig_order_number;
      RETURN NEW;
    END IF;
  END IF;

  NEW.order_number := nextval('public.orders_order_number_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sequential_order_number ON public.orders;
CREATE TRIGGER trg_assign_sequential_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sequential_order_number();



-- ==============================================================================
-- 08_n8n_tables.sql
-- Creates the n8n operational tables (queue, n8n_chat_histories, n8n_chat_histories1)
-- required by the n8n Messenger workflow on Self-Hosted Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.queue (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_sender_id ON public.queue(sender_id);

CREATE TABLE IF NOT EXISTS public.n8n_chat_histories (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_id ON public.n8n_chat_histories(session_id);

CREATE TABLE IF NOT EXISTS public.n8n_chat_histories1 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories1_session_id ON public.n8n_chat_histories1(session_id);
