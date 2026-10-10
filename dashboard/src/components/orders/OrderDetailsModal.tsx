'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  PhoneCall,
  MessageCircle,
  MapPin,
  Clock,
  Printer, AlertTriangle,
  FileText,
  Save,
  Check,
  AlertCircle,
  ChefHat,
  Bike,
  CheckCircle2,
  Ban,
  ArrowRight,
  Receipt,
  User,
  ShoppingBag,
  CreditCard,
  Sparkles,
  Building2,
  Tag,
} from 'lucide-react';
import { formatCurrency, formatDateTime, getOrderStatusBadge, getWhatsAppLink } from '@/lib/utils';
import { OrderWithItems, OrderStatus } from './types';

interface OrderDetailsModalProps {
  order: OrderWithItems | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
  onChangeStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  onUpdateNotes: (orderId: string, notes: string) => Promise<boolean>;
  onPrintReceipt: (order: OrderWithItems) => void;
  complaints?: any[];
}

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  onAdvanceStatus,
  onChangeStatus,
  onUpdateNotes,
  onPrintReceipt, complaints = [] }: OrderDetailsModalProps) {
  const [internalNotes, setInternalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveSuccess, setNotesSaveSuccess] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Sync internal notes state only when opening a different order
  useEffect(() => {
    if (order) {
      setInternalNotes(order.internal_notes || '');
      setNotesSaveSuccess(false);
    }
  }, [order?.id]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const success = await onUpdateNotes(order.id, internalNotes);
      if (success) {
        setNotesSaveSuccess(true);
        setTimeout(() => setNotesSaveSuccess(false), 3000);
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsChangingStatus(true);
    try {
      await onChangeStatus(order.id, newStatus);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const currentBadge = getOrderStatusBadge(order.status);

  const getSourceDisplay = (source: string) => {
    switch (source) {
      case 'messenger':
        return { label: 'فيسبوك ماسنجر', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'whatsapp':
        return { label: 'واتساب', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'web':
        return { label: 'الموقع', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default:
        return { label: source, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const sourceMeta = getSourceDisplay(order.source);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="order-details-title" className="font-extrabold text-lg text-white">
                  طلب رقم #{order.order_number}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${currentBadge.color}`}
                >
                  {currentBadge.label}
                </span>
                <span
                  className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${sourceMeta.color}`}
                >
                  {sourceMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>تم التسجيل في: {formatDateTime(order.created_at)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintReceipt(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-xs"
              title="طباعة إيصال الفاتورة"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">طباعة 80mm</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Customer Details Card */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-amber-400">
              <User className="w-4 h-4" />
              <span>معلومات العميل والتوصيل</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">اسم العميل</div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {order.customer_name}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">رقم الهاتف والتواصل</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm font-semibold text-white" dir="ltr">
                    {order.customer_phone}
                  </span>
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors"
                    title="اتصال هاتفي"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>اتصال</span>
                  </a>
                  <a
                    href={getWhatsAppLink(order.customer_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                    title="محادثة واتساب"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>واتساب</span>
                  </a>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-slate-400">عنوان التوصيل بالتفصيل</div>
                <div className="flex items-start gap-1.5 mt-1 text-sm font-medium text-slate-200">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{order.delivery_address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>أصناف الوجبات والطلبات</span>
                <span className="text-xs text-slate-400">
                  ({order.order_items.length} صنف)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-900/40">
                    <th className="py-2.5 px-4 font-semibold">الصنف</th>
                    <th className="py-2.5 px-4 font-semibold text-center">الكمية</th>
                    <th className="py-2.5 px-4 font-semibold">سعر الوحدة</th>
                    <th className="py-2.5 px-4 font-semibold text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {order.order_items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{item.item_name}</div>
                        {item.notes && (
                          <div className="inline-block mt-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                            ملاحظة: {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-400 text-sm">
                        x{item.quantity}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatCurrency(Number(item.unit_price) || 0)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-white">
                        {formatCurrency(Number(item.total_price) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>المجموع الفرعي للأصناف:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(Number(order.subtotal) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>تكلفة خدمة التوصيل:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(Number(order.delivery_fee) || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold text-white">
                <span className="text-amber-400">الإجمالي النهائي المطلوب:</span>
                <span className="font-mono text-lg text-amber-400">
                  {formatCurrency(Number(order.total_amount) || 0)}
                </span>
              </div>
              {order.branch?.name && (
                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>الفرع المسؤول:</span>
                  <span className="font-medium text-blue-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    {order.branch.name}
                  </span>
                </div>
              )}
              {order.offer?.title && (
                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>العرض المطبق:</span>
                  <span className="font-medium text-amber-400 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    {order.offer.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Internal Notes Textarea */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="order-internal-notes"
                className="text-xs font-bold text-slate-300 flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>ملاحظات فريق العمل والتشغيل الداخلي</span>
              </label>
              {notesSaveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  تم الحفظ بنجاح
                </span>
              )}
            </div>

            <textarea
              id="order-internal-notes"
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="اكتب أي ملاحظة للمطبخ، مندوب الدليفري، أو التجهيز..."
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />

            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSavingNotes ? 'جاري الحفظ...' : 'حفظ الملاحظة'}</span>
              </button>
            </div>
          </div>

                    {/* Linked Complaints */}
          {complaints && complaints.length > 0 && (
            <div className="rounded-2xl bg-slate-950/60 border border-rose-900/50 p-4">
              <div className="text-xs font-bold text-rose-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>شكاوى مرتبطة بالطلب</span>
              </div>
              <div className="space-y-2">
                {complaints.map(c => (
                  <Link
                    key={c.id}
                    href={{pathname: '/dashboard/complaints', query: {complaintId: c.id}}}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">#{c.ticket_number}</span>
                      <span className="text-xs text-slate-400">
                        {c.status === 'open' ? 'مفتوحة' : 'تم الحل'}
                      </span>
                    </div>
                    <span className="text-xs text-rose-400 font-medium">عرض التفاصيل</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Status Workflow Controls */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4">
            <div className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تحديث حالة الطلب</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('pending')}
                disabled={isChangingStatus || order.status === 'pending'}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  order.status === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-2 ring-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>قيد الانتظار</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('confirmed')}
                disabled={isChangingStatus || order.status === 'confirmed'}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  order.status === 'confirmed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 ring-2 ring-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>مؤكد</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-800 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintReceipt(order)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>طباعة إيصال الفاتورة</span>
            </button>

            {/* Quick Next-Step Advance Button */}
            {order.status === 'pending' && (
              <button
                type="button"
                onClick={() => onAdvanceStatus(order.id, 'pending')}
                disabled={isChangingStatus}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-102"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد الطلب وإبلاغ العميل</span>
              </button>
            )}

            {order.status === 'confirmed' && (
              <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>الطلب مؤكد</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}








