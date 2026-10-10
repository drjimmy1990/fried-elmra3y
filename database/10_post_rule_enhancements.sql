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
