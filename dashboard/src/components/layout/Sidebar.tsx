'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingBag,
  CalendarClock,
  AlertCircle,
  MessageSquare,
  BookOpen,
  Sparkles,
  MessagesSquare,
  Users,
  Settings,
  X,
  Radio,
  Building2,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { StaffPermission, defaultPermissionsForRole } from '@/lib/role-guard';

interface SidebarProps {
  role: UserRole;
  permissions?: StaffPermission[];
  restaurantName?: string;
  issueOrdersCount?: number;
  scheduledOrdersCount?: number;
  openComplaintsCount?: number;
  needsHumanCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

type BadgeKind = 'orders' | 'scheduled' | 'complaints' | 'chat';

interface NavItem {
  title: string;
  href: string;
  permission: StaffPermission;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: BadgeKind;
  badgeTitle?: string;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'الرئيسية',
    href: '/dashboard',
    permission: 'overview',
    icon: LayoutDashboard,
    roles: ['admin'],
    section: 'غرفة العمليات',
  },
  {
    title: 'الإحصائيات والتقارير',
    href: '/dashboard/analytics',
    permission: 'analytics',
    icon: BarChart3,
    roles: ['admin'],
    section: 'غرفة العمليات',
  },
  {
    title: 'الطلبات',
    href: '/dashboard/orders',
    permission: 'orders',
    icon: ShoppingBag,
    roles: ['admin', 'order_agent'],
    badge: 'orders',
    badgeTitle: 'أوردرات قيد الانتظار',
    section: 'غرفة العمليات',
  },
  {
    title: 'الطلبات المجدولة',
    href: '/dashboard/scheduled-orders',
    permission: 'scheduled_orders',
    icon: CalendarClock,
    roles: ['admin', 'order_agent'],
    badge: 'scheduled',
    badgeTitle: 'أوردرات مجدولة قادمة',
    section: 'غرفة العمليات',
  },
  {
    title: 'الشكاوى',
    href: '/dashboard/complaints',
    permission: 'complaints',
    icon: AlertCircle,
    roles: ['admin', 'support_agent'],
    badge: 'complaints',
    badgeTitle: 'شكاوى مفتوحة',
    section: 'غرفة العمليات',
  },
  {
    title: 'المحادثات',
    href: '/dashboard/chat',
    permission: 'chat',
    icon: MessageSquare,
    roles: ['admin'],
    badge: 'chat',
    badgeTitle: 'عملاء طالبين موظف',
    section: 'غرفة العمليات',
  },
  {
    title: 'التعليقات',
    href: '/dashboard/comments',
    permission: 'comments',
    icon: MessagesSquare,
    roles: ['admin', 'support_agent'],
    section: 'غرفة العمليات',
  },
  {
    title: 'الفروع والتوصيل',
    href: '/dashboard/branches',
    permission: 'branches',
    icon: Building2,
    roles: ['admin'],
    section: 'إدارة المطعم',
  },
  {
    title: 'المنيو',
    href: '/dashboard/menu',
    permission: 'menu',
    icon: BookOpen,
    roles: ['admin'],
    section: 'إدارة المطعم',
  },
  {
    title: 'العروض',
    href: '/dashboard/offers',
    permission: 'offers',
    icon: Sparkles,
    roles: ['admin'],
    section: 'إدارة المطعم',
  },
  {
    title: 'القنوات والربط',
    href: '/dashboard/channels',
    permission: 'channels',
    icon: Radio,
    roles: ['admin'],
    section: 'إعدادات النظام',
  },
  {
    title: 'فريق العمل',
    href: '/dashboard/team',
    permission: 'team',
    icon: Users,
    roles: ['admin'],
    section: 'إعدادات النظام',
  },
  {
    title: 'الإعدادات العامة',
    href: '/dashboard/settings',
    permission: 'settings',
    icon: Settings,
    roles: ['admin'],
    section: 'إعدادات النظام',
  },
];

const BADGE_STYLES: Record<BadgeKind, string> = {
  orders: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-500/25',
  scheduled: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/25',
  complaints: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/25',
  chat: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/25',
};

export function Sidebar({
  role,
  permissions,
  restaurantName = 'تشيكن مراعي',
  issueOrdersCount = 0,
  scheduledOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const activePermissions =
    permissions && permissions.length > 0 ? permissions : defaultPermissionsForRole(role);

  // Filter links visible to the user's explicit permissions
  const visibleItems = NAV_ITEMS.filter((item) => activePermissions.includes(item.permission));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex h-dvh max-h-dvh w-72 max-w-[85vw] flex-col border-l border-slate-200 bg-white text-slate-800 shadow-xl dark:border-slate-800 dark:bg-[#0E1424] dark:text-slate-100 dark:shadow-2xl transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:z-auto lg:translate-x-0 lg:visible lg:pointer-events-auto ${
          isOpen
            ? 'translate-x-0 visible pointer-events-auto'
            : 'translate-x-full invisible pointer-events-none'
        }`}
      >
        {/* Branding & Logo Header */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5">
          <Link href="/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-md shadow-red-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.svg"
                alt="تشيكن مراعي"
                className="h-full w-full rounded-2xl object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate font-extrabold text-base text-slate-900 dark:text-white" title={restaurantName}>
                {restaurantName}
              </div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">لأكيلة مراعي 🍗👑</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <nav className="space-y-1 pb-6">
            {visibleItems.map((item, index) => {
              const Icon = item.icon;
              const shortHref = item.href.replace(/^\/dashboard/, '') || '/';
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname === '/'
                  : pathname === item.href ||
                    pathname.startsWith(item.href + '/') ||
                    pathname === shortHref ||
                    pathname.startsWith(shortHref + '/');

              const badgeCount =
                item.badge === 'orders'
                  ? issueOrdersCount
                  : item.badge === 'scheduled'
                  ? scheduledOrdersCount
                  : item.badge === 'complaints'
                  ? openComplaintsCount
                  : item.badge === 'chat'
                  ? needsHumanCount
                  : 0;

              const isFirstInSection =
                index === 0 || visibleItems[index - 1].section !== item.section;

              return (
                <React.Fragment key={item.href}>
                  {isFirstInSection && (
                    <div className={`px-3 ${index === 0 ? 'pb-1.5' : 'pt-4 pb-1.5'}`}>
                      <span className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                        {item.section}
                      </span>
                    </div>
                  )}

                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-r-3 border-amber-500 shadow-xs font-bold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-400 group-hover:text-amber-500'
                        }`}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>

                    {/* Badges for counts */}
                    {item.badge && badgeCount > 0 && (
                      <span
                        title={item.badgeTitle}
                        aria-label={`${item.badgeTitle ?? ''}: ${badgeCount}`}
                        className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                            : BADGE_STYLES[item.badge]
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800/80 p-4 bg-slate-50/60 dark:bg-[#0B0F17]/60">
          <div className="flex items-center justify-between rounded-xl bg-white dark:bg-slate-900/80 p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>المطعم متصل</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-semibold">v2.1</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileNavTabs({
  role,
  permissions,
  issueOrdersCount = 0,
  scheduledOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  onOpenDrawer,
}: {
  role: UserRole;
  permissions?: StaffPermission[];
  issueOrdersCount?: number;
  scheduledOrdersCount?: number;
  openComplaintsCount?: number;
  needsHumanCount?: number;
  onOpenDrawer?: () => void;
}) {
  const pathname = usePathname();
  const activePermissions =
    permissions && permissions.length > 0 ? permissions : defaultPermissionsForRole(role);
  const visibleItems = NAV_ITEMS.filter((item) => activePermissions.includes(item.permission));

  return (
    <div className="sticky top-20 z-20 flex w-full items-center gap-1.5 overflow-x-auto border-b border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0E1424]/95 lg:hidden no-scrollbar">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const shortHref = item.href.replace(/^\/dashboard/, '') || '/';
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard' || pathname === '/'
            : pathname === item.href ||
              pathname.startsWith(item.href + '/') ||
              pathname === shortHref ||
              pathname.startsWith(shortHref + '/');

        const badgeCount =
          item.badge === 'orders'
            ? issueOrdersCount
            : item.badge === 'scheduled'
            ? scheduledOrdersCount
            : item.badge === 'complaints'
            ? openComplaintsCount
            : item.badge === 'chat'
            ? needsHumanCount
            : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs'
                : 'border-slate-200/80 bg-slate-50/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
            <span>{item.title}</span>
            {item.badge && badgeCount > 0 && (
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  isActive
                    ? 'bg-amber-500/25 text-amber-800 dark:text-amber-200'
                    : BADGE_STYLES[item.badge]
                }`}
              >
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
      {onOpenDrawer && (
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <span>القائمة</span>
        </button>
      )}
    </div>
  );
}
