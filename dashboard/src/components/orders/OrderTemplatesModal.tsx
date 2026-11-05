'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_ORDER_MESSAGE_TEMPLATES,
  OrderMessageTemplates,
  TemplatePreset,
} from '@/lib/order-templates';

interface OrderTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplates: OrderMessageTemplates;
  onSaved: (updated: OrderMessageTemplates) => void;
}

export function OrderTemplatesModal({
  isOpen,
  onClose,
  initialTemplates,
  onSaved,
}: OrderTemplatesModalProps) {
  const [templates, setTemplates] = useState<OrderMessageTemplates>(initialTemplates);
  const [activeTab, setActiveTab] = useState<'modification' | 'cancellation' | 'confirm'>('modification');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTemplates(initialTemplates);
      setSaveMessage(null);
    }
  }, [isOpen, initialTemplates]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/orders/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save templates');
      }
      onSaved(data.templates);
      setSaveMessage('تم حفظ قوالب الرسائل بنجاح ✅');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error saving templates:', err);
      alert('تعذر حفظ قوالب الرسائل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل تريد استعادة النصوص الافتراضية لجميع قوالب الرسائل؟')) {
      setTemplates(DEFAULT_ORDER_MESSAGE_TEMPLATES);
    }
  };

  const updatePresetList = (
    key: 'modification_decline_presets' | 'cancellation_decline_presets' | 'staff_cancel_presets',
    index: number,
    field: 'label' | 'text',
    value: string
  ) => {
    setTemplates((prev) => {
      const list = [...prev[key]];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [key]: list };
    });
  };

  const addPreset = (
    key: 'modification_decline_presets' | 'cancellation_decline_presets' | 'staff_cancel_presets'
  ) => {
    setTemplates((prev) => ({
      ...prev,
      [key]: [
        ...prev[key],
        {
          id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: 'سبب جديد',
          text: 'بنعتذر لحضرتك يا {customer_name} 🙏 بخصوص الأوردر رقم #{order_number}: ',
        },
      ],
    }));
  };

  const removePreset = (
    key: 'modification_decline_presets' | 'cancellation_decline_presets' | 'staff_cancel_presets',
    index: number
  ) => {
    setTemplates((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, idx) => idx !== index),
    }));
  };

  const renderPresetEditor = (
    title: string,
    key: 'modification_decline_presets' | 'cancellation_decline_presets' | 'staff_cancel_presets',
    presets: TemplatePreset[]
  ) => (
    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{title}</span>
        <button
          type="button"
          onClick={() => addPreset(key)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة سبب سريع</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {presets.map((preset, idx) => (
          <div
            key={preset.id || idx}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={preset.label}
                onChange={(e) => updatePresetList(key, idx, 'label', e.target.value)}
                placeholder="عنوان الزر السريع (مثال: خرج مع الدليفري)"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removePreset(key, idx)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                title="حذف هذا القالب"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={2}
              value={preset.text}
              onChange={(e) => updatePresetList(key, idx, 'text', e.target.value)}
              placeholder="نص الرسالة..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      dir="rtl"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                قوالب رسائل الأوردرات والتعديلات والإلغاء
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تخصيص الرسائل التلقائية التي تُرسل للعميل عند الموافقة أو رفض التعديل أو إلغاء الأوردر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variables Helper Bar */}
        <div className="px-6 py-2.5 bg-amber-500/5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            المتغيرات المتاحة:
          </span>
          <code className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-amber-300 font-mono text-[11px]">
            {'{customer_name}'} = اسم العميل
          </code>
          <code className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-amber-300 font-mono text-[11px]">
            {'{order_number}'} = رقم الأوردر
          </code>
          <code className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-amber-300 font-mono text-[11px]">
            {'{total_amount}'} = الإجمالي
          </code>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('modification')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all ${
              activeTab === 'modification'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ✏️ طلبات تعديل الأوردر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancellation')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all ${
              activeTab === 'cancellation'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🚫 قوالب إلغاء الأوردر (من المطعم أو العميل)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirm')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all ${
              activeTab === 'confirm'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ✅ رسالة تأكيد الأوردر
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'modification' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ✅ القالب الافتراضي للموافقة على تعديل الأوردر:
                </label>
                <textarea
                  rows={3}
                  value={templates.modification_approve}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, modification_approve: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-rose-600 dark:text-rose-400">
                  ❌ القالب الافتراضي لرفض تعديل الأوردر:
                </label>
                <textarea
                  rows={3}
                  value={templates.modification_decline}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, modification_decline: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {renderPresetEditor(
                'أسباب سريعة لرفض تعديل الأوردر (تظهر كأزرار جاهزة للموظف):',
                'modification_decline_presets',
                templates.modification_decline_presets
              )}
            </div>
          )}

          {activeTab === 'cancellation' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-rose-600 dark:text-rose-400">
                  🚫 القالب الافتراضي عند إلغاء الأوردر من طرف المطعم:
                </label>
                <textarea
                  rows={3}
                  value={templates.staff_cancel_order}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, staff_cancel_order: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {renderPresetEditor(
                'أسباب سريعة لإلغاء الأوردر من طرف المطعم:',
                'staff_cancel_presets',
                templates.staff_cancel_presets
              )}

              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ✅ القالب الافتراضي للموافقة على طلب العميل بإلغاء الأوردر:
                </label>
                <textarea
                  rows={3}
                  value={templates.cancellation_approve}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, cancellation_approve: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-rose-600 dark:text-rose-400">
                  ❌ القالب الافتراضي لرفض طلب العميل بإلغاء الأوردر (لخروجه مع الدليفري):
                </label>
                <textarea
                  rows={3}
                  value={templates.cancellation_decline}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, cancellation_decline: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {renderPresetEditor(
                'أسباب سريعة لرفض إلغاء الأوردر:',
                'cancellation_decline_presets',
                templates.cancellation_decline_presets
              )}
            </div>
          )}

          {activeTab === 'confirm' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ✅ قالب رسالة تأكيد الأوردر الأساسي (عند الضغط على زر تأكيد الطلب):
                </label>
                <textarea
                  rows={4}
                  value={templates.confirm_order}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, confirm_order: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>

            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveMessage}
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition"
              >
                إغلاق
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ القوالب</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
