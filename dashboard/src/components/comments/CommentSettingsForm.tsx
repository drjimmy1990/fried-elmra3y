'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { btn, inputClass } from '@/components/ui/Modal';
import { Switch, TagInput } from '@/components/ui/FormControls';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/database.types';
import {
  DEFAULT_ACTION_ASSETS,
  parseActionAssets,
  type ActionAsset,
  type CommentSettings,
} from './types';

const DEFAULT_AI_PROMPT = `أنت المشرف الذكي وممثل خدمة العملاء لمطعم فراخ مقلية وبروستد كريسبي في مصر. تتميز بالود، اللهجة المصرية الدارجة السريعة والمحترمة، واستخدام الإيموجي المناسب (🍗🔥🛵❤️).

مهمتك تحليل كل تعليق وتحديد الإجراء المطلوب والرد المناسب.

### 1. تحديد القرار (decision):
- اختر (DELETE): إذا احتوى التعليق على سباب، ألفاظ خارجة، إعلانات، روابط، ترويج لمنافسين، أو تعليق هجومي مسيء جداً.
- اختر (KEEP): لجميع التعليقات الأخرى المقبولة.

### 2. تحديد نوع الإجراء والصورة المرفقة (action):
- اختر "normal": لأي تعليق عام، استفسار عادي، شكر ومجاملة، أو سؤال لا يحتاج صورة مرفقة في الكومنت.
- اختر اسم الإجراء المناسب من قائمة الإجراءات المحددة في النظام بناءً على قصد العميل (مثل branches إذا سأل عن الفروع، menu إذا طلب المنيو، offers إذا سأل عن العروض، إلخ). سيقوم النظام بإرفاق الصورة المخصصة لهذا الإجراء تلقائياً مع الرد.

### 3. الشكاوى (is_complaint):
- اجعلها true: إذا اشتكى العميل من تجربة سيئة (أكل بارد، تأخير في التوصيل، أوردر ناقص، فراخ مش مستوية).
- اجعلها false: في أي تعليق عادي أو استفسار.

### 4. الرد العلني (public_reply):
- اكتب ردك بأسلوب جذاب باللهجة المصرية (سطر إلى سطرين).
- إذا كان action ليس "normal" (أي يتضمن صورة مرفقة كالفروع أو المنيو أو العروض)، أشر في الرد باختصار إلى أن التفاصيل موضحة في الصورة المرفقة بالتعليق.
- إذا كان القرار DELETE: اتركه فارغاً "".

### 5. الرسالة الخاصة (send_dm & dm_message):
- اجعل send_dm: true واكتب رسالة خاصة لطيفة في dm_message لتشجيع العميل على الطلب أو حل مشكلته إذا كان تعليقه شكوى أو طلباً خاصاً.

### صيغة الإخراج الإلزامية (JSON فقط بدون أي نص إضافي):
{
  "decision": "KEEP" | "DELETE",
  "action": "normal" | "<اسم_الإجراء>",
  "is_complaint": true | false,
  "public_reply": "نص الرد العام هنا",
  "send_dm": true | false,
  "dm_message": "نص الرسالة الخاصة هنا"
}`;

interface Props {
  settings: CommentSettings;
  canEdit: boolean;
  onSave: (patch: Partial<CommentSettings>) => Promise<void>;
}

export function CommentSettingsForm({ settings, canEdit, onSave }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [s, setS] = useState(settings);
  const [actionAssets, setActionAssets] = useState<ActionAsset[]>(() => {
    const parsed = parseActionAssets(settings.action_assets as Json);
    return parsed.length > 0 ? parsed : DEFAULT_ACTION_ASSETS;
  });

  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    setS(settings);
    const parsed = parseActionAssets(settings.action_assets as Json);
    setActionAssets(parsed.length > 0 ? parsed : DEFAULT_ACTION_ASSETS);
  }, [settings]);

  const set = <K extends keyof CommentSettings>(k: K, v: CommentSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const initialAssetsJson = JSON.stringify(parseActionAssets(settings.action_assets as Json));
  const currentAssetsJson = JSON.stringify(actionAssets);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings) || initialAssetsJson !== currentAssetsJson;

  const save = async () => {
    if (s.reply_delay_max_sec < s.reply_delay_min_sec) {
      return setMsg({ ok: false, text: 'أقصى تأخير لازم يكون أكبر من أو يساوي أقل تأخير' });
    }

    // Validate that action assets have valid keys
    for (const a of actionAssets) {
      if (!a.name.trim()) {
        return setMsg({ ok: false, text: 'يجب كتابة اسم معرّف (Action Key) لكل صورة' });
      }
    }

    setSaving(true);
    setMsg(null);
    try {
      // Sync legacy fields if keys exist
      const branchesImg = actionAssets.find((a) => a.name === 'branches')?.image_url || null;
      const menuImg = actionAssets.find((a) => a.name === 'menu')?.image_url || null;
      const offersImg = actionAssets.find((a) => a.name === 'offers')?.image_url || null;

      await onSave({
        ai_enabled: s.ai_enabled,
        ai_system_prompt: s.ai_system_prompt?.trim() || null,
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
        action_assets: actionAssets as unknown as Json,
        fallback_dm_message: s.fallback_dm_message?.trim() || null,
        branches_image_url: branchesImg,
        menu_image_url: menuImg,
        offers_image_url: offersImg,
      });
      setMsg({ ok: true, text: 'تم حفظ الإعدادات وقائمة الصور بنجاح' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'تعذر الحفظ' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }

    setUploadingIndex(index);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `actions/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage.from('menu-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu-assets').getPublicUrl(filePath);
      if (data?.publicUrl) {
        updateActionAsset(index, { image_url: data.publicUrl });
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('حدث خطأ أثناء رفع الصورة إلى السيرفر');
    } finally {
      setUploadingIndex(null);
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index]!.value = '';
      }
    }
  };

  const addActionAsset = () => {
    const newId = `asset_${Date.now()}`;
    setActionAssets((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        label: '',
        description: '',
        image_url: '',
      },
    ]);
  };

  const updateActionAsset = (index: number, patch: Partial<ActionAsset>) => {
    setActionAssets((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const removeActionAsset = (index: number) => {
    setActionAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const moveActionAsset = (index: number, direction: 'up' | 'down') => {
    setActionAssets((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const num = (v: string, min = 0, max = 10000) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  return (
    <div className="space-y-6">
      {/* AI Comment Agent */}
      <section className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-amber-500/30 space-y-4 shadow-xl shadow-amber-500/5">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">المساعد الذكي للتعليقات (AI Comment Agent)</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-3 h-3" /> المحرك الأساسي
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                الذكاء الاصطناعي بيحلل نية التعليق، يحدد الإجراء والصورة المرفقة، يخفي السبام، ويسجل الشكاوى تلقائياً.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', s.ai_enabled ? 'text-emerald-400' : 'text-slate-500')}>
              {s.ai_enabled ? '🟢 الذكاء الاصطناعي مفعل' : '⚪ معطل'}
            </span>
            <Switch
              checked={s.ai_enabled}
              onChange={(v) => set('ai_enabled', v)}
              disabled={!canEdit}
              label="تفعيل الذكاء الاصطناعي للتعليقات"
            />
          </div>
        </header>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-200">
              تعليمات وأسلوب الذكاء الاصطناعي (System Prompt)
            </label>
            {canEdit && (
              <button
                type="button"
                onClick={() => set('ai_system_prompt', DEFAULT_AI_PROMPT)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <RotateCcw className="w-3 h-3" /> استعادة القالب الافتراضي للمطعم
              </button>
            )}
          </div>
          <textarea
            rows={10}
            disabled={!canEdit || !s.ai_enabled}
            className={cn(inputClass, 'font-sans text-xs leading-relaxed resize-y', !s.ai_enabled && 'opacity-50')}
            value={s.ai_system_prompt ?? ''}
            onChange={(e) => set('ai_system_prompt', e.target.value)}
            placeholder="اكتب تعليمات الذكاء الاصطناعي هنا..."
          />
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>البوت بيعتمد على أنواع الصور والإجراءات المحددة بالأسفل في اتخاذ القرار وإرفاق الصورة المناسبة.</span>
            <span>{s.ai_system_prompt?.length ?? 0} حرف</span>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                الرسالة الخاصة التلقائية / الاحتياطية (Fallback DM Message)
              </label>
              <span className="text-[11px] text-amber-400">تُرسل في الخاص لكل المعلقين إذا لم يولد الذكاء الاصطناعي رسالة مخصصة</span>
            </div>
            <textarea
              rows={2}
              disabled={!canEdit}
              className={cn(inputClass, 'font-sans text-xs resize-y')}
              value={s.fallback_dm_message ?? ''}
              onChange={(e) => set('fallback_dm_message', e.target.value)}
              placeholder="أهلاً بحضرتك يا فندم نورتنا! 🍗 تقدر تطلب أو تستفسر عن أي حاجة من هنا مباشرة 🛵"
            />
          </div>
        </div>
      </section>

      {/* Dynamic Action Assets & Images Manager */}
      <section className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">صور وإجراءات الرد الآلي (Action Images & Intents)</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                  {actionAssets.length} صور مضافة
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                أضف الصور التي تريد من البوت إرفاقها في التعليقات (مثل المنيو، الفروع، العروض، مسابقات). كل صورة لها اسم معرّف ووصف نية يوجه الذكاء الاصطناعي لاختيارها.
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActionAssets(DEFAULT_ACTION_ASSETS)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> استعادة الافتراضي
              </button>
              <button
                type="button"
                onClick={addActionAsset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition shadow"
              >
                <Plus className="w-4 h-4" /> إضافة صورة وإجراء
              </button>
            </div>
          )}
        </header>

        {actionAssets.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">لا توجد صور أو إجراءات مضافة حالياً.</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setActionAssets(DEFAULT_ACTION_ASSETS)}
                className="mt-3 text-xs font-bold text-amber-400 hover:underline"
              >
                تحميل الإجراءات الافتراضية (الفروع، المنيو، العروض)
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {actionAssets.map((asset, index) => (
              <div
                key={asset.id || index}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      action: &quot;{asset.name || 'غير محدد'}&quot;
                    </span>
                    {asset.label && <span className="text-xs font-semibold text-slate-200">({asset.label})</span>}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveActionAsset(index, 'up')}
                        disabled={index === 0}
                        title="تحريك لأعلى"
                        className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActionAsset(index, 'down')}
                        disabled={index === actionAssets.length - 1}
                        title="تحريك لأسفل"
                        className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeActionAsset(index)}
                        title="حذف هذا الإجراء"
                        className="p-1 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition mr-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-12 gap-3 items-start">
                  {/* Image Preview & Upload (4 cols) */}
                  <div className="md:col-span-4 flex flex-col items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="w-full h-32 rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800 relative group">
                      {asset.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={asset.image_url}
                          alt={asset.label || asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                          <span className="text-[10px]">لا توجد صورة</span>
                        </div>
                      )}

                      {uploadingIndex === index && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center gap-1.5 text-xs text-amber-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الرفع...</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={!canEdit || uploadingIndex === index}
                        ref={(el) => {
                          fileInputRefs.current[index] = el;
                        }}
                        className="hidden"
                        onChange={(e) => handleFileUpload(index, e)}
                      />
                      <button
                        type="button"
                        disabled={!canEdit || uploadingIndex === index}
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" /> رفع صورة
                      </button>
                    </div>

                    <input
                      type="url"
                      disabled={!canEdit}
                      placeholder="أو ضع رابط مباشر للصورة..."
                      value={asset.image_url}
                      onChange={(e) => updateActionAsset(index, { image_url: e.target.value })}
                      className={cn(inputClass, 'text-[11px] py-1 px-2')}
                    />
                  </div>

                  {/* Metadata & Intent description (8 cols) */}
                  <div className="md:col-span-8 space-y-2.5">
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-300">
                          اسم المعرّف للبوت (Action Key) <span className="text-rose-400">*</span>
                        </span>
                        <input
                          type="text"
                          disabled={!canEdit}
                          dir="ltr"
                          placeholder="مثال: branches أو menu"
                          value={asset.name}
                          onChange={(e) =>
                            updateActionAsset(index, {
                              name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                            })
                          }
                          className={cn(inputClass, 'font-mono text-xs text-amber-300')}
                        />
                        <span className="block text-[10px] text-slate-500">
                          حروف إنجليزية صغيرة بدون مسافات (سيعيده الـ AI في حقل action).
                        </span>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-300">الاسم الظاهر في اللوحة</span>
                        <input
                          type="text"
                          disabled={!canEdit}
                          placeholder="مثال: عناوين وفروع المطعم"
                          value={asset.label}
                          onChange={(e) => updateActionAsset(index, { label: e.target.value })}
                          className={cn(inputClass, 'text-xs')}
                        />
                        <span className="block text-[10px] text-slate-500">اسم توضيحي للإجراء في لوحة التحكم.</span>
                      </label>
                    </div>

                    <label className="space-y-1 block">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          وصف النية (متى يختار البوت هذا الإجراء ويرفق الصورة؟)
                        </span>
                        <span className="text-[10px] text-amber-400/80">يتم تزويده للذكاء الاصطناعي مباشرة</span>
                      </div>
                      <textarea
                        rows={2}
                        disabled={!canEdit}
                        placeholder="مثال: إذا سأل العميل عن الفروع، أماكن التواجد، العناوين، أو هل ليكم فرع في مكان معين"
                        value={asset.description}
                        onChange={(e) => updateActionAsset(index, { description: e.target.value })}
                        className={cn(inputClass, 'text-xs resize-y')}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3 sticky bottom-4 p-4 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur shadow-2xl z-20">
          {msg && (
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', msg.ok ? 'text-emerald-300' : 'text-rose-300')}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.text}
            </span>
          )}
          <button type="button" className={btn.primary} onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            حفظ إعدادات التعليقات والصور
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
