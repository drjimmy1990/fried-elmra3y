'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  Sparkles,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import { TemplatePreset, interpolateOrderTemplate } from '@/lib/order-templates';

export type OrderActionModalType =
  | 'modification_approve'
  | 'modification_decline'
  | 'cancellation_approve'
  | 'cancellation_decline'
  | 'staff_cancel_order';

export interface OrderActionModalConfig {
  type: OrderActionModalType;
  title: string;
  subtitle: string;
  confirmButtonLabel: string;
  confirmButtonVariant: 'emerald' | 'rose' | 'amber';
  customerName: string;
  orderNumber: number | string;
  totalAmount: number | string;
  modificationDetails?: string;
  defaultMessage: string;
  presets?: TemplatePreset[];
  onConfirm: (payload: {
    messageText: string;
    sendNotification: boolean;
    reasonNote?: string;
  }) => Promise<void>;
}

interface OrderActionMessageModalProps {
  config: OrderActionModalConfig | null;
  onClose: () => void;
}

export function OrderActionMessageModal({
  config,
  onClose,
}: OrderActionMessageModalProps) {
  const [messageText, setMessageText] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      setMessageText(config.defaultMessage);
      setSendNotification(true);
      setSelectedPresetLabel('');
      setIsSubmitting(false);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [config, isSubmitting, onClose]);

  if (!config) return null;

  const handleSelectPreset = (preset: TemplatePreset) => {
    const interpolated = interpolateOrderTemplate(preset.text, {
      customer_name: config.customerName,
      order_number: config.orderNumber,
      total_amount: config.totalAmount,
      modification_details: config.modificationDetails,
    });
    setMessageText(interpolated);
    setSelectedPresetLabel(preset.label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (sendNotification && !messageText.trim()) {
      alert('يرجى كتابة نص الرسالة أو إلغاء تحديد خيار الإرسال للعميل.');
      return;
    }

    setIsSubmitting(true);
    try {
      await config.onConfirm({
        messageText: messageText.trim(),
        sendNotification,
        reasonNote: selectedPresetLabel || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Action modal error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isApprove =
    config.confirmButtonVariant === 'emerald' ||
    config.type === 'modification_approve' ||
    config.type === 'cancellation_approve';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      dir="rtl"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isApprove
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-rose-500/10 border-rose-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isApprove
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isApprove ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : config.type === 'staff_cancel_order' ? (
                <Ban className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {config.title}
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {config.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Quick Presets if available */}
          {config.presets && config.presets.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>اختر قالب سبب سريع (يملأ الرسالة تلقائياً ويمكنك تعديلها):</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {config.presets.map((preset) => {
                  const isSelected = selectedPresetLabel === preset.label;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-500/40'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <MessageSquareText className="w-3.5 h-3.5 text-amber-500" />
                <span>رسالة العميل على ماسنجر (قابلة للتعديل قبل الإرسال):</span>
              </label>
              <span className="text-[11px] text-slate-400">
                العميل: <strong className="text-slate-700 dark:text-slate-200">{config.customerName}</strong>
              </span>
            </div>

            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={!sendNotification || isSubmitting}
              placeholder="اكتب الرسالة التي ستصل للعميل على فيسبوك ماسنجر..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 leading-relaxed"
            />
          </div>

          {/* Toggle Send Notification */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              إرسال هذه الرسالة للعميل فوراً عبر فيسبوك ماسنجر 💬
            </span>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              تراجع
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition disabled:opacity-50 ${
                isApprove
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التنفيذ والإرسال...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{config.confirmButtonLabel}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
