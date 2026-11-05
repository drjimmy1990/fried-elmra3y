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

  // Fast initial load: fetch Today + Yesterday operational window (last 52 hours to cover midnight/late-night Cairo shifts).
  // Older historical orders (Last 7 Days / All) are lazy-loaded on demand when staff switches the filter tab.
  const since = new Date(Date.now() - 52 * 60 * 60 * 1000);

  // Fetch today & yesterday's orders WITH embedded order_items in a single query
  const [
    { data: orders, error: ordersError },
    { data: branches },
    { data: offers },
    { data: openComplaints },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('offers')
      .select('id, title')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('complaints')
      .select('id, ticket_number, contact_id, customer_name, customer_phone, issue_description, status, order_id, created_at')
      .eq('status', 'open')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (ordersError) {
    console.error('Failed to fetch initial orders:', ordersError);
  }

  const rawOrders = (orders || []) as (OrderRow & { order_items?: OrderItemRow[] })[];
  const activeBranches = branches || [];
  const activeOffers = offers || [];

  // Combine orders with their associated order items, branch, and offer
  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: Array.isArray(order.order_items) ? order.order_items : [],
    branch: activeBranches.find((b) => b.id === order.branch_id) || null,
    offer: activeOffers.find((o) => o.id === order.offer_id) || null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <OrderKanban
        initialOrders={initialOrders}
        branches={activeBranches}
        offers={activeOffers}
        initialOpenComplaints={openComplaints || []}
      />
    </div>
  );
}
