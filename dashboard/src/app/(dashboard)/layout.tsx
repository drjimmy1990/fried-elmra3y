import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RealtimeAudioProvider } from '@/components/providers/RealtimeAudioProvider';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { UserRole } from '@/types/database.types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile details
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, is_active')
    .eq('id', user.id)
    .single();

  if (profile && profile.is_active === false) {
    redirect('/login?error=account_deactivated');
  }

  // Fetch operational badge counts and bot status in parallel
  const [
    { count: pendingOrdersCount },
    { count: openComplaintsCount },
    { data: botSettings },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('bot_settings')
      .select('bot_enabled')
      .limit(1)
      .maybeSingle(),
  ]);

  const userProfile = {
    id: user.id,
    email: user.email || '',
    full_name:
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'مستخدم النظام',
    role: (profile?.role as UserRole) || 'admin',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
  };

  return (
    <RealtimeAudioProvider role={userProfile.role}>
      <DashboardShell
        user={userProfile}
        botEnabled={botSettings?.bot_enabled ?? true}
        pendingOrdersCount={pendingOrdersCount || 0}
        openComplaintsCount={openComplaintsCount || 0}
      >
        {children}
      </DashboardShell>
    </RealtimeAudioProvider>
  );
}
