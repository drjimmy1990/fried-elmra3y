import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database, UserRole } from '@/types/database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Unauthenticated users accessing /dashboard/* are redirected to /login
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated users on /login are redirected to /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
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
      const url = request.nextUrl.clone();
      url.pathname = '/login?error=account_deactivated';
      return NextResponse.redirect(url);
    }

    // Role Route Restrictions
    if (role === 'order_agent') {
      // Order agent can only access /dashboard/orders
      const allowedPaths = ['/dashboard/orders'];
      const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/orders';
        return NextResponse.redirect(url);
      }
    } else if (role === 'support_agent') {
      // Support agent can access /dashboard/complaints, /dashboard/chat
      const allowedPaths = ['/dashboard/complaints', '/dashboard/chat'];
      const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/complaints';
        return NextResponse.redirect(url);
      }
    }
    // Admin has access to everything
  }

  return supabaseResponse;
}
