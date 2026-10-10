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
