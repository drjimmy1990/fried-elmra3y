import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { OrderWithItems, OrderItemRow, OrderRow } from '@/components/orders/types';

export const metadata: Metadata = {
  title: 'الإحصائيات والتقارير المالية | تشيكن مراعي',
  description: 'لوحة التحليلات المالية، ترتيب الفروع والعروض والأصناف الأكثر مبيعاً، ومؤشرات الأداء',
};

export const revalidate = 0;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [
    ordersRes,
    branchesRes,
    offersRes,
    complaintsRes,
    contactsRes,
    botMessagesRes,
    agentMessagesRes,
    userMessagesRes,
    commentsRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('branches')
      .select('id, name, address, is_active')
      .order('name'),
    supabase
      .from('offers')
      .select('id, title, price_after, is_active')
      .neq('title', '__ALL_OFFERS_IMAGE__')
      .order('created_at', { ascending: false }),
    supabase
      .from('complaints')
      .select('id, ticket_number, customer_name, customer_phone, issue_description, status, order_id, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('contacts')
      .select('id, ai_enabled, needs_human, platform, created_at')
      .limit(5000),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'bot'),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'agent'),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'user'),
    supabase
      .from('comment_events')
      .select('id, decision, dm_sent, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const rawOrders: OrderRow[] = ordersRes.data || [];
  const orderIds = rawOrders.map((o) => o.id);

  let rawItems: OrderItemRow[] = [];
  if (orderIds.length > 0) {
    // Fetch in chunks of 500 if large
    const chunks: string[][] = [];
    for (let i = 0; i < orderIds.length; i += 500) {
      chunks.push(orderIds.slice(i, i + 500));
    }
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        supabase.from('order_items').select('*').in('order_id', chunk)
      )
    );
    for (const r of chunkResults) {
      if (r.data) {
        rawItems.push(...r.data);
      }
    }
  }

  const branches = branchesRes.data || [];
  const offers = offersRes.data || [];
  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const offerMap = new Map(offers.map((o) => [o.id, o]));

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of rawItems) {
    const existing = itemsByOrder.get(item.order_id) || [];
    existing.push(item);
    itemsByOrder.set(item.order_id, existing);
  }

  const initialOrders: OrderWithItems[] = rawOrders.map((order) => ({
    ...order,
    order_items: itemsByOrder.get(order.id) || [],
    branch: order.branch_id ? branchMap.get(order.branch_id) || null : null,
    offer: order.offer_id ? offerMap.get(order.offer_id) || null : null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <AnalyticsDashboard
        initialOrders={initialOrders}
        branches={branches}
        offers={offers}
        complaints={complaintsRes.data || []}
        contacts={contactsRes.data || []}
        messageStats={{
          botCount: botMessagesRes.count || 0,
          agentCount: agentMessagesRes.count || 0,
          userCount: userMessagesRes.count || 0,
        }}
        commentEvents={commentsRes.data || []}
      />
    </div>
  );
}
