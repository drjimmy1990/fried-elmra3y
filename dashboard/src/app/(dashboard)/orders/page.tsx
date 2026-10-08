import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { OrderKanban } from '@/components/orders/OrderKanban';
import { OrderWithItems, OrderItemRow, OrderRow } from '@/components/orders/types';

export const metadata: Metadata = {
  title: 'إدارة الطلبات المباشرة | مطعم الخديوي',
  description: 'نظام إدارة ومتابعة الطلبات المباشرة وطباعة الإيصالات الحرارية في مطعم الخديوي',
};

export const revalidate = 0; // Dynamic server component

export default async function OrdersPage() {
  const supabase = await createClient();

  // Fetch recent orders ordered by creation timestamp descending
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

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

  // Combine orders with their associated order items
  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: rawItems.filter((item) => item.order_id === order.id),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <OrderKanban initialOrders={initialOrders} />
    </div>
  );
}
