'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Eye, ShieldCheck, Lock, X } from 'lucide-react';
import { Sidebar, MobileNavTabs } from './Sidebar';
import { Topbar } from './Topbar';
import { UserRole } from '@/types/database.types';
import { StaffPermission } from '@/lib/role-guard';
import { createClient } from '@/lib/supabase/client';
import { isOrderCancelled } from '@/lib/utils';
import { isScheduledPaymentMethod } from '@/lib/scheduled-orders';
import { isMergedOrDeclinedModOrder } from '@/lib/order-templates';
import {
  DEMO_COOKIE_NAME,
  isDemoUser,
  triggerDemoBlockedNotification,
} from '@/lib/demo-mode';

interface DashboardShellProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    permissions?: StaffPermission[];
    avatar_url?: string | null;
  };
  isDemo?: boolean;
  restaurantName?: string;
  botEnabled?: boolean;
  issueOrdersCount?: number;
  scheduledOrdersCount?: number;
  openComplaintsCount?: number;
  needsHumanCount?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  isDemo = false,
  restaurantName = 'تشيكن مراعي',
  botEnabled = true,
  issueOrdersCount = 0,
  scheduledOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  children,
}: DashboardShellProps) {
  const effectiveIsDemo = isDemo || isDemoUser(user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [demoToastMessage, setDemoToastMessage] = useState<string | null>(null);
  const [livePendingOrdersCount, setLivePendingOrdersCount] = useState(issueOrdersCount);
  const [liveScheduledCount, setLiveScheduledCount] = useState(scheduledOrdersCount);
  const [liveComplaintsCount, setLiveComplaintsCount] = useState(openComplaintsCount);
  const [liveNeedsHumanCount, setLiveNeedsHumanCount] = useState(needsHumanCount);

  if (typeof document !== 'undefined') {
    document.cookie = `${DEMO_COOKIE_NAME}=${effectiveIsDemo ? '1' : '0'}; path=/; SameSite=Lax`;
  }

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!effectiveIsDemo || typeof window === 'undefined') return;

    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const showDemoToast = (msg?: string) => {
      setDemoToastMessage(
        msg ||
          'وضع العرض التجريبي (للقراءة فقط): هذا الحساب مخصص لمعاينة النظام ولا يقوم بتعديل البيانات الفعلية للمطعم أو إرسال رسائل للعملاء.'
      );
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        setDemoToastMessage(null);
      }, 4500);
    };

    const handleDemoBlocked = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      showDemoToast(detail?.message);
    };

    window.addEventListener('khedewy:demo-blocked', handleDemoBlocked);

    // Replace native window.alert in Demo Mode with the sleek toast notification
    const origAlert = window.alert.bind(window);
    window.alert = (message?: any) => {
      const text = String(message || '');
      if (
        text.includes('وضع العرض التجريبي') ||
        text.includes('DEMO_READ_ONLY') ||
        text.includes('فشل') ||
        text.includes('خطأ') ||
        text.includes('تعذر')
      ) {
        showDemoToast(
          'وضع العرض التجريبي (للقراءة فقط): تمت محاكاة الإجراء بنجاح دون تعديل البيانات الفعلية للمطعم.'
        );
        return;
      }
      origAlert(message);
    };

    // Intercept client-side mutating fetch calls to /api/... so Demo Mode responds immediately & shows toast
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
      const method = (
        init?.method ||
        (typeof input === 'object' && 'method' in input ? input.method : 'GET') ||
        'GET'
      ).toUpperCase();

      if (
        (url.startsWith('/api/') || url.includes('/api/')) &&
        !['GET', 'HEAD', 'OPTIONS'].includes(method)
      ) {
        triggerDemoBlockedNotification(
          'وضع العرض التجريبي (للقراءة فقط): تمت معاينة الأمر بنجاح — لا يتم تعديل بيانات المطعم أو مراسلة العملاء الفعليين من حساب العرض.'
        );
        return new Response(
          JSON.stringify({
            error:
              'وضع العرض التجريبي (للقراءة فقط): هذا الحساب مخصص لمعاينة النظام ولا يقوم بتعديل البيانات الفعلية للمطعم.',
            isDemoBlocked: true,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return origFetch(input, init);
    };

    return () => {
      window.removeEventListener('khedewy:demo-blocked', handleDemoBlocked);
      window.alert = origAlert;
      window.fetch = origFetch;
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [effectiveIsDemo]);

  useEffect(() => {
    setLivePendingOrdersCount(issueOrdersCount);
  }, [issueOrdersCount]);

  useEffect(() => {
    setLiveScheduledCount(scheduledOrdersCount);
  }, [scheduledOrdersCount]);

  useEffect(() => {
    setLiveComplaintsCount(openComplaintsCount);
  }, [openComplaintsCount]);

  useEffect(() => {
    setLiveNeedsHumanCount(needsHumanCount);
  }, [needsHumanCount]);

  const refreshOrderCounts = useCallback(async () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 8);

    const [{ data: pendingRows }, { count: schedCount }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, payment_method, internal_notes')
        .eq('status', 'pending')
        .gte('created_at', since.toISOString()),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .like('payment_method', 'scheduled|%'),
    ]);

    if (pendingRows) {
      const activePending = pendingRows.filter(
        (o) =>
          !isOrderCancelled(o) &&
          !isScheduledPaymentMethod(o.payment_method) &&
          !isMergedOrDeclinedModOrder(o)
      ).length;
      setLivePendingOrdersCount(activePending);
    }
    if (typeof schedCount === 'number') {
      setLiveScheduledCount(schedCount);
    }
  }, [supabase]);

  const refreshComplaintsCount = useCallback(async () => {
    const { count } = await supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    if (typeof count === 'number') {
      setLiveComplaintsCount(count);
    }
  }, [supabase]);

  const refreshNeedsHumanCount = useCallback(async () => {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('needs_human', true);
    if (typeof count === 'number') {
      setLiveNeedsHumanCount(count);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupShellRealtime = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch {}

      if (!isMounted) return;

      const channelName = `shell_badges_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      activeChannel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          refreshOrderCounts();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
          refreshComplaintsCount();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
          refreshNeedsHumanCount();
        })
        .subscribe();
    };

    setupShellRealtime();

    const interval = setInterval(() => {
      refreshOrderCounts();
      refreshComplaintsCount();
      refreshNeedsHumanCount();
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [supabase, refreshOrderCounts, refreshComplaintsCount, refreshNeedsHumanCount]);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Role & Permission-Aware Sidebar */}
      <Sidebar
        role={user.role}
        permissions={user.permissions}
        restaurantName={restaurantName}
        issueOrdersCount={livePendingOrdersCount}
        scheduledOrdersCount={liveScheduledCount}
        openComplaintsCount={liveComplaintsCount}
        needsHumanCount={liveNeedsHumanCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          user={user}
          botEnabled={botEnabled}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Always-visible scrollable tab bar on mobile / iPhone */}
        <MobileNavTabs
          role={user.role}
          permissions={user.permissions}
          issueOrdersCount={livePendingOrdersCount}
          scheduledOrdersCount={liveScheduledCount}
          openComplaintsCount={liveComplaintsCount}
          needsHumanCount={liveNeedsHumanCount}
          onOpenDrawer={() => setIsSidebarOpen(true)}
        />

        {/* Demo Showcase Read-Only & Privacy Protection Banner */}
        {effectiveIsDemo && (
          <div className="border-b border-amber-200/80 bg-gradient-to-l from-amber-50 via-orange-50/90 to-amber-50 px-4 py-2.5 text-amber-950 shadow-xs dark:border-amber-500/20 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 dark:text-amber-200">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300">
                  <Eye className="h-3.5 w-3.5" />
                  وضع العرض التجريبي (للقراءة فقط)
                </span>
                <span className="text-amber-900/90 dark:text-amber-200/90">
                  يمكنك استعراض جميع أقسام وإمكانيات النظام بالكامل — تم تشفير أرقام وعناوين العملاء لحماية الخصوصية، وجميع التعديلات متوقفة في هذا الحساب.
                </span>
              </div>
              <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300/80 md:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>بيانات المطعم والعملاء محمية 100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Page Content — individual pages control their max-width & padding */}
        <main className="flex-1 min-w-0 flex flex-col">
          {children}
        </main>

        {/* Floating Demo Mode Read-Only Toast */}
        {effectiveIsDemo && demoToastMessage && (
          <div className="fixed bottom-5 left-5 z-[100] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md dark:border-amber-500/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs leading-relaxed">
                <p className="font-bold text-amber-300 mb-0.5">حساب عرض تجريبي (Read-Only Demo)</p>
                <p className="text-slate-200">{demoToastMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setDemoToastMessage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
