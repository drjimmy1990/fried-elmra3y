'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  AlertCircle,
  ThumbsUp,
  MessageCircle,
  Send,
  Plus,
  Trash2,
  Image as ImageIcon,
  ShieldAlert,
  Loader2,
  Info,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GlobalCommentRuleRow, DmButton, PRESET_DM_BUTTONS } from './types';

interface GlobalCommentRuleFormProps {
  initialRule: GlobalCommentRuleRow | null;
}

export function GlobalCommentRuleForm({ initialRule }: GlobalCommentRuleFormProps) {
  // State
  const [ruleId, setRuleId] = useState<string | null>(initialRule?.id || null);
  const [isEnabled, setIsEnabled] = useState<boolean>(initialRule?.is_enabled ?? true);
  const [autoLikeComment, setAutoLikeComment] = useState<boolean>(
    initialRule?.auto_like_comment ?? true
  );
  const [commentReplies, setCommentReplies] = useState<string[]>(
    Array.isArray(initialRule?.comment_replies) && initialRule.comment_replies.length > 0
      ? initialRule.comment_replies
      : [
          'شرفتنا ونورتنا يا فندم! بعتنالك التفاصيل والمنيو كامل في رسايل الصفحة 📩❤️',
          'أهلاً بحضرتك في مطعم الخديوي! تم الرد على حضرتك في الخاص بجميع التفاصيل والأسعار 🌟👑',
          'منورنا دائماً يا غالي! شيك على رسايلك الخاصة بعتنالك أقوى العروض والمنيو 💬✨',
        ]
  );
  const [replyInput, setReplyInput] = useState('');
  const [sendDm, setSendDm] = useState<boolean>(initialRule?.send_dm ?? true);
  const [dmMessage, setDmMessage] = useState<string>(
    initialRule?.dm_message ||
      'أهلاً بك في مطعم الخديوي للأكلات والمشويات الأصيلة! 👑🍽️ يسعدنا خدمتك ومساعدتك في اختيار أشهى الوجبات. يمكنك استعراض المنيو، التعرف على أحدث العروض، أو التواصل مع موظف خدمة العملاء مباشرة عبر الأزرار التالية:'
  );
  const [dmImageUrl, setDmImageUrl] = useState<string>(initialRule?.dm_image_url || '');
  const [dmButtons, setDmButtons] = useState<DmButton[]>(
    Array.isArray(initialRule?.dm_buttons) && (initialRule.dm_buttons as any[]).length > 0
      ? (initialRule.dm_buttons as any as DmButton[])
      : [
          { title: 'قائمة المنيو 🍔', payload: 'VIEW_MENU' },
          { title: 'العروض الحالية 🏷️', payload: 'VIEW_OFFERS' },
          { title: 'تحدث مع موظف 👨‍💼', payload: 'HUMAN_AGENT' },
        ]
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCustomBtnInput, setShowCustomBtnInput] = useState(false);
  const [customBtnTitle, setCustomBtnTitle] = useState('');
  const [customBtnPayload, setCustomBtnPayload] = useState('');

  // Comment replies management
  const handleAddReply = () => {
    const trimmed = replyInput.trim();
    if (trimmed) {
      setCommentReplies([...commentReplies, trimmed]);
      setReplyInput('');
    }
  };

  const handleRemoveReply = (index: number) => {
    if (commentReplies.length <= 1) {
      setErrorMessage('يجب الإبقاء على صيغة رد واحدة على الأقل');
      return;
    }
    setCommentReplies(commentReplies.filter((_, i) => i !== index));
  };

  // DM Buttons management
  const handleAddPresetButton = (preset: { title: string; payload: string }) => {
    if (dmButtons.length >= 3) {
      setErrorMessage('الحد الأقصى لأزرار المسنجر هو 3 أزرار فقط');
      return;
    }
    if (dmButtons.some((b) => b.payload === preset.payload)) {
      return;
    }
    setDmButtons([...dmButtons, { title: preset.title, payload: preset.payload }]);
  };

  const handleAddCustomButton = () => {
    if (dmButtons.length >= 3) {
      setErrorMessage('الحد الأقصى لأزرار المسنجر هو 3 أزرار فقط');
      return;
    }
    if (!customBtnTitle.trim() || !customBtnPayload.trim()) {
      setErrorMessage('يرجى إدخال اسم الزر ورمز الحدث (Payload)');
      return;
    }
    setDmButtons([
      ...dmButtons,
      { title: customBtnTitle.trim(), payload: customBtnPayload.trim().toUpperCase() },
    ]);
    setCustomBtnTitle('');
    setCustomBtnPayload('');
    setShowCustomBtnInput(false);
  };

  const handleRemoveButton = (index: number) => {
    setDmButtons(dmButtons.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (commentReplies.length === 0) {
      setErrorMessage('يجب إضافة صيغة رد واحدة على الأقل للتعليقات');
      return;
    }
    if (sendDm && !dmMessage.trim()) {
      setErrorMessage('يرجى كتابة نص الرسالة الخاصة أو تعطيل إرسال رسالة مسنجر');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();

      const payload = {
        is_enabled: isEnabled,
        auto_like_comment: autoLikeComment,
        comment_replies: commentReplies,
        send_dm: sendDm,
        dm_message: sendDm ? dmMessage.trim() : null,
        dm_image_url: sendDm && dmImageUrl.trim() ? dmImageUrl.trim() : null,
        dm_buttons: sendDm ? (dmButtons as any) : [],
        updated_at: new Date().toISOString(),
      };

      if (ruleId) {
        const { error } = await supabase
          .from('global_comment_rules')
          .update(payload)
          .eq('id', ruleId);

        if (error) throw error;
      } else {
        // Insert singleton row
        const { data, error } = await supabase
          .from('global_comment_rules')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (data) setRuleId(data.id);
      }

      setSuccessMessage('تم حفظ إعدادات الرد الاحتياطي العام للتعليقات بنجاح ✓');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to save global comment rule:', err);
      setErrorMessage(err?.message || 'تعذر حفظ الإعدادات، يرجى المحاولة لاحقاً');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Alert Callout Note */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-300">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block text-white font-bold mb-1">
            كيف يعمل الرد الاحتياطي العام (Global Fallback Rule)؟
          </strong>
          تُطبق هذه القاعدة تلقائياً على أي تعليق يصل على صفحة فيسبوك في حالتين:
          1) المنشور ليس له قاعدة مخصصة في تبويب "قواعد المنشورات".
          2) المنشور له قاعدة مشروطة بكلمات مفتاحية، ولكن تعليق العميل لم يحتوِ على أي من الكلمات المشروطة.
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section 1: Master Controls */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              تفعيل نظام الرد الاحتياطي العام
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تشغيل أو إيقاف الرد التلقائي الاحتياطي على مستوى كامل الصفحة
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-blue-400" />
              الإعجاب التلقائي بالتعليق (Auto-Like Comment)
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              وضع Like باسم المطعم على كل تعليق يتم الرد عليه احتياطياً
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
      </div>

      {/* Section 2: Randomized Public Comment Replies */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              صيغ الرد العام العشوائي على التعليقات
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              يقوم البوت باختيار صيغة عشوائية من هذه القائمة في كل مرة للرد على تعليق العميل العام
            </p>
          </div>
          <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
            <Sparkles className="w-3 h-3" />
            حماية من حظر السبام
          </span>
        </div>

        {/* Replies List */}
        <div className="space-y-2">
          {commentReplies.map((reply, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 group"
            >
              <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-mono shrink-0">
                {idx + 1}
              </span>
              <span className="flex-1 break-words leading-relaxed">{reply}</span>
              <button
                type="button"
                onClick={() => handleRemoveReply(idx)}
                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="حذف هذا الرد"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new reply input */}
        <div className="flex items-center gap-2 pt-2">
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
            placeholder="أضف صيغة رد بديلة للتعليقات العامة..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="button"
            onClick={handleAddReply}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            إضافة صيغة
          </button>
        </div>
      </div>

      {/* Section 3: Private Messenger DM */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              الرسالة الخاصة الترحيبية العامة (Messenger DM)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              إرسال رسالة ترحيب وقائمة المنيو والعروض مباشرة إلى صندوق رسائل العميل المعلق
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sendDm}
              onChange={(e) => setSendDm(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {sendDm && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80 animate-in fade-in duration-200">
            {/* Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نص الرسالة الترحيبية العامة
              </label>
              <textarea
                rows={4}
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="اكتب رسالة الترحيب العامة..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 leading-relaxed"
              />
            </div>

            {/* DM Image URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                رابط صورة البانر في الرسالة (اختياري)
              </label>
              <input
                type="url"
                value={dmImageUrl}
                onChange={(e) => setDmImageUrl(e.target.value)}
                placeholder="https://... رابط صورة الغلاف الترحيبي أو المنيو"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
                    الحد الأقصى 3 أزرار تظهر تحت الرسالة في تطبيق فيسبوك مسنجر
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
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
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
                      className="text-slate-500 hover:text-rose-400 p-1.5 transition-colors"
                      title="حذف الزر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Preset Buttons */}
              {dmButtons.length < 3 && (
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400">إضافة أزرار جاهزة:</span>
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
                      onClick={() => setShowCustomBtnInput(!showCustomBtnInput)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                    >
                      + زر مخصص
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Button Input */}
              {showCustomBtnInput && dmButtons.length < 3 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-700 space-y-2.5 animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-slate-300">إضافة زر مخصص</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customBtnTitle}
                      onChange={(e) => setCustomBtnTitle(e.target.value)}
                      placeholder="اسم الزر (مثال: طلب دليفري 🛵)"
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
                    />
                    <input
                      type="text"
                      value={customBtnPayload}
                      onChange={(e) => setCustomBtnPayload(e.target.value)}
                      placeholder="رمز الحدث (مثال: ORDER_NOW)"
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 uppercase font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomBtnInput(false)}
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
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xl shadow-amber-500/10 flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              حفظ إعدادات الرد الاحتياطي العام
            </>
          )}
        </button>
      </div>
    </form>
  );
}
