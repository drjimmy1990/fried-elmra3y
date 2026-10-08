import 'server-only';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

/**
 * Service-role Supabase client. SERVER ONLY.
 * Required for the secret tables (meta_apps, channel_secrets), which have no browser access at all.
 * Throws a clear error when SUPABASE_SERVICE_ROLE_KEY is missing so routes can report it.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new MissingServiceRoleError();
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export class MissingServiceRoleError extends Error {
  constructor() {
    super('SUPABASE_SERVICE_ROLE_KEY غير مضاف في ملف .env.local — أضفه ثم أعد تشغيل لوحة التحكم');
    this.name = 'MissingServiceRoleError';
  }
}
