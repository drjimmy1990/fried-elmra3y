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
