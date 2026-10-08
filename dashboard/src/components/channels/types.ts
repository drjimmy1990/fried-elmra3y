import type { Tables } from '@/types/database.types';

/** Meta app as returned by /api/meta-apps (secret masked). */
export interface MetaAppView {
  id: string;
  name: string;
  app_id: string;
  webhook_verify_token: string;
  login_config_id: string | null;
  is_active: boolean;
  secret_hint: string | null;
  pages_count: number;
  created_at: string;
}

/** Channel as returned by /api/channels (no token). */
export type ChannelView = Tables<'channels'> & {
  has_token: boolean;
  meta_app: { id: string; name: string; app_id: string } | null;
};

export interface SelectablePage {
  id: string;
  name: string;
  picture_url: string | null;
  missing_tasks: string[];
  current_status: Tables<'channels'>['status'] | null;
}

export type Notice = { type: 'success' | 'error' | 'warning'; text: string } | null;

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}
