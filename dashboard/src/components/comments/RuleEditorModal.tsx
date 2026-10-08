'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus, Sparkles, X } from 'lucide-react';
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
  if (!d.name?.trim()) return 'اكتب اسم القاعدة';
  if (d.trigger_type === 'keywords' && !(d.keywords ?? []).length) return 'أضف كلمة واحدة على الأقل، أو اختر "أي تعليق"';
  const replies = (d.reply_variations ?? []).filter((r) => r.trim());
  if (d.reply_enabled && replies.length === 0) return 'أضف صيغة رد علني واحدة على الأقل أو أوقف الرد العلني';
  if (d.dm_enabled && !d.dm_message?.trim() && !d.dm_send_menu && !d.dm_send_offers && !d.dm_image_url?.trim()) {
    return 'الرسالة الخاصة فارغة: اكتب نص الرسالة أو اختر إرسال المنيو / العروض';
  }
  if (d.dm_image_url?.trim() && !/^https:\/\//i.test(d.dm_image_url.trim())) return 'رابط الصورة لازم يبدأ بـ https://';
  if (d.dm_buttons.some((b) => !b.title.trim() || !b.payload.trim())) return 'كل زر لازم يكون له اسم وكود';
  const anyAction =
    d.reply_enabled || d.like_comment || d.dm_enabled || d.hide_comment || d.create_complaint || d.notify_staff;
  if (!anyAction) return 'اختر إجراء واحد على الأقل';
  return null;
}

export function RuleEditorModal({ open, draft, pages, postPreview, onClose, onSave }: Props) {
  const [d, setD] = useState<RuleDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setD(draft);
    setError(null);
  }, [draft]);

  if (!d) return null;
  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  const toggleButton = (b: DmButton) => {
    const has = d.dm_buttons.some((x) => x.payload === b.payload);
    if (has) set('dm_buttons', d.dm_buttons.filter((x) => x.payload !== b.payload));
    else if (d.dm_buttons.length < MAX_DM_BUTTONS) set('dm_buttons', [...d.dm_buttons, b]);
  };

  const submit = async () => {
    const clean: RuleDraft = {
      ...d,
      name: d.name.trim(),
      keywords: d.trigger_type === 'keywords' ? d.keywords ?? [] : [],
      reply_variations: (d.reply_variations ?? []).map((r) => r.trim()).filter(Boolean),
      dm_message: d.dm_message?.trim() || null,
      dm_image_url: d.dm_image_url?.trim() || null,
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
      size="lg"
      icon={<Sparkles className="w-5 h-5" />}
      title={d.id ? 'تعديل القاعدة' : isPost ? 'قاعدة جديدة لهذا المنشور' : 'قاعدة عامة جديدة'}
      subtitle={isPost ? 'تُطبق على التعليقات على هذا المنشور فقط' : 'تُطبق على أي منشور ليس له قاعدة مطابقة'}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="button" className={btn.primary} onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            حفظ القاعدة
          </button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {isPost && postPreview && (
          <div className="flex gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            {postPreview.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={postPreview.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-800 shrink-0" />
            )}
            <p className="text-xs text-slate-400 line-clamp-3">{postPreview.caption || 'منشور بدون نص'}</p>
          </div>
        )}

        {/* Basics */}
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="sm:col-span-2 space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">اسم القاعدة *</span>
            <input
              className={inputClass}
              value={d.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={isPost ? 'مثال: السؤال عن سعر الوجبة' : 'مثال: طلب العنوان والفروع'}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الأولوية</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={d.priority ?? 100}
              onChange={(e) => set('priority', Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="block text-[11px] text-slate-500">الرقم الأصغر يتفحص الأول</span>
          </label>
        </div>

        {!isPost && pages.length > 1 && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الصفحة</span>
            <select
              className={inputClass}
              value={d.channel_id ?? ''}
              onChange={(e) => set('channel_id', e.target.value || null)}
            >
              <option value="">كل الصفحات</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.external_id}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Trigger */}
        <section className="space-y-2.5">
          <span className="text-xs font-semibold text-slate-300">متى تشتغل؟</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['keywords', 'لما التعليق فيه كلمات معينة'],
                ['any', 'أي تعليق'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => set('trigger_type', v)}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-xs font-bold border transition',
                  d.trigger_type === v
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {d.trigger_type === 'keywords' && (
            <TagInput
              value={d.keywords ?? []}
              onChange={(v) => set('keywords', v)}
              placeholder="اكتب الكلمة واضغط Enter (مثال: بكام، السعر، منيو)"
            />
          )}
          <p className="text-[11px] text-slate-500">
            المطابقة ذكية: &quot;سعر&quot; تلقط &quot;السعر&quot; و&quot;سعرها&quot;، ومش بتفرق بين أ/ا أو ة/ه.
          </p>
        </section>

        {/* Actions */}
        <section className="space-y-3">
          <span className="text-xs font-semibold text-slate-300">البوت يعمل إيه؟</span>

          <ActionRow label="رد علني على التعليق" hint="يختار صيغة عشوائية كل مرة لتجنب السبام" checked={!!d.reply_enabled} onChange={(v) => set('reply_enabled', v)}>
            <TextListEditor
              value={d.reply_variations ?? []}
              onChange={(v) => set('reply_variations', v)}
              placeholder="مثال: بعتنالك السعر في الخاص 🍗📩"
            />
          </ActionRow>

          <ActionRow label="لايك على التعليق" checked={!!d.like_comment} onChange={(v) => set('like_comment', v)} />

          <ActionRow
            label="رسالة خاصة (ماسنجر)"
            hint="فيسبوك يسمح برسالة خاصة واحدة لكل تعليق خلال 7 أيام"
            checked={!!d.dm_enabled}
            onChange={(v) => set('dm_enabled', v)}
          >
            <div className="space-y-3">
              <textarea
                rows={3}
                className={cn(inputClass, 'resize-y')}
                value={d.dm_message ?? ''}
                onChange={(e) => set('dm_message', e.target.value)}
                placeholder="نص الرسالة الخاصة..."
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <MiniCheck label="إرسال صور المنيو" checked={!!d.dm_send_menu} onChange={(v) => set('dm_send_menu', v)} />
                <MiniCheck label="إرسال العروض الحالية" checked={!!d.dm_send_offers} onChange={(v) => set('dm_send_offers', v)} />
              </div>
              <input
                className={inputClass}
                dir="ltr"
                value={d.dm_image_url ?? ''}
                onChange={(e) => set('dm_image_url', e.target.value)}
                placeholder="رابط صورة إضافية (اختياري) https://..."
              />
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  أزرار تحت الرسالة ({d.dm_buttons.length}/{MAX_DM_BUTTONS})
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
                          'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40',
                          on ? 'bg-blue-500/15 border-blue-500/40 text-blue-200' : 'bg-slate-950/50 border-slate-800 text-slate-400'
                        )}
                      >
                        {b.title}
                      </button>
                    );
                  })}
                </div>
                {d.dm_buttons.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={inputClass}
                      maxLength={MAX_BUTTON_TITLE}
                      value={b.title}
                      onChange={(e) => set('dm_buttons', d.dm_buttons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      placeholder="اسم الزر"
                    />
                    <input
                      className={cn(inputClass, 'font-mono text-xs')}
                      dir="ltr"
                      value={b.payload}
                      onChange={(e) => set('dm_buttons', d.dm_buttons.map((x, j) => (j === i ? { ...x, payload: e.target.value } : x)))}
                      placeholder="PAYLOAD"
                    />
                    <button
                      type="button"
                      onClick={() => set('dm_buttons', d.dm_buttons.filter((_, j) => j !== i))}
                      className="w-10 shrink-0 rounded-xl text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center"
                      aria-label="حذف الزر"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {d.dm_buttons.length < MAX_DM_BUTTONS && (
                  <button
                    type="button"
                    onClick={() => set('dm_buttons', [...d.dm_buttons, { title: '', payload: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> زر مخصص
                  </button>
                )}
              </div>
            </div>
          </ActionRow>

          <ActionRow label="إخفاء التعليق" hint="التعليق المخفي يظهر لصاحبه وأصدقائه فقط" checked={!!d.hide_comment} onChange={(v) => set('hide_comment', v)} />
          <ActionRow label="فتح شكوى تلقائياً" checked={!!d.create_complaint} onChange={(v) => set('create_complaint', v)} />
          <ActionRow label="تنبيه الفريق على تليجرام" checked={!!d.notify_staff} onChange={(v) => set('notify_staff', v)} />
        </section>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
          <span className="text-xs font-semibold text-slate-300">القاعدة مفعلة</span>
          <Switch checked={!!d.is_active} onChange={(v) => set('is_active', v)} label="تفعيل القاعدة" />
        </div>

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

function ActionRow({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border transition', checked ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-slate-800 bg-slate-950/40')}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-200">{label}</p>
          {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
        </div>
        <Switch checked={checked} onChange={onChange} label={label} size="sm" />
      </div>
      {checked && children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function MiniCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-500" />
      {label}
    </label>
  );
}
