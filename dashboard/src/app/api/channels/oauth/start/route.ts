import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { buildOAuthDialogUrl } from '@/lib/meta/graph';
import { oauthCookies } from '@/lib/meta/oauth-cookies';
import { oauthRedirectUri, resolveBaseUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

// GET /api/channels/oauth/start?app=<meta_apps.id> — sends the admin to the Facebook Login dialog
export async function GET(request: NextRequest) {
  const base = resolveBaseUrl(request.headers);
  const back = (error: string) =>
    NextResponse.redirect(`${base}/dashboard/channels?oauth_error=${encodeURIComponent(error)}`);

  const auth = await requireAdmin();
  if (!auth.ok) return back('هذه العملية متاحة لمدير النظام فقط');

  const appRowId = request.nextUrl.searchParams.get('app');
  if (!appRowId) return back('اختر تطبيق ميتا أولاً');

  return withAdminClient(async (db) => {
    const { data: app } = await db
      .from('meta_apps')
      .select('id, app_id, is_active, login_config_id')
      .eq('id', appRowId)
      .maybeSingle();
    if (!app) return back('تطبيق ميتا غير موجود');
    if (!app.is_active) return back('هذا التطبيق موقوف — فعّله أولاً');

    const state = randomBytes(16).toString('hex');
    const res = NextResponse.redirect(
      buildOAuthDialogUrl({
        appId: app.app_id,
        redirectUri: oauthRedirectUri(request.headers),
        state,
        configId: app.login_config_id,
      })
    );
    oauthCookies.setState(res, { state, metaAppRowId: app.id }, base.startsWith('https://'));
    return res;
  });
}
