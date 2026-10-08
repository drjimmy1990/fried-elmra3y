import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  return `${amount.toFixed(2)} ${currency === 'EGP' ? 'ج.م' : currency}`;
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'جديد قيد الانتظار', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'confirmed':
      return { label: 'تم التأكيد', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'preparing':
      return { label: 'قيد التحضير في المطبخ', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    case 'out_for_delivery':
      return { label: 'مع الطيار للتوصيل', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    case 'delivered':
      return { label: 'تم التسليم بنجاح', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'cancelled':
      return { label: 'ملغي', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    default:
      return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-300' };
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
