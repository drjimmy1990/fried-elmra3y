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
