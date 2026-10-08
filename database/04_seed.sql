-- ==============================================================================
-- 04_seed.sql: Default Master Configuration, Rules & Seed Food Catalog
-- Project: Intelligent Messenger Bot & Operations Control Dashboard (Al-Khedewy)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- ==============================================================================
-- 1. Master Bot Configuration (Single-Row bot_settings)
-- ==============================================================================
INSERT INTO public.bot_settings (
    id,
    bot_enabled,
    auto_pause_on_complaint,
    notify_telegram,
    telegram_bot_token,
    telegram_chat_id,
    notify_dashboard,
    business_hours_enabled,
    open_time,
    close_time,
    off_hours_message,
    ai_system_prompt,
    menu_full_image_url,
    menu_full_pdf_url,
    currency,
    delivery_fee
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    true,
    true,
    true,
    NULL,
    NULL,
    true,
    false,
    '12:00:00'::time,
    '02:00:00'::time,
    'أهلاً بحضرتك في مطعم الخديوي! 🌟 نحن حالياً خارج أوقات العمل الرسمية. مواعيد العمل واستقبال الطلبات يومياً من 12:00 ظهراً حتى 02:00 صباحاً. يسعدنا استقبال رسالتك وسنقوم بالرد عليك فور بدء أوقات العمل! ❤️',
    'أنت المساعد الذكي والممثل الرسمي لمطعم الخديوي (Al-Khedewy)، المتخصص في المشويات الشرقية والأكلات المصرية الفاخرة الأصيلة في مصر. أسلوبك ودود للغاية، مرحب، ومهذب جداً باللهجة المصرية العامية الراقية (يا فندم، نورتنا، تحت أمرك، بالهنا والشفا). مهمتك: 1) الترحيب بالعملاء وتقديم قائمة الطعام والعروض الترويجية الحالية. 2) مساعدة العميل في اختيار وتنسيق أصناف الطلب وحساب الأسعار بدقة بالجنيه المصري (EGP). 3) جمع بيانات التوصيل كاملة (الاسم الثلاثي، رقم الهاتف المصري، العنوان التفصيلي بدقة). 4) في حال وجود أي شكوى أو استياء من عميل، تعامل بأقصى درجات اللطف والاعتذار وسجل الشكوى فوراً لطمأنته بأن الإدارة تتولى الأمر.',
    '/storage/v1/object/public/menu-assets/khedewy-full-menu.webp',
    '/storage/v1/object/public/menu-assets/khedewy-menu.pdf',
    'EGP',
    20.00
WHERE NOT EXISTS (SELECT 1 FROM public.bot_settings)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 2. Fallback Comment Auto-Reply Rules (Single-Row global_comment_rules)
-- ==============================================================================
INSERT INTO public.global_comment_rules (
    id,
    is_enabled,
    auto_like_comment,
    comment_replies,
    send_dm,
    dm_message,
    dm_image_url,
    dm_buttons
)
SELECT
    '00000000-0000-0000-0000-000000000002'::uuid,
    true,
    true,
    ARRAY[
        'شرفتنا ونورتنا يا فندم! بعتنالك التفاصيل والمنيو كامل في رسايل الصفحة 📩❤️',
        'أهلاً بحضرتك في مطعم الخديوي! تم الرد على حضرتك في الخاص بجميع التفاصيل والأسعار 🌟👑',
        'منورنا دائماً يا غالي! شيك على رسايلك الخاصة بعتنالك أقوى العروض والمنيو 💬✨'
    ],
    true,
    'أهلاً بك في مطعم الخديوي للأكلات والمشويات الأصيلة! 👑🍽️ يسعدنا خدمتك ومساعدتك في اختيار أشهى الوجبات. يمكنك استعراض المنيو، التعرف على أحدث العروض، أو التواصل مع موظف خدمة العملاء مباشرة عبر الأزرار التالية:',
    '/storage/v1/object/public/offer-banners/welcome-dm-banner.webp',
    '[
        {"title": "قائمة المنيو 🍔", "payload": "VIEW_MENU"},
        {"title": "العروض الحالية 🏷️", "payload": "VIEW_OFFERS"},
        {"title": "تحدث مع موظف 👨‍💼", "payload": "HUMAN_AGENT"}
    ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.global_comment_rules)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 3. Sample Menu Categories (4 Core Categories)
-- ==============================================================================
INSERT INTO public.menu_categories (id, name_ar, name_en, image_url, sort_order, is_active)
VALUES
    (
        '11111111-1111-1111-1111-111111111101'::uuid,
        'مشويات',
        'Grills',
        '/storage/v1/object/public/menu-assets/category-grills.webp',
        1,
        true
    ),
    (
        '11111111-1111-1111-1111-111111111102'::uuid,
        'ساندوتشات',
        'Sandwiches',
        '/storage/v1/object/public/menu-assets/category-sandwiches.webp',
        2,
        true
    ),
    (
        '11111111-1111-1111-1111-111111111103'::uuid,
        'مقبلات وشوربة',
        'Appetizers & Soups',
        '/storage/v1/object/public/menu-assets/category-appetizers.webp',
        3,
        true
    ),
    (
        '11111111-1111-1111-1111-111111111104'::uuid,
        'مشروبات',
        'Beverages',
        '/storage/v1/object/public/menu-assets/category-beverages.webp',
        4,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ==============================================================================
-- 4. Sample Menu Items (2-3 Items Per Category with Realistic EGP Prices)
-- ==============================================================================

-- 4.1 مشويات (Grills)
INSERT INTO public.menu_items (id, category_id, name_ar, name_en, description, price, sale_price, image_url, is_available, badges, sort_order)
VALUES
    (
        '22222222-2222-2222-2222-222222220101'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        'كيلو مشكل كباب وكفتة الخديوي',
        'Mixed Kebab & Kofta (1kg)',
        'تشكيلة فاخرة من كباب البتلو المتبل وكفتة الضاني المشوية على الفحم، تقدم مع أرز بسمتي وسلطات وخبز طازج',
        420.00,
        390.00,
        '/storage/v1/object/public/menu-assets/mixed-grill-khedewy.webp',
        true,
        ARRAY['bestseller', 'signature'],
        1
    ),
    (
        '22222222-2222-2222-2222-222222220102'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        'نصف كيلو كفتة ضاني مشوية',
        'Grilled Lamb Kofta (0.5kg)',
        'كفتة لحم ضاني مفرومة مع خلطة بهارات الخديوي السرية مشوية على الفحم النباتي، تقدم مع طحينة وسلطة بلدي وخبز',
        210.00,
        NULL,
        '/storage/v1/object/public/menu-assets/grilled-kofta.webp',
        true,
        ARRAY['bestseller'],
        2
    ),
    (
        '22222222-2222-2222-2222-222222220103'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        'شيش طاووق على الفحم',
        'Charcoal Grilled Shish Tawook',
        'أوراك دجاج طازجة متبلة بالزبادي والليمون والأعشاب، مشوية على الفحم مع فلفل ألوان وبصل، تقدم مع أرز وتومية',
        180.00,
        165.00,
        '/storage/v1/object/public/menu-assets/shish-tawook.webp',
        true,
        ARRAY['popular'],
        3
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sale_price = EXCLUDED.sale_price,
    image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available,
    badges = EXCLUDED.badges,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 4.2 ساندوتشات (Sandwiches)
INSERT INTO public.menu_items (id, category_id, name_ar, name_en, description, price, sale_price, image_url, is_available, badges, sort_order)
VALUES
    (
        '22222222-2222-2222-2222-222222220201'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        'ساندوتش كفتة الخديوي المخصوص',
        'Khedewy Special Kofta Sandwich',
        'أصابع كفتة مشوية على الفحم في خبز بلدي ساخن مع سلطة طحينة بيضاء وبقدونس مفروم ولمسة ليمون معصفر',
        55.00,
        NULL,
        '/storage/v1/object/public/menu-assets/kofta-sandwich.webp',
        true,
        ARRAY['bestseller'],
        1
    ),
    (
        '22222222-2222-2222-2222-222222220202'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        'ساندوتش شيش طاووق سوري',
        'Shish Tawook Syrian Sandwich',
        'قطع شيش طاووق مشوية مع تومية كريمية ومخلل خيار وبطاطس محمرة ملفوفة في خبز صاج سوري محمص',
        60.00,
        NULL,
        '/storage/v1/object/public/menu-assets/shish-sandwich.webp',
        true,
        ARRAY['popular'],
        2
    ),
    (
        '22222222-2222-2222-2222-222222220203'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        'حواوشي لحمة بلدي على الفحم',
        'Egyptian Charcoal Hawawshi',
        'رغيف خبز بلدي مقرمش محشو باللحم البلدي المتبل بالبصل والفلفل الحار والبهارات، مشوي على الفحم',
        50.00,
        45.00,
        '/storage/v1/object/public/menu-assets/hawawshi.webp',
        true,
        ARRAY['crispy', 'spicy'],
        3
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sale_price = EXCLUDED.sale_price,
    image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available,
    badges = EXCLUDED.badges,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 4.3 مقبلات وشوربة (Appetizers & Soups)
INSERT INTO public.menu_items (id, category_id, name_ar, name_en, description, price, sale_price, image_url, is_available, badges, sort_order)
VALUES
    (
        '22222222-2222-2222-2222-222222220301'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid,
        'شوربة لسان عصفور بالمستكة',
        'Orzo Soup with Mastic',
        'شوربة لسان عصفور ذهبية محضرة بمرقة اللحم البتلو الطازجة والمستكة اليونانية والحبهان وتقدم مع ليمون',
        35.00,
        NULL,
        '/storage/v1/object/public/menu-assets/orzo-soup.webp',
        true,
        ARRAY['starter'],
        1
    ),
    (
        '22222222-2222-2222-2222-222222220302'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid,
        'طاجن ملوخية بالطشة الخديوية',
        'Egyptian Molokhia Tagine',
        'ملوخية خضراء طازجة تخرط يومياً ومطهوة بمرقة اللحم الغنية مع طشة الثوم والكزبرة بالزبدة الفلاحي',
        45.00,
        NULL,
        '/storage/v1/object/public/menu-assets/molokhia-tagine.webp',
        true,
        ARRAY['bestseller', 'traditional'],
        2
    ),
    (
        '22222222-2222-2222-2222-222222220303'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid,
        'مقبلات الخديوي المشكلة',
        'Mixed Appetizers Platter',
        'طبق مشكل يضم سلطة طحينة سمسم فاخرة، بابا غنوج مدخن، سلطة بلدي بالخل والليمون، ومخلل خديوي مشكل',
        40.00,
        NULL,
        '/storage/v1/object/public/menu-assets/appetizer-platter.webp',
        true,
        ARRAY['sharing'],
        3
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sale_price = EXCLUDED.sale_price,
    image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available,
    badges = EXCLUDED.badges,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 4.4 مشروبات (Beverages)
INSERT INTO public.menu_items (id, category_id, name_ar, name_en, description, price, sale_price, image_url, is_available, badges, sort_order)
VALUES
    (
        '22222222-2222-2222-2222-222222220401'::uuid,
        '11111111-1111-1111-1111-111111111104'::uuid,
        'عصير مانجو طبيعي مثلج',
        'Fresh Chilled Mango Juice',
        'عصير مانجو فريش طبيعي 100% محضر من مانجو إسمعلاوي طازجة بدون أي إضافات صناعية',
        35.00,
        NULL,
        '/storage/v1/object/public/menu-assets/mango-juice.webp',
        true,
        ARRAY['fresh'],
        1
    ),
    (
        '22222222-2222-2222-2222-222222220402'::uuid,
        '11111111-1111-1111-1111-111111111104'::uuid,
        'مشروب غازي كانز 330 مل',
        'Soft Drink Can (330ml)',
        'مشروب غازي كانز مثلج (بيبسي / كوكاكولا / سفن آب / ميرندا / سبرايت)',
        20.00,
        NULL,
        '/storage/v1/object/public/menu-assets/soda-can.webp',
        true,
        ARRAY[]::TEXT[],
        2
    ),
    (
        '22222222-2222-2222-2222-222222220403'::uuid,
        '11111111-1111-1111-1111-111111111104'::uuid,
        'مياه معدنية طبيعية 600 مل',
        'Mineral Water (600ml)',
        'زجاجة مياه معدنية طبيعية نقية ومبردة',
        10.00,
        NULL,
        '/storage/v1/object/public/menu-assets/mineral-water.webp',
        true,
        ARRAY[]::TEXT[],
        3
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sale_price = EXCLUDED.sale_price,
    image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available,
    badges = EXCLUDED.badges,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- ==============================================================================
-- 5. Sample Offer (Promotional Marketing Banner)
-- ==============================================================================
INSERT INTO public.offers (
    id,
    title,
    description,
    price_before,
    price_after,
    banner_url,
    start_date,
    end_date,
    is_active,
    sort_order
) VALUES (
    '33333333-3333-3333-3333-333333330001'::uuid,
    'عرض الخديوي العائلي 👑🍖',
    'وليمة تكفي 4 إلى 5 أفراد: كيلو مشكل مشويات (كباب + كفتة + شيش طاووق) + سرفيس أرز بسمتي بالمكسرات + طاجن ملوخية بالطشة + 4 سلطات مشكلة + لتر بيبسي عائلي + خبز بلدي ساخن.',
    350.00,
    280.00,
    '/storage/v1/object/public/offer-banners/khedewy-family-offer.webp',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days',
    true,
    1
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_before = EXCLUDED.price_before,
    price_after = EXCLUDED.price_after,
    banner_url = EXCLUDED.banner_url,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
