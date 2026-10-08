'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, ImageOff, Loader2, Plus, RefreshCw, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/components/channels/types';
import { btn, inputClass } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/FormControls';
import { cn, formatDateTime } from '@/lib/utils';
import { RuleList } from './RuleList';
import { fbLink, type CommentRule, type FbPost, type PageOption, type PostSetting } from './types';

interface RuleHandlers {
  onEdit: (rule: CommentRule) => void;
  onDuplicate: (rule: CommentRule) => void;
  onToggle: (rule: CommentRule, active: boolean) => Promise<void>;
  onDelete: (rule: CommentRule) => Promise<void>;
}

interface Props extends RuleHandlers {
  pages: PageOption[];
  postSettings: PostSetting[];
  rules: CommentRule[];
  canEdit: boolean;
  onToggleBot: (post: FbPost, channelId: string, enabled: boolean) => Promise<void>;
  onAddRule: (post: FbPost, channelId: string) => void;
}

/** A post card can come from Facebook (fresh) or only from the post_settings cache (older posts with rules). */
type GridPost = FbPost & { channelId: string; cachedOnly?: boolean };

export function PostsGrid({ pages, postSettings, rules, canEdit, onToggleBot, onAddRule, ...ruleHandlers }: Props) {
  const connected = pages.filter((p) => p.status !== 'disconnected');
  const [channelId, setChannelId] = useState(connected[0]?.id ?? '');
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async (ch: string, after: string | null) => {
    if (!ch) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ channel: ch, ...(after ? { after } : {}) });
      const res = await api<{ posts: FbPost[]; nextCursor: string | null }>(`/api/comments/posts?${qs}`);
      setPosts((prev) => (after ? [...prev, ...res.posts.filter((p) => !prev.some((x) => x.id === p.id))] : res.posts));
      setCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المنشورات');
      if (!after) setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedId(null);
    load(channelId, null);
  }, [channelId, load]);

  const settingsMap = useMemo(() => new Map(postSettings.map((p) => [p.facebook_post_id, p])), [postSettings]);
  const rulesByPost = useMemo(() => {
    const m = new Map<string, CommentRule[]>();
    for (const r of rules) {
      if (r.scope !== 'post' || !r.facebook_post_id) continue;
      m.set(r.facebook_post_id, [...(m.get(r.facebook_post_id) ?? []), r]);
    }
    return m;
  }, [rules]);

  const gridPosts: GridPost[] = useMemo(() => {
    const fresh: GridPost[] = posts.map((p) => ({ ...p, channelId }));
    // Older posts that still have rules but are not in the loaded list
    const older: GridPost[] = Array.from(rulesByPost.keys())
      .filter((id) => !posts.some((p) => p.id === id))
      .map((id) => settingsMap.get(id))
      .filter((s): s is PostSetting => !!s && (!s.channel_id || s.channel_id === channelId))
      .map((s) => ({
        id: s.facebook_post_id,
        message: s.post_caption ?? '',
        created_time: s.post_created_at ?? s.created_at,
        full_picture: s.post_thumbnail_url,
        permalink_url: s.post_url,
        channelId: s.channel_id ?? channelId,
        cachedOnly: true,
      }));
    return [...fresh, ...older];
  }, [posts, rulesByPost, settingsMap, channelId]);

  const selected = gridPosts.find((p) => p.id === selectedId) ?? null;

  if (connected.length === 0) {
    return (
      <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-slate-800">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
        <p className="text-sm text-slate-300">لا توجد صفحة فيسبوك مربوطة</p>
        <Link href="/dashboard/channels" className={btn.primary}>
          اربط صفحتك من صفحة القنوات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {connected.length > 1 && (
          <select className={cn(inputClass, 'w-auto min-w-[200px]')} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {connected.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.external_id}
              </option>
            ))}
          </select>
        )}
        <button type="button" className={btn.secondary} onClick={() => load(channelId, null)} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          تحديث
        </button>
        <p className="text-[11px] text-slate-500">
          المنشور اللي مالوش قواعد خاصة بيستخدم القواعد العامة. اقفل البوت على أي منشور لو مش عايزه يرد عليه.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{error}</p>
            <Link href="/dashboard/channels" className="underline">
              راجع ربط الصفحة
            </Link>
          </div>
        </div>
      )}

      {/* Selected post: rules panel */}
      {selected && (
        <section className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-4">
          <div className="flex items-start gap-3">
            <Thumb src={selected.full_picture} className="w-16 h-16" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white">قواعد هذا المنشور</h3>
              <p className="text-xs text-slate-400 line-clamp-2">{selected.message || 'منشور بدون نص'}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <RuleList
            rules={rulesByPost.get(selected.id) ?? []}
            pages={pages}
            canEdit={canEdit}
            emptyText="مفيش قواعد خاصة — التعليقات هنا بتمشي على القواعد العامة"
            {...ruleHandlers}
          />
          {canEdit && (
            <button type="button" className={btn.primary} onClick={() => onAddRule(selected, selected.channelId)}>
              <Plus className="w-4 h-4" /> إضافة قاعدة لهذا المنشور
            </button>
          )}
        </section>
      )}

      {gridPosts.length === 0 && !loading && !error && (
        <p className="py-12 text-center text-sm text-slate-500">لا توجد منشورات على هذه الصفحة</p>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {gridPosts.map((post) => {
          const setting = settingsMap.get(post.id);
          const botOn = setting ? setting.bot_enabled : true;
          const postRules = rulesByPost.get(post.id) ?? [];
          const activeRules = postRules.filter((r) => r.is_active).length;
          return (
            <article
              key={post.id}
              className={cn(
                'rounded-3xl overflow-hidden border bg-slate-900/60 flex flex-col transition',
                selectedId === post.id ? 'border-amber-500/60' : 'border-slate-800',
                !botOn && 'opacity-75'
              )}
            >
              <div className="relative aspect-video bg-slate-800">
                <Thumb src={post.full_picture} className="w-full h-full rounded-none" />
                <span
                  className={cn(
                    'absolute top-2 right-2 px-2 py-1 rounded-lg text-[11px] font-bold backdrop-blur',
                    !botOn
                      ? 'bg-slate-950/80 text-slate-300'
                      : activeRules > 0
                        ? 'bg-amber-500/90 text-slate-950'
                        : 'bg-slate-950/70 text-emerald-300'
                  )}
                >
                  {!botOn ? 'البوت متوقف على المنشور' : activeRules > 0 ? `قواعد خاصة (${activeRules})` : 'يستخدم الرد العام'}
                </span>
                {post.cachedOnly && (
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-950/80 text-slate-400">منشور أقدم</span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <p className="text-xs text-slate-300 line-clamp-3 flex-1">{post.message || <em className="text-slate-500">بدون نص</em>}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{formatDateTime(post.created_time)}</span>
                  <a
                    href={post.permalink_url ?? fbLink(post.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-slate-300"
                  >
                    فيسبوك <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
                    <Switch
                      size="sm"
                      checked={botOn}
                      disabled={!canEdit || togglingId === post.id}
                      label={botOn ? 'إيقاف البوت على هذا المنشور' : 'تشغيل البوت على هذا المنشور'}
                      onChange={async (v) => {
                        setTogglingId(post.id);
                        await onToggleBot(post, post.channelId, v).finally(() => setTogglingId(null));
                      }}
                    />
                    البوت {botOn ? 'شغال' : 'متوقف'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(post.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-200 bg-amber-500/10 hover:bg-amber-500/20"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    القواعد ({postRules.length})
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {cursor && (
        <div className="flex justify-center">
          <button type="button" className={btn.secondary} onClick={() => load(channelId, cursor)} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            تحميل منشورات أقدم
          </button>
        </div>
      )}
      {loading && posts.length === 0 && (
        <div className="py-12 flex justify-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
    </div>
  );
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  if (!src) {
    return (
      <div className={cn('rounded-xl bg-slate-800 flex items-center justify-center text-slate-600 shrink-0', className)}>
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={cn('rounded-xl object-cover shrink-0', className)} />;
}
