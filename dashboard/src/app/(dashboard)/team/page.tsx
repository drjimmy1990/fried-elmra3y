import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { TeamManager } from '@/components/team/TeamManager';
import { StaffMember } from '@/components/team/types';
import { Database } from '@/types/database.types';

export const metadata: Metadata = {
  title: 'إدارة فريق العمل والصلاحيات | مطعم الخديوي',
  description: 'إدارة حسابات الوكلاء والمشرفين وأدوار التشغيل في لوحة تحكم مطعم الخديوي',
};

export const revalidate = 0; // Dynamic server component

export default async function TeamPage() {
  const supabase = await createClient();

  // 1. RBAC Guard: Strictly restricted to active admin
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

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    redirect('/dashboard');
  }

  // 2. Fetch staff profiles
  const { data: rawProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Failed to fetch team profiles:', fetchError);
  }

  // 3. Resolve emails if admin service role is configured
  let emailMap = new Map<string, string>();
  if (user.email) {
    emailMap.set(user.id, user.email);
  }

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
          if (u.email) emailMap.set(u.id, u.email);
        });
      }
    } catch (e) {
      console.warn('Could not list auth users in TeamPage:', e);
    }
  }

  const initialStaff: StaffMember[] = (rawProfiles || []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) || null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <TeamManager initialStaff={initialStaff} currentUserId={user.id} />
    </div>
  );
}
