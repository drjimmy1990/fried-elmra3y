import { createServerClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { Database, UserRole } from '@/types/database.types';
import { homeRouteForRole, isRouteAllowed } from '@/lib/role-guard';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  ) as unknown as SupabaseClient<Database>;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const redirectTo = (path: string, search = '') => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = search;
    return NextResponse.redirect(url);
  };

  // API routes do their own auth checks (and must return JSON, not redirects)
  if (pathname.startsWith('/api/')) return supabaseResponse;

  if (pathname === '/login') {
    // Signed-in users skip the login page, unless they were bounced for a deactivated account
    if (user && request.nextUrl.searchParams.get('error') !== 'account_deactivated') {
      return redirectTo('/dashboard');
    }
    return supabaseResponse;
  }

  // Every other matched path is a dashboard page. Pages are reachable both as /dashboard/x
  // and directly as /x (next.config rewrite), so guard both forms.
  if (!user) return redirectTo('/login');

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single();
  if (!profile || !profile.is_active) return redirectTo('/login', '?error=account_deactivated');

  const role: UserRole = profile.role;
  if (!isRouteAllowed(role, pathname, true)) return redirectTo(homeRouteForRole(role));

  return supabaseResponse;
}
