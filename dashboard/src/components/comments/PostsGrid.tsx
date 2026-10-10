'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/components/channels/types';
import { btn, inputClass } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/FormControls';
import { cn, formatDateTime } from '@/lib/utils';
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

export function PostsGrid({
  pages,
  postSettings,
  rules,
  canEdit,
  onToggleBot,
  onAddRule,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const connected = pages.filter((p) => p.status !== 'disconnected');
  const [channelId, setChannelId] = useState(connected[0]?.id ?? '');
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(connected[0]?.id));
  const [error, setError] = useState<string | null>(null);
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
    load(channelId, null);
  }, [channelId, load]);

  const settingsMap = useMemo(() => new Map(postSettings.map((p) => [p.facebook_post_id, p])), [postSettings]);

  // Strictly 1 rule per post mapping
  const ruleByPost = useMemo(() => {
    const m = new Map<string, CommentRule>();
    for (const r of rules) {
      if (r.scope !== 'post' || !r.facebook_post_id) continue;
      // Take the active rule or the latest rule
      if (!m.has(r.facebook_post_id) || r.is_active) {
        m.set(r.facebook_post_id, r);
      }
    }
    return m;
  }, [rules]);

  const gridPosts: GridPost[] = useMemo(() => {
    const fresh: GridPost[] = posts.map((p) => ({ ...p, channelId }));
    // Older posts that still have rules but are not in the loaded list
    const older: GridPost[] = Array.from(ruleByPost.keys())
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
  }, [posts, ruleByPost, settingsMap, channelId]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            تحديث المنشورات
          </button>
        </div>
        <p className="text-xs text-slate-400">
          كل منشور يمكن تخصيص <strong className="text-amber-400 font-semibold">رد واحد فقط</strong> له. المنشورات بدون رد مخصص تتبع الرد العام التلقائي.
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

      {gridPosts.length === 0 && !loading && !error && (
        <div className="py-16 text-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-2xs">
          <MessageSquare className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">لا توجد منشورات ظاهرة على هذه الصفحة حالياً</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تأكد من نشر منشورات على صفحة فيسبوك وأن رمز الوصول يمتلك صلاحية القراءة.</p>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#101726] shadow-xs animate-pulse flex flex-col"
            >
              <div className="aspect-video bg-slate-100 dark:bg-slate-900/60" />
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-900 rounded-md w-1/3 pt-1" />
                </div>
                <div className="h-24 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {gridPosts.map((post) => {
            const setting = settingsMap.get(post.id);
            const botOn = setting ? setting.bot_enabled : true;
            const rule = ruleByPost.get(post.id) ?? null;

            return (
              <article
                key={post.id}
                className={cn(
                  'rounded-3xl overflow-hidden border bg-white dark:bg-[#101726] flex flex-col transition hover:border-slate-300 dark:hover:border-slate-600 shadow-xs dark:shadow-xl',
                  !botOn
                    ? 'border-slate-200 dark:border-slate-800/80 opacity-75'
                    : rule
                      ? rule.is_active
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'border-slate-200/90 dark:border-slate-700/80'
                      : 'border-slate-200/90 dark:border-slate-700/80'
                )}
              >
                {/* Post Thumbnail & Badges */}
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/60">
                  <Thumb src={post.full_picture} className="w-full h-full rounded-none" />

                  {/* Status Badge */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {!botOn ? (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-500/90 text-white backdrop-blur shadow-xs">
                        البوت متوقف ⛔
                      </span>
                    ) : rule ? (
                      rule.is_active ? (
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500 text-slate-950 backdrop-blur shadow-xs">
                          رد مخصص نشط 🟢
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-900/80 text-slate-200 border border-white/10 backdrop-blur shadow-xs">
                          رد مخصص معطل ⚪
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500 text-slate-950 backdrop-blur shadow-xs">
                        الرد العام 🤖
                      </span>
                    )}
                  </div>

                  {post.cachedOnly && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/80 text-slate-300 backdrop-blur border border-white/10">
                      منشور أقدم
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-3 leading-relaxed">
                      {post.message || <em className="text-slate-400 dark:text-slate-500 font-normal">منشور بدون نص</em>}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span>{formatDateTime(post.created_time)}</span>
                      <a
                        href={post.permalink_url ?? fbLink(post.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 font-medium transition"
                      >
                        فتح المنشور <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Rule Info & Direct Actions */}
                  <div className="space-y-3 pt-2">
                    {rule ? (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800/80 space-y-2.5">
                        {/* Pill features summary */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                            {rule.trigger_type === 'any' ? 'أي تعليق' : `كلمات (${rule.keywords.length})`}
                          </span>

                          {rule.reply_enabled && rule.reply_variations && rule.reply_variations.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                              {rule.reply_variations.length === 1 ? 'رد موحد' : `${rule.reply_variations.length} ردود متغيرة`}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
                              بدون رد تعليق
                            </span>
                          )}

                          {rule.comment_image_url && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/20">
                              <ImageIcon className="w-2.5 h-2.5" /> صورة
                            </span>
                          )}

                          {rule.dm_enabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20">
                              <MessageSquare className="w-2.5 h-2.5" /> خاص
                            </span>
                          )}

                          {rule.like_comment && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                              <ThumbsUp className="w-2.5 h-2.5" /> لايك
                            </span>
                          )}

                          {rule.delete_keywords && rule.delete_keywords.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
                              <ShieldAlert className="w-2.5 h-2.5" /> {rule.auto_delete ? 'حذف' : 'إخفاء'} ({rule.delete_keywords.length})
                            </span>
                          )}
                        </div>

                        {/* Rule Buttons & Toggle */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <Switch
                              size="sm"
                              checked={rule.is_active}
                              disabled={!canEdit}
                              label={rule.is_active ? 'الرد المخصص نشط' : 'الرد المخصص متوقف'}
                              onChange={(active) => onToggle(rule, active)}
                            />
                            <span>{rule.is_active ? 'مفعل' : 'متوقف'}</span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEdit(rule)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-xs cursor-pointer active:scale-95"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                              تعديل الرد
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('هل تريد حذف الرد المخصص لهذا المنشور والرجوع للرد العام التلقائي؟')) {
                                    onDelete(rule);
                                  }
                                }}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-2xs cursor-pointer"
                                title="حذف الرد المخصص"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5 text-center">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">هذا المنشور يتبع الرد العام بالذكاء الاصطناعي</p>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onAddRule(post, post.channelId)}
                            className="w-full py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            تخصيص رد لهذا المنشور
                          </button>
                        )}
                      </div>
                    )}

                    {/* Master Bot Switch on this post */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      <span>تشغيل البوت على المنشور</span>
                      <Switch
                        size="sm"
                        checked={botOn}
                        disabled={!canEdit || togglingId === post.id}
                        label={botOn ? 'إيقاف البوت' : 'تشغيل البوت'}
                        onChange={async (v) => {
                          setTogglingId(post.id);
                          await onToggleBot(post, post.channelId, v).finally(() => setTogglingId(null));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {cursor && (
        <div className="flex justify-center pt-2">
          <button type="button" className={btn.secondary} onClick={() => load(channelId, cursor)} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            تحميل منشورات أقدم
          </button>
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
