import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { OrderKanban } from '@/components/orders/OrderKanban';
import { OrderWithItems, OrderItemRow, OrderRow } from '@/components/orders/types';

export const metadata: Metadata = {
  title: 'إدارة الطلبات المباشرة | المطعم',
  description: 'نظام إدارة ومتابعة الطلبات المباشرة وطباعة الإيصالات الحرارية في المطعم',
};

export const revalidate = 0; // Dynamic server component

export default async function OrdersPage() {
  const supabase = await createClient();

  // Last 8 days covers the board's date filters (today / yesterday / last 7 days).
  // Older orders are opened on demand via ?orderId= deep links.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 8);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000);

  if (ordersError) {
    console.error('Failed to fetch initial orders:', ordersError);
  }

  const rawOrders: OrderRow[] = orders || [];
  const orderIds = rawOrders.map((o) => o.id);

  let rawItems: OrderItemRow[] = [];
  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Failed to fetch initial order items:', itemsError);
    }
    rawItems = items || [];
  }

  // Fetch active branches and active offers for filtering and display
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  const { data: offers } = await supabase
    .from('offers')
    .select('id, title')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const activeBranches = branches || [];
  const activeOffers = offers || [];

  // Combine orders with their associated order items, branch, and offer
  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: rawItems.filter((item) => item.order_id === order.id),
    branch: activeBranches.find((b) => b.id === order.branch_id) || null,
    offer: activeOffers.find((o) => o.id === order.offer_id) || null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <OrderKanban
        initialOrders={initialOrders}
        branches={activeBranches}
        offers={activeOffers}
      />
    </div>
  );
}
