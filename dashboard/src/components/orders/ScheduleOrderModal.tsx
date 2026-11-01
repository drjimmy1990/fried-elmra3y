'use client';

import React, { useState, useEffect } from 'react';
import { CalendarClock, X, BellRing, Check, Clock, Sparkles } from 'lucide-react';
import {
  PREP_ALERT_OPTIONS,
  parseScheduleMeta,
  toCairoDateTimeLocalInput,
  fromCairoDateTimeLocalInput,
} from '@/lib/scheduled-orders';
import { formatDateTime } from '@/lib/utils';
import { OrderWithItems } from './types';

interface ScheduleOrderModalProps {
  order: OrderWithItems | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSchedule: (orderId: string, scheduledForIso: string, prepAlertMinutes: number) => Promise<void>;
}

export function ScheduleOrderModal({
  order,
  isOpen,
  onClose,
  onConfirmSchedule,
}: ScheduleOrderModalProps) {
  const [dateTimeLocal, setDateTimeLocal] = useState('');
  const [prepAlertMinutes, setPrepAlertMinutes] = useState<number>(60);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!order || !isOpen) return;
    const existing = parseScheduleMeta(order.payment_method);
    if (existing.isScheduled && existing.scheduledDate) {
      setDateTimeLocal(toCairoDateTimeLocalInput(existing.scheduledDate));
      setPrepAlertMinutes(existing.prepAlertMinutes || 60);
    } else {
      // Default to tomorrow at 7:00 PM Cairo time (or 3 hours from now)
      const defaultDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
      setDateTimeLocal(toCairoDateTimeLocalInput(defaultDate));
      setPrepAlertMinutes(60);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const applyShortcut = (daysAhead: number, hour24: number, minute = 0) => {
    const now = new Date();
    const parts = toCairoDateTimeLocalInput(now).split('T')[0].split('-').map(Number);
    const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + daysAhead, hour24 - 2, minute, 0));
    setDateTimeLocal(toCairoDateTimeLocalInput(base));
  };

  const previewIso = dateTimeLocal ? fromCairoDateTimeLocalInput(dateTimeLocal) : null;
  const previewAlertDate = previewIso
    ? new Date(new Date(previewIso).getTime() - prepAlertMinutes * 60 * 1000)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTimeLocal) return;
    setIsSaving(true);
    try {
      const iso = fromCairoDateTimeLocalInput(dateTimeLocal);
      await onConfirmSchedule(order.id, iso, prepAlertMinutes);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                جدولة الطلب #{order.order_number} ({order.customer_name})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حفظ الطلب في صفحة الطلبات المجدولة مع تنبيه للمطبخ قبل الموعد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {order.customer_notes && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              <span className="font-bold">ملاحظة العميل المسجلة: </span>
              <span>{order.customer_notes}</span>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>اختيار سريع للموعد (بتوقيت مصر):</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyShortcut(0, 17, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                اليوم 5:00 م
              </button>
              <button
                type="button"
                onClick={() => applyShortcut(0, 19, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                اليوم 7:00 م
              </button>
              <button
                type="button"
                onClick={() => applyShortcut(0, 21, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                اليوم 9:00 م
              </button>
              <button
                type="button"
                onClick={() => applyShortcut(1, 15, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                غداً 3:00 م
              </button>
              <button
                type="button"
                onClick={() => applyShortcut(1, 17, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                غداً 5:00 م
              </button>
              <button
                type="button"
                onClick={() => applyShortcut(1, 19, 0)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition"
              >
                غداً 7:00 م
              </button>
            </div>
          </div>

          {/* Exact Delivery Date & Time */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>تاريخ ووقت توصيل الطلب للعميل:</span>
            </label>
            <input
              type="datetime-local"
              required
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          {/* Prep Alert Lead Time */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-amber-500" />
              <span>موعد تنبيه المطبخ لتجهيز الطلب (قبل ميعاد التوصيل الفعلي):</span>
            </label>
            <select
              value={prepAlertMinutes}
              onChange={(e) => setPrepAlertMinutes(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
              {PREP_ALERT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Live Preview of Delivery & Alert Times */}
          {previewIso && previewAlertDate && (
            <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/25 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                <span>📦 موعد التوصيل للعميل:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-300">
                  {formatDateTime(previewIso)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                <span>🔔 موعد رنين التنبيه لتجهيز المطبخ:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {formatDateTime(previewAlertDate.toISOString())}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ في الطلبات المجدولة 📅'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
