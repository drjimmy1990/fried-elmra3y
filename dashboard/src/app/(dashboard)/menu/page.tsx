import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MenuManager } from '@/components/menu/MenuManager';
import {
  MenuCategory,
  MenuItem,
  FullMenuSettings,
} from '@/components/menu/types';

export const metadata: Metadata = {
  title: 'إدارة قائمة الطعام والمنيو الرقمي | مطعم الخديوي',
  description:
    'إدارة أصناف وأطباق المنيو، الأقسام، الأسعار والعروض الترويجية والمنيو الكامل لمطعم الخديوي',
};

export const revalidate = 0; // Dynamic server component

export default async function MenuPage() {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Fetch categories, items, and bot settings in parallel
  const [categoriesRes, itemsRes, botSettingsRes] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),

    supabase
      .from('bot_settings')
      .select('menu_full_image_url, menu_full_pdf_url')
      .limit(1)
      .maybeSingle(),
  ]);

  if (categoriesRes.error) {
    console.error('Failed to fetch menu categories:', categoriesRes.error);
  }

  if (itemsRes.error) {
    console.error('Failed to fetch menu items:', itemsRes.error);
  }

  if (botSettingsRes.error) {
    console.error('Failed to fetch bot settings for menu:', botSettingsRes.error);
  }

  const rawCategories = categoriesRes.data || [];
  const rawItems = itemsRes.data || [];

  // Calculate item counts for each category
  const initialCategories: MenuCategory[] = rawCategories.map((cat) => ({
    ...cat,
    item_count: rawItems.filter((item) => item.category_id === cat.id).length,
  }));

  const categoryMap = new Map<string, MenuCategory>();
  initialCategories.forEach((cat) => categoryMap.set(cat.id, cat));

  const initialItems: MenuItem[] = rawItems.map((item) => ({
    ...item,
    category: categoryMap.get(item.category_id) || null,
  }));

  const initialFullMenu: FullMenuSettings = {
    menu_full_image_url: botSettingsRes.data?.menu_full_image_url || null,
    menu_full_pdf_url: botSettingsRes.data?.menu_full_pdf_url || null,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <MenuManager
        initialCategories={initialCategories}
        initialItems={initialItems}
        initialFullMenu={initialFullMenu}
      />
    </div>
  );
}
