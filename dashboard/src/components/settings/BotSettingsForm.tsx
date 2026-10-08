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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BotSettings, BotSettingsFormData, DEFAULT_AI_PROMPT, DEFAULT_OFF_HOURS_MESSAGE } from './types';
import { cn } from '@/lib/utils';

interface BotSettingsFormProps {
  initialSettings: BotSettings;
}

export function BotSettingsForm({ initialSettings }: BotSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // Helper to extract HH:mm from ISO or time string (e.g. "10:00:00" -> "10:00")
  const formatTimeInput = (timeStr: string | null): string => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  const [formData, setFormData] = useState<BotSettingsFormData>({
    bot_enabled: initialSettings.bot_enabled ?? true,
    auto_pause_on_complaint: initialSettings.auto_pause_on_complaint ?? true,
    delivery_fee: Number(initialSettings.delivery_fee) || 0,
    currency: initialSettings.currency || 'EGP',
    business_hours_enabled: initialSettings.business_hours_enabled ?? false,
    open_time: formatTimeInput(initialSettings.open_time) || '10:00',
    close_time: formatTimeInput(initialSettings.close_time) || '02:00',
    off_hours_message: initialSettings.off_hours_message || DEFAULT_OFF_HOURS_MESSAGE,
    ai_system_prompt: initialSettings.ai_system_prompt || DEFAULT_AI_PROMPT,
    notify_telegram: initialSettings.notify_telegram ?? true,
    telegram_bot_token: initialSettings.telegram_bot_token || '',
    telegram_chat_id: initialSettings.telegram_chat_id || '',
    notify_dashboard: initialSettings.notify_dashboard ?? true,
    menu_full_image_url: initialSettings.menu_full_image_url || '',
    menu_full_pdf_url: initialSettings.menu_full_pdf_url || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
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
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
            text: `👑 *مطعم الخديوي - اختبار إشعارات العمليات*\n\n✅ تم الاتصال بنجاح بنظام التنبيهات.\nسيتلقى هذا الشات إشعارات الطلبات الجديدة والشكاوى فور تسجيلها.\n\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}`,
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
          delivery_fee: Number(formData.delivery_fee) || 0,
          currency: formData.currency,
          business_hours_enabled: formData.business_hours_enabled,
          open_time: formattedOpenTime,
          close_time: formattedCloseTime,
          off_hours_message: formData.off_hours_message,
          ai_system_prompt: formData.ai_system_prompt,
          notify_telegram: formData.notify_telegram,
          telegram_bot_token: formData.telegram_bot_token.trim() || null,
          telegram_chat_id: formData.telegram_chat_id.trim() || null,
          notify_dashboard: formData.notify_dashboard,
          menu_full_image_url: formData.menu_full_image_url.trim() || null,
          menu_full_pdf_url: formData.menu_full_pdf_url.trim() || null,
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
          'relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 shadow-lg',
          formData.bot_enabled
            ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30'
            : 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/30'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-transform duration-300',
                formData.bot_enabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              )}
            >
              <Power className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">
                  المفتاح الرئيسي للأتمتة والرد الذكي
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border',
                    formData.bot_enabled
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      formData.bot_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    )}
                  />
                  {formData.bot_enabled ? '🟢 البوت متصل ويعمل' : '🔴 البوت معطل بالكامل'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
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
            <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Sub-rule: Auto-pause on complaint */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-sm font-semibold text-slate-200 block">
                إيقاف الذكاء الاصطناعي تلقائياً للعميل عند فتح شكوى (Auto-Pause on Complaint)
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
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
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2. Financial & Delivery Parameters */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">معايير التوصيل والأسعار</h3>
                <p className="text-xs text-slate-400">تكلفة التوصيل الافتراضية والعملة المستخدمة في الفواتير</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  سعر التوصيل الثابت الافتراضي
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.delivery_fee}
                    onChange={(e) => handleInputChange('delivery_fee', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
                    placeholder="15.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                    {formData.currency === 'EGP' ? 'ج.م' : formData.currency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  يتم احتساب هذا المبلغ تلقائياً على إجمالي كل طلب جديد يُسجل عبر المحادثة.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  رمز العملة الرسمية
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
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
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تنبيهات لوحة التحكم المباشرة</h3>
                <p className="text-xs text-slate-400">التنبيهات الصوتية والبصرية للموظفين المناوبين</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-purple-400" />
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      التنبيهات الصوتية والفورية للطلبات والشكاوى
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
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
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  نظام التنبيهات مرتبط بـ Supabase Realtime، ويعمل على جميع شاشات مسؤولي الطلبات وخدمة العملاء فوراً بدون الحاجة لتحديث الصفحة.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Business Hours & Off-Hours Handling */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">مواعيد العمل وخارج أوقات التشغيل</h3>
              <p className="text-xs text-slate-400">تحديد أوقات عمل المطعم ورسالة الرد التلقائي أثناء الإغلاق</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              {formData.business_hours_enabled ? 'مفعلة' : 'معطلة (متاح 24/7)'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.business_hours_enabled}
                onChange={(e) => handleInputChange('business_hours_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {formData.business_hours_enabled && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  وقت بدء العمل اليومي (Open Time)
                </label>
                <input
                  type="time"
                  value={formData.open_time}
                  onChange={(e) => handleInputChange('open_time', e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  وقت إغلاق العمل اليومي (Close Time)
                </label>
                <input
                  type="time"
                  value={formData.close_time}
                  onChange={(e) => handleInputChange('close_time', e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  رسالة الرد التلقائي خارج أوقات العمل الرسمية
                </label>
                <button
                  type="button"
                  onClick={() => handleInputChange('off_hours_message', DEFAULT_OFF_HOURS_MESSAGE)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة النص النموذجي
                </button>
              </div>
              <textarea
                rows={3}
                value={formData.off_hours_message}
                onChange={(e) => handleInputChange('off_hours_message', e.target.value)}
                placeholder="اكتب الرسالة التي تظهر للعملاء خارج مواعيد العمل..."
                className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl p-3.5 text-white text-sm outline-none transition leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                تُرسل هذه الرسالة آلياً عند تواصل العملاء في الفترات التي تقع خارج ساعات العمل المحددة أعلاه.
              </p>
            </div>
          </div>
        )}

        {!formData.business_hours_enabled && (
          <p className="text-xs text-slate-400 italic">
            مواعيد العمل معطلة حالياً: يستقبل البوت الطلبات والاستفسارات على مدار الـ 24 ساعة بدون انقطاع.
          </p>
        )}
      </div>

      {/* 5. AI Agent System Prompt (Gemini 2.0 Flash) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">توجيهات نموذج الذكاء الاصطناعي (AI System Prompt)</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  Gemini 2.0 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                الشخصية، أسلوب التخاطب مع رواد المطعم، شروط تقديم الاقتراحات وإرشادات جمع الطلبات
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleInputChange('ai_system_prompt', DEFAULT_AI_PROMPT)}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition self-start sm:self-center"
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
            className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl p-4 text-slate-100 text-sm font-mono leading-relaxed outline-none transition"
            placeholder="اكتب التوجيهات والأوامر التي يلتزم بها المساعد الذكي..."
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>💡 نصيحة: حدد نبرة الصوت، الأطباق المميزة، وقواعد جمع العنوان ورقم التليفون قبل تأكيد الأوردر.</span>
            <span>{formData.ai_system_prompt.length} حرف</span>
          </div>
        </div>
      </div>

      {/* 6. Telegram Operations Alerts */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إشعارات عمليات تيليجرام (Telegram Operations)</h3>
              <p className="text-xs text-slate-400">إرسال إشعار فوري لجروب الإدارة والمطبخ عند أي طلب أو شكوى جديدة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              {formData.notify_telegram ? 'مفعلة' : 'معطلة'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.notify_telegram}
                onChange={(e) => handleInputChange('notify_telegram', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>
        </div>

        {formData.notify_telegram && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  رمز بوت تيليجرام (Telegram Bot Token)
                </label>
                <div className="relative">
                  <input
                    type={showTelegramToken ? 'text' : 'password'}
                    value={formData.telegram_bot_token}
                    onChange={(e) => handleInputChange('telegram_bot_token', e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelegramToken(!showTelegramToken)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    title={showTelegramToken ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  معرف قناة أو جروب تيليجرام (Telegram Chat ID)
                </label>
                <input
                  type="text"
                  value={formData.telegram_chat_id}
                  onChange={(e) => handleInputChange('telegram_chat_id', e.target.value)}
                  placeholder="-1001234567890 أو @khedewy_orders"
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">
                يمكنك الضغط على زر الاختبار للتحقق من وصول الرسالة إلى الجروب مباشرة.
              </span>
              <button
                type="button"
                disabled={isTestingTelegram || !formData.telegram_bot_token || !formData.telegram_chat_id}
                onClick={handleTestTelegram}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                {isTestingTelegram ? 'جارِ الاختبار...' : 'اختبار إرسال إشعار تيليجرام'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7. Full Menu Media Assets */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">روابط المنيو الكامل للعملاء (Menu Assets)</h3>
            <p className="text-xs text-slate-400">ملفات المنيو الكاملة التي يرسلها البوت تلقائياً عند طلب العميل "المنيو كامل"</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              رابط صورة المنيو الكاملة (Image URL)
            </label>
            <input
              type="url"
              value={formData.menu_full_image_url}
              onChange={(e) => handleInputChange('menu_full_image_url', e.target.value)}
              placeholder="https://.../menu-full.jpg"
              className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 rounded-xl px-4 py-2.5 text-white text-xs outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              رابط ملف المنيو PDF (PDF URL)
            </label>
            <input
              type="url"
              value={formData.menu_full_pdf_url}
              onChange={(e) => handleInputChange('menu_full_pdf_url', e.target.value)}
              placeholder="https://.../khedewy-menu.pdf"
              className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 rounded-xl px-4 py-2.5 text-white text-xs outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Save Action Sticky Footer */}
      <div className="sticky bottom-4 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
