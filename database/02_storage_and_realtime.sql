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

