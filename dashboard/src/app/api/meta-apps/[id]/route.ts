import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { toPublicMetaApp } from '@/lib/meta/channels';
import { describeGraphError, verifyAppCredentials } from '@/lib/meta/graph';
import type { TablesUpdate } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/meta-apps/:id — { name?, app_secret?, is_active?, regenerate_verify_token? }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return withAdminClient(async (db) => {
    const { data: app } = await db.from('meta_apps').select('*').eq('id', id).maybeSingle();
    if (!app) return jsonError('التطبيق غير موجود', 404);

    const updates: TablesUpdate<'meta_apps'> = {};
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
    if (body.regenerate_verify_token === true) updates.webhook_verify_token = randomBytes(16).toString('hex');
    if (typeof body.login_config_id === 'string') {
      const cfg = body.login_config_id.trim();
      if (cfg && !/^\d{5,25}$/.test(cfg)) return jsonError('Configuration ID لازم يكون أرقام فقط');
      if ((cfg || null) !== app.login_config_id) updates.login_config_id = cfg || null;
    }

    if (typeof body.app_secret === 'string' && body.app_secret.trim()) {
      const secret = body.app_secret.trim();
      if (!/^[a-f0-9]{16,64}$/i.test(secret)) return jsonError('App Secret غير صحيح');
      try {
        await verifyAppCredentials(app.app_id, secret);
      } catch (err) {
        return jsonError(`فيسبوك رفض الـ App Secret الجديد: ${describeGraphError(err)}`);
      }
      updates.app_secret = secret;
    }

    if (Object.keys(updates).length === 0) return jsonError('لا توجد تغييرات للحفظ');

    const { data, error } = await db.from('meta_apps').update(updates).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ app: toPublicMetaApp(data) });
  });
}

// DELETE /api/meta-apps/:id — pages linked to it stay saved but lose their app link
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  return withAdminClient(async (db) => {
    const { error } = await db.from('meta_apps').delete().eq('id', id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ success: true });
  });
}
