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

  const [{ data: orders, error: ordersError }, { data: branches }, { data: offers }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .like('payment_method', 'scheduled|%')
        .order('created_at', { ascending: false })
        .limit(500),
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

  if (ordersError) {
    console.error('Failed to fetch scheduled orders:', ordersError);
  }

  const rawOrders = (orders || []) as (OrderRow & { order_items?: OrderItemRow[] })[];
  const activeBranches = branches || [];
  const activeOffers = offers || [];

  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: Array.isArray(order.order_items) ? order.order_items : [],
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
