import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { getMetaApp } from '@/lib/meta/channels';
import {
  PAGE_WEBHOOK_FIELDS,
  describeGraphError,
  getPageFromToken,
  getPageSubscriptions,
  subscribePageToApp,
} from '@/lib/meta/graph';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/channels/:id/test — checks the token and webhook subscription; repairs the subscription if missing
export async function POST(_request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  return withAdminClient(async (db) => {
    const { data: channel } = await db.from('channels').select('*').eq('id', id).maybeSingle();
    if (!channel) return jsonError('الصفحة غير موجودة', 404);

    const { data: secret } = await db.from('channel_secrets').select('access_token').eq('channel_id', id).maybeSingle();
    if (!secret) return jsonError('لا يوجد رمز وصول لهذه الصفحة — أعد ربطها');

    const app = await getMetaApp(db, channel.meta_app_id);
    const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
    let status: 'connected' | 'error' = 'connected';
    let lastError: string | null = null;
    let page: { name: string; picture_url: string | null } | null = null;

    // 1. Token still works and belongs to this page
    try {
      const p = await getPageFromToken(secret.access_token, app?.app_secret);
      if (p.id !== channel.external_id) throw new Error('الرمز تابع لصفحة أخرى');
      page = p;
      checks.push({ label: 'رمز الوصول صالح', ok: true });
    } catch (err) {
      status = 'error';
      lastError = describeGraphError(err);
      checks.push({ label: 'رمز الوصول صالح', ok: false, detail: lastError });
    }

    // 2. Page is subscribed to the app with the required fields (repair if not)
    if (status === 'connected') {
      try {
        const subs = await getPageSubscriptions(channel.external_id, secret.access_token, app?.app_secret);
        const mine = app ? subs.find((s) => s.id === app.app_id) : subs[0];
        const missing = PAGE_WEBHOOK_FIELDS.filter((f) => !mine?.subscribed_fields?.includes(f));
        if (!mine || missing.length) {
          await subscribePageToApp(channel.external_id, secret.access_token, app?.app_secret);
          checks.push({ label: 'الاشتراك في الويب هوك', ok: true, detail: 'تم إصلاح الاشتراك تلقائياً' });
        } else {
          checks.push({ label: 'الاشتراك في الويب هوك', ok: true });
        }
      } catch (err) {
        status = 'error';
        lastError = describeGraphError(err);
        checks.push({ label: 'الاشتراك في الويب هوك', ok: false, detail: lastError });
      }
    }

    if (!app) {
      checks.push({ label: 'مربوطة بتطبيق ميتا', ok: false, detail: 'اربط الصفحة بتطبيق حتى يتعرف n8n على الـ App Secret' });
    }

    const { data: updated } = await db
      .from('channels')
      .update({
        status,
        last_error: lastError,
        last_checked_at: new Date().toISOString(),
        ...(page ? { name: page.name, picture_url: page.picture_url } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    return NextResponse.json({ ok: status === 'connected', checks, channel: updated });
  });
}
