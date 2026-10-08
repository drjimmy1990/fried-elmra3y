'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, Timer } from 'lucide-react';
import { btn, inputClass } from '@/components/ui/Modal';
import { Switch, TagInput } from '@/components/ui/FormControls';
import { cn } from '@/lib/utils';
import type { CommentSettings } from './types';

interface Props {
  settings: CommentSettings;
  canEdit: boolean;
  onSave: (patch: Partial<CommentSettings>) => Promise<void>;
}

export function CommentSettingsForm({ settings, canEdit, onSave }: Props) {
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setS(settings), [settings]);
  const set = <K extends keyof CommentSettings>(k: K, v: CommentSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const save = async () => {
    if (s.reply_delay_max_sec < s.reply_delay_min_sec) {
      return setMsg({ ok: false, text: 'أقصى تأخير لازم يكون أكبر من أو يساوي أقل تأخير' });
    }
    setSaving(true);
    setMsg(null);
    try {
      await onSave({
        sensitive_keywords: s.sensitive_keywords,
        complaint_public_reply: s.complaint_public_reply?.trim() || null,
        complaint_dm_message: s.complaint_dm_message?.trim() || null,
        complaint_hide_comment: s.complaint_hide_comment,
        complaint_create_ticket: s.complaint_create_ticket,
        complaint_notify_staff: s.complaint_notify_staff,
        dm_cooldown_hours: s.dm_cooldown_hours,
        reply_delay_min_sec: s.reply_delay_min_sec,
        reply_delay_max_sec: s.reply_delay_max_sec,
        ignore_nested_replies: s.ignore_nested_replies,
        ignore_mentions_only: s.ignore_mentions_only,
      });
      setMsg({ ok: true, text: 'تم حفظ الإعدادات' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'تعذر الحفظ' });
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string, min = 0, max = 10000) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  return (
    <div className="space-y-5">
      {/* Complaint words */}
      <section className="p-5 rounded-3xl bg-slate-900/60 border border-rose-500/20 space-y-4">
        <header className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <div>
            <h3 className="text-sm font-bold text-white">كلمات الشكاوى والكلمات الحساسة</h3>
            <p className="text-[11px] text-slate-400">لو التعليق فيه أي كلمة منهم، البوت مش هيرد رد عادي — هيتعامل معاه كشكوى (قبل أي قاعدة).</p>
          </div>
        </header>
        <TagInput
          tone="rose"
          disabled={!canEdit}
          value={s.sensitive_keywords}
          onChange={(v) => set('sensitive_keywords', v)}
          placeholder="مثال: بارد، اتأخر، مش مستوي، شكوى"
        />
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الرد العلني على الشكوى</span>
            <textarea
              rows={3}
              disabled={!canEdit}
              className={cn(inputClass, 'resize-y')}
              value={s.complaint_public_reply ?? ''}
              onChange={(e) => set('complaint_public_reply', e.target.value)}
              placeholder="اتركه فارغاً لعدم الرد علنياً"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">رسالة الاعتذار في الخاص</span>
            <textarea
              rows={3}
              disabled={!canEdit}
              className={cn(inputClass, 'resize-y')}
              value={s.complaint_dm_message ?? ''}
              onChange={(e) => set('complaint_dm_message', e.target.value)}
              placeholder="اتركه فارغاً لعدم الإرسال"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <ToggleTile label="إخفاء تعليق الشكوى" checked={s.complaint_hide_comment} disabled={!canEdit} onChange={(v) => set('complaint_hide_comment', v)} />
          <ToggleTile label="فتح تذكرة شكوى" checked={s.complaint_create_ticket} disabled={!canEdit} onChange={(v) => set('complaint_create_ticket', v)} />
          <ToggleTile label="تنبيه تليجرام" checked={s.complaint_notify_staff} disabled={!canEdit} onChange={(v) => set('complaint_notify_staff', v)} />
        </div>
      </section>

      {/* Anti-spam */}
      <section className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <header className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-white">الحماية من السبام</h3>
            <p className="text-[11px] text-slate-400">عشان ردود البوت تبان طبيعية وفيسبوك ميعتبرهاش سبام.</p>
          </div>
        </header>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">مدة منع تكرار الرسالة الخاصة (ساعات)</span>
            <input
              type="number"
              min={0}
              max={720}
              disabled={!canEdit}
              className={inputClass}
              value={s.dm_cooldown_hours}
              onChange={(e) => set('dm_cooldown_hours', num(e.target.value, 0, 720))}
            />
            <span className="block text-[11px] text-slate-500">نفس الشخص مش هياخد رسالة خاصة تانية قبل المدة دي (0 = بدون حد)</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">أقل تأخير قبل الرد (ثانية)</span>
            <input
              type="number"
              min={0}
              max={600}
              disabled={!canEdit}
              className={inputClass}
              value={s.reply_delay_min_sec}
              onChange={(e) => set('reply_delay_min_sec', num(e.target.value, 0, 600))}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">أقصى تأخير قبل الرد (ثانية)</span>
            <input
              type="number"
              min={0}
              max={600}
              disabled={!canEdit}
              className={inputClass}
              value={s.reply_delay_max_sec}
              onChange={(e) => set('reply_delay_max_sec', num(e.target.value, 0, 600))}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <ToggleTile
            label="تجاهل الردود على التعليقات"
            hint="البوت يرد على التعليقات الأساسية فقط"
            checked={s.ignore_nested_replies}
            disabled={!canEdit}
            onChange={(v) => set('ignore_nested_replies', v)}
          />
          <ToggleTile
            label="تجاهل المنشن والإيموجي فقط"
            hint="تعليقات زي ❤️ أو منشن لصاحبه"
            checked={s.ignore_mentions_only}
            disabled={!canEdit}
            onChange={(v) => set('ignore_mentions_only', v)}
          />
        </div>
      </section>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {msg && (
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', msg.ok ? 'text-emerald-300' : 'text-rose-300')}>
              {msg.ok && <CheckCircle2 className="w-4 h-4" />}
              {msg.text}
            </span>
          )}
          <button type="button" className={btn.primary} onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            حفظ إعدادات التعليقات
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleTile({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} size="sm" />
    </div>
  );
}
