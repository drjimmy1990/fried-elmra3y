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
