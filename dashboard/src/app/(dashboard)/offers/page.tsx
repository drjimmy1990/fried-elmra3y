import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OffersContainer } from '@/components/offers/OffersContainer';
import { Offer } from '@/components/offers/types';

export const metadata: Metadata = {
  title: 'إدارة العروض الترويجية والخصومات | مطعم الخديوي',
  description:
    'إدارة وتنسيق العروض الترويجية، الخصومات الحصرية، والبانرات الإعلانية لمطعم الخديوي',
};

export const revalidate = 0; // Dynamic server component

export default async function OffersPage() {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Fetch all offers from Supabase ordered by sort_order asc, created_at desc
  const { data: rawOffers, error: offersError } = await supabase
    .from('offers')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (offersError) {
    console.error('Failed to fetch offers from Supabase:', offersError);
  }

  const initialOffers: Offer[] = (rawOffers || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    price_before: row.price_before,
    price_after: row.price_after,
    banner_url: row.banner_url,
    start_date: row.start_date,
    end_date: row.end_date,
    is_active: row.is_active,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <OffersContainer initialOffers={initialOffers} />
    </div>
  );
}
