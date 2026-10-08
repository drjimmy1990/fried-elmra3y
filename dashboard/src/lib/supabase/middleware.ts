import { createServerClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { Database, UserRole } from '@/types/database.types';

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

  // Unauthenticated users accessing / or /dashboard/* are redirected to /login
  if (!user && (pathname === '/' || pathname.startsWith('/dashboard'))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated users on /login are redirected to /dashboard
  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // Role-Based Access Control (RBAC) Route Guards
  if (user && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    const role: UserRole = profile?.role || 'order_agent';
    const isActive = profile?.is_active ?? true;

    if (!isActive) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login?error=account_deactivated';
      return NextResponse.redirect(redirectUrl);
    }

    // Role Route Restrictions
    if (role === 'order_agent') {
      // Order agent can only access /dashboard/orders
      const allowedPaths = ['/dashboard/orders'];
      const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/dashboard/orders';
        return NextResponse.redirect(redirectUrl);
      }
    } else if (role === 'support_agent') {
      // Support agent can access /dashboard/complaints, /dashboard/chat
      const allowedPaths = ['/dashboard/complaints', '/dashboard/chat'];
      const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/dashboard/complaints';
        return NextResponse.redirect(redirectUrl);
      }
    }
    // Admin has access to everything
  }

  return supabaseResponse;
}
