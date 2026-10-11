import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RealtimeAudioProvider } from '@/components/providers/RealtimeAudioProvider';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { UserRole } from '@/types/database.types';

const DEFAULT_RESTAURANT_NAME = 'تشيكن مراعي';

/** Extracts `restaurant_name` from the get_public_settings() JSON payload. */
function readRestaurantName(payload: unknown): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const name = (payload as Record<string, unknown>).restaurant_name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return DEFAULT_RESTAURANT_NAME;
}

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

  // Operational badge counts + restaurant name + bot status, in parallel.
  // bot_settings is admin-only under RLS, so non-admins get null → default to "enabled".
  const [
    { count: issueOrdersCount },
    { count: openComplaintsCount },
    { count: needsHumanCount },
    { data: publicSettings },
    { data: botSettings },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('needs_human', true),
    supabase.rpc('get_public_settings'),
    supabase.from('bot_settings').select('bot_enabled').limit(1).maybeSingle(),
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
        restaurantName={readRestaurantName(publicSettings)}
        botEnabled={botSettings?.bot_enabled ?? true}
        issueOrdersCount={issueOrdersCount || 0}
        openComplaintsCount={openComplaintsCount || 0}
        needsHumanCount={needsHumanCount || 0}
      >
        {children}
      </DashboardShell>
    </RealtimeAudioProvider>
  );
}
