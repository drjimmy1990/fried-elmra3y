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
  botEnabled?: boolean;
  pendingOrdersCount?: number;
  openComplaintsCount?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  botEnabled = true,
  pendingOrdersCount = 0,
  openComplaintsCount = 0,
  children,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Role-Aware Sidebar */}
      <Sidebar
        role={user.role}
        pendingOrdersCount={pendingOrdersCount}
        openComplaintsCount={openComplaintsCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <Topbar
          user={user}
          botEnabled={botEnabled}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
