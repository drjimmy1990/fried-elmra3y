import { Database, ComplaintStatus, UserRole } from '@/types/database.types';

export type ComplaintRow = Database['public']['Tables']['complaints']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ContactRow = Database['public']['Tables']['contacts']['Row'];

export type { ComplaintStatus, UserRole };

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

export type StatusFilter = 'all' | ComplaintStatus;
export type ViewMode = 'table' | 'cards';

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
        label: 'مفتوحة',
        color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        bgSolid: 'bg-rose-500',
        dot: 'bg-rose-500',
      };
    case 'resolved':
      return {
        label: 'تم الحل',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        bgSolid: 'bg-emerald-500',
        dot: 'bg-emerald-500',
      };
    default:
      return {
        label: status,
        color: 'bg-slate-800 text-slate-300 border-slate-700',
        bgSolid: 'bg-slate-700',
        dot: 'bg-slate-500',
      };
  }
}
