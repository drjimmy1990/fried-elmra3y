'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  AlertCircle,
  MessageSquare,
  UtensilsCrossed,
  Sparkles,
  Sliders,
  Users,
  Settings,
  X,
  Utensils,
  Crown,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';

interface SidebarProps {
  role: UserRole;
  pendingOrdersCount?: number;
  openComplaintsCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: 'orders' | 'complaints';
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'نظرة عامة',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin'],
  },
  {
    title: 'إدارة الطلبات',
    href: '/dashboard/orders',
    icon: ShoppingBag,
    roles: ['admin', 'order_agent'],
    badge: 'orders',
  },
  {
    title: 'الشكاوى والبلاغات',
    href: '/dashboard/complaints',
    icon: AlertCircle,
    roles: ['admin', 'support_agent'],
    badge: 'complaints',
  },
  {
    title: 'المحادثات المباشرة',
    href: '/dashboard/chat',
    icon: MessageSquare,
    roles: ['admin', 'support_agent'],
  },
  {
    title: 'قائمة الطعام (المنيو)',
    href: '/dashboard/menu',
    icon: UtensilsCrossed,
    roles: ['admin'],
  },
  {
    title: 'العروض الترويجية',
    href: '/dashboard/offers',
    icon: Sparkles,
    roles: ['admin'],
  },
  {
    title: 'قواعد ردود البوستات',
    href: '/dashboard/post-rules',
    icon: Sliders,
    roles: ['admin'],
  },
  {
    title: 'فريق العمل والوكلاء',
    href: '/dashboard/team',
    icon: Users,
    roles: ['admin'],
  },
  {
    title: 'إعدادات البوت والنظام',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export function Sidebar({
  role,
  pendingOrdersCount = 0,
  openComplaintsCount = 0,
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
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Branding & Logo Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-800/80 px-6">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-lg text-white">
                <span>مطعم الخديوي</span>
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs text-amber-200/80">لوحة تحكم العمليات</p>
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
                  ? pendingOrdersCount
                  : item.badge === 'complaints'
                  ? openComplaintsCount
                  : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
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
                  {badgeCount > 0 && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                        isActive
                          ? 'bg-white text-amber-800'
                          : item.badge === 'orders'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
              النظام متصل بالسحابة
            </span>
            <span className="font-mono text-[10px] text-slate-500">v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
