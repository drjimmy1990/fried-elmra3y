'use client';

import Link from 'next/link';
import React from 'react';
import {
  Clock,
  MapPin,
  Phone,
  Printer,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  MessageCircle,
  Building2,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, getOrderStatusBadge, getWhatsAppLink } from '@/lib/utils';
import { OrderWithItems, OrderStatus } from './types';

export interface OrderCardProps {
  order: OrderWithItems;
  complaints?: any[];
  onSelectOrder: (order: OrderWithItems) => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
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

function OrderCardComponent({
  order,
  complaints = [],
  onSelectOrder,
  onAdvanceStatus,
  onPrintReceipt,
  isUpdating = false,
}: OrderCardProps) {
  const currentBadge = getOrderStatusBadge(order.status);

  // Summarize items for preview
  const totalItemCount = (order.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const itemsPreview = (order.order_items || [])
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.item_name}`)
    .join('، ');
  const remainingCount = (order.order_items || []).length > 2 ? order.order_items.length - 2 : 0;

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
          {order.branch?.name && (
            <span className="flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-[10px] font-medium border border-blue-500/20">
              <Building2 className="w-2.5 h-2.5" />
              <span>{order.branch.name}</span>
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
            {order.contact_id && (
              <Link
                href={{ pathname: '/dashboard/chat', query: { contactId: order.contact_id } }}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                title="فتح محادثة العميل"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Address snippet */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{order.delivery_address}</span>
        </div>
      </div>

      {/* Offer Banner Badge if applicable */}
      {order.offer?.title && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium">
          <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">عرض: {order.offer.title}</span>
        </div>
      )}

      {/* Linked Open Complaint Alert */}
      {complaints.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>شكوى مفتوحة #{complaints[0].ticket_number || ''}</span>
        </div>
      )}

      {/* Order Items Preview */}
      <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-amber-500/80" />
            <span>الأصناف ({totalItemCount} قطع)</span>
          </span>
          {order.customer_notes && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded-sm">
              يوجد ملاحظات
            </span>
          )}
        </div>
        <div className="text-slate-300 font-medium line-clamp-2 leading-relaxed">
          {itemsPreview || order.customer_notes || 'تفاصيل الأصناف بالداخل'}
          {remainingCount > 0 && (
            <span className="text-amber-400/90 font-semibold mr-1">
              +{remainingCount} صنف آخر
            </span>
          )}
        </div>
      </div>

      {/* Price Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
        <div>
          <div className="text-[11px] text-slate-400">الإجمالي النهائي</div>
          <div className="font-extrabold text-base text-amber-400 font-mono">
            {formatCurrency(Number(order.total_amount) || 0)}
          </div>
        </div>

        <div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${currentBadge.color}`}>
            {currentBadge.label}
          </span>
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
        </div>

        {/* Quick Advance Status Button */}
        <div>
          {isUpdating ? (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>جاري التأكيد...</span>
            </div>
          ) : (
            <>
              {order.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => onAdvanceStatus(order.id, 'confirmed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all hover:scale-102"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تأكيد الطلب وإبلاغ العميل</span>
                </button>
              )}

              {order.status === 'confirmed' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم تأكيد الطلب</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const OrderCard = React.memo(OrderCardComponent);
