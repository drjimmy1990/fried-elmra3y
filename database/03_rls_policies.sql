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
