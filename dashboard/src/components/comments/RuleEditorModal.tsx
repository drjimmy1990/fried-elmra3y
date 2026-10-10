'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Modal, btn, inputClass } from '@/components/ui/Modal';
import { Switch, TagInput, TextListEditor } from '@/components/ui/FormControls';
import { cn } from '@/lib/utils';
import {
  DM_BUTTON_PRESETS,
  MAX_BUTTON_TITLE,
  MAX_DM_BUTTONS,
  type DmButton,
  type PageOption,
  type RuleDraft,
} from './types';

interface Props {
  open: boolean;
  draft: RuleDraft | null;
  pages: PageOption[];
  /** Preview of the post for post-scope rules. */
  postPreview?: { caption: string | null; thumbnail: string | null } | null;
  onClose: () => void;
  onSave: (draft: RuleDraft) => Promise<void>;
}

function validate(d: RuleDraft): string | null {
  if (!d.name?.trim()) return 'اكتب اسماً للقاعدة لتتعرف عليها';
  if (d.trigger_type === 'keywords' && !(d.keywords ?? []).length) {
    return 'أضف كلمة مفتاحية واحدة على الأقل، أو اختر "أي تعليق"';
  }
  const replies = (d.reply_variations ?? []).filter((r) => r.trim());
  if (d.reply_enabled && replies.length === 0) {
    return 'أضف نص الرد العلني أو قم بإيقاف الرد العلني';
  }
  if (d.dm_enabled && !d.dm_message?.trim() && !d.dm_image_url?.trim() && !(d.dm_buttons && d.dm_buttons.length > 0)) {
    return 'الرسالة الخاصة مفعلة لكنها فارغة: اكتب نص الرسالة أو اختر أزراراً سريعة';
  }
  return null;
}

export const BUTTON_ACTIONS = [
  { label: 'طلب أوردر / وجبة 🛵', payload: 'START_ORDER' },
  { label: 'عرض المنيو والأسعار 🍗', payload: 'VIEW_MENU' },
  { label: 'عروض وتخفيضات 🔥', payload: 'VIEW_OFFERS' },
  { label: 'تحدث مع موظف 👨‍💼', payload: 'HUMAN_AGENT' },
  { label: 'فروع المطعم 📍', payload: 'BRANCHES' },
];

export function RuleEditorModal({ open, draft, pages, postPreview, onClose, onSave }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<RuleDraft | null>(draft);
  const [replyMode, setReplyMode] = useState<'single' | 'random'>('single');
  const [singleReply, setSingleReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentImgInputRef = useRef<HTMLInputElement | null>(null);

  // DM Button Builder State
  const [editingBtnIndex, setEditingBtnIndex] = useState<number | null>(null);
  const [editBtnTitle, setEditBtnTitle] = useState('');
  const [editBtnPayload, setEditBtnPayload] = useState('START_ORDER');
  const [isAddingBtn, setIsAddingBtn] = useState(false);
  const [newBtnTitle, setNewBtnTitle] = useState('');
  const [newBtnPayload, setNewBtnPayload] = useState('START_ORDER');

  useEffect(() => {
    setD(draft);
    setError(null);
    setEditingBtnIndex(null);
    setIsAddingBtn(false);
    if (draft) {
      const vars = draft.reply_variations ?? [];
      if (vars.length > 1) {
        setReplyMode('random');
        setSingleReply(vars[0] || '');
      } else {
        setReplyMode('single');
        setSingleReply(vars[0] || '');
      }
    }
  }, [draft]);

  if (!d) return null;
  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  const toggleButton = (b: DmButton) => {
    const has = d.dm_buttons.some((x) => x.payload === b.payload);
    if (has) set('dm_buttons', d.dm_buttons.filter((x) => x.payload !== b.payload));
    else if (d.dm_buttons.length < MAX_DM_BUTTONS) set('dm_buttons', [...d.dm_buttons, b]);
  };

  const removeButton = (idx: number) => {
    set('dm_buttons', d.dm_buttons.filter((_, i) => i !== idx));
    if (editingBtnIndex === idx) setEditingBtnIndex(null);
  };

  const startEditButton = (idx: number) => {
    const b = d.dm_buttons[idx];
    if (!b) return;
    setEditingBtnIndex(idx);
    setEditBtnTitle(b.title);
    setEditBtnPayload(b.payload);
  };

  const saveEditButton = (idx: number) => {
    if (!editBtnTitle.trim()) return;
    const next = [...d.dm_buttons];
    next[idx] = {
      title: editBtnTitle.trim().slice(0, MAX_BUTTON_TITLE),
      payload: editBtnPayload.trim() || 'START_ORDER',
    };
    set('dm_buttons', next);
    setEditingBtnIndex(null);
  };

  const addCustomButton = () => {
    if (!newBtnTitle.trim() || d.dm_buttons.length >= MAX_DM_BUTTONS) return;
    const updated = [
      ...d.dm_buttons,
      {
        title: newBtnTitle.trim().slice(0, MAX_BUTTON_TITLE),
        payload: newBtnPayload.trim() || 'START_ORDER',
      },
    ];
    set('dm_buttons', updated);
    setNewBtnTitle('');
    setIsAddingBtn(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `rules/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage.from('menu-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu-assets').getPublicUrl(filePath);
      if (data?.publicUrl) {
        set('comment_image_url', data.publicUrl);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploadingImg(false);
      if (commentImgInputRef.current) commentImgInputRef.current.value = '';
    }
  };

  const submit = async () => {
    let finalReplies: string[] = [];
    if (d.reply_enabled) {
      if (replyMode === 'single') {
        finalReplies = singleReply.trim() ? [singleReply.trim()] : [];
      } else {
        finalReplies = (d.reply_variations ?? []).map((r) => r.trim()).filter(Boolean);
      }
    }

    const clean: RuleDraft = {
      ...d,
      name: d.name.trim() || (isPost ? 'قاعدة المنشور' : 'قاعدة عامة'),
      keywords: d.trigger_type === 'keywords' ? d.keywords ?? [] : [],
      reply_variations: finalReplies,
      dm_message: d.dm_message?.trim() || null,
      dm_image_url: d.dm_image_url?.trim() || null,
      comment_image_url: d.comment_image_url?.trim() || null,
      delete_keywords: d.delete_keywords ?? [],
      auto_delete: Boolean(d.auto_delete),
      dm_buttons: d.dm_buttons.map((b) => ({ title: b.title.trim(), payload: b.payload.trim().toUpperCase() })),
    };

    const err = validate(clean);
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      await onSave(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const isPost = d.scope === 'post';

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="xl"
      icon={<Sparkles className="w-5 h-5 text-amber-400" />}
      title={isPost ? 'إعدادات الرد التلقائي على المنشور' : d.id ? 'تعديل القاعدة العامة' : 'قاعدة عامة جديدة'}
      subtitle={isPost ? 'حدد شروط الرد، نص التعليق، الصورة المرفقة، والرسالة الخاصة لهذا المنشور' : 'تُطبق كبديل عام عند عدم وجود قاعدة مخصصة'}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="button" className={btn.primary} onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            حفظ إعدادات المنشور
          </button>
        </>
      }
    >
      <div className="space-y-6 text-sm">
        {/* Post Preview Banner */}
        {isPost && postPreview && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            {postPreview.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={postPreview.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-800" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-800/80 shrink-0 flex items-center justify-center text-slate-500">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">المنشور المحدد</span>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{postPreview.caption || 'منشور بدون نص'}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 pl-2">
              <span className={cn('text-xs font-bold', d.is_active ? 'text-emerald-400' : 'text-slate-500')}>
                {d.is_active ? '🟢 مفعل' : '⚪ متوقف'}
              </span>
              <Switch checked={!!d.is_active} onChange={(v) => set('is_active', v)} label="تفعيل القاعدة" />
            </div>
          </div>
        )}

        {/* Rule Title (Hidden for Post or simplified) */}
        {!isPost && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">اسم القاعدة *</span>
            <input
              className={inputClass}
              value={d.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="مثال: السؤال عن السعر أو المنيو"
            />
          </label>
        )}

        {/* 1. Trigger Conditions */}
        <section className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              متى يتم تفعيل الرد على هذا المنشور؟
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['any', 'الرد على أي تعليق (بدون شروط)'],
              ['keywords', 'الرد فقط عند وجود كلمات معينة'],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => set('trigger_type', v as 'any' | 'keywords')}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-xs font-bold border transition text-center',
                  d.trigger_type === v
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-800 dark:text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {d.trigger_type === 'keywords' && (
            <div className="space-y-1.5 pt-1">
              <TagInput
                value={d.keywords ?? []}
                onChange={(v) => set('keywords', v)}
                placeholder="اكتب الكلمة واضغط Enter (مثال: بكام، السعر، منيو، عرض)"
              />
              <p className="text-[11px] text-slate-500">
                المطابقة ذكية: كتابة &quot;سعر&quot; ستلتقط &quot;السعر&quot;، &quot;سعره&quot;، وبدون حساسية للهمزات.
              </p>
            </div>
          )}
        </section>

        {/* 2. Toxic/Forbidden Words (Auto Delete / Hide) */}
        <section className="p-4 rounded-2xl bg-rose-50/50 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-500/20 space-y-3">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">إخفاء أو حذف التعليق عند كلمات معينة</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">لو كتب العميل أي كلمة من هذه الكلمات، لن يتم الرد وسيتم إخفاء/حذف التعليق فوراً.</p>
              </div>
            </div>
            <Switch
              checked={(d.delete_keywords?.length ?? 0) > 0 || !!d.hide_comment}
              onChange={(v) => {
                if (!v) {
                  set('delete_keywords', []);
                  set('hide_comment', false);
                } else if ((d.delete_keywords?.length ?? 0) === 0) {
                  set('delete_keywords', ['نصابين', 'وحش', 'بارد']);
                  set('hide_comment', true);
                }
              }}
              label="تفعيل الحظر"
            />
          </header>

          {((d.delete_keywords?.length ?? 0) > 0 || !!d.hide_comment) && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <TagInput
                tone="rose"
                value={d.delete_keywords ?? []}
                onChange={(v) => set('delete_keywords', v)}
                placeholder="اكتب الكلمة المسيئة واضغط Enter (مثال: نصابين، زفت، بارد، سيء)"
              />
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">الإجراء المطلوب:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="auto_delete_opt"
                    checked={!d.auto_delete}
                    onChange={() => set('auto_delete', false)}
                    className="accent-amber-500"
                  />
                  <span>إخفاء التعليق فقط (يظهر لصاحبه فقط)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-rose-700 dark:text-rose-300 font-semibold">
                  <input
                    type="radio"
                    name="auto_delete_opt"
                    checked={!!d.auto_delete}
                    onChange={() => set('auto_delete', true)}
                    className="accent-rose-500"
                  />
                  <span>حذف نهائي للتعليق (Delete)</span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* 3. Public Comment Reply */}
        <section className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">الرد العلني في الكومنت (Public Reply)</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">كتابة رد عام يظهر لكل المتابعين تحت تعليق العميل.</p>
              </div>
            </div>
            <Switch checked={!!d.reply_enabled} onChange={(v) => set('reply_enabled', v)} label="الرد العلني" />
          </header>

          {d.reply_enabled && (
            <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
              {/* Reply Mode: Single vs Random */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">صيغة الرد:</span>
                <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyMode('single');
                      if (singleReply.trim()) set('reply_variations', [singleReply.trim()]);
                    }}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold transition',
                      replyMode === 'single' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    رد موحد للكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyMode('random')}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold transition',
                      replyMode === 'random' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    ردود عشوائية متغيرة (تجنب السبام)
                  </button>
                </div>
              </div>

              {replyMode === 'single' ? (
                <textarea
                  rows={2}
                  className={cn(inputClass, 'resize-y text-xs')}
                  value={singleReply}
                  onChange={(e) => {
                    setSingleReply(e.target.value);
                    set('reply_variations', [e.target.value]);
                  }}
                  placeholder="مثال: أهلاً بك يا فندم! بعتنالك كافة التفاصيل في رسالة خاصة 📩🍗"
                />
              ) : (
                <div className="space-y-1.5">
                  <TextListEditor
                    value={d.reply_variations ?? []}
                    onChange={(v) => set('reply_variations', v)}
                    placeholder="اكتب صيغة رد واضغط Enter (مثال: بعتنالك السعر في الخاص 🍗📩)"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    يتم اختيار واحدة من هذه الصيغ عشوائياً لكل تعليق لتبدو الردود طبيعية وفيسبوك لا يحظر الصفحة.
                  </span>
                </div>
              )}

              {/* Attach Image in Comment */}
              <div className="pt-2 border-t border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    إرفاق صورة مع الرد في الكومنت (اختياري)
                  </span>
                  {d.comment_image_url && (
                    <button
                      type="button"
                      onClick={() => set('comment_image_url', null)}
                      className="text-[11px] text-rose-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> إزالة الصورة
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {d.comment_image_url && (
                    <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.comment_image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    ref={commentImgInputRef}
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  <button
                    type="button"
                    disabled={uploadingImg}
                    onClick={() => commentImgInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    {uploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-amber-400" />}
                    {d.comment_image_url ? 'تغيير الصورة' : 'رفع صورة للرد في الكومنت'}
                  </button>

                  <input
                    type="url"
                    dir="ltr"
                    className={cn(inputClass, 'flex-1 text-xs')}
                    value={d.comment_image_url ?? ''}
                    onChange={(e) => set('comment_image_url', e.target.value)}
                    placeholder="أو ضع رابط مباشر للصورة https://..."
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. Private Messenger Reply */}
        <section className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">الرد في رسالة خاصة (ماسنجر)</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">إرسال رسالة ترحيبية فورية إلى صندوق رسائل العميل.</p>
              </div>
            </div>
            <Switch checked={!!d.dm_enabled} onChange={(v) => set('dm_enabled', v)} label="الرسالة الخاصة" />
          </header>

          {d.dm_enabled && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <textarea
                rows={3}
                className={cn(inputClass, 'resize-y text-xs')}
                value={d.dm_message ?? ''}
                onChange={(e) => set('dm_message', e.target.value)}
                placeholder="أهلاً بك يا فندم! بناءً على طلبك، إليك تفاصيل العرض والأسعار..."
              />

              {/* DM Quick Buttons Builder */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      أزرار الرد السريع تحت الرسالة ({d.dm_buttons.length}/{MAX_DM_BUTTONS})
                    </span>
                    <span className="text-[10px] text-slate-400">(حد أقصى 3 أزرار حسب سياسة فيسبوك)</span>
                  </div>
                  {!isAddingBtn && d.dm_buttons.length < MAX_DM_BUTTONS && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBtn(true);
                        setNewBtnTitle('');
                        setNewBtnPayload('START_ORDER');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:text-blue-400 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة زر مخصص
                    </button>
                  )}
                </div>

                {/* Active buttons list */}
                {d.dm_buttons.length > 0 && (
                  <div className="space-y-1.5">
                    {d.dm_buttons.map((b, idx) => {
                      const isEditing = editingBtnIndex === idx;
                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-wrap items-center gap-2 text-xs"
                          >
                            <input
                              type="text"
                              maxLength={MAX_BUTTON_TITLE}
                              className={cn(inputClass, 'flex-1 py-1 text-xs')}
                              value={editBtnTitle}
                              onChange={(e) => setEditBtnTitle(e.target.value)}
                              placeholder="عنوان الزر (مثلاً: اطلب الآن)"
                            />
                            <select
                              className={cn(inputClass, 'w-auto py-1 text-xs bg-slate-900')}
                              value={editBtnPayload}
                              onChange={(e) => setEditBtnPayload(e.target.value)}
                            >
                              {BUTTON_ACTIONS.map((act) => (
                                <option key={act.payload} value={act.payload}>
                                  {act.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => saveEditButton(idx)}
                              disabled={!editBtnTitle.trim()}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
                              title="حفظ التعديل"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBtnIndex(null)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      const matchedAction = BUTTON_ACTIONS.find((act) => act.payload === b.payload);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{b.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 font-medium border border-blue-500/20">
                              {matchedAction ? matchedAction.label : b.payload}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditButton(idx)}
                              className="p-1 text-slate-400 hover:text-blue-400 transition rounded"
                              title="تعديل الزر"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeButton(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition rounded"
                              title="حذف الزر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Custom Button Form */}
                {isAddingBtn && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/40 space-y-2">
                    <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                      <span>إضافة زر جديد:</span>
                      <span className="text-[10px] text-slate-400 font-normal">أقصى طول للعنوان 20 حرف</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        maxLength={MAX_BUTTON_TITLE}
                        className={cn(inputClass, 'flex-1 py-1.5 text-xs')}
                        value={newBtnTitle}
                        onChange={(e) => setNewBtnTitle(e.target.value)}
                        placeholder="نص الزر (مثلاً: اطلب دليفري 🛵)"
                        autoFocus
                      />
                      <select
                        className={cn(inputClass, 'w-auto py-1.5 text-xs bg-slate-900')}
                        value={newBtnPayload}
                        onChange={(e) => setNewBtnPayload(e.target.value)}
                      >
                        {BUTTON_ACTIONS.map((act) => (
                          <option key={act.payload} value={act.payload}>
                            {act.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingBtn(false)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={addCustomButton}
                        disabled={!newBtnTitle.trim()}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition"
                      >
                        إضافة الزر
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Presets Suggestions */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    أو اختر من الأزرار الجاهزة بنقرة واحدة:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DM_BUTTON_PRESETS.map((b) => {
                      const on = d.dm_buttons.some((x) => x.payload === b.payload);
                      return (
                        <button
                          key={b.payload}
                          type="button"
                          onClick={() => toggleButton(b)}
                          disabled={!on && d.dm_buttons.length >= MAX_DM_BUTTONS}
                          className={cn(
                            'px-2 py-1 rounded-lg text-[11px] font-semibold border transition disabled:opacity-40',
                            on
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-200'
                              : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-500/40'
                          )}
                        >
                          {on ? `✓ ${b.title}` : `+ ${b.title}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 5. Auto-Like */}
        <section className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">لايك تلقائي على التعليق</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">عمل Like فوري على تعليق العميل لزيادة التفاعل.</p>
            </div>
          </div>
          <Switch checked={!!d.like_comment} onChange={(v) => set('like_comment', v)} label="لايك تلقائي" />
        </section>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
