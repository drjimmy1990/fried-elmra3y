'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Sliders,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  ThumbsUp,
  MessageCircle,
  Send,
  Zap,
  Tag,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Facebook,
  Filter,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PostRuleRow } from './types';
import { PostRuleModal } from './PostRuleModal';
import { formatDateTime } from '@/lib/utils';

interface PostRulesManagerProps {
  initialRules: PostRuleRow[];
}

export function PostRulesManager({ initialRules }: PostRulesManagerProps) {
  const [rules, setRules] = useState<PostRuleRow[]>(initialRules);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<PostRuleRow | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<PostRuleRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.is_active).length;
    const totalTriggers = rules.reduce((acc, r) => acc + (r.total_triggers || 0), 0);
    return { total, active, inactive: total - active, totalTriggers };
  }, [rules]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Status filter
      if (filterActive === 'active' && !rule.is_active) return false;
      if (filterActive === 'inactive' && rule.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = rule.title.toLowerCase().includes(q);
        const matchesPostId = rule.facebook_post_id.toLowerCase().includes(q);
        const matchesCaption = rule.post_caption?.toLowerCase().includes(q) || false;
        const matchesKeywords =
          Array.isArray(rule.trigger_keywords) &&
          rule.trigger_keywords.some((kw) => kw.toLowerCase().includes(q));

        if (!matchesTitle && !matchesPostId && !matchesCaption && !matchesKeywords) {
          return false;
        }
      }

      return true;
    });
  }, [rules, searchQuery, filterActive]);

  // Existing post IDs to prevent duplicates in picker
  const existingPostIds = useMemo(() => rules.map((r) => r.facebook_post_id), [rules]);

  // Toggle active status (Optimistic)
  const handleToggleActive = async (rule: PostRuleRow) => {
    const nextStatus = !rule.is_active;
    setTogglingId(rule.id);

    // Optimistic update
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextStatus } : r))
    );

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('post_rules')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', rule.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle post rule active status:', err);
      // Revert optimistic update
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Delete post rule
  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    setIsDeleting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from('post_rules').delete().eq('id', ruleToDelete.id);
      if (error) throw error;

      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
      setRuleToDelete(null);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Callback on rule save / insert
  const handleRuleSaved = (savedRule: PostRuleRow) => {
    setRules((prev) => {
      const exists = prev.findIndex((r) => r.id === savedRule.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = savedRule;
        return next;
      }
      return [savedRule, ...prev];
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Rules */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي القواعد</span>
            <span className="text-2xl font-extrabold text-white font-mono">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <Sliders className="w-5 h-5" />
          </div>
        </div>

        {/* Active Rules */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-medium block mb-1">القواعد النشطة</span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{stats.active}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Inactive Rules */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1">المتوقفة مؤقتاً</span>
            <span className="text-2xl font-extrabold text-slate-400 font-mono">{stats.inactive}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Automation Triggers */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-medium block mb-1">مرات الرد التلقائي</span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono">
              {stats.totalTriggers.toLocaleString('ar-EG')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar: Search, Filters & Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنوان، كود المنشور، أو الكلمات المفتاحية..."
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterActive('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({rules.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'active'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              النشطة ({stats.active})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'inactive'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المعطلة ({stats.inactive})
            </button>
          </div>
        </div>

        {/* Add Post Rule Button */}
        <button
          onClick={() => {
            setRuleToEdit(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          إضافة قاعدة لمنشور جديد
        </button>
      </div>

      {/* Rules List Grid */}
      {filteredRules.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              {searchQuery ? 'لا توجد قواعد مطابقة للبحث' : 'لم يتم إنشاء أي قواعد رد للمنشورات بعد'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              قم بإنشاء قواعد ردود آلية تستهدف منشورات محددة على فيسبوك للرد الفوري على تعليقات العملاء وإرسال العروض في رسائل المسنجر الخاصة.
            </p>
          </div>
          <button
            onClick={() => {
              setRuleToEdit(null);
              setIsModalOpen(true);
            }}
            className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            إنشاء أول قاعدة منشور
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRules.map((rule) => {
            const isToggling = togglingId === rule.id;
            const buttonsCount = Array.isArray(rule.dm_buttons) ? rule.dm_buttons.length : 0;
            const repliesCount = Array.isArray(rule.comment_replies) ? rule.comment_replies.length : 0;
            const keywords = Array.isArray(rule.trigger_keywords) ? rule.trigger_keywords : [];

            return (
              <div
                key={rule.id}
                className={`relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  rule.is_active
                    ? 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700/80'
                    : 'bg-slate-950/60 border-slate-900 opacity-75 hover:opacity-100'
                }`}
              >
                {/* Card Top: Post Thumbnail, Title, Facebook ID & Status Switch */}
                <div className="p-5 pb-3">
                  <div className="flex items-start gap-4">
                    {/* Post Thumbnail */}
                    <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 relative group">
                      {rule.post_thumbnail_url ? (
                        <img
                          src={rule.post_thumbnail_url}
                          alt={rule.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Facebook className="w-7 h-7 opacity-40" />
                        </div>
                      )}
                      {rule.post_url && (
                        <a
                          href={rule.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="عرض المنشور الأصلي على فيسبوك"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Meta info & Rule Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {/* Match Type Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            rule.match_type === 'any'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {rule.match_type === 'any' ? 'أي تعليق (شامل)' : 'كلمات محددة'}
                        </span>

                        {/* Active Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-400">
                            {rule.is_active ? 'نشط' : 'معطل'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.is_active}
                              disabled={isToggling}
                              onChange={() => handleToggleActive(rule)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white truncate mb-1" title={rule.title}>
                        {rule.title}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="truncate max-w-[160px]" title={rule.facebook_post_id}>
                          Post ID: {rule.facebook_post_id.split('_').pop() || rule.facebook_post_id}
                        </span>
                        <span>•</span>
                        <span className="text-amber-400/90 font-sans flex items-center gap-1 font-semibold">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {rule.total_triggers || 0} استجابة
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trigger Keywords (if keywords match type) */}
                  {rule.match_type === 'keywords' && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-medium">الكلمات:</span>
                      {keywords.slice(0, 5).map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] border border-slate-700/60"
                        >
                          {kw}
                        </span>
                      ))}
                      {keywords.length > 5 && (
                        <span className="text-[10px] text-slate-500">
                          +{keywords.length - 5} أخرى
                        </span>
                      )}
                    </div>
                  )}

                  {/* Comment & DM Preview Snippet */}
                  <div className="mt-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-semibold">{repliesCount} صيغ للرد العام</span>
                      {rule.auto_like_comment && (
                        <span className="mr-auto inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          <ThumbsUp className="w-2.5 h-2.5" />
                          Auto-Like
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-1.5 text-slate-400">
                      <Send className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed flex-1">
                        {rule.dm_message}
                      </p>
                    </div>

                    {buttonsCount > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                        <span>أزرار مسنجر ({buttonsCount}):</span>
                        {Array.isArray(rule.dm_buttons) &&
                          (rule.dm_buttons as any[]).map((btn, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {btn.title}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Timestamp & Action Buttons */}
                <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    تم الإنشاء: {formatDateTime(rule.created_at)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRuleToEdit(rule);
                        setIsModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleToDelete(rule)}
                      className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
                      title="حذف القاعدة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Rule Modal (Create & Edit) */}
      <PostRuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setRuleToEdit(null);
        }}
        onSaved={handleRuleSaved}
        ruleToEdit={ruleToEdit}
        existingPostIds={existingPostIds.filter(
          (id) => !ruleToEdit || id !== ruleToEdit.facebook_post_id
        )}
      />

      {/* Delete Confirmation Modal */}
      {ruleToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">
                تأكيد حذف قاعدة المنشور
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف قاعدة{' '}
                <span className="font-bold text-white">"{ruleToDelete.title}"</span>؟
                لن يتم الرد التلقائي على هذا المنشور بعد الآن.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRuleToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
