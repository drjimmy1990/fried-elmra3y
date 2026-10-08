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
