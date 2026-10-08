'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Facebook,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
  Image as ImageIcon,
  ThumbsUp,
  MessageCircle,
  Send,
  Sliders,
  Tag,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PostRuleRow,
  PostRuleFormData,
  FacebookPost,
  DmButton,
  PRESET_DM_BUTTONS,
  RuleMatchType,
} from './types';
import { VisualPostPickerModal } from './VisualPostPickerModal';

interface PostRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (rule: PostRuleRow) => void;
  ruleToEdit?: PostRuleRow | null;
  existingPostIds?: string[];
}

export function PostRuleModal({
  isOpen,
  onClose,
  onSaved,
  ruleToEdit,
  existingPostIds = [],
}: PostRuleModalProps) {
  const isEditMode = Boolean(ruleToEdit);

  // Form State
  const [title, setTitle] = useState('');
  const [facebookPostId, setFacebookPostId] = useState('');
  const [postThumbnailUrl, setPostThumbnailUrl] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [matchType, setMatchType] = useState<RuleMatchType>('any');
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [autoLikeComment, setAutoLikeComment] = useState(true);
  const [commentReplies, setCommentReplies] = useState<string[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [dmImageUrl, setDmImageUrl] = useState('');
  const [dmButtons, setDmButtons] = useState<DmButton[]>([]);
  const [isActive, setIsActive] = useState(true);

  // UI State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCustomButtonInput, setShowCustomButtonInput] = useState(false);
  const [customBtnTitle, setCustomBtnTitle] = useState('');
  const [customBtnPayload, setCustomBtnPayload] = useState('');

  // Initialize or reset form data
  useEffect(() => {
    if (ruleToEdit) {
      setTitle(ruleToEdit.title || '');
      setFacebookPostId(ruleToEdit.facebook_post_id || '');
      setPostThumbnailUrl(ruleToEdit.post_thumbnail_url || '');
      setPostUrl(ruleToEdit.post_url || '');
      setPostCaption(ruleToEdit.post_caption || '');
      setMatchType(ruleToEdit.match_type || 'any');
      setTriggerKeywords(Array.isArray(ruleToEdit.trigger_keywords) ? ruleToEdit.trigger_keywords : []);
      setAutoLikeComment(ruleToEdit.auto_like_comment ?? true);
      setCommentReplies(Array.isArray(ruleToEdit.comment_replies) ? ruleToEdit.comment_replies : []);
      setDmMessage(ruleToEdit.dm_message || '');
      setDmImageUrl(ruleToEdit.dm_image_url || '');
      setDmButtons(Array.isArray(ruleToEdit.dm_buttons) ? (ruleToEdit.dm_buttons as any as DmButton[]) : []);
      setIsActive(ruleToEdit.is_active ?? true);
    } else {
      // Default initial values for new rule
      setTitle('');
      setFacebookPostId('');
      setPostThumbnailUrl('');
      setPostUrl('');
      setPostCaption('');
      setMatchType('any');
      setTriggerKeywords(['بكام', 'السعر', 'منيو', 'عرض']);
      setAutoLikeComment(true);
      setCommentReplies([
        'أهلاً بك يا فندم! تم إرسال كافة التفاصيل في رسالة خاصة 📩🌹',
        'شرفتنا ونورتنا! راجع صندوق الرسائل تجد العرض والأسعار والمنيو كاملاً 👑✨',
      ]);
      setDmMessage(
        'أهلاً بحضرتك في مطعم الخديوي للأكلات والمشويات الأصيلة! 👑🍽️ بخصوص استفسارك على المنشور، إليك كافة التفاصيل والأسعار:'
      );
      setDmImageUrl('');
      setDmButtons([
        { title: 'قائمة المنيو 🍔', payload: 'VIEW_MENU' },
        { title: 'العروض الحالية 🏷️', payload: 'VIEW_OFFERS' },
        { title: 'تحدث مع موظف 👨‍💼', payload: 'HUMAN_AGENT' },
      ]);
      setIsActive(true);
    }
    setValidationError(null);
    setKeywordInput('');
    setReplyInput('');
    setShowCustomButtonInput(false);
  }, [ruleToEdit, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPickerOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isPickerOpen, onClose]);

  // Select Post Callback from Visual Picker
  const handleSelectPost = (post: FacebookPost) => {
    setFacebookPostId(post.id);
    setPostThumbnailUrl(post.full_picture || '');
    setPostUrl(post.permalink_url || '');
    setPostCaption(post.message || '');
    if (!title.trim() && post.message) {
      // Auto-suggest a clean rule title from the first words of the post
      const firstLine = post.message.split('\n')[0].replace(/[^\p{L}\p{N}\s]/gu, '').trim();
      const snippet = firstLine.slice(0, 40);
      setTitle(snippet ? `قاعدة: ${snippet}` : `قاعدة المنشور #${post.id.slice(-6)}`);
    }
  };

  // Keywords management
  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !triggerKeywords.includes(trimmed)) {
      setTriggerKeywords([...triggerKeywords, trimmed]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setTriggerKeywords(triggerKeywords.filter((_, i) => i !== index));
  };

  // Reply variations management
  const handleAddReply = () => {
    const trimmed = replyInput.trim();
    if (trimmed) {
      setCommentReplies([...commentReplies, trimmed]);
      setReplyInput('');
    }
  };

  const handleRemoveReply = (index: number) => {
    if (commentReplies.length <= 1) {
      setValidationError('يجب الإبقاء على نموذج رد واحد على الأقل للتعليق العام');
      return;
    }
    setCommentReplies(commentReplies.filter((_, i) => i !== index));
  };

  // DM Buttons management (Facebook max 3 buttons)
  const handleAddPresetButton = (preset: { title: string; payload: string }) => {
    if (dmButtons.length >= 3) {
      setValidationError('الحد الأقصى لأزرار ماسنجر هو 3 أزرار فقط طبقاً لسياسات فيسبوك');
      return;
    }
    if (dmButtons.some((b) => b.payload === preset.payload)) {
      return;
    }
    setDmButtons([...dmButtons, { title: preset.title, payload: preset.payload }]);
  };

  const handleAddCustomButton = () => {
    if (dmButtons.length >= 3) {
      setValidationError('الحد الأقصى لأزرار ماسنجر هو 3 أزرار فقط');
      return;
    }
    if (!customBtnTitle.trim() || !customBtnPayload.trim()) {
      setValidationError('يرجى إدخال اسم الزر ورمز الحدث (Payload)');
      return;
    }
    setDmButtons([
      ...dmButtons,
      { title: customBtnTitle.trim(), payload: customBtnPayload.trim().toUpperCase() },
    ]);
    setCustomBtnTitle('');
    setCustomBtnPayload('');
    setShowCustomButtonInput(false);
  };

  const handleRemoveButton = (index: number) => {
    setDmButtons(dmButtons.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Form validations
    if (!title.trim()) {
      setValidationError('يرجى إدخال عنوان وصفي للقاعدة');
      return;
    }
    if (!facebookPostId.trim()) {
      setValidationError('يرجى اختيار منشور فيسبوك المستهدف من خلال مستكشف المنشورات');
      return;
    }
    if (matchType === 'keywords' && triggerKeywords.length === 0) {
      setValidationError('عند اختيار "كلمات محددة"، يجب إضافة كلمة مفتاحية واحدة على الأقل');
      return;
    }
    if (commentReplies.length === 0) {
      setValidationError('يجب إضافة رد تعليق واحد على الأقل');
      return;
    }
    if (!dmMessage.trim()) {
      setValidationError('يرجى كتابة نص الرسالة الخاصة (DM)');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      const payload = {
        title: title.trim(),
        facebook_post_id: facebookPostId.trim(),
        post_thumbnail_url: postThumbnailUrl.trim() || null,
        post_url: postUrl.trim() || null,
        post_caption: postCaption.trim() || null,
        match_type: matchType,
        trigger_keywords: matchType === 'keywords' ? triggerKeywords : [],
        auto_like_comment: autoLikeComment,
        comment_replies: commentReplies,
        dm_message: dmMessage.trim(),
        dm_image_url: dmImageUrl.trim() || null,
        dm_buttons: dmButtons as any,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (isEditMode && ruleToEdit?.id) {
        const { data, error } = await supabase
          .from('post_rules')
          .update(payload)
          .eq('id', ruleToEdit.id)
          .select()
          .single();

        if (error) throw error;
        onSaved(data);
      } else {
        const { data, error } = await supabase
          .from('post_rules')
          .insert({
            ...payload,
            total_triggers: 0,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('توجد بالفعل قاعدة مسبقة مسجلة لنفس هذا المنشور! يمكنك تعديلها بدلاً من إنشائها مجدداً.');
          }
          throw error;
        }
        onSaved(data);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save post rule:', err);
      setValidationError(err?.message || 'تعذر حفظ القاعدة، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-rule-modal-title"
        className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPickerOpen) onClose();
        }}
      >
        <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 id="post-rule-modal-title" className="text-lg font-bold text-white">
                  {isEditMode ? 'تعديل قاعدة رد البوست' : 'إضافة قاعدة رد لمنشور جديد'}
                </h2>
                <p className="text-xs text-slate-400">
                  تحديد المنشور المستهدف، الكلمات المفتاحية، الرد العام العشوائي، والرسالة الخاصة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Error Banner */}
          {validationError && (
            <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{validationError}</span>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-rose-400 hover:text-rose-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Step 1: Facebook Post Selection Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-400" />
                  المنشور المستهدف على فيسبوك <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {facebookPostId ? 'تغيير المنشور' : 'اختيار منشور من فيسبوك'}
                </button>
              </div>

              {facebookPostId ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-full sm:w-36 aspect-video sm:aspect-square rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative">
                    {postThumbnailUrl ? (
                      <img
                        src={postThumbnailUrl}
                        alt="Post thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Post Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <span className="font-mono text-slate-400 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                        ID: {facebookPostId}
                      </span>
                      {postUrl && (
                        <a
                          href={postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[11px]"
                        >
                          عرض المنشور الأصلي
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {postCaption || 'لا يوجد نص للمنشور'}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsPickerOpen(true)}
                  className="cursor-pointer border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-slate-950/30 hover:bg-slate-950/60 transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center transition-colors">
                    <Facebook className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                    اضغط هنا لاستعراض واختيار منشور من صفحة فيسبوك
                  </p>
                  <p className="text-[11px] text-slate-500">
                    يمكنك مشاهدة المنشورات بصورها ونصوصها واختيار المنشور بنقرة واحدة
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Rule Title & Active Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  عنوان أو اسم القاعدة <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: عرض طاجن اللحمة بالبصل، خصم الويكند..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">حالة التفعيل</label>
                <div className="flex items-center h-10 px-3 bg-slate-950 border border-slate-700/80 rounded-xl justify-between">
                  <span className="text-xs text-slate-300">
                    {isActive ? 'القاعدة مفعلة' : 'القاعدة معطلة'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 3: Match Type & Trigger Keywords */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  طريقة مطابقة التعليقات (شرط التفعيل) <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      matchType === 'any'
                        ? 'bg-amber-500/10 border-amber-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="match_type"
                      checked={matchType === 'any'}
                      onChange={() => setMatchType('any')}
                      className="mt-0.5 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        أي تعليق على هذا البوست (شامل)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        سيقوم البوت بالرد على كل شخص يعلق على هذا المنشور بأي عبارة كانت.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      matchType === 'keywords'
                        ? 'bg-amber-500/10 border-amber-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="match_type"
                      checked={matchType === 'keywords'}
                      onChange={() => setMatchType('keywords')}
                      className="mt-0.5 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        كلمات مفتاحية محددة فقط (استهداف ذكي)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        يرد البوت فقط إذا كان تعليق العميل يحتوي على إحدى الكلمات المحددة أدناه.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Keywords Tag Manager (Active only if 'keywords' is selected) */}
              {matchType === 'keywords' && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      الكلمات المفتاحية المشغلة للرد
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {triggerKeywords.length} كلمات مسجلة
                    </span>
                  </div>

                  {/* Input row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      placeholder="اكتب كلمة مفتاحية واضغط Enter (مثال: بكام، السعر، منيو...)"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
                    >
                      إضافة
                    </button>
                  </div>

                  {/* Keyword Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {triggerKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(i)}
                          className="hover:text-rose-400 p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Auto-Like Comment & Randomized Public Replies */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-blue-400" />
                    الإعجاب التلقائي بتعليق العميل (Auto-Like)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    وضع Like على تعليق العميل باسم صفحة مطعم الخديوي فور وصوله لزيادة التفاعل
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoLikeComment}
                    onChange={(e) => setAutoLikeComment(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Public Comment Replies Variations */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    صيغ الردود العامة المتغيرة على التعليق <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    يتم اختيار صيغة عشوائياً لكل عميل لتجنب الحظر
                  </span>
                </div>

                {/* Replies list */}
                <div className="space-y-2">
                  {commentReplies.map((reply, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 group"
                    >
                      <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 break-words">{reply}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReply(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                        title="حذف هذا الرد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new reply input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddReply();
                      }
                    }}
                    placeholder="أضف صيغة رد جديدة... (مثال: شرفتنا يا فندم! راجع الخاص بعتنالك كل التفاصيل 🌹)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddReply}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صيغة
                  </button>
                </div>
              </div>
            </div>

            {/* Step 5: Private Messenger DM Message & Buttons */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-1">
                  <Send className="w-4 h-4 text-purple-400" />
                  الرسالة الخاصة في مسنجر (DM Message) <span className="text-rose-400">*</span>
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  الرسالة الفورية التي ستصل إلى صندوق رسائل العميل (Messenger) باسم مطعم الخديوي فور تعليقه
                </p>
                <textarea
                  rows={4}
                  value={dmMessage}
                  onChange={(e) => setDmMessage(e.target.value)}
                  placeholder="اكتب تفاصيل العرض والأسعار والترحيب بالعميل هنا..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 leading-relaxed"
                />
              </div>

              {/* Optional DM Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  رابط صورة البانر في الرسالة (اختياري)
                </label>
                <input
                  type="url"
                  value={dmImageUrl}
                  onChange={(e) => setDmImageUrl(e.target.value)}
                  placeholder="https://... رابط صورة البانر أو المنيو لتضمينها في الرسالة"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Quick Action Buttons Builder */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200">
                      أزرار الإجراء السريع في المسنجر (Quick Action Buttons)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      تظهر أسفل الرسالة لتمكين العميل من فتح المنيو أو طلب موظف فوراً (الحد الأقصى 3)
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-md">
                    {dmButtons.length} / 3
                  </span>
                </div>

                {/* Current Buttons List */}
                <div className="space-y-2">
                  {dmButtons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{btn.title}</span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          Payload: {btn.payload}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveButton(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Preset Quick-Add Buttons */}
                {dmButtons.length < 3 && (
                  <div className="space-y-2">
                    <span className="text-[11px] text-slate-400">إضافة أزرار قياسية جاهزة:</span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_DM_BUTTONS.map((preset) => {
                        const isAdded = dmButtons.some((b) => b.payload === preset.payload);
                        return (
                          <button
                            key={preset.payload}
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddPresetButton(preset)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                              isAdded
                                ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/80 hover:border-amber-500/50'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            {preset.title}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setShowCustomButtonInput(!showCustomButtonInput)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                      >
                        + زر مخصص
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Button Input Form */}
                {showCustomButtonInput && dmButtons.length < 3 && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2.5 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-slate-300">إضافة زر مخصص</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customBtnTitle}
                        onChange={(e) => setCustomBtnTitle(e.target.value)}
                        placeholder="اسم الزر (مثال: طلب دليفري 🛵)"
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500"
                      />
                      <input
                        type="text"
                        value={customBtnPayload}
                        onChange={(e) => setCustomBtnPayload(e.target.value)}
                        placeholder="رمز الحدث (مثال: ORDER_NOW)"
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 uppercase font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomButtonInput(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomButton}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                      >
                        إضافة الزر
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    {isEditMode ? 'حفظ تعديلات القاعدة' : 'حفظ وإنشاء القاعدة'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Visual Post Picker Modal */}
      <VisualPostPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPost={handleSelectPost}
        existingPostIds={existingPostIds}
        selectedPostId={facebookPostId}
      />
    </>
  );
}
