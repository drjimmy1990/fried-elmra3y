'use client';

import React from 'react';
import Link from 'next/link';
import {
  Edit3,
  Ban,
  CheckCircle2,
  XCircle,
  Phone,
  MessageCircle,
  Clock,
  Building2,
  ArrowLeftRight,
  ShoppingBag,
  Eye,
  Sparkles,
} from 'lucide-react';
import { OrderWithItems } from './types';
import {
  formatCurrency,
  formatTimeElapsed,
  getOrderStatusBadge,
  normalizeOrderPricing,
} from '@/lib/utils';
import { extractModificationSummary } from '@/lib/order-templates';

export interface ModificationRequestPair {
  modOrder: OrderWithItems;
  originalOrder: OrderWithItems | null;
}

export interface CancellationRequestItem {
  complaint: {
    id: string;
    ticket_number: number;
    contact_id: string | null;
    customer_name: string;
    customer_phone: string | null;
    issue_description: string;
    status: string;
    order_id: string | null;
    created_at: string;
  };
  linkedOrder: OrderWithItems | null;
}

interface OrderModificationRequestsSectionProps {
  modificationRequests: ModificationRequestPair[];
  cancellationRequests: CancellationRequestItem[];
  isUpdating: Record<string, boolean>;
  onApproveModification: (pair: ModificationRequestPair) => void;
  onDeclineModification: (pair: ModificationRequestPair) => void;
  onApproveCancellation: (item: CancellationRequestItem) => void;
  onDeclineCancellation: (item: CancellationRequestItem) => void;
  onSelectOrder: (order: OrderWithItems) => void;
}

export function OrderModificationRequestsSection({
  modificationRequests,
  cancellationRequests,
  isUpdating,
  onApproveModification,
  onDeclineModification,
  onApproveCancellation,
  onDeclineCancellation,
  onSelectOrder,
}: OrderModificationRequestsSectionProps) {
  const totalRequests = modificationRequests.length + cancellationRequests.length;

  if (totalRequests === 0) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
              قسم طلبات تعديل وإلغاء الأوردرات من العملاء
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              لا توجد طلبات تعديل أو إلغاء معلقة حالياً — سيظهر أي طلب تعديل أو إلغاء جديد هنا تلقائياً مع مقارنة الأوردر الأصلي والمعدل وأزرار الموافقة والرفض.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          0 طلبات معلقة ✅
        </span>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-rose-500/5 p-4 sm:p-5 space-y-4 shadow-xl"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-500 flex items-center justify-center shadow-inner">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                طلبات تعديل وإلغاء الأوردرات من العملاء
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                {totalRequests} طلب بانتظار القرار
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              راجع الأوردر الأصلي والتعديل أو الإلغاء المطلوب، واضغط موافقة أو رفض لإرسال رسالة فورية للعميل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          {modificationRequests.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
              ✏️ {modificationRequests.length} طلب تعديل
            </span>
          )}
          {cancellationRequests.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
              🚫 {cancellationRequests.length} طلب إلغاء
            </span>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. ORDER MODIFICATION REQUEST CARDS */}
        {modificationRequests.map((pair) => {
          const { modOrder, originalOrder } = pair;
          const busy = Boolean(
            isUpdating[modOrder.id] || (originalOrder && isUpdating[originalOrder.id])
          );
          const modSummary = extractModificationSummary(modOrder.customer_notes);
          const modPricing = normalizeOrderPricing(modOrder);
          const origPricing = originalOrder ? normalizeOrderPricing(originalOrder) : null;
          const origStatusBadge = originalOrder
            ? getOrderStatusBadge(originalOrder.status, originalOrder.payment_method)
            : null;

          return (
            <div
              key={`mod-${modOrder.id}`}
              className="flex flex-col justify-between rounded-2xl border border-amber-500/35 bg-white dark:bg-slate-900/95 p-4 shadow-md space-y-3.5"
            >
              <div className="space-y-3">
                {/* Top Row: Badge + Customer + Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <Edit3 className="w-3.5 h-3.5" />
                        طلب تعديل أوردر {originalOrder ? `#${originalOrder.order_number}` : `#${modOrder.order_number}`}
                      </span>
                      {modOrder.branch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                          <Building2 className="w-3 h-3" />
                          {modOrder.branch.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatTimeElapsed(modOrder.created_at)}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {modOrder.customer_name || 'عميل'}
                      <span className="mr-2 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                        ({modOrder.customer_phone})
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {modOrder.customer_phone && (
                      <a
                        href={`tel:${modOrder.customer_phone}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="اتصال بالعميل"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {modOrder.contact_id && (
                      <Link
                        href={`/chat?contactId=${modOrder.contact_id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="فتح محادثة العميل"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectOrder(originalOrder || modOrder)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="عرض تفاصيل الطلب"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Highlighted Modification Summary */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>التعديل المطلوب من العميل:</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                    {modSummary}
                  </p>
                </div>

                {/* Side-by-Side Comparison: Original vs Modified */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Original Order Box */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                        {originalOrder
                          ? `الأوردر الأصلي (#${originalOrder.order_number})`
                          : 'الأوردر السابق'}
                      </span>
                      {origStatusBadge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${origStatusBadge.color}`}
                        >
                          {origStatusBadge.label}
                        </span>
                      )}
                    </div>

                    {originalOrder && origPricing ? (
                      <>
                        <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                          {origPricing.items.length > 0 ? (
                            origPricing.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between gap-1">
                                <span className="font-semibold">
                                  {it.normalizedQty}x {it.item_name}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {it.normalizedLineTotal} ج
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400">بدون تفاصيل أصناف</span>
                          )}
                        </div>
                        <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-black">
                          <span className="text-slate-500">الإجمالي السابق:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-mono">
                            {formatCurrency(origPricing.totalAmount)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 py-2">
                        طلب تعديل مباشر على الأوردر (#{modOrder.order_number})
                      </p>
                    )}
                  </div>

                  {/* Modified Order Box */}
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        الأوردر النهائي بعد التعديل
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        #{modOrder.order_number}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-800 dark:text-slate-100">
                      {modPricing.items.length > 0 ? (
                        modPricing.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between gap-1">
                            <span className="font-bold">
                              {it.normalizedQty}x {it.item_name}
                            </span>
                            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                              {it.normalizedLineTotal} ج
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400">راجع تفاصيل الملاحظات أعلاه</span>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-xs font-black">
                      <span className="text-emerald-700 dark:text-emerald-300">الإجمالي الجديد:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(modPricing.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Approve vs Decline */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApproveModification(pair)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/15 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>موافقة وتحديث الأوردر</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeclineModification(pair)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>رفض التعديل وإبلاغ العميل</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* 2. CUSTOMER CANCELLATION REQUEST CARDS */}
        {cancellationRequests.map((item) => {
          const { complaint, linkedOrder } = item;
          const busy = Boolean(
            isUpdating[complaint.id] || (linkedOrder && isUpdating[linkedOrder.id])
          );
          const ordPricing = linkedOrder ? normalizeOrderPricing(linkedOrder) : null;
          const ordStatusBadge = linkedOrder
            ? getOrderStatusBadge(linkedOrder.status, linkedOrder.payment_method)
            : null;

          return (
            <div
              key={`cancel-req-${complaint.id}`}
              className="flex flex-col justify-between rounded-2xl border border-rose-500/35 bg-white dark:bg-slate-900/95 p-4 shadow-md space-y-3.5"
            >
              <div className="space-y-3">
                {/* Top Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                        <Ban className="w-3.5 h-3.5" />
                        طلب إلغاء أوردر {linkedOrder ? `#${linkedOrder.order_number}` : `(تذكرة #${complaint.ticket_number})`}
                      </span>
                      {linkedOrder?.branch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                          <Building2 className="w-3 h-3" />
                          {linkedOrder.branch.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatTimeElapsed(complaint.created_at)}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {complaint.customer_name || linkedOrder?.customer_name || 'عميل'}
                      {(complaint.customer_phone || linkedOrder?.customer_phone) && (
                        <span className="mr-2 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                          ({complaint.customer_phone || linkedOrder?.customer_phone})
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {(complaint.customer_phone || linkedOrder?.customer_phone) && (
                      <a
                        href={`tel:${complaint.customer_phone || linkedOrder?.customer_phone}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="اتصال بالعميل"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {(complaint.contact_id || linkedOrder?.contact_id) && (
                      <Link
                        href={`/chat?contactId=${complaint.contact_id || linkedOrder?.contact_id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="فتح محادثة العميل"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Link>
                    )}
                    {linkedOrder && (
                      <button
                        type="button"
                        onClick={() => onSelectOrder(linkedOrder)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="عرض تفاصيل الأوردر"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cancellation Reason Box */}
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-300 block">
                    تفاصيل طلب الإلغاء من العميل:
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                    {complaint.issue_description}
                  </p>
                </div>

                {/* Linked Order Summary */}
                {linkedOrder && ordPricing && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        الأوردر المرتبط #{linkedOrder.order_number}
                      </span>
                      {ordStatusBadge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ordStatusBadge.color}`}
                        >
                          {ordStatusBadge.label}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {ordPricing.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between gap-1">
                          <span className="font-semibold">
                            {it.normalizedQty}x {it.item_name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {it.normalizedLineTotal} ج
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-500">إجمالي الأوردر:</span>
                      <span className="text-amber-500 font-mono">
                        {formatCurrency(ordPricing.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Approve Cancellation vs Decline Cancellation */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApproveCancellation(item)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/15 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>موافقة وإلغاء الأوردر</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeclineCancellation(item)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>رفض الإلغاء وإبلاغ العميل</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
