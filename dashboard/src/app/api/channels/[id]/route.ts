import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { getMetaApp } from '@/lib/meta/channels';
import { describeGraphError, unsubscribePageFromApp } from '@/lib/meta/graph';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/channels/:id — { meta_app_id } re-link a page to another Meta app
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return withAdminClient(async (db) => {
    const metaAppId = body.meta_app_id ? String(body.meta_app_id) : null;
    if (metaAppId && !(await getMetaApp(db, metaAppId))) return jsonError('تطبيق ميتا غير موجود', 404);
    const { data, error } = await db.from('channels').update({ meta_app_id: metaAppId }).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ channel: data });
  });
}

// DELETE /api/channels/:id — disconnect: stop webhooks, delete the token, keep history.
//   ?purge=1 also deletes the channel row (contacts/orders keep their data, link becomes empty).
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const purge = request.nextUrl.searchParams.get('purge') === '1';

  return withAdminClient(async (db) => {
    const { data: channel } = await db.from('channels').select('*').eq('id', id).maybeSingle();
    if (!channel) return jsonError('الصفحة غير موجودة', 404);

    let warning: string | null = null;
    const { data: secret } = await db.from('channel_secrets').select('access_token').eq('channel_id', id).maybeSingle();
    if (secret) {
      const app = await getMetaApp(db, channel.meta_app_id);
      try {
        await unsubscribePageFromApp(channel.external_id, secret.access_token, app?.app_secret);
      } catch (err) {
        warning = `تم الفصل من لوحة التحكم، لكن فيسبوك لم يؤكد إيقاف الويب هوك: ${describeGraphError(err)}`;
      }
    }

    if (purge) {
      const { error } = await db.from('channels').delete().eq('id', id);
      if (error) return jsonError(error.message, 500);
    } else {
      await db.from('channel_secrets').delete().eq('channel_id', id);
      const { error } = await db
        .from('channels')
        .update({ status: 'disconnected', last_error: null, last_checked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return jsonError(error.message, 500);
    }
    return NextResponse.json({ success: true, warning });
  });
}
