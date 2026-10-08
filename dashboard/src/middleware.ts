import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, audio, etc.)
     * - api/facebook (external webhooks)
     */
    '/((?!_next/static|_next/image|favicon.ico|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$|api/facebook).*)',
  ],
};
