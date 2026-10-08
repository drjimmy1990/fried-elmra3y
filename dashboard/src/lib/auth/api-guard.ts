import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, MissingServiceRoleError } from '@/lib/supabase/admin';
import type { UserRole } from '@/types/database.types';

type StaffOk = { ok: true; user: User; role: UserRole };
type StaffFail = { ok: false; response: NextResponse };

/**
 * Verifies the caller is a signed-in, active staff member (optionally with one of `roles`).
 * Usage in a route handler:
 *   const auth = await requireStaff(['admin']); if (!auth.ok) return auth.response;
 */
export async function requireStaff(roles?: UserRole[]): Promise<StaffOk | StaffFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: jsonError('يرجى تسجيل الدخول أولاً', 401) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    return { ok: false, response: jsonError('حسابك غير مفعل', 403) };
  }

  if (roles && !roles.includes(profile.role)) {
    return { ok: false, response: jsonError('هذه العملية متاحة لمدير النظام فقط', 403) };
  }

  return { ok: true, user, role: profile.role };
}

export const requireAdmin = () => requireStaff(['admin']);

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Runs `fn` with a service-role client and converts thrown errors into JSON responses. */
export async function withAdminClient(
  fn: (db: ReturnType<typeof createAdminClient>) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn(createAdminClient());
  } catch (err) {
    if (err instanceof MissingServiceRoleError) return jsonError(err.message, 500);
    console.error('[api] unexpected error:', err);
    return jsonError(err instanceof Error ? err.message : 'خطأ غير متوقع في الخادم', 500);
  }
}
