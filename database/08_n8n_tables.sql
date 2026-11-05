-- ==============================================================================
-- 08_n8n_tables.sql
-- Creates the n8n operational tables (queue, n8n_chat_histories, n8n_chat_histories1)
-- required by the n8n Messenger workflow on Self-Hosted Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.queue (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_sender_id ON public.queue(sender_id);

CREATE TABLE IF NOT EXISTS public.n8n_chat_histories (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_id ON public.n8n_chat_histories(session_id);

CREATE TABLE IF NOT EXISTS public.n8n_chat_histories1 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories1_session_id ON public.n8n_chat_histories1(session_id);
