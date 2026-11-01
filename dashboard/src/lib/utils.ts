import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  return `${amount.toFixed(2)} ${currency === 'EGP' ? 'ج.م' : currency}`;
}

export function normalizeOrderPricing<
  T extends {
    id?: string;
    item_name?: string;
    quantity?: number | null;
    unit_price?: number | null;
    total_price?: number | null;
    notes?: string | null;
  }
>(order: {
  subtotal?: number | null;
  delivery_fee?: number | null;
  total_amount?: number | null;
  order_items?: T[] | null;
}) {
  const deliveryFee = Number(order.delivery_fee) || 0;
  const totalAmount = Number(order.total_amount) || 0;
  const expectedSubtotal = Math.max(0, totalAmount - deliveryFee);
  const rawItems = order.order_items || [];

  const baseItems = rawItems.map((item) => {
    const qty = Number(item.quantity) || 1;
    const rawUnit = Number(item.unit_price) || 0;
    const rawTotal = Number(item.total_price) || rawUnit * qty;
    return {
      ...item,
      normalizedQty: qty,
      normalizedUnitPrice: rawUnit,
      normalizedLineTotal: rawTotal,
      reductionIfLineTotal:
        qty > 1 && rawUnit > 0 && Math.abs(rawTotal - rawUnit * qty) <= 1
          ? rawUnit * (qty - 1)
          : 0,
    };
  });

  const rawTotalSum = baseItems.reduce((sum, it) => sum + it.normalizedLineTotal, 0);
  const excess = rawTotalSum - expectedSubtotal;

  if (expectedSubtotal > 0 && excess > 1) {
    // Find subset of multi-qty items whose reductionIfLineTotal sums to excess
    const multiIndices = baseItems
      .map((it, idx) => (it.reductionIfLineTotal > 0 ? idx : -1))
      .filter((idx) => idx !== -1);

    let matchedMask = 0;
    const count = multiIndices.length;
    if (count > 0 && count <= 12) {
      for (let mask = 1; mask < 1 << count; mask++) {
        let sumRed = 0;
        for (let b = 0; b < count; b++) {
          if (mask & (1 << b)) {
            sumRed += baseItems[multiIndices[b]].reductionIfLineTotal;
          }
        }
        if (Math.abs(sumRed - excess) <= 1) {
          matchedMask = mask;
          break;
        }
      }
    }

    if (matchedMask > 0) {
      for (let b = 0; b < count; b++) {
        if (matchedMask & (1 << b)) {
          const idx = multiIndices[b];
          const it = baseItems[idx];
          it.normalizedLineTotal = it.normalizedUnitPrice;
          it.normalizedUnitPrice = it.normalizedUnitPrice / it.normalizedQty;
        }
      }
    }
  }

  const normalizedItemsSum = baseItems.reduce((sum, it) => sum + it.normalizedLineTotal, 0);
  const displaySubtotal =
    expectedSubtotal > 0
      ? expectedSubtotal
      : normalizedItemsSum > 0
      ? normalizedItemsSum
      : Number(order.subtotal) || 0;

  return {
    items: baseItems,
    displaySubtotal,
    deliveryFee,
    totalAmount,
  };
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function isOrderCancelled(
  orderOrPaymentMethod?:
    | { status?: string | null; payment_method?: string | null }
    | string
    | null
): boolean {
  if (!orderOrPaymentMethod) return false;
  if (typeof orderOrPaymentMethod === 'string') {
    return (
      orderOrPaymentMethod === 'cancelled' ||
      orderOrPaymentMethod.startsWith('cancelled|')
    );
  }
  if (orderOrPaymentMethod.status === 'cancelled') return true;
  const pm = orderOrPaymentMethod.payment_method;
  return typeof pm === 'string' && (pm === 'cancelled' || pm.startsWith('cancelled|'));
}

export function getOrderStatusBadge(status: string, paymentMethod?: string | null) {
  if (status === 'cancelled' || isOrderCancelled(paymentMethod)) {
    return { label: 'ملغي 🚫', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' };
  }
  switch (status) {
    case 'pending':
      return { label: 'قيد الانتظار', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'confirmed':
      return { label: 'مؤكد', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    default:
      return { label: status, color: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

export function getComplaintPriorityBadge(priority: string) {
  switch (priority) {
    case 'urgent':
      return { label: 'عاجل جداً 🔴', color: 'bg-red-100 text-red-800 border-red-300 animate-pulse' };
    case 'high':
      return { label: 'أولوية عالية 🟠', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    case 'medium':
      return { label: 'متوسط 🟡', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    case 'low':
      return { label: 'عادي 🟢', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    default:
      return { label: priority, color: 'bg-gray-100 text-gray-800 border-gray-300' };
  }
}

export function getWhatsAppLink(phone: string | null | undefined): string {
  if (!phone) return '#';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '2' + clean;
  } else if (!clean.startsWith('20') && clean.length === 10) {
    clean = '20' + clean;
  }
  return `https://wa.me/${clean}`;
}

export function getComplaintStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return { label: 'مفتوحة / جديدة', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'in_progress':
      return { label: 'قيد المتابعة', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'resolved':
      return { label: 'تم الحل بنجاح', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'closed':
      return { label: 'مغلقة ومؤرشفة', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    default:
      return { label: status, color: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

export function formatTimeElapsed(dateString: string | null | undefined): string {
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
