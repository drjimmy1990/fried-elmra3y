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
