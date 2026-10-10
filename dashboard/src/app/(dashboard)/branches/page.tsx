import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BranchesManager } from '@/components/branches/BranchesManager';
import { BranchWithZones } from '@/components/branches/types';

export const metadata: Metadata = {
  title: 'إدارة الفروع ومناطق التوصيل | لوحة التحكم',
  description: 'إدارة فروع المطعم وتحديد أسعار ومناطق التوصيل لكل فرع للبوت والعمليات',
};

export const revalidate = 0; // Dynamic server component

export default async function BranchesPage() {
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
    redirect('/dashboard/orders');
  }

  // 2. Fetch all branches ordered by created_at desc
  const { data: branches, error: branchesError } = await supabase
    .from('branches')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchesError) {
    console.error('Failed to fetch branches:', branchesError);
  }

  // 3. Fetch delivery zones counts per branch
  const { data: zones, error: zonesError } = await supabase
    .from('branch_delivery_zones')
    .select('branch_id');

  if (zonesError) {
    console.error('Failed to fetch zones counts:', zonesError);
  }

  const counts: Record<string, number> = {};
  (zones || []).forEach((z) => {
    counts[z.branch_id] = (counts[z.branch_id] || 0) + 1;
  });

  const initialBranches: BranchWithZones[] = (branches || []).map((b) => ({
    ...b,
    zones_count: counts[b.id] || 0,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <BranchesManager initialBranches={initialBranches} />
    </div>
  );
}
