import { Database, ComplaintStatus, ComplaintPriority, UserRole } from '@/types/database.types';

export type ComplaintRow = Database['public']['Tables']['complaints']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ContactRow = Database['public']['Tables']['contacts']['Row'];

export type { ComplaintStatus, ComplaintPriority, UserRole };

export interface StaffProfile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string | null;
  phone?: string | null;
  is_active: boolean;
}

export type ComplaintWithDetails = ComplaintRow & {
  assigned_profile?: StaffProfile | null;
  contact?: ContactRow | null;
  order?: Database['public']['Tables']['orders']['Row'] | null;
};

export type PriorityFilter = 'all' | ComplaintPriority;
export type StatusFilter = 'all' | ComplaintStatus;
export type ViewMode = 'columns' | 'tabs';

export interface StatusColumnDef {
  id: ComplaintStatus;
  title: string;
  subtitle: string;
  badgeColor: string;
  dotColor: string;
  bgLight: string;
  borderLight: string;
}

export function getComplaintStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return {
        label: 'مفتوحة / جديدة',
        color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        bgSolid: 'bg-rose-500',
        dot: 'bg-rose-500',
      };
    case 'in_progress':
      return {
        label: 'قيد المتابعة',
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        bgSolid: 'bg-blue-500',
        dot: 'bg-blue-500',
      };
    case 'resolved':
      return {
        label: 'تم الحل',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        bgSolid: 'bg-emerald-500',
        dot: 'bg-emerald-500',
      };
    case 'closed':
      return {
        label: 'مغلقة',
        color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        bgSolid: 'bg-slate-500',
        dot: 'bg-slate-500',
      };
    default:
      return {
        label: status,
        color: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
        bgSolid: 'bg-gray-500',
        dot: 'bg-gray-500',
      };
  }
}
