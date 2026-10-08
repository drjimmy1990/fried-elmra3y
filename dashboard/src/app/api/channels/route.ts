import { NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';

// GET /api/channels — connected pages with their Meta app name (no tokens)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  return withAdminClient(async (db) => {
    const [{ data: channels, error }, { data: apps }, { data: secrets }] = await Promise.all([
      db.from('channels').select('*').order('created_at', { ascending: true }),
      db.from('meta_apps').select('id, name, app_id'),
      db.from('channel_secrets').select('channel_id'),
    ]);
    if (error) return jsonError(error.message, 500);

    const appById = new Map((apps ?? []).map((a) => [a.id, a]));
    const withToken = new Set((secrets ?? []).map((s) => s.channel_id));

    return NextResponse.json({
      channels: (channels ?? []).map((c) => ({
        ...c,
        has_token: withToken.has(c.id),
        meta_app: c.meta_app_id ? appById.get(c.meta_app_id) ?? null : null,
      })),
    });
  });
}
