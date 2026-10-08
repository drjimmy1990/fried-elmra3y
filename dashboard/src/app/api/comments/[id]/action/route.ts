import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, requireStaff, withAdminClient } from '@/lib/auth/api-guard';
import { ChannelCredentialsError, loadChannelCredentials } from '@/lib/meta/channels';
import { describeMessagingError, likeComment, replyToComment, sendPrivateReply, setCommentHidden } from '@/lib/meta/graph';
import type { TablesUpdate } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
type Action = 'reply' | 'private_reply' | 'hide' | 'unhide' | 'like' | 'mark_handled';
const ACTIONS: Action[] = ['reply', 'private_reply', 'hide', 'unhide', 'like', 'mark_handled'];
const MAX_TEXT = 2000;

/**
 * POST /api/comments/:id/action  { action, message? }
 * Manual staff action on a comment from the live inbox (admin + support agent).
 * The page token never leaves the server.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireStaff(['admin', 'support_agent']);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { action?: Action; message?: string };
  const action = body.action;
  const message = (body.message ?? '').trim();
  if (!action || !ACTIONS.includes(action)) return jsonError('إجراء غير معروف');
  if ((action === 'reply' || action === 'private_reply') && !message) return jsonError('اكتب نص الرد أولاً');
  if (message.length > MAX_TEXT) return jsonError(`الرد طويل جداً (الحد ${MAX_TEXT} حرف)`);

  return withAdminClient(async (db) => {
    const { data: event } = await db.from('comment_events').select('*').eq('id', id).maybeSingle();
    if (!event) return jsonError('التعليق غير موجود', 404);

    const patch: TablesUpdate<'comment_events'> = { handled_by: auth.user.id };
    if (['pending', 'failed', 'ignored'].includes(event.decision)) patch.decision = 'manual';

    if (action === 'mark_handled') {
      patch.decision = event.decision === 'complaint' ? 'complaint' : 'manual';
    } else {
      if (action === 'private_reply' && event.dm_sent) {
        return jsonError('تم إرسال رسالة خاصة لهذا التعليق من قبل — فيسبوك يسمح برد خاص واحد فقط. افتح المحادثة إذا رد العميل.');
      }

      let creds;
      try {
        creds = await loadChannelCredentials(db, event.channel_id);
      } catch (err) {
        if (err instanceof ChannelCredentialsError) return jsonError(err.message, 409);
        throw err;
      }
      const pageAuth = { token: creds.token, appSecret: creds.appSecret };

      try {
        switch (action) {
          case 'reply': {
            patch.public_reply_id = await replyToComment(event.comment_id, message, pageAuth);
            patch.public_reply_text = message;
            patch.replied = true;
            break;
          }
          case 'private_reply':
            await sendPrivateReply(creds.channel.external_id, event.comment_id, message, pageAuth);
            patch.dm_sent = true;
            break;
          case 'hide':
          case 'unhide':
            await setCommentHidden(event.comment_id, action === 'hide', pageAuth);
            patch.hidden = action === 'hide';
            break;
          case 'like':
            await likeComment(event.comment_id, pageAuth);
            patch.liked = true;
            break;
        }
      } catch (err) {
        return jsonError(describeMessagingError(err), 502);
      }
    }

    const { data: updated, error } = await db.from('comment_events').update(patch).eq('id', id).select().single();
    if (error) return jsonError(`تم التنفيذ على فيسبوك لكن تعذر تحديث السجل: ${error.message}`, 500);
    return NextResponse.json({ event: updated });
  });
}
