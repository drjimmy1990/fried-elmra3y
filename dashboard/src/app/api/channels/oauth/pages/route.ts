import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin, withAdminClient } from '@/lib/auth/api-guard';
import { getMetaApp, savePageConnection } from '@/lib/meta/channels';
import { describeGraphError, listManagedPages } from '@/lib/meta/graph';
import { oauthCookies } from '@/lib/meta/oauth-cookies';

export const dynamic = 'force-dynamic';

const PAGE_TASKS_NEEDED = ['MODERATE', 'MESSAGING'];

// GET /api/channels/oauth/pages — pages the admin manages (no tokens sent to the browser)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const session = oauthCookies.getSession(request);
  if (!session) return jsonError('انتهت جلسة الربط — اضغط "ربط عبر فيسبوك" مرة أخرى', 410);

  return withAdminClient(async (db) => {
    const app = await getMetaApp(db, session.metaAppRowId);
    if (!app) return jsonError('تطبيق ميتا غير موجود', 404);

    try {
      const [pages, { data: existing }] = await Promise.all([
        listManagedPages(session.userToken, app.app_secret),
        db.from('channels').select('external_id, status').eq('platform', 'facebook'),
      ]);
      const statusById = new Map((existing ?? []).map((c) => [c.external_id, c.status]));

      return NextResponse.json({
        app: { id: app.id, name: app.name },
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          picture_url: p.picture_url,
          missing_tasks: PAGE_TASKS_NEEDED.filter((t) => !p.tasks.includes(t)),
          current_status: statusById.get(p.id) ?? null,
        })),
      });
    } catch (err) {
      return jsonError(describeGraphError(err), 502);
    }
  });
}

// POST /api/channels/oauth/pages — { pageIds: string[] } connect the selected pages
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const session = oauthCookies.getSession(request);
  if (!session) return jsonError('انتهت جلسة الربط — اضغط "ربط عبر فيسبوك" مرة أخرى', 410);

  const body = await request.json().catch(() => ({}));
  const pageIds: string[] = Array.isArray(body.pageIds) ? body.pageIds.map(String) : [];
  if (pageIds.length === 0) return jsonError('اختر صفحة واحدة على الأقل');

  return withAdminClient(async (db) => {
    const app = await getMetaApp(db, session.metaAppRowId);
    if (!app) return jsonError('تطبيق ميتا غير موجود', 404);

    let pages;
    try {
      pages = await listManagedPages(session.userToken, app.app_secret);
    } catch (err) {
      return jsonError(describeGraphError(err), 502);
    }

    const results: Array<{ page_id: string; name: string; ok: boolean; warning?: string | null; error?: string }> = [];
    for (const id of pageIds) {
      const page = pages.find((p) => p.id === id);
      if (!page) {
        results.push({ page_id: id, name: id, ok: false, error: 'الصفحة غير متاحة لهذا الحساب' });
        continue;
      }
      try {
        const { warning } = await savePageConnection(db, {
          metaApp: app,
          page: { id: page.id, name: page.name, picture_url: page.picture_url },
          pageToken: page.access_token,
        });
        results.push({ page_id: id, name: page.name, ok: true, warning });
      } catch (err) {
        results.push({ page_id: id, name: page.name, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const res = NextResponse.json({ results });
    oauthCookies.clearSession(res);
    return res;
  });
}
