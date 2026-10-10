'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Inbox, Loader2, MessageSquare, Search, ShieldAlert, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/components/channels/types';
import { Modal, btn, inputClass } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { CommentEventCard, needsAttention, type InboxAction } from './CommentEventCard';
import type { CommentEvent, CommentRule, Notice, PageOption, PostSetting } from './types';

type Range = 'today' | '7d' | '30d';
type Filter = 'all' | 'attention' | 'failed' | 'complaint' | 'replied' | 'ignored';

const RANGE_LABEL: Record<Range, string> = { today: 'اليوم', '7d': 'آخر 7 أيام', '30d': 'آخر 30 يوم' };
const FILTERS: Array<[Filter, string]> = [
  ['all', 'الكل'],
  ['attention', 'يحتاج تدخل'],
  ['complaint', 'شكاوى'],
  ['failed', 'فشل'],
  ['replied', 'تم الرد'],
  ['ignored', 'متجاهل'],
];
const LIMIT = 300;

function sinceIso(range: Range) {
  const d = new Date();
  if (range === 'today') d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - (range === '7d' ? 7 : 30));
  return d.toISOString();
}

interface Props {
  initialEvents: CommentEvent[];
  rules: CommentRule[];
  posts: PostSetting[];
  pages: PageOption[];
  canCreateRule: boolean;
  onCreateRuleForPost: (postId: string, channelId: string | null) => void;
}

export function CommentInbox({ initialEvents, rules, posts, pages, canCreateRule, onCreateRuleForPost }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [range, setRange] = useState<Range>('7d');
  const [events, setEvents] = useState<CommentEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [postFilter, setPostFilter] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<{ id: string; action: InboxAction } | null>(null);
  const [reply, setReply] = useState<{ event: CommentEvent; mode: 'reply' | 'private_reply' } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const ruleMap = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);
  const postMap = useMemo(() => new Map(posts.map((p) => [p.facebook_post_id, p])), [posts]);
  const pageMap = useMemo(() => new Map(pages.map((p) => [p.id, p.name ?? p.external_id])), [pages]);

  // Reload when the range changes (the initial server load covers 7 days).
  const load = useCallback(
    async (r: Range) => {
      setLoading(true);
      const { data, error } = await supabase
        .from('comment_events')
        .select('*')
        .gte('created_at', sinceIso(r))
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      setLoading(false);
      if (error) setNotice({ type: 'error', text: `تعذر تحميل التعليقات: ${error.message}` });
      else setEvents(data ?? []);
    },
    [supabase]
  );

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel('comment-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_events' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<CommentEvent>;
          setEvents((prev) => prev.filter((e) => e.id !== old.id));
          return;
        }
        const row = payload.new as CommentEvent;
        setEvents((prev) => {
          const i = prev.findIndex((e) => e.id === row.id);
          if (i >= 0) return prev.map((e) => (e.id === row.id ? row : e));
          return [row, ...prev].slice(0, LIMIT);
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const todayStart = useMemo(() => sinceIso('today'), []);
  const kpis = useMemo(() => {
    const today = events.filter((e) => e.created_at >= todayStart);
    const auto = today.filter((e) => e.decision === 'replied' || e.decision === 'complaint').length;
    return {
      today: today.length,
      autoPct: today.length ? Math.round((auto / today.length) * 100) : 0,
      failed: today.filter((e) => e.decision === 'failed').length,
      attention: events.filter(needsAttention).length,
    };
  }, [events, todayStart]);

  const postOptions = useMemo(() => {
    const ids = Array.from(new Set(events.map((e) => e.post_id).filter(Boolean) as string[]));
    return ids.map((id) => ({ id, label: (postMap.get(id)?.post_caption || id).slice(0, 45) }));
  }, [events, postMap]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'attention' && !needsAttention(e)) return false;
      if (filter !== 'all' && filter !== 'attention' && e.decision !== filter) return false;
      if (postFilter && e.post_id !== postFilter) return false;
      if (q && !`${e.commenter_name ?? ''} ${e.comment_text ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, filter, postFilter, search]);

  const runAction = async (event: CommentEvent, action: InboxAction, message?: string) => {
    setBusy({ id: event.id, action });
    setNotice(null);
    try {
      const res = await api<{ event: CommentEvent }>(`/api/comments/${event.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, message }),
      });
      setEvents((prev) => prev.map((e) => (e.id === res.event.id ? res.event : e)));
      return true;
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submitReply = async () => {
    if (!reply || !replyText.trim()) return;
    const ok = await runAction(reply.event, reply.mode, replyText.trim());
    if (ok) {
      setReply(null);
      setReplyText('');
      setNotice({ type: 'success', text: reply.mode === 'reply' ? 'تم نشر الرد على التعليق' : 'تم إرسال الرسالة الخاصة' });
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<MessageSquare className="w-4 h-4" />} label="تعليقات اليوم" value={kpis.today} tone="slate" />
        <Kpi icon={<Sparkles className="w-4 h-4" />} label="تعامل معها البوت" value={`${kpis.autoPct}%`} tone="emerald" />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="فشل اليوم" value={kpis.failed} tone="orange" />
        <Kpi icon={<ShieldAlert className="w-4 h-4" />} label="يحتاج تدخل" value={kpis.attention} tone="rose" />
      </div>

      {/* Filters */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                filter === v ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input className={cn(inputClass, 'pr-9')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو النص" />
          </div>
          <select className={inputClass} value={postFilter} onChange={(e) => setPostFilter(e.target.value)}>
            <option value="">كل المنشورات</option>
            {postOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={range}
            onChange={(e) => {
              const r = e.target.value as Range;
              setRange(r);
              load(r);
            }}
          >
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            'p-3 rounded-xl text-xs border',
            notice.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          )}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center space-y-2 rounded-3xl border border-dashed border-slate-800">
          <Inbox className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm text-slate-400">لا توجد تعليقات {filter !== 'all' ? 'بهذا الفلتر' : `في ${RANGE_LABEL[range]}`}</p>
          <p className="text-[11px] text-slate-600">التعليقات الجديدة تظهر هنا مباشرة أول ما البوت يستقبلها.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => (
            <CommentEventCard
              key={e.id}
              event={e}
              rule={e.matched_rule_id ? ruleMap.get(e.matched_rule_id) : undefined}
              post={e.post_id ? postMap.get(e.post_id) : undefined}
              pageName={e.channel_id && pages.length > 1 ? pageMap.get(e.channel_id) ?? null : null}
              busyAction={busy?.id === e.id ? busy.action : null}
              canCreateRule={canCreateRule}
              onAction={(a) => runAction(e, a)}
              onReply={(mode) => {
                setReplyText('');
                setReply({ event: e, mode });
              }}
              onCreateRule={() => e.post_id && onCreateRuleForPost(e.post_id, e.channel_id)}
            />
          ))}
          {events.length >= LIMIT && <p className="text-center text-[11px] text-slate-500">يتم عرض أحدث {LIMIT} تعليق فقط</p>}
        </div>
      )}

      <Modal
        open={!!reply}
        onClose={() => setReply(null)}
        locked={!!busy}
        title={reply?.mode === 'reply' ? 'رد علني على التعليق' : 'رد في الخاص (ماسنجر)'}
        subtitle={reply?.event.commenter_name ?? undefined}
        icon={<MessageSquare className="w-5 h-5" />}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setReply(null)} disabled={!!busy}>
              إلغاء
            </button>
            <button type="button" className={btn.primary} onClick={submitReply} disabled={!!busy || !replyText.trim()}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              إرسال
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {reply?.event.comment_text && (
            <p className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">{reply.event.comment_text}</p>
          )}
          <textarea
            rows={4}
            autoFocus
            className={cn(inputClass, 'resize-y')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={reply?.mode === 'reply' ? 'الرد هيظهر للكل تحت التعليق باسم الصفحة' : 'الرسالة هتوصل للعميل على ماسنجر'}
          />
          {reply?.mode === 'private_reply' && (
            <p className="text-[11px] text-slate-500">فيسبوك يسمح برسالة خاصة واحدة فقط لكل تعليق، وخلال 7 أيام من كتابته.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

const TONES = {
  slate: 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60',
  emerald: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10',
  orange: 'text-orange-700 dark:text-orange-300 bg-orange-500/10',
  rose: 'text-rose-700 dark:text-rose-300 bg-rose-500/10',
} as const;

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: keyof typeof TONES }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', TONES[tone])}>{icon}</div>
      <div>
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  );
}
