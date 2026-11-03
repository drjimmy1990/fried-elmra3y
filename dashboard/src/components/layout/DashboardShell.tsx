'use client';

import React, { useState } from 'react';
import { Sidebar, MobileNavTabs } from './Sidebar';
import { Topbar } from './Topbar';
import { UserRole } from '@/types/database.types';
import { StaffPermission } from '@/lib/role-guard';

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

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Role & Permission-Aware Sidebar */}
      <Sidebar
        role={user.role}
        permissions={user.permissions}
        restaurantName={restaurantName}
        issueOrdersCount={issueOrdersCount}
        scheduledOrdersCount={scheduledOrdersCount}
        openComplaintsCount={openComplaintsCount}
        needsHumanCount={needsHumanCount}
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
          issueOrdersCount={issueOrdersCount}
          scheduledOrdersCount={scheduledOrdersCount}
          openComplaintsCount={openComplaintsCount}
          needsHumanCount={needsHumanCount}
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
