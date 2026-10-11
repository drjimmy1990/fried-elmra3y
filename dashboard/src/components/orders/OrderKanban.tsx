'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  Printer,
  Eye,
  ShoppingBag,
  TrendingUp,
  X,
  Calendar,
  Clock,
  Building2,
  Tag,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { formatCurrency, formatDateTime, getOrderStatusBadge } from '@/lib/utils';
import { OrderCard } from './OrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';
import { ThermalReceipt } from './ThermalReceipt';
import {
  OrderWithItems,
  OrderRow,
  OrderStatus,
  DateFilterType,
  ViewMode,
  KanbanColumnDef,
} from './types';

interface OrderKanbanProps {
  initialOrders: OrderWithItems[];
  branches?: { id: string; name: string }[];
  offers?: { id: string; title: string }[];
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'pending',
    title: 'قيد الانتظار',
    subtitle: 'طلبات جديدة تحتاج مراجعة وتأكيد',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    bgLight: 'bg-amber-500/5',
    borderLight: 'border-amber-500/20',
    dotColor: 'bg-amber-500',
    allowedStatuses: ['pending'],
  },
  {
    id: 'confirmed',
    title: 'مؤكد',
    subtitle: 'طلبات مؤكدة قيد التجهيز والتسليم',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    bgLight: 'bg-emerald-500/5',
    borderLight: 'border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    allowedStatuses: ['confirmed'],
  },
];

export function OrderKanban({ initialOrders, branches = [], offers = [] }: OrderKanbanProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>(branches);
  const [offersList, setOffersList] = useState<{ id: string; title: string }[]>(offers);

  const searchParams = useSearchParams();
  const [printingOrder, setPrintingOrder] = useState<OrderWithItems | null>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<Record<string, boolean>>({});
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // Fetch branches and offers if not passed via props
  useEffect(() => {
    if (branches.length === 0) {
      supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) setBranchesList(data);
        });
    }
    if (offers.length === 0) {
      supabase
        .from('offers')
        .select('id, title')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setOffersList(data);
        });
    }
  }, [branches, offers, supabase]);

  // Handle deep link ?orderId=
  useEffect(() => {
    const id = searchParams.get('orderId');
    if (id) {
      const found = orders.find((o) => o.id === id);
      if (found) {
        setSelectedOrder(found);
      } else {
        const fetchMissing = async () => {
          const { data } = await supabase.from('orders').select('*').eq('id', id).single();
          if (data) {
            const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);
            const fullOrder = { ...(data as any), order_items: (items as any) || [] } as OrderWithItems;
            setSelectedOrder(fullOrder);
            setOrders((prev) => [fullOrder, ...prev]);
          }
        };
        fetchMissing();
      }
    }
  }, [searchParams, orders, supabase]);

  // Complaint tracking for visible orders
  const [complaintsMap, setComplaintsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchComplaints = async () => {
      const ids = orders.map((o) => o.id);
      if (ids.length === 0) return;
      const { data } = await supabase
        .from('complaints')
        .select('id, ticket_number, order_id, status')
        .in('order_id', ids);

      if (data) {
        const map: Record<string, any[]> = {};
        data.forEach((c) => {
          if (c.order_id) {
            if (!map[c.order_id]) map[c.order_id] = [];
            map[c.order_id].push(c);
          }
        });
        setComplaintsMap(map);
      }
    };
    fetchComplaints();
  }, [orders, supabase]);

  // Restaurant name for thermal receipt
  const [restaurantName, setRestaurantName] = useState('المطعم');
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.rpc('get_public_settings');
      if (data && (data as any).restaurant_name) {
        setRestaurantName((data as any).restaurant_name);
      }
    };
    fetchSettings();
  }, [supabase]);

  // Sync state with initialOrders from server
  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders((prev) => {
        const initialMap = new Map(initialOrders.map((o) => [o.id, o]));
        const merged = [...initialOrders];
        for (const existing of prev) {
          if (!initialMap.has(existing.id)) {
            merged.unshift(existing);
          }
        }
        return merged;
      });
    }
  }, [initialOrders]);

  // Realtime subscription on orders and complaints
  useEffect(() => {
    const channelName = `realtime_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          setIsRealtimeActive(true);

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderRow;

            // Construct full order immediately with zero delay
            const fullOrder: OrderWithItems = {
              ...newOrder,
              order_items: [],
              branch: branchesList.find((b) => b.id === newOrder.branch_id) || null,
              offer: offersList.find((o) => o.id === newOrder.offer_id) || null,
            };

            // 1. Immediately prepend order to state so card appears instantly with 0ms latency
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) {
                return prev.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o));
              }
              return [fullOrder, ...prev];
            });

            // 2. Fetch order items asynchronously in background without blocking card rendering
            const fetchItems = async () => {
              try {
                const { data: items, error } = await supabase
                  .from('order_items')
                  .select('*')
                  .eq('order_id', newOrder.id);

                if (!error && items && items.length > 0) {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === newOrder.id ? { ...o, order_items: items as any } : o
                    )
                  );
                  setSelectedOrder((prev) =>
                    prev?.id === newOrder.id ? { ...prev, order_items: items as any } : prev
                  );
                }
              } catch (err) {
                console.warn('Non-blocking items fetch warning:', err);
              }
            };

            // Immediate fetch
            fetchItems();
            // Retry fetch after 1.5s to catch items created in background by n8n
            setTimeout(fetchItems, 1500);
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as OrderRow;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
            );
            setSelectedOrder((prev) =>
              prev?.id === updatedOrder.id ? { ...prev, ...updatedOrder } : prev
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const c = payload.new as any;
            if (!c.order_id) return;
            setComplaintsMap((prev) => {
              const orderComplaints = prev[c.order_id] || [];
              const exists = orderComplaints.some((x) => x.id === c.id);
              if (exists) {
                return { ...prev, [c.order_id]: orderComplaints.map((x) => (x.id === c.id ? c : x)) };
              } else {
                return { ...prev, [c.order_id]: [...orderComplaints, c] };
              }
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime channel status: ${status}`, err);
          setIsRealtimeActive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, branchesList, offersList]);

  // Robust date parser for Postgres UTC / ISO timestamps in browser timezone
  const parseOrderDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let s = dateStr.trim();
    if (s.includes(' ') && !s.includes('T')) {
      s = s.replace(' ', 'T');
    }
    if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-')) {
      s = s + 'Z';
    } else if (!s.endsWith('Z') && s.split('T')[1] && !s.split('T')[1].includes('+') && !s.split('T')[1].includes('-')) {
      s = s + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(dateStr) : d;
  };

  // Filtered orders based on Search, Date, Branch, Offer
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Search filter: customer name, customer phone, order number
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = order.customer_name?.toLowerCase().includes(query);
        const matchesPhone = order.customer_phone?.includes(query);
        const matchesNumber = String(order.order_number).includes(query);
        if (!matchesName && !matchesPhone && !matchesNumber) {
          return false;
        }
      }

      // 2. Date filter
      if (dateFilter !== 'all') {
        const orderDate = parseOrderDate(order.created_at);
        const now = new Date();

        // Any order created within the last 3 hours is always considered "today" regardless of timezone drift
        const isVeryRecent = Math.abs(now.getTime() - orderDate.getTime()) < 3 * 60 * 60 * 1000;

        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          if (!isVeryRecent && (orderDate < startOfToday || orderDate > endOfToday)) return false;
        } else if (dateFilter === 'yesterday') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
          if (orderDate < startOfYesterday || orderDate >= startOfToday) return false;
        } else if (dateFilter === 'last_7_days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < sevenDaysAgo) return false;
        }
      }

      // 3. Branch filter
      if (selectedBranchId !== 'all') {
        if (order.branch_id !== selectedBranchId) return false;
      }

      // 4. Offer filter
      if (selectedOfferId !== 'all') {
        if (selectedOfferId === 'has_offer') {
          if (!order.offer_id) return false;
        } else if (order.offer_id !== selectedOfferId) {
          return false;
        }
      }

      return true;
    });
  }, [orders, searchQuery, dateFilter, selectedBranchId, selectedOfferId]);

  // Order Confirmation Action: Calls API and optimistically updates
  const handleConfirmOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const previousStatus = targetOrder?.status;

    setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: true }));

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmed' } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
    }

    try {
      const res = await fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to confirm order');
      }
    } catch (err) {
      console.error('Error confirming order:', err);
      if (previousStatus) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: previousStatus } : null));
        }
      }
      alert('تعذر تأكيد الطلب وإرسال رسالة التأكيد. يرجى التحقق من الاتصال بالإنترنت.');
    } finally {
      setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Workflow status advancement
  const handleAdvanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    if (currentStatus === 'pending') {
      await handleConfirmOrder(orderId);
    }
  };

  // Generic status changer
  const handleChangeStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'confirmed') {
      await handleConfirmOrder(orderId);
      return;
    }

    const targetOrder = orders.find((o) => o.id === orderId);
    const previousStatus = targetOrder?.status;

    setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: true }));

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      if (previousStatus) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: previousStatus } : null));
        }
      }
      alert('تعذر تحديث حالة الطلب.');
    } finally {
      setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Save Internal Notes
  const handleUpdateNotes = async (orderId: string, notes: string): Promise<boolean> => {
    const { error } = await supabase
      .from('orders')
      .update({
        internal_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, internal_notes: notes } : o))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, internal_notes: notes } : null));
      }
      return true;
    }
    return false;
  };

  // Thermal Receipt Printing
  const handlePrintReceipt = (order: OrderWithItems) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Summary Metrics calculations
  const totalOrdersCount = filteredOrders.length;
  const pendingCount = filteredOrders.filter((o) => o.status !== 'confirmed').length;
  const confirmedCount = filteredOrders.filter((o) => o.status === 'confirmed').length;
  const totalRevenue = filteredOrders
    .filter((o) => o.status === 'confirmed')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header & Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">إدارة الطلبات المباشرة</h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isRealtimeActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{isRealtimeActive ? 'تحديث لحظي نشط' : 'جاري الاتصال...'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            متابعة دورة تحضير وتسليم الوجبات وتحديث الحالات وإبلاغ العملاء فورياً
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>كانبان</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>الجدول</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3.5 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي الطلبات</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">{totalOrdersCount}</span>
            <ShoppingBag className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 p-3.5 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">قيد الانتظار (جديدة)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400">{pendingCount}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 p-3.5 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">طلبات مؤكدة</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">{confirmedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3.5 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي المبيعات المؤكدة</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatCurrency(totalRevenue)}
            </span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3.5 rounded-2xl shadow-xs">
        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الهاتف، أو رقم الطلب..."
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pr-9 pl-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Branch Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                كل الفروع
              </option>
              {branchesList.map((b) => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Offer Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <select
              value={selectedOfferId}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer max-w-[160px] truncate"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                كل الطلبات
              </option>
              <option value="has_offer" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-300">
                طلبات العروض فقط ⭐
              </option>
              {offersList.map((o) => (
                <option key={o.id} value={o.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                  {o.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>الفترة:</span>
            </span>

            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                dateFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              الكل
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                dateFilter === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              اليوم
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                dateFilter === 'yesterday'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              أمس
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('last_7_days')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                dateFilter === 'last_7_days'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              آخر 7 أيام
            </button>
          </div>
        </div>
      </div>

      {/* Main Board View: Kanban or Table */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {KANBAN_COLUMNS.map((column) => {
            const columnOrders = filteredOrders.filter((order) => {
              if (column.allowedStatuses.includes(order.status)) return true;
              if (column.id === 'pending' && order.status !== 'confirmed') return true;
              return false;
            });
            const columnTotal = columnOrders.reduce(
              (sum, o) => sum + (Number(o.total_amount) || 0),
              0
            );

            return (
              <div
                key={column.id}
                className="flex flex-col rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 shadow-md dark:shadow-xl overflow-hidden min-h-[500px]"
              >
                {/* Column Header */}
                <div
                  className={`p-4 border-b border-slate-100 dark:border-slate-800/80 ${column.bgLight} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{column.title}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${column.badgeColor}`}
                    >
                      {columnOrders.length} طلب
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{column.subtitle}</span>
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(columnTotal)}
                    </span>
                  </div>
                </div>

                {/* Orders List */}
                <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
                  {columnOrders.length === 0 ? (
                    <div className="py-16 px-4 text-center">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 mb-2 border border-slate-200 dark:border-slate-800">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-slate-500">لا توجد طلبات هنا حالياً</p>
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        complaints={complaintsMap[order.id] || []}
                        onSelectOrder={(ord) => setSelectedOrder(ord)}
                        onAdvanceStatus={handleAdvanceStatus}
                        onPrintReceipt={handlePrintReceipt}
                        isUpdating={isUpdatingOrder[order.id]}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-950/70">
                  <th className="py-3 px-4 font-semibold">رقم الطلب</th>
                  <th className="py-3 px-4 font-semibold">التاريخ والوقت</th>
                  <th className="py-3 px-4 font-semibold">العميل</th>
                  <th className="py-3 px-4 font-semibold">رقم الهاتف</th>
                  <th className="py-3 px-4 font-semibold">الفرع</th>
                  <th className="py-3 px-4 font-semibold">العنوان</th>
                  <th className="py-3 px-4 font-semibold">الأصناف</th>
                  <th className="py-3 px-4 font-semibold">الإجمالي</th>
                  <th className="py-3 px-4 font-semibold">الحالة</th>
                  <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      لا توجد طلبات مطابقة لمعايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const badge = getOrderStatusBadge(order.status);
                    const totalItems = (order.order_items || []).reduce(
                      (acc, it) => acc + (it.quantity || 1),
                      0
                    );

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="py-3.5 px-4 font-bold font-mono text-slate-900 dark:text-white">
                          #{order.order_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                          {order.customer_phone}
                        </td>
                        <td className="py-3.5 px-4 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                          {order.branch?.name || '-'}
                        </td>
                        <td
                          className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                          title={order.delivery_address}
                        >
                          {order.delivery_address}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {totalItems} أصناف
                        </td>
                        <td className="py-3.5 px-4 font-bold font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {formatCurrency(Number(order.total_amount) || 0)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(order)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                              title="طباعة إيصال الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            </button>

                            {order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleConfirmOrder(order.id)}
                                disabled={isUpdatingOrder[order.id]}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                              >
                                {isUpdatingOrder[order.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>تأكيد</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        complaints={selectedOrder ? complaintsMap[selectedOrder.id] || [] : []}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onAdvanceStatus={handleAdvanceStatus}
        onChangeStatus={handleChangeStatus}
        onUpdateNotes={handleUpdateNotes}
        onPrintReceipt={handlePrintReceipt}
      />

      {/* Thermal Receipt Print Component */}
      {printingOrder && (
        <ThermalReceipt
          restaurantName={restaurantName}
          order={printingOrder}
          isPreview={isReceiptPreviewOpen}
          onClose={() => setIsReceiptPreviewOpen(false)}
        />
      )}
    </div>
  );
}
