import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, requireStaff, withAdminClient } from '@/lib/auth/api-guard';
import { ChannelCredentialsError, loadChannelCredentials } from '@/lib/meta/channels';
import { describeGraphError, listPagePosts } from '@/lib/meta/graph';

export const dynamic = 'force-dynamic';

/**
 * GET /api/comments/posts?channel=<channels.id>&after=<cursor>
 * Real posts of a connected page (no mock fallback: errors are returned as-is).
 * Also caches caption / thumbnail / link into post_settings so the inbox can show
 * post previews; never touches post_settings.bot_enabled.
 */
export async function GET(req: NextRequest) {
  const auth = await requireStaff(['admin', 'support_agent']);
  if (!auth.ok) return auth.response;

  const channelId = req.nextUrl.searchParams.get('channel');
  const after = req.nextUrl.searchParams.get('after');
  if (!channelId) return jsonError('اختر الصفحة أولاً');

  return withAdminClient(async (db) => {
    let creds;
    try {
      creds = await loadChannelCredentials(db, channelId);
    } catch (err) {
      if (err instanceof ChannelCredentialsError) return jsonError(err.message, 409);
      throw err;
    }

    try {
      const { posts, nextCursor } = await listPagePosts(creds.channel.external_id, creds.token, creds.appSecret, { after });

      if (posts.length > 0) {
        const { error } = await db.from('post_settings').upsert(
          posts.map((p) => ({
            facebook_post_id: p.id,
            channel_id: creds.channel.id,
            post_caption: p.message ? p.message.slice(0, 500) : null,
            post_thumbnail_url: p.full_picture,
            post_url: p.permalink_url,
            post_created_at: p.created_time,
          })),
          { onConflict: 'facebook_post_id' }
        );
        if (error) console.warn('[comments/posts] post_settings cache failed:', error.message);
      }

      return NextResponse.json({ posts, nextCursor });
    } catch (err) {
      return jsonError(describeGraphError(err), 502);
    }
  });
}
