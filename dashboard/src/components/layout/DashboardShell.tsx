'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { UserRole } from '@/types/database.types';

interface DashboardShellProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url?: string | null;
  };
  restaurantName?: string;
  botEnabled?: boolean;
  issueOrdersCount?: number;
  openComplaintsCount?: number;
  needsHumanCount?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  restaurantName = 'بروستد الخديوي',
  botEnabled = true,
  issueOrdersCount = 0,
  openComplaintsCount = 0,
  needsHumanCount = 0,
  children,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Role-Aware Sidebar */}
      <Sidebar
        role={user.role}
        restaurantName={restaurantName}
        issueOrdersCount={issueOrdersCount}
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

        {/* Page Content — individual pages control their max-width & padding */}
        <main className="flex-1 min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
