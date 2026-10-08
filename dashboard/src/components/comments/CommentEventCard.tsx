'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  MessageCircle,
  MessageSquareReply,
  Send,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { cn, formatTimeElapsed } from '@/lib/utils';
import { IGNORE_REASON_LABELS, type IgnoreReason } from '@/lib/rules-matcher';
import { fbLink, type CommentEvent, type CommentRule, type PostSetting } from './types';

export type InboxAction = 'reply' | 'private_reply' | 'hide' | 'unhide' | 'like' | 'mark_handled';

const DECISION_STYLE: Record<CommentEvent['decision'], { label: string; cls: string }> = {
  pending: { label: 'قيد المعالجة', cls: 'bg-slate-700/40 text-slate-300 border-slate-600/40' },
  replied: { label: 'تم الرد تلقائياً', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
  ignored: { label: 'تم تجاهله', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  complaint: { label: 'شكوى 🚨', cls: 'bg-rose-500/15 text-rose-200 border-rose-500/30' },
  failed: { label: 'فشل ⚠️', cls: 'bg-orange-500/15 text-orange-200 border-orange-500/30' },
  manual: { label: 'رد الفريق', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/25' },
};

export function needsAttention(e: CommentEvent) {
  return e.decision === 'failed' || e.decision === 'complaint' || e.decision === 'pending';
}

interface Props {
  event: CommentEvent;
  rule: CommentRule | undefined;
  post: PostSetting | undefined;
  pageName: string | null;
  busyAction: InboxAction | null;
  canCreateRule: boolean;
  onAction: (action: InboxAction) => void;
  onReply: (mode: 'reply' | 'private_reply') => void;
  onCreateRule: () => void;
}

export function CommentEventCard({ event: e, rule, post, pageName, busyAction, canCreateRule, onAction, onReply, onCreateRule }: Props) {
  const style = DECISION_STYLE[e.decision];
  const postLink = post?.post_url || (e.post_id ? fbLink(e.post_id) : null);
  const reason = e.ignore_reason ? IGNORE_REASON_LABELS[e.ignore_reason as IgnoreReason | 'cooldown'] ?? e.ignore_reason : null;
  const busy = busyAction !== null;

  return (
    <article
      className={cn(
        'p-4 rounded-2xl border bg-slate-900/60 space-y-3',
        e.decision === 'complaint' ? 'border-rose-500/30' : e.decision === 'failed' ? 'border-orange-500/30' : 'border-slate-800'
      )}
    >
      <div className="flex gap-3">
        {/* Post thumbnail */}
        <a
          href={postLink ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60"
          title={post?.post_caption ?? 'فتح المنشور'}
        >
          {post?.post_thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.post_thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-lg">🍗</span>
          )}
        </a>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-white">{e.commenter_name || 'مستخدم فيسبوك'}</span>
            <span className="text-[11px] text-slate-500">{formatTimeElapsed(e.comment_created_at ?? e.created_at)}</span>
            {pageName && <span className="text-[11px] text-blue-300/80">· {pageName}</span>}
            {e.parent_comment_id && <span className="text-[11px] text-slate-500">· رد على تعليق</span>}
          </div>
          <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{e.comment_text || <em className="text-slate-500">بدون نص</em>}</p>
          {post?.post_caption && <p className="text-[11px] text-slate-500 line-clamp-1">على: {post.post_caption}</p>}
        </div>
      </div>

      {/* What the bot did */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge cls={style.cls}>{style.label}</Badge>
        {e.replied && <Badge cls="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">رد علني ✓</Badge>}
        {e.dm_sent && <Badge cls="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">رسالة خاصة ✓</Badge>}
        {e.liked && <Badge cls="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">لايك ✓</Badge>}
        {e.hidden && <Badge cls="bg-slate-700/50 text-slate-300 border-slate-600/50">مخفي</Badge>}
        {rule && <Badge cls="bg-purple-500/10 text-purple-300 border-purple-500/20">القاعدة: {rule.name}</Badge>}
        {reason && e.decision !== 'replied' && <Badge cls="bg-slate-800 text-slate-400 border-slate-700">{reason}</Badge>}
        {e.complaint_id && (
          <Link href="/dashboard/complaints" className="text-[11px] font-semibold text-rose-300 hover:underline">
            عرض الشكوى ←
          </Link>
        )}
      </div>

      {e.public_reply_text && (
        <div className="mr-6 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
          <span className="text-amber-300 font-semibold">رد الصفحة: </span>
          {e.public_reply_text}
        </div>
      )}

      {e.error_message && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-[11px] text-orange-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{e.error_message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
        <ActionBtn icon={<MessageSquareReply className="w-3.5 h-3.5" />} label="رد علني" disabled={busy} onClick={() => onReply('reply')} />
        {!e.dm_sent && (
          <ActionBtn icon={<Send className="w-3.5 h-3.5" />} label="رد في الخاص" disabled={busy} onClick={() => onReply('private_reply')} />
        )}
        {!e.liked && (
          <ActionBtn
            icon={busyAction === 'like' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
            label="لايك"
            disabled={busy}
            onClick={() => onAction('like')}
          />
        )}
        <ActionBtn
          icon={
            busyAction === 'hide' || busyAction === 'unhide' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : e.hidden ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )
          }
          label={e.hidden ? 'إظهار' : 'إخفاء'}
          disabled={busy}
          onClick={() => onAction(e.hidden ? 'unhide' : 'hide')}
        />
        {e.contact_id && (
          <Link
            href={`/dashboard/chat?contactId=${e.contact_id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-200 bg-blue-500/10 hover:bg-blue-500/20"
          >
            <MessageCircle className="w-3.5 h-3.5" /> فتح المحادثة
          </Link>
        )}
        {canCreateRule && e.post_id && (
          <ActionBtn icon={<Sparkles className="w-3.5 h-3.5" />} label="قاعدة لهذا المنشور" disabled={busy} onClick={onCreateRule} />
        )}
        {needsAttention(e) && (
          <ActionBtn
            icon={busyAction === 'mark_handled' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            label="تم التعامل"
            disabled={busy}
            onClick={() => onAction('mark_handled')}
          />
        )}
        {postLink && (
          <a
            href={postLink}
            target="_blank"
            rel="noreferrer"
            className="mr-auto inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
          >
            المنشور <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </article>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold border', cls)}>{children}</span>;
}

function ActionBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}
