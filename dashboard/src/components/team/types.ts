import { UserRole } from '@/types/database.types';

export type { UserRole };

export interface StaffMember {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StaffRoleFilter = 'all' | UserRole;

export interface InviteStaffInput {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
}

export interface RoleConfig {
  role: UserRole;
  label: string;
  shortLabel: string;
  iconName: string;
  badgeClass: string;
  bgLight: string;
  description: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    role: 'admin',
    label: 'مدير النظام 👑',
    shortLabel: 'مدير',
    iconName: 'Crown',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    bgLight: 'from-amber-500/20 to-amber-500/5',
    description: 'صلاحيات كاملة للتحكم في النظام، الإعدادات، فريق العمل والمنيو',
  },
  order_agent: {
    role: 'order_agent',
    label: 'مسؤول الطلبات 🍕',
    shortLabel: 'طلبات',
    iconName: 'Pizza',
    badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    bgLight: 'from-blue-500/20 to-blue-500/5',
    description: 'استقبال وتجهيز طلبات العملاء وتحديث حالات التوصيل',
  },
  support_agent: {
    role: 'support_agent',
    label: 'خدمة العملاء والدعم 🎧',
    shortLabel: 'دعم فني',
    iconName: 'Headphones',
    badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    bgLight: 'from-purple-500/20 to-purple-500/5',
    description: 'معالجة الشكاوى والبلاغات، المحادثات المباشرة ومساعدة العملاء',
  },
};
