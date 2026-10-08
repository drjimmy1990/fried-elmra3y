import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { toPublicMetaApp } from '@/lib/meta/channels';
import { describeGraphError, verifyAppCredentials } from '@/lib/meta/graph';

export const dynamic = 'force-dynamic';

// GET /api/meta-apps — list Meta apps (secrets masked) with connected page counts
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  return withAdminClient(async (db) => {
    const [{ data: apps, error }, { data: channels }] = await Promise.all([
      db.from('meta_apps').select('*').order('created_at', { ascending: true }),
      db.from('channels').select('meta_app_id').neq('status', 'disconnected'),
    ]);
    if (error) return jsonError(error.message, 500);

    const counts = new Map<string, number>();
    for (const c of channels ?? []) {
      if (c.meta_app_id) counts.set(c.meta_app_id, (counts.get(c.meta_app_id) ?? 0) + 1);
    }
    return NextResponse.json({ apps: (apps ?? []).map((a) => toPublicMetaApp(a, counts.get(a.id) ?? 0)) });
  });
}

// POST /api/meta-apps — add a Meta app { name?, app_id, app_secret }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const appId = String(body.app_id ?? '').trim();
  const appSecret = String(body.app_secret ?? '').trim();
  const loginConfigId = String(body.login_config_id ?? '').trim() || null;
  let name = String(body.name ?? '').trim();

  if (!/^\d{5,25}$/.test(appId)) return jsonError('App ID لازم يكون أرقام فقط (تلاقيه في أعلى صفحة التطبيق في Meta for Developers)');
  if (!/^[a-f0-9]{16,64}$/i.test(appSecret)) return jsonError('App Secret غير صحيح — انسخه من App settings → Basic');
  if (loginConfigId && !/^\d{5,25}$/.test(loginConfigId)) return jsonError('Configuration ID لازم يكون أرقام فقط');

  try {
    const verified = await verifyAppCredentials(appId, appSecret);
    if (!name) name = verified.name || `Meta App ${appId}`;
  } catch (err) {
    return jsonError(`لم يتم قبول بيانات التطبيق من فيسبوك: ${describeGraphError(err)}`);
  }

  return withAdminClient(async (db) => {
    const { data, error } = await db
      .from('meta_apps')
      .insert({ name, app_id: appId, app_secret: appSecret, login_config_id: loginConfigId })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return jsonError('هذا التطبيق مضاف بالفعل');
      return jsonError(error.message, 500);
    }
    return NextResponse.json({ app: toPublicMetaApp(data) }, { status: 201 });
  });
}
