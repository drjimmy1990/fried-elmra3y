import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { getMetaApp, savePageConnection } from '@/lib/meta/channels';
import { debugToken, describeGraphError, getPageFromToken } from '@/lib/meta/graph';

export const dynamic = 'force-dynamic';

// POST /api/channels/manual — fallback: paste a Page Access Token { access_token, meta_app_id? }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const token = String(body.access_token ?? '').trim();
  const metaAppId = body.meta_app_id ? String(body.meta_app_id) : null;
  if (token.length < 50) return jsonError('الصق رمز الوصول (Page Access Token) كاملاً');

  return withAdminClient(async (db) => {
    const app = await getMetaApp(db, metaAppId);
    if (metaAppId && !app) return jsonError('تطبيق ميتا غير موجود', 404);

    // Reject user tokens: /me on a user token returns the person, not the page
    if (app) {
      try {
        const info = await debugToken({ appId: app.app_id, appSecret: app.app_secret, token });
        if (!info.is_valid) return jsonError('الرمز غير صالح أو منتهي');
        if (info.type && info.type !== 'PAGE') {
          return jsonError('هذا رمز مستخدم (User Token) وليس رمز صفحة — استخدم زر "ربط عبر فيسبوك" بدلاً منه');
        }
        if (info.app_id && info.app_id !== app.app_id) {
          return jsonError('هذا الرمز تابع لتطبيق ميتا آخر — اختر التطبيق الصحيح');
        }
      } catch (err) {
        return jsonError(describeGraphError(err));
      }
    }

    let page;
    try {
      page = await getPageFromToken(token, app?.app_secret);
    } catch (err) {
      return jsonError(describeGraphError(err));
    }

    try {
      const { channel, warning } = await savePageConnection(db, { metaApp: app, page, pageToken: token });
      return NextResponse.json({ channel, warning }, { status: 201 });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : String(err), 500);
    }
  });
}
