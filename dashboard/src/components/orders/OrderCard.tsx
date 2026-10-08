'use client';

import React from 'react';
import {
  Clock,
  MapPin,
  Phone,
  Printer,
  ChevronLeft,
  ChefHat,
  Bike,
  CheckCircle2,
  Ban,
  Loader2,
  ShoppingBag,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import { formatCurrency, getOrderStatusBadge } from '@/lib/utils';
import { OrderWithItems, OrderStatus } from './types';

interface OrderCardProps {
  order: OrderWithItems;
  onSelectOrder: (order: OrderWithItems) => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onPrintReceipt: (order: OrderWithItems) => void;
  isUpdating?: boolean;
}

// Arabic relative time elapsed helper
function formatTimeElapsed(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'الآن';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) return 'منذ دقيقة';
  if (diffInMinutes === 2) return 'منذ دقيقتين';
  if (diffInMinutes >= 3 && diffInMinutes <= 10) return `منذ ${diffInMinutes} دقائق`;
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return 'منذ ساعة';
  if (diffInHours === 2) return 'منذ ساعتين';
  if (diffInHours >= 3 && diffInHours <= 10) return `منذ ${diffInHours} ساعات`;
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'منذ يوم';
  if (diffInDays === 2) return 'منذ يومين';
  if (diffInDays >= 3 && diffInDays <= 10) return `منذ ${diffInDays} أيام`;
  return `منذ ${diffInDays} يوم`;
}

export function OrderCard({
  order,
  onSelectOrder,
  onAdvanceStatus,
  onCancelOrder,
  onPrintReceipt,
  isUpdating = false,
}: OrderCardProps) {
  const currentBadge = getOrderStatusBadge(order.status);

  // Summarize items for preview
  const totalItemCount = order.order_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const itemsPreview = order.order_items
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.item_name}`)
    .join('، ');
  const remainingCount = order.order_items.length > 2 ? order.order_items.length - 2 : 0;

  // Format WhatsApp link
  const getWhatsAppLink = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '2' + clean;
    else if (!clean.startsWith('20') && clean.length === 10) clean = '20' + clean;
    return `https://wa.me/${clean}`;
  };

  return (
    <div
      onClick={() => onSelectOrder(order)}
      className="group relative rounded-2xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 p-4 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer text-slate-200 flex flex-col gap-3 select-none"
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base text-white tracking-wide font-mono">
            #{order.order_number}
          </span>
          {order.source && (
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-medium border border-slate-700/50">
              {order.source === 'messenger' ? 'ماسنجر' : order.source === 'whatsapp' ? 'واتساب' : order.source}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{formatTimeElapsed(order.created_at)}</span>
        </div>
      </div>

      {/* Customer Information */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
            {order.customer_name}
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <a
              href={`tel:${order.customer_phone}`}
              className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="اتصال بالعميل"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
            <a
              href={getWhatsAppLink(order.customer_phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="محادثة واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Address snippet */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{order.delivery_address}</span>
        </div>
      </div>

      {/* Order Items Preview */}
      <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-amber-500/80" />
            <span>الأصناف ({totalItemCount} قطع)</span>
          </span>
          {order.order_items.some((i) => i.notes) && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded-sm">
              يوجد ملاحظات
            </span>
          )}
        </div>
        <div className="text-slate-300 font-medium line-clamp-2 leading-relaxed">
          {itemsPreview}
          {remainingCount > 0 && (
            <span className="text-amber-400/90 font-semibold mr-1">
              +{remainingCount} صنف آخر
            </span>
          )}
        </div>
      </div>

      {/* Price & Payment Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
        <div>
          <div className="text-[11px] text-slate-400">الإجمالي النهائي</div>
          <div className="font-extrabold text-base text-amber-400 font-mono">
            {formatCurrency(Number(order.total_amount) || 0)}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700/40">
          <CreditCard className="w-3 h-3 text-slate-400" />
          <span>{order.payment_method === 'cash_on_delivery' ? 'كاش' : order.payment_method}</span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div
        className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {/* Quick Print Button */}
          <button
            type="button"
            onClick={() => onPrintReceipt(order)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
            title="طباعة إيصال الفاتورة (80mm)"
          >
            <Printer className="w-4 h-4 text-amber-400" />
          </button>

          {/* Quick Cancel Button (for non-terminal statuses) */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`هل أنت متأكد من إلغاء الطلب #${order.order_number}؟`)) {
                  onCancelOrder(order.id);
                }
              }}
              disabled={isUpdating}
              className="p-2 rounded-xl bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors border border-slate-800 hover:border-rose-500/30"
              title="إلغاء الطلب"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Advance Status Button */}
        <div>
          {isUpdating ? (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>جاري التحديث...</span>
            </div>
          ) : (
            <>
              {(order.status === 'pending' || order.status === 'confirmed') && (
                <button
                  type="button"
                  onClick={() => onAdvanceStatus(order.id, order.status)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all hover:scale-102"
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>بدء التجهيز</span>
                </button>
              )}

              {order.status === 'preparing' && (
                <button
                  type="button"
                  onClick={() => onAdvanceStatus(order.id, order.status)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all hover:scale-102"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>إرسال للدليفري</span>
                </button>
              )}

              {order.status === 'out_for_delivery' && (
                <button
                  type="button"
                  onClick={() => onAdvanceStatus(order.id, order.status)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all hover:scale-102"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم التوصيل</span>
                </button>
              )}

              {order.status === 'delivered' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مكتمل</span>
                </span>
              )}

              {order.status === 'cancelled' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20">
                  <Ban className="w-3.5 h-3.5" />
                  <span>ملغي</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
