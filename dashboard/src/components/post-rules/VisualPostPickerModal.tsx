'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Facebook,
  Check,
} from 'lucide-react';
import { FacebookPost, FacebookPostsResponse } from './types';
import { formatDateTime } from '@/lib/utils';

interface VisualPostPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPost: (post: FacebookPost) => void;
  existingPostIds?: string[];
  selectedPostId?: string | null;
}

export function VisualPostPickerModal({
  isOpen,
  onClose,
  onSelectPost,
  existingPostIds = [],
  selectedPostId,
}: VisualPostPickerModalProps) {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch posts from API
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/facebook/posts', { cache: 'no-store' });
      const data: FacebookPostsResponse = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setPosts(data.posts);
        setIsMock(Boolean(data.isMock));
      } else {
        throw new Error(data.error || 'تعذر جلب منشورات صفحة فيسبوك');
      }
    } catch (err: any) {
      console.error('Failed to load facebook posts:', err);
      setError(err?.message || 'حدث خطأ أثناء تحميل المنشورات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
    }
  }, [isOpen, fetchPosts]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Filter posts by search query (caption or ID)
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        (p.message && p.message.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Facebook className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 id="post-picker-title" className="text-lg font-bold text-white flex items-center gap-2">
                اختيار منشور من صفحة فيسبوك
                {isMock && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    وضع العرض التجريبي
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                اختر المنشور المطلوب لإنشاء قواعد رد تلقائي مخصصة للتعليقات ورسائل المسنجر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPosts}
              disabled={loading}
              title="تحديث المنشورات"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="إغلاق"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mock Data Notice Banner */}
        {isMock && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              يتم عرض منشورات تجريبية واقعية لمطعم الخديوي لتمكينك من ضبط القواعد فوراً أثناء التطوير أو قبل ربط توكن فيسبوك الرسمي.
            </span>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في نص المنشور أو كود المنشور..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-400 shrink-0 font-medium px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            {filteredPosts.length} منشور متاح
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">جاري جلب المنشورات من فيسبوك...</p>
            </div>
          ) : error && posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-rose-400 gap-3">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={fetchPosts}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs border border-rose-500/30"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <Facebook className="w-8 h-8 opacity-40" />
              <p className="text-sm">لم يتم العثور على منشورات مطابقة لبحثك</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((post) => {
                const hasExistingRule = existingPostIds.includes(post.id);
                const isCurrentSelected = selectedPostId === post.id;

                return (
                  <div
                    key={post.id}
                    className={`group relative rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden ${
                      isCurrentSelected
                        ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10'
                        : hasExistingRule
                        ? 'bg-slate-900/90 border-blue-500/40 hover:border-blue-500/70'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {/* Post Image Container */}
                    <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                      {post.full_picture ? (
                        <img
                          src={post.full_picture}
                          alt="Facebook Post Thumbnail"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1 bg-gradient-to-br from-slate-900 to-slate-950">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                          <span className="text-[11px]">منشور نصي بدون صورة</span>
                        </div>
                      )}

                      {/* Status Badges Overlay */}
                      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end">
                        {isCurrentSelected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                            المنشور المختار حالياً
                          </span>
                        )}
                        {hasExistingRule && !isCurrentSelected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/90 text-white shadow-md backdrop-blur-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            قاعدة مضافة مسبقاً
                          </span>
                        )}
                      </div>

                      {/* External Link Overlay Button */}
                      {post.permalink_url && (
                        <a
                          href={post.permalink_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="عرض المنشور على فيسبوك"
                          className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Post Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        {/* Date & Post ID */}
                        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {formatDateTime(post.created_time)}
                          </span>
                          <span className="text-slate-500 text-[10px] truncate max-w-[120px]" title={post.id}>
                            ID: {post.id.split('_').pop() || post.id}
                          </span>
                        </div>

                        {/* Caption snippet */}
                        <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                          {post.message || 'لا يوجد نص مرفق مع المنشور'}
                        </p>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPost(post);
                          onClose();
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          isCurrentSelected
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'bg-slate-800 hover:bg-amber-500 text-slate-200 hover:text-slate-950 border border-slate-700/60 hover:border-amber-400'
                        }`}
                      >
                        {isCurrentSelected ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            تم اختيار هذا المنشور
                          </>
                        ) : hasExistingRule ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            تعديل قاعدة هذا المنشور
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            اختيار هذا المنشور
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            {posts.length > 0 ? `تم استعراض آخر ${posts.length} منشور منشور على الصفحة` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
