'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Power,
  ShieldAlert,
  Clock,
  DollarSign,
  Send,
  Bell,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  RotateCcw,
  Volume2,
  ExternalLink,
  MessageSquare,
  Facebook,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BotSettings, BotSettingsFormData, DEFAULT_AI_PROMPT, DEFAULT_OFF_HOURS_MESSAGE } from './types';
import { cn } from '@/lib/utils';

interface BotSettingsFormProps {
  initialSettings: BotSettings;
}

function formatArabicTimeLabel(time24: string): string {
  const [hStr, mStr] = (time24 || '12:00').split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (Number.isNaN(h)) return time24;
  if (h === 0 && m === '00') return '12:00 منتصف الليل';
  if (h === 0) return `12:${m} بعد منتصف الليل`;
  if (h === 12 && m === '00') return '12:00 ظهراً';
  if (h === 12) return `12:${m} ظهراً`;
  if (h >= 1 && h <= 4) return `${h}:${m} فجراً`;
  if (h >= 5 && h <= 11) return `${h}:${m} صباحاً`;
  if (h >= 13 && h <= 15) return `${h - 12}:${m} ظهراً`;
  return `${h - 12}:${m} مساءً`;
}

function parseScheduleSettingsFromPrompt(prompt: string | null): {
  scheduledOrdersEnabled: boolean;
  maxScheduleHours: number;
} {
  if (!prompt) {
    return { scheduledOrdersEnabled: true, maxScheduleHours: 5 };
  }
  if (prompt.includes('جدولة الأوردرات المسبقة متوقفة حالياً')) {
    return { scheduledOrdersEnabled: false, maxScheduleHours: 5 };
  }
  const match = prompt.match(/بحد أقصى\s*\*\*(\d+)\s*ساعات?\*\*\s*مقدماً/);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 24) {
      return { scheduledOrdersEnabled: true, maxScheduleHours: parsed };
    }
  }
  return { scheduledOrdersEnabled: true, maxScheduleHours: 5 };
}

function buildDeliveryHoursPromptSection(
  enabled: boolean,
  openTime24: string,
  closeTime24: string,
  offHoursReply: string,
  scheduledOrdersEnabled = true,
  maxScheduleHours = 5
): string {
  const openLabel = formatArabicTimeLabel(openTime24);
  const closeLabel = formatArabicTimeLabel(closeTime24);
  const hoursCount = Math.max(1, Math.min(24, Number(maxScheduleHours) || 5));

  const scheduleBlock = scheduledOrdersEnabled
    ? [
        `  - ⏳ **قواعد الأوردرات المجدولة مسبقاً (Scheduled Orders - حد أقصى ${hoursCount} ساعات):**`,
        `    - يُسمح للعميل بطلب أوردر مجدول لاستلامه في وقت لاحق من نفس اليوم بحد أقصى **${hoursCount} ساعات** مقدماً من "الوقت الحالي (مصر)" المرفق مع رسالة العميل.`,
        `    - **شرط أساسي إلزامي للأوردر المجدول:** يجب أن يكون موعد الاستلام المطلوب: (أ) خلال **${hoursCount} ساعات على الأكثر** من وقت رسالة العميل، و(ب) **داخل مواعيد عمل الدليفري المعتمدة** (أي بين الساعة **${openLabel}** وقبل إغلاق الأوردرات في الساعة **${closeLabel}**).`,
        `    - إذا طلب العميل جدولة أوردر لموعد يبعد **أكثر من ${hoursCount} ساعات** عن الوقت الحالي، أو ليوم آخر ("بكرة")، أو لموعد يقع **خارج مواعيد عمل الدليفري** (بعد الساعة ${closeLabel} أو قبل الساعة ${openLabel}): **ممنوع منعاً باتاً** تأكيد الأوردر (\`order\`)! اعتذر له بلباقة وقل له: **"بنعتذر لحضرتك يا فندم، حجز الأوردرات المجدولة متاح بحد أقصى ${hoursCount} ساعات قبل موعد الاستلام، وبشرط أن يكون موعد التوصيل داخل مواعيد عمل الدليفري (من ${openLabel} حتى ${closeLabel}) 🕒. تقدر تكلمنا قبل الموعد بـ ${hoursCount} ساعات وهنسجل أوردرك فوراً، أو تتصل على الخط الساخن 17330 📞!"**.`,
      ].join('\n')
    : [
        '  - ⏳ **قواعد الأوردرات المجدولة مسبقاً (جدولة الأوردرات المسبقة متوقفة حالياً):**',
        '    - استقبال الأوردرات عبر الماسنجر مخصص للتجهيز والتوصيل الفوري فقط (خلال حوالي 45 دقيقة)؛ إذا طلب العميل حجز أوردر لوقت متأخر أو ليوم آخر، اعتذر له بلباقة واطلب منه مراسلتنا وقت رغبته في استلام الطلب مباشرة أو الاتصال على الخط الساخن 17330.',
      ].join('\n');

  if (!enabled) {
    return [
      '• مواعيد العمل ونظام التوصيل (دليفري فقط):',
      '  - استقبال أوردرات الدليفري عبر الماسنجر متاح على مدار الـ 24 ساعة في جميع الفروع.',
      scheduleBlock,
      '  - جميع الأوردرات عبر الماسنجر مخصصة للتوصيل المنزلي (دليفري فقط)؛ لا يوجد حجز استلام من الفرع أو صالة عبر الماسنجر، وممنوع نهائياً سؤال العميل "دليفري ولا استلام من الفرع؟". إذا طلب العميل استلاماً من الفرع، وضح له بلباقة أن طلبات الماسنجر للدليفري فقط، أو يشرفنا في أقرب فرع ليطلب مباشرة من الكاشير.',
      '  - متوسط وقت التوصيل المتوقع حوالي 45 دقيقة (يختلف حسب قرب أو بُعد العنوان عن الفرع وضغط الطلبات، والتأكيد على 17330).',
      '  - رسوم التوصيل محددة وتختلف حسب المنطقة والفرع التابع له.',
      '  - الدفع عند الاستلام (كاش)، وممنوع سؤال العميل عن طريقة الدفع.',
    ].join('\n');
  }

  const openH = parseInt((openTime24 || '12:00').split(':')[0], 10);
  const closeH = parseInt((closeTime24 || '00:00').split(':')[0], 10);

  const closedHours: number[] = [];
  for (let h = 0; h < 24; h++) {
    let isOpen = true;
    if (openH < closeH) {
      isOpen = h >= openH && h < closeH;
    } else if (openH > closeH) {
      isOpen = h >= openH || h < closeH;
    }
    if (!isOpen) closedHours.push(h);
  }

  const closedHoursList = closedHours.length > 0 ? closedHours.join('، ') : 'لا يوجد';
  const lastClosedH = closedHours.length > 0 ? closedHours[closedHours.length - 1] : (openH + 23) % 24;
  const closedStart24 = closeTime24 || '00:00';
  const closedEnd24 = `${String(lastClosedH).padStart(2, '0')}:59`;

  const cleanOffMsg =
    (offHoursReply || '').trim() ||
    `بنعتذر لحضرتك يا فندم، مواعيد استقبال أوردرات الدليفري عبر الماسنجر يومياً من الساعة ${openLabel} حتى الساعة ${closeLabel} 🕒. لو حابب تطلب أوردر دلوقتي تقدر تتصل مباشرة على الخط الساخن 17330 📞، وتحت أمرك هنا في أي وقت لأي استفسار عن المنيو أو العروض أو لتسجيل أي شكوى!`;

  return [
    '• مواعيد العمل ونظام التوصيل (دليفري فقط):',
    `  - مواعيد استقبال أوردرات الدليفري عبر الماسنجر يومياً من الساعة **${openLabel}** حتى الساعة **${closeLabel}** (من \`${openTime24}\` حتى \`${closeTime24 === '00:00' ? '23:59' : closeTime24}\` بتوقيت مصر) في جميع الفروع.`,
    `  - ⚠️ **إغلاق استقبال أوردرات الماسنجر من الساعة ${closeLabel} حتى ${openLabel} (\`${closedStart24}\` إلى \`${closedEnd24}\` - مهم جداً):**`,
    `    - انظر دائماً إلى **"الوقت الحالي (مصر)"** المرفق مع رسالة العميل (صيغة 24 ساعة \`H:mm\`). إذا كان الوقت الحالي بين الساعة **\`${closedStart24}\` (${closeLabel})** و **\`${closedEnd24}\`** (أي الساعات \`${closedHoursList}\`)، فإن استقبال الأوردرات عبر الماسنجر متوقف في هذا التوقيت!`,
    `    - في فترة خارج مواعيد دليفري الماسنجر (\`${closedStart24}\` حتى \`${closedEnd24}\`):`,
    '      1. **الاستفسارات العادية والشكاوى مستمرة بشكل طبيعي تماماً:** يمكنك الرد طبيعياً على أي استفسار عن المنيو والعروض والأسعار والفروع (`normal`, `menu`, `branches`, `all_offers`, `single_offer`)، وكذلك **استقبال وتسجيل الشكاوى (`complaint`) بشكل طبيعي وفوري**!',
    `      2. **منع عمل أوردر على الماسنجر وتوجيه العميل للخط الساخن 17330:** إذا طلب العميل **عمل أوردر جديد** في هذا التوقيت (\`${closedStart24}\` إلى \`${closedEnd24}\`)، **ممنوع منعاً باتاً** طلب بيانات توصيل أو عرض ملخص أوردر أو تأكيد أي أوردر (\`order\`) على الماسنجر! اعتذر له بلباقة وقل له: **"${cleanOffMsg}"**.`,
    scheduleBlock,
    '  - جميع الأوردرات عبر الماسنجر مخصصة للتوصيل المنزلي (دليفري فقط)؛ لا يوجد حجز استلام من الفرع أو صالة عبر الماسنجر، وممنوع نهائياً سؤال العميل "دليفري ولا استلام من الفرع؟". إذا طلب العميل استلاماً من الفرع، وضح له بلباقة أن طلبات الماسنجر للدليفري فقط، أو يشرفنا في أقرب فرع ليطلب مباشرة من الكاشير.',
    '  - متوسط وقت التوصيل المتوقع حوالي 45 دقيقة (يختلف حسب قرب أو بُعد العنوان عن الفرع وضغط الطلبات، والتأكيد على 17330).',
    '  - رسوم التوصيل محددة وتختلف حسب المنطقة والفرع التابع له.',
    '  - الدفع عند الاستلام (كاش)، وممنوع سؤال العميل عن طريقة الدفع.',
  ].join('\n');
}

function syncPromptWithDeliveryHours(
  currentPrompt: string,
  enabled: boolean,
  openTime24: string,
  closeTime24: string,
  offHoursReply: string,
  scheduledOrdersEnabled = true,
  maxScheduleHours = 5
): string {
  const newSection = buildDeliveryHoursPromptSection(
    enabled,
    openTime24,
    closeTime24,
    offHoursReply,
    scheduledOrdersEnabled,
    maxScheduleHours
  );
  const sectionRegex = /• مواعيد العمل ونظام التوصيل \(دليفري فقط\):[\s\S]*?(?=\n• الفروع والكيدز أريا|\n• تخصيص الطلبات|$)/;
  if (sectionRegex.test(currentPrompt)) {
    return currentPrompt.replace(sectionRegex, newSection + '\n');
  }
  return `${currentPrompt.trim()}\n\n${newSection}`;
}

export function BotSettingsForm({ initialSettings }: BotSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // Helper to extract HH:mm from ISO or time string (e.g. "10:00:00" -> "10:00")
  const formatTimeInput = (timeStr: string | null): string => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  const parsedSchedule = parseScheduleSettingsFromPrompt(initialSettings.ai_system_prompt);

  const [formData, setFormData] = useState<BotSettingsFormData>({
    bot_enabled: initialSettings.bot_enabled ?? true,
    auto_pause_on_complaint: initialSettings.auto_pause_on_complaint ?? true,
    restaurant_name: initialSettings.restaurant_name || '',
    delivery_fee: Number(initialSettings.delivery_fee) || 0,
    currency: initialSettings.currency || 'EGP',
    business_hours_enabled: initialSettings.business_hours_enabled ?? false,
    open_time: formatTimeInput(initialSettings.open_time) || '12:00',
    close_time: formatTimeInput(initialSettings.close_time) || '00:00',
    scheduled_orders_enabled: parsedSchedule.scheduledOrdersEnabled,
    max_schedule_hours: parsedSchedule.maxScheduleHours,
    welcome_message: initialSettings.welcome_message || '',
    human_handoff_message: initialSettings.human_handoff_message || '',
    off_hours_message: initialSettings.off_hours_message || DEFAULT_OFF_HOURS_MESSAGE,
    ai_system_prompt: initialSettings.ai_system_prompt || DEFAULT_AI_PROMPT,
    notify_telegram: initialSettings.notify_telegram ?? true,
    telegram_bot_token: initialSettings.telegram_bot_token || '',
    telegram_chat_id: initialSettings.telegram_chat_id || '',
    notify_dashboard: initialSettings.notify_dashboard ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showFacebookToken, setShowFacebookToken] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleInputChange = <K extends keyof BotSettingsFormData>(
    field: K,
    value: BotSettingsFormData[K]
  ) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (
        field === 'business_hours_enabled' ||
        field === 'open_time' ||
        field === 'close_time' ||
        field === 'off_hours_message' ||
        field === 'scheduled_orders_enabled' ||
        field === 'max_schedule_hours'
      ) {
        const openLabel = formatArabicTimeLabel(next.open_time);
        const closeLabel = formatArabicTimeLabel(next.close_time);
        if (field === 'open_time' || field === 'close_time') {
          next.off_hours_message = `بنعتذر لحضرتك يا فندم، مواعيد استقبال أوردرات الدليفري عبر الماسنجر يومياً من الساعة ${openLabel} حتى الساعة ${closeLabel} 🕒. لو حابب تطلب أوردر دلوقتي تقدر تتصل مباشرة على الخط الساخن 17330 📞، وتحت أمرك هنا في أي وقت لأي استفسار عن المنيو أو العروض أو لتسجيل أي شكوى!`;
        }
        next.ai_system_prompt = syncPromptWithDeliveryHours(
          next.ai_system_prompt,
          next.business_hours_enabled,
          next.open_time,
          next.close_time,
          next.off_hours_message,
          next.scheduled_orders_enabled,
          next.max_schedule_hours
        );
      }

      return next;
    });
  };

  // Test Telegram Connection
  const handleTestTelegram = async () => {
    if (!formData.telegram_bot_token.trim() || !formData.telegram_chat_id.trim()) {
      showToast('error', 'يرجى إدخال رمز البوت (Bot Token) ومعرف الشات (Chat ID) أولاً لاختبار التنبيه');
      return;
    }

    setIsTestingTelegram(true);
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${formData.telegram_bot_token.trim()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: formData.telegram_chat_id.trim(),
            text: `🍗 *${formData.restaurant_name || 'المطعم'} - اختبار الإشعارات*\n\n✅ تم الاتصال بنجاح بنظام التنبيهات.\nسيتلقى هذا الشات إشعارات الطلبات الجديدة والشكاوى فور تسجيلها.\n\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}`,
            parse_mode: 'Markdown',
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('success', 'تم إرسال رسالة الاختبار بنجاح إلى تيليجرام 🚀');
      } else {
        const errorDetail = data.description || 'تحقق من صحة التوكن ومعرف المحادثة';
        showToast('error', `فشل إرسال التنبيه: ${errorDetail}`);
      }
    } catch (err: any) {
      showToast('error', `حدث خطأ أثناء الاتصال بتيليجرام: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Submit Settings Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const formattedOpenTime = formData.open_time ? `${formData.open_time}:00` : null;
      const formattedCloseTime = formData.close_time ? `${formData.close_time}:00` : null;

      const { error } = await supabase
        .from('bot_settings')
        .update({
          bot_enabled: formData.bot_enabled,
          auto_pause_on_complaint: formData.auto_pause_on_complaint,
          restaurant_name: formData.restaurant_name,
          delivery_fee: Number(formData.delivery_fee) || 0,
          currency: formData.currency,
          business_hours_enabled: formData.business_hours_enabled,
          open_time: formattedOpenTime,
          close_time: formattedCloseTime,
          welcome_message: formData.welcome_message,
          human_handoff_message: formData.human_handoff_message,
          off_hours_message: formData.off_hours_message,
          ai_system_prompt: formData.ai_system_prompt,
          notify_telegram: formData.notify_telegram,
          telegram_bot_token: formData.telegram_bot_token.trim() || null,
          telegram_chat_id: formData.telegram_chat_id.trim() || null,
          notify_dashboard: formData.notify_dashboard,
          updated_at: new Date().toISOString(),
        })
        .eq('id', initialSettings.id);

      if (error) {
        throw error;
      }

      showToast('success', 'تم حفظ جميع إعدادات البوت والتشغيل بنجاح 💾');
      router.refresh();
    } catch (err: any) {
      console.error('Error updating bot settings:', err);
      showToast('error', `حدث خطأ أثناء حفظ الإعدادات: ${err?.message || 'يرجى المحاولة ثانية'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div
          role="alert"
          className={cn(
            'fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4',
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border border-rose-500/40'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Master Automation Status Banner */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 shadow-xs',
          formData.bot_enabled
            ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border-emerald-500/30'
            : 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 border-rose-500/30'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-transform duration-300',
                formData.bot_enabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              )}
            >
              <Power className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  المفتاح الرئيسي للأتمتة والرد الذكي
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border',
                    formData.bot_enabled
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      formData.bot_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    )}
                  />
                  {formData.bot_enabled ? '🟢 البوت متصل ويعمل' : '🔴 البوت معطل بالكامل'}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {formData.bot_enabled
                  ? 'المساعد الذكي (Gemini 2.0 Flash) نشط ويقوم بالرد الفوري على تعليقات ورسائل العملاء، واستقبال الطلبات تلقائياً.'
                  : 'تم إيقاف الأتمتة بالكامل. لن يقوم البوت بالرد على أي رسالة واردة، ويتعين على ممثلي خدمة العملاء الرد يدوياً.'}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none self-end sm:self-center">
            <input
              type="checkbox"
              checked={formData.bot_enabled}
              onChange={(e) => handleInputChange('bot_enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Sub-rule: Auto-pause on complaint */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                إيقاف الذكاء الاصطناعي تلقائياً للعميل عند فتح شكوى (Auto-Pause on Complaint)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                تعليق ردود البوت مؤقتاً لأي عميل يقدم شكوى لحين تدخل موظف خدمة العملاء لتفادي الاستفزاز أو التكرار.
              </span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={formData.auto_pause_on_complaint}
              onChange={(e) => handleInputChange('auto_pause_on_complaint', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2. Financial & Delivery Parameters */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">معايير التوصيل والأسعار</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">تكلفة التوصيل الافتراضية والعملة المستخدمة في الفواتير</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  سعر التوصيل الثابت الافتراضي
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.delivery_fee}
                    onChange={(e) => handleInputChange('delivery_fee', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="15.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400 font-bold">
                    {formData.currency === 'EGP' ? 'ج.م' : formData.currency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  يتم احتساب هذا المبلغ تلقائياً على إجمالي كل طلب جديد يُسجل عبر المحادثة.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  رمز العملة الرسمية
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition"
                >
                  <option value="EGP">جنيه مصري (EGP - ج.م)</option>
                  <option value="SAR">ريال سعودي (SAR - ر.س)</option>
                  <option value="USD">دولار أمريكي (USD - $)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Dashboard Alerts */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">تنبيهات لوحة التحكم المباشرة</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">التنبيهات الصوتية والبصرية للموظفين المناوبين</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-purple-500 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                      التنبيهات الصوتية والفورية للطلبات والشكاوى
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                      تشغيل نغمة تنبيه صوتية عند وصول طلب معلق جديد أو تسجيل شكوى عميل ذات أولوية.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.notify_dashboard}
                    onChange={(e) => handleInputChange('notify_dashboard', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <span>
                  نظام التنبيهات مرتبط بـ Supabase Realtime، ويعمل على جميع شاشات مسؤولي الطلبات وخدمة العملاء فوراً بدون الحاجة لتحديث الصفحة.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Business Hours & Off-Hours Handling */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                مواعيد استقبال أوردرات الدليفري عبر الماسنجر
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تحديد ساعات استقبال الأوردرات (الشكاوى والرد على الاستفسارات تعمل 24 ساعة طبيعياً، وخارج المواعيد يوجه البوت للخط الساخن 17330 لطلب أوردر)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {formData.business_hours_enabled
                ? `مفعلة (${formatArabicTimeLabel(formData.open_time)} ← ${formatArabicTimeLabel(formData.close_time)})`
                : 'معطلة (متاح 24/7)'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.business_hours_enabled}
                onChange={(e) => handleInputChange('business_hours_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {formData.business_hours_enabled && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">اختيار سريع للمواعيد:</span>
              {[
                { label: 'من 12 ظهراً لـ 12 منتصف الليل', open: '12:00', close: '00:00' },
                { label: 'من 11 صباحاً لـ 3 فجراً', open: '11:00', close: '03:00' },
                { label: 'من 12 ظهراً لـ 2 فجراً', open: '12:00', close: '02:00' },
              ].map((preset) => {
                const isSelected = formData.open_time === preset.open && formData.close_time === preset.close;
                return (
                  <button
                    key={`${preset.open}-${preset.close}`}
                    type="button"
                    onClick={() => {
                      const openLabel = formatArabicTimeLabel(preset.open);
                      const closeLabel = formatArabicTimeLabel(preset.close);
                      const autoMsg = `بنعتذر لحضرتك يا فندم، مواعيد استقبال أوردرات الدليفري عبر الماسنجر يومياً من الساعة ${openLabel} حتى الساعة ${closeLabel} 🕒. لو حابب تطلب أوردر دلوقتي تقدر تتصل مباشرة على الخط الساخن 17330 📞، وتحت أمرك هنا في أي وقت لأي استفسار عن المنيو أو العروض أو لتسجيل أي شكوى!`;
                      setFormData((prev) => ({
                        ...prev,
                        open_time: preset.open,
                        close_time: preset.close,
                        off_hours_message: autoMsg,
                        ai_system_prompt: syncPromptWithDeliveryHours(
                          prev.ai_system_prompt,
                          true,
                          preset.open,
                          preset.close,
                          autoMsg,
                          prev.scheduled_orders_enabled,
                          prev.max_schedule_hours
                        ),
                      }));
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer',
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  وقت بدء استقبال أوردرات الدليفري (Open Time) — ({formatArabicTimeLabel(formData.open_time)})
                </label>
                <input
                  type="time"
                  value={formData.open_time}
                  onChange={(e) => handleInputChange('open_time', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  وقت إيقاف استقبال أوردرات الدليفري (Close Time) — ({formatArabicTimeLabel(formData.close_time)})
                </label>
                <input
                  type="time"
                  value={formData.close_time}
                  onChange={(e) => handleInputChange('close_time', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رسالة الاعتذار عند طلب أوردر خارج المواعيد (توجيه للخط الساخن 17330)
                </label>
                <button
                  type="button"
                  onClick={() => handleInputChange('off_hours_message', DEFAULT_OFF_HOURS_MESSAGE)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة النص النموذجي
                </button>
              </div>
              <textarea
                rows={3}
                value={formData.off_hours_message}
                onChange={(e) => handleInputChange('off_hours_message', e.target.value)}
                placeholder="اكتب الرسالة التي يرد بها البوت إذا حاول العميل عمل أوردر خارج مواعيد الدليفري..."
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl p-3.5 text-slate-900 dark:text-white text-sm outline-none transition leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                ✨ أي تعديل في الساعات أو الرسالة هنا يقوم بتحديث قسم المواعيد داخل توجيهات الذكاء الاصطناعي (AI System Prompt) بالأسفل تلقائياً فور التغيير!
              </p>
            </div>
          </div>
        )}

        {!formData.business_hours_enabled && (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            مواعيد العمل معطلة حالياً: يستقبل البوت الطلبات والاستفسارات على مدار الـ 24 ساعة بدون انقطاع.
          </p>
        )}

        {/* Scheduled Orders Advance Window Sub-Section */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>⏳ التحكم في الوقت المتاح للأوردرات المجدولة مسبقاً (Scheduled Orders)</span>
                <span
                  className={cn(
                    'text-[11px] px-2.5 py-0.5 rounded-full font-bold border',
                    formData.scheduled_orders_enabled
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                  )}
                >
                  {formData.scheduled_orders_enabled
                    ? `حد أقصى ${formData.max_schedule_hours} ساعات مقدماً`
                    : 'الأوردرات الفورية فقط'}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تحديد أقصى عدد ساعات يُسمح للعميل بجدولة استلام الأوردر خلالها، بشرط أن يقع موعد الاستلام داخل مواعيد عمل الدليفري ({formatArabicTimeLabel(formData.open_time)} ← {formatArabicTimeLabel(formData.close_time)})
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={formData.scheduled_orders_enabled}
                onChange={(e) => handleInputChange('scheduled_orders_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {formData.scheduled_orders_enabled && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                    أقصى مدة مسموحة للاستلام:
                  </span>
                  {[2, 3, 4, 5, 6, 8, 12].map((hrs) => {
                    const active = Number(formData.max_schedule_hours) === hrs;
                    return (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => handleInputChange('max_schedule_hours', hrs)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer',
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        )}
                      >
                        {hrs === 2 ? 'ساعتين' : `${hrs} ساعات`}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    عدد الساعات:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={formData.max_schedule_hours}
                    onChange={(e) =>
                      handleInputChange(
                        'max_schedule_hours',
                        Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-20 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3 py-1.5 text-center text-sm font-black text-slate-900 dark:text-white outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">ساعة</span>
                </div>
              </div>

              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                📌 <strong>القاعدة المطبقة حالياً في الأجنت:</strong> يقبل البوت الأوردرات المجدولة فقط إذا كان العميل سيستلم الأوردر خلال <strong>{formData.max_schedule_hours} ساعات بحد أقصى</strong> من وقت رسالته، وبشرط أن يكون موعد التوصيل المطلوب قبل الساعة <strong>{formatArabicTimeLabel(formData.close_time)}</strong> (ضمن ساعات فتح الدليفري).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. AI Agent System Prompt (Gemini 2.0 Flash) */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">توجيهات نموذج الذكاء الاصطناعي (AI System Prompt)</h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  Gemini 2.0 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                الشخصية، أسلوب التخاطب مع رواد المطعم، شروط تقديم الاقتراحات وإرشادات جمع الطلبات
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleInputChange('ai_system_prompt', DEFAULT_AI_PROMPT)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 transition self-start sm:self-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            استعادة القالب الافتراضي
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            rows={10}
            value={formData.ai_system_prompt}
            onChange={(e) => handleInputChange('ai_system_prompt', e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl p-4 text-slate-900 dark:text-slate-100 text-sm font-mono leading-relaxed outline-none transition"
            placeholder="اكتب التوجيهات والأوامر التي يلتزم بها المساعد الذكي..."
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span>💡 نصيحة: حدد نبرة الصوت، الأطباق المميزة، وقواعد جمع العنوان ورقم التليفون قبل تأكيد الأوردر.</span>
            <span>{formData.ai_system_prompt.length} حرف</span>
          </div>
        </div>
      </div>

      {/* 6. Telegram Operations Alerts */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">إشعارات عمليات تيليجرام (Telegram Operations)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">إرسال إشعار فوري لجروب الإدارة والمطبخ عند أي طلب أو شكوى جديدة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {formData.notify_telegram ? 'مفعلة' : 'معطلة'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.notify_telegram}
                onChange={(e) => handleInputChange('notify_telegram', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>
        </div>

        {formData.notify_telegram && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  رمز بوت تيليجرام (Telegram Bot Token)
                </label>
                <div className="relative">
                  <input
                    type={showTelegramToken ? 'text' : 'password'}
                    value={formData.telegram_bot_token}
                    onChange={(e) => handleInputChange('telegram_bot_token', e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-xs outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelegramToken(!showTelegramToken)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                    title={showTelegramToken ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  معرف قناة أو جروب تيليجرام (Telegram Chat ID)
                </label>
                <input
                  type="text"
                  value={formData.telegram_chat_id}
                  onChange={(e) => handleInputChange('telegram_chat_id', e.target.value)}
                  placeholder="-1001234567890 أو @khedewy_orders"
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-xs outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                يمكنك الضغط على زر الاختبار للتحقق من وصول الرسالة إلى الجروب مباشرة.
              </span>
              <button
                type="button"
                disabled={isTestingTelegram || !formData.telegram_bot_token || !formData.telegram_chat_id}
                onClick={handleTestTelegram}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                {isTestingTelegram ? 'جارِ الاختبار...' : 'اختبار إرسال إشعار تيليجرام'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Link Card for Channels and Menu */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/dashboard/channels" className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-950/50 transition group">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20 transition">
            <Facebook className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">إعدادات فيسبوك وماسنجر</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">انتقل لربط الصفحة والردود التلقائية</p>
          </div>
        </a>

        <a href="/dashboard/menu" className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-500/50 bg-slate-50/50 dark:bg-slate-950/50 transition group">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-500/20 transition">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">إعدادات المنيو والأسعار</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">انتقل لرفع المنيو وتحديث قائمة الأسعار</p>
          </div>
        </a>
      </div>

      {/* Save Action Sticky Footer */}
      <div className="sticky bottom-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>تأكد من مراجعة التغييرات قبل الحفظ لتطبيقها على محادثات مسنجر فوراً.</span>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'جارِ حفظ التغييرات...' : 'حفظ إعدادات البوت والتشغيل'}
        </button>
      </div>
    </form>
  );
}
