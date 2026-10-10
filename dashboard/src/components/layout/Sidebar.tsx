'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  AlertCircle,
  MessageSquare,
  BookOpen,
  Sparkles,
  MessagesSquare,
  Users,
  Settings,
  X,
  Drumstick,
  Radio,
  Building2,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';

interface SidebarProps {
  role: UserRole;
  restaurantName?: string;
  issueOrdersCount?: number;
  openComplaintsCount?: number;
  needsHumanCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

type BadgeKind = 'orders' | 'complaints' | 'chat';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: BadgeKind;
  badgeTitle?: string;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  { title: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'], section: 'غرفة العمليات' },
  {
    title: 'الطلبات',
    href: '/dashboard/orders',
    icon: ShoppingBag,
    roles: ['admin', 'order_agent'],
    badge: 'orders',
    badgeTitle: 'أوردرات قيد الانتظار',
    section: 'غرفة العمليات',
  },
  {
    title: 'الشكاوى',
    href: '/dashboard/complaints',
    icon: AlertCircle,
    roles: ['admin', 'support_agent'],
    badge: 'complaints',
    badgeTitle: 'شكاوى مفتوحة',
    section: 'غرفة العمليات',
  },
  {
    title: 'المحادثات',
    href: '/dashboard/chat',
    icon: MessageSquare,
    roles: ['admin'], // Strictly admin only per owner requirement
    badge: 'chat',
    badgeTitle: 'عملاء طالبين موظف',
    section: 'غرفة العمليات',
  },
  {
    title: 'التعليقات',
    href: '/dashboard/comments',
    icon: MessagesSquare,
    roles: ['admin', 'support_agent'],
    section: 'غرفة العمليات',
  },
  { title: 'الفروع والتوصيل', href: '/dashboard/branches', icon: Building2, roles: ['admin'], section: 'إدارة المطعم' },
  { title: 'المنيو', href: '/dashboard/menu', icon: BookOpen, roles: ['admin'], section: 'إدارة المطعم' },
  { title: 'العروض', href: '/dashboard/offers', icon: Sparkles, roles: ['admin'], section: 'إدارة المطعم' },
  { title: 'القنوات والربط', href: '/dashboard/channels', icon: Radio, roles: ['admin'], section: 'إعدادات النظام' },
  { title: 'فريق العمل', href: '/dashboard/team', icon: Users, roles: ['admin'], section: 'إعدادات النظام' },
  { title: 'الإعدادات العامة', href: '/dashboard/settings', icon: Settings, roles: ['admin'], section: 'إعدادات النظام' },
];

const BADGE_STYLES: Record<BadgeKind, string> = {
  orders: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-500/25',
  complaints: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/25',
  chat: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/25',
};

export function Sidebar({
  role,
  restaurantName = 'بروستد الخديوي',
  issueOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  // Filter links visible to the current role
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

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
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-slate-200 bg-white text-slate-800 shadow-xl dark:border-slate-800 dark:bg-[#0E1424] dark:text-slate-100 dark:shadow-2xl transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Branding & Logo Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6">
          <Link href="/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20">
              <Drumstick className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-extrabold text-base text-slate-900 dark:text-white" title={restaurantName}>
                {restaurantName}
              </div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-300/90">غرفة العمليات الذكية 🍗👑</p>
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
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <nav className="space-y-1">
            {visibleItems.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/');

              const badgeCount =
                item.badge === 'orders'
                  ? issueOrdersCount
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
        <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-4 bg-slate-50/60 dark:bg-[#0B0F17]/60">
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
