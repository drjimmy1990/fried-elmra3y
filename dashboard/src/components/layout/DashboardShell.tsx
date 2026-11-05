'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar, MobileNavTabs } from './Sidebar';
import { Topbar } from './Topbar';
import { UserRole } from '@/types/database.types';
import { StaffPermission } from '@/lib/role-guard';
import { createClient } from '@/lib/supabase/client';
import { isOrderCancelled } from '@/lib/utils';
import { isScheduledPaymentMethod } from '@/lib/scheduled-orders';
import { isMergedOrDeclinedModOrder } from '@/lib/order-templates';

interface DashboardShellProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    permissions?: StaffPermission[];
    avatar_url?: string | null;
  };
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
  restaurantName = 'تشيكن مراعي',
  botEnabled = true,
  issueOrdersCount = 0,
  scheduledOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  children,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [livePendingOrdersCount, setLivePendingOrdersCount] = useState(issueOrdersCount);
  const [liveScheduledCount, setLiveScheduledCount] = useState(scheduledOrdersCount);
  const [liveComplaintsCount, setLiveComplaintsCount] = useState(openComplaintsCount);
  const [liveNeedsHumanCount, setLiveNeedsHumanCount] = useState(needsHumanCount);

  const supabase = useMemo(() => createClient(), []);

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

        {/* Page Content — individual pages control their max-width & padding */}
        <main className="flex-1 min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
