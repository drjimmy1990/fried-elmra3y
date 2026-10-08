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
}

const NAV_ITEMS: NavItem[] = [
  { title: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  {
    title: 'الطلبات',
    href: '/dashboard/orders',
    icon: ShoppingBag,
    roles: ['admin', 'order_agent'],
    badge: 'orders',
    badgeTitle: 'أوردرات عليها مشكلة',
  },
  {
    title: 'الشكاوى',
    href: '/dashboard/complaints',
    icon: AlertCircle,
    roles: ['admin', 'support_agent'],
    badge: 'complaints',
    badgeTitle: 'شكاوى مفتوحة',
  },
  {
    title: 'المحادثات',
    href: '/dashboard/chat',
    icon: MessageSquare,
    roles: ['admin', 'support_agent', 'order_agent'],
    badge: 'chat',
    badgeTitle: 'عملاء طالبين موظف',
  },
  {
    title: 'التعليقات',
    href: '/dashboard/comments',
    icon: MessagesSquare,
    roles: ['admin', 'support_agent'],
  },
  { title: 'المنيو', href: '/dashboard/menu', icon: BookOpen, roles: ['admin'] },
  { title: 'العروض', href: '/dashboard/offers', icon: Sparkles, roles: ['admin'] },
  { title: 'القنوات', href: '/dashboard/channels', icon: Radio, roles: ['admin'] },
  { title: 'الفريق', href: '/dashboard/team', icon: Users, roles: ['admin'] },
  { title: 'الإعدادات', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },
];

const BADGE_STYLES: Record<BadgeKind, string> = {
  orders: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  complaints: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  chat: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
};

export function Sidebar({
  role,
  restaurantName = 'المطعم',
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-slate-800/80 bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Branding & Logo Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-800/80 px-6">
          <Link href="/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
              <Drumstick className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-lg text-white" title={restaurantName}>
                {restaurantName}
              </div>
              <p className="text-xs text-amber-200/80">لوحة تحكم الأوردرات والبوت 🍗</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-800">
          <nav className="space-y-1.5">
            {visibleItems.map((item) => {
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-400'
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
                        isActive ? 'bg-white text-amber-800' : BADGE_STYLES[item.badge]
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="border-t border-slate-800/80 p-4 bg-slate-950/60">
          <div className="flex items-center justify-between rounded-xl bg-slate-900/80 p-3 text-xs text-slate-400 border border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              متصل
            </span>
            <span className="font-mono text-[10px] text-slate-500">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
