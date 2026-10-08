import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { describeGraphError, exchangeCodeForUserToken, exchangeForLongLivedUserToken } from '@/lib/meta/graph';
import { oauthCookies } from '@/lib/meta/oauth-cookies';
import { oauthRedirectUri, resolveBaseUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function sameState(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// GET /api/channels/oauth/callback — Facebook redirects here after the admin approves
export async function GET(request: NextRequest) {
  const base = resolveBaseUrl(request.headers);
  const secure = base.startsWith('https://');
  const sp = request.nextUrl.searchParams;

  const back = (query: string) => {
    const res = NextResponse.redirect(`${base}/dashboard/channels?${query}`);
    oauthCookies.clearState(res);
    return res;
  };
  const fail = (msg: string) => back(`oauth_error=${encodeURIComponent(msg)}`);

  const auth = await requireAdmin();
  if (!auth.ok) return fail('هذه العملية متاحة لمدير النظام فقط');

  if (sp.get('error')) {
    return fail(
      sp.get('error_reason') === 'user_denied'
        ? 'تم إلغاء الربط من نافذة فيسبوك'
        : sp.get('error_description') || 'فيسبوك رفض طلب الربط'
    );
  }

  const code = sp.get('code');
  const state = sp.get('state');
  const saved = oauthCookies.getState(request);
  if (!code || !state || !saved || !sameState(state, saved.state)) {
    return fail('انتهت صلاحية محاولة الربط أو تم فتحها من متصفح آخر — اضغط "ربط عبر فيسبوك" مرة أخرى');
  }

  return withAdminClient(async (db) => {
    const { data: app } = await db.from('meta_apps').select('*').eq('id', saved.metaAppRowId).maybeSingle();
    if (!app) return fail('تطبيق ميتا غير موجود');

    try {
      const shortToken = await exchangeCodeForUserToken({
        appId: app.app_id,
        appSecret: app.app_secret,
        redirectUri: oauthRedirectUri(request.headers),
        code,
      });
      const userToken = await exchangeForLongLivedUserToken({ appId: app.app_id, appSecret: app.app_secret, token: shortToken });

      const res = back('oauth=select');
      oauthCookies.setSession(res, { metaAppRowId: app.id, userToken }, secure);
      return res;
    } catch (err) {
      return fail(describeGraphError(err));
    }
  });
}
