import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient, User } from '@supabase/supabase-js';
import { TeamManager } from '@/components/team/TeamManager';
import { StaffMember } from '@/components/team/types';
import { Database } from '@/types/database.types';
import { extractStaffAuth, homeRouteForRole } from '@/lib/role-guard';

export const metadata: Metadata = {
  title: 'إدارة فريق العمل والصلاحيات | لوحة التحكم',
  description: 'إدارة حسابات الوكلاء والمشرفين وأدوار التشغيل في لوحة التحكم',
};

export const revalidate = 0; // Dynamic server component

export default async function TeamPage() {
  const supabase = await createClient();

  // 1. RBAC Guard: Restricted to staff with 'team' permission
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  const { displayRole, permissions, isActive } = extractStaffAuth(user, profile);

  if (!profile || !isActive || !permissions.includes('team')) {
    redirect(homeRouteForRole(displayRole, permissions));
  }

  // 2. Fetch staff profiles
  const { data: rawProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Failed to fetch team profiles:', fetchError);
  }

  // 3. Resolve emails & custom permissions from auth.users via service role
  const authUserMap = new Map<string, User>();
  authUserMap.set(user.id, user);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const adminClient = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (authUsers?.users) {
        authUsers.users.forEach((u) => {
          authUserMap.set(u.id, u);
        });
      }
    } catch (e) {
      console.warn('Could not list auth users in TeamPage:', e);
    }
  }

  const initialStaff: StaffMember[] = (rawProfiles || []).map((p) => {
    const authUser = authUserMap.get(p.id);
    const { displayRole: staffRole, permissions: staffPerms } = extractStaffAuth(authUser, p);
    return {
      ...p,
      role: staffRole,
      permissions: staffPerms,
      email: authUser?.email || null,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <TeamManager initialStaff={initialStaff} currentUserId={user.id} />
    </div>
  );
}
