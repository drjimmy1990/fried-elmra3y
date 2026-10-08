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
    target_email TEXT := 'admin@khedewy.com';
    target_password TEXT := 'khedewy123456';
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
