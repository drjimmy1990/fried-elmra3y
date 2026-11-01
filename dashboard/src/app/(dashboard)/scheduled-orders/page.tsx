import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ScheduledOrdersBoard } from '@/components/scheduled-orders/ScheduledOrdersBoard';
import { OrderWithItems, OrderItemRow, OrderRow } from '@/components/orders/types';

export const metadata: Metadata = {
  title: 'الطلبات المجدولة | المطعم',
  description: 'نظام حفظ ومتابعة الطلبات المجدولة وتنبيهات تحضير المطبخ قبل موعد التوصيل',
};

export const revalidate = 0;

export default async function ScheduledOrdersPage() {
  const supabase = await createClient();

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .like('payment_method', 'scheduled|%')
    .order('created_at', { ascending: false })
    .limit(500);

  if (ordersError) {
    console.error('Failed to fetch scheduled orders:', ordersError);
  }

  const rawOrders: OrderRow[] = orders || [];
  const orderIds = rawOrders.map((o) => o.id);

  let rawItems: OrderItemRow[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);
    rawItems = items || [];
  }

  const [{ data: branches }, { data: offers }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('offers')
      .select('id, title, price_after')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ]);

  const activeBranches = branches || [];
  const activeOffers = offers || [];

  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: rawItems.filter((item) => item.order_id === order.id),
    branch: activeBranches.find((b) => b.id === order.branch_id) || null,
    offer: activeOffers.find((o) => o.id === order.offer_id) || null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ScheduledOrdersBoard
        initialOrders={initialOrders}
        branches={activeBranches}
        offers={activeOffers}
      />
    </div>
  );
}
