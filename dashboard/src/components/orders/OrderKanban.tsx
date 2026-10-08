'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  Ban,
  Printer,
  Eye,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  X,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'pending_group',
    title: 'جديد / معلق',
    subtitle: 'بانتظار التأكيد وبدء التجهيز',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    bgLight: 'bg-amber-500/5',
    borderLight: 'border-amber-500/20',
    dotColor: 'bg-amber-500',
    allowedStatuses: ['pending', 'confirmed'],
  },
  {
    id: 'preparing',
    title: 'جاري التجهيز',
    subtitle: 'قيد التحضير في المطبخ',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    bgLight: 'bg-blue-500/5',
    borderLight: 'border-blue-500/20',
    dotColor: 'bg-blue-500',
    allowedStatuses: ['preparing'],
  },
  {
    id: 'out_for_delivery',
    title: 'خرج للتوصيل',
    subtitle: 'مع مندوب الدليفري في الطريق',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    bgLight: 'bg-purple-500/5',
    borderLight: 'border-purple-500/20',
    dotColor: 'bg-purple-500',
    allowedStatuses: ['out_for_delivery'],
  },
  {
    id: 'delivered',
    title: 'تم التسليم',
    subtitle: 'تم الاستلام والتحصيل بنجاح',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    bgLight: 'bg-emerald-500/5',
    borderLight: 'border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    allowedStatuses: ['delivered'],
  },
  {
    id: 'cancelled',
    title: 'ملغي',
    subtitle: 'طلبات تم إلغاؤها',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    bgLight: 'bg-rose-500/5',
    borderLight: 'border-rose-500/20',
    dotColor: 'bg-rose-500',
    allowedStatuses: ['cancelled'],
  },
];

export function OrderKanban({ initialOrders }: OrderKanbanProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [printingOrder, setPrintingOrder] = useState<OrderWithItems | null>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<Record<string, boolean>>({});
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // Set up Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('realtime_orders_pipeline')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          setIsRealtimeActive(true);
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderRow;
            // Fetch associated line items
            const { data: items } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', newOrder.id);

            const completeOrder: OrderWithItems = {
              ...newOrder,
              order_items: items || [],
            };

            setOrders((prev) => [completeOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OrderRow;
            setOrders((prev) =>
              prev.map((order) =>
                order.id === updated.id
                  ? { ...order, ...updated }
                  : order
              )
            );

            // Also update currently inspected order if open
            setSelectedOrder((prev) =>
              prev?.id === updated.id ? { ...prev, ...updated } : prev
            );
            setPrintingOrder((prev) =>
              prev?.id === updated.id ? { ...prev, ...updated } : prev
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setOrders((prev) => prev.filter((order) => order.id !== deletedId));
            setSelectedOrder((prev) => (prev?.id === deletedId ? null : prev));
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Date & Search Filtering
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
        const orderDate = new Date(order.created_at);
        const now = new Date();

        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (orderDate < startOfToday) return false;
        } else if (dateFilter === 'yesterday') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          if (orderDate < startOfYesterday || orderDate >= startOfToday) return false;
        } else if (dateFilter === 'last_7_days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < sevenDaysAgo) return false;
        }
      }

      return true;
    });
  }, [orders, searchQuery, dateFilter]);

  // Workflow Status Advancement
  const handleAdvanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus = 'preparing';
    if (currentStatus === 'pending' || currentStatus === 'confirmed') {
      nextStatus = 'preparing';
    } else if (currentStatus === 'preparing') {
      nextStatus = 'out_for_delivery';
    } else if (currentStatus === 'out_for_delivery') {
      nextStatus = 'delivered';
    } else {
      return;
    }
    await handleChangeStatus(orderId, nextStatus);
  };

  // Change Status Handler
  const handleChangeStatus = async (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const previousStatus = targetOrder?.status;

    setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: true }));

    // Optimistic UI update
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
        console.error('Error updating order status:', error);
        // Direct rollback to previousStatus
        if (previousStatus) {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o))
          );
          if (selectedOrder?.id === orderId) {
            setSelectedOrder((prev) => (prev ? { ...prev, status: previousStatus } : null));
          }
        }
        alert('تعذر تحديث حالة الطلب. يرجى التحقق من الاتصال بالإنترنت.');
      }
    } catch {
      if (previousStatus) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: previousStatus } : null));
        }
      }
      alert('حدث خطأ غير متوقع أثناء تحديث الطلب.');
    } finally {
      setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Cancel Order Handler
  const handleCancelOrder = async (orderId: string) => {
    await handleChangeStatus(orderId, 'cancelled');
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

  // Trigger Thermal Receipt Printing
  const handlePrintReceipt = (order: OrderWithItems) => {
    setPrintingOrder(order);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const afterPrintHandler = () => {
          setPrintingOrder(null);
          window.removeEventListener('afterprint', afterPrintHandler);
        };
        window.addEventListener('afterprint', afterPrintHandler);
        window.print();
        // Fallback cleanup in case afterprint does not fire in some browsers
        setTimeout(() => {
          setPrintingOrder(null);
        }, 3000);
      }
    }, 150);
  };

  // Preview Thermal Receipt Modal
  const handleOpenReceiptPreview = (order: OrderWithItems) => {
    setPrintingOrder(order);
    setIsReceiptPreviewOpen(true);
  };

  // Summary Metrics calculations
  const totalOrdersCount = filteredOrders.length;
  const pendingCount = filteredOrders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed'
  ).length;
  const preparingCount = filteredOrders.filter((o) => o.status === 'preparing').length;
  const outForDeliveryCount = filteredOrders.filter(
    (o) => o.status === 'out_for_delivery'
  ).length;
  const deliveredCount = filteredOrders.filter((o) => o.status === 'delivered').length;
  const totalRevenue = filteredOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header & Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">إدارة الطلبات المباشرة</h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isRealtimeActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
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
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            متابعة دورة تحضير وتسليم الوجبات وتحديث الحالات فورياً
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
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
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>جدول تفصيلي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">إجمالي الطلبات</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-white">{totalOrdersCount}</span>
            <ShoppingBag className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium">جديد / معلق</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-amber-400">{pendingCount}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-blue-400 font-medium">جاري التجهيز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-blue-400">{preparingCount}</span>
            <ChefHat className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-purple-500/5 border border-purple-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-purple-400 font-medium">مع الدليفري</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-purple-400">{outForDeliveryCount}</span>
            <Bike className="w-4 h-4 text-purple-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium">تم التسليم</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-400">{deliveredCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">إجمالي المبيعات</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-lg font-black text-amber-400 font-mono">
              {formatCurrency(totalRevenue)}
            </span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الهاتف، أو رقم الطلب..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Filters Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 ml-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>الفترة:</span>
          </span>

          <button
            type="button"
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            كل الطلبات
          </button>

          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            اليوم
          </button>

          <button
            type="button"
            onClick={() => setDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'yesterday'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            أمس
          </button>

          <button
            type="button"
            onClick={() => setDateFilter('last_7_days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'last_7_days'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            آخر 7 أيام
          </button>
        </div>
      </div>

      {/* Main View Area: Kanban vs Table */}
      {viewMode === 'kanban' ? (
        /* Kanban Columns Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {KANBAN_COLUMNS.map((column) => {
            const columnOrders = filteredOrders.filter((order) =>
              column.allowedStatuses.includes(order.status)
            );
            const columnTotal = columnOrders.reduce(
              (sum, o) => sum + (Number(o.total_amount) || 0),
              0
            );

            return (
              <div
                key={column.id}
                className={`flex flex-col rounded-3xl bg-slate-950/70 border border-slate-800/90 shadow-lg min-h-[500px] overflow-hidden`}
              >
                {/* Column Header */}
                <div className={`p-4 border-b border-slate-800/90 ${column.bgLight}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
                      <h3 className="font-extrabold text-sm text-white">{column.title}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold border ${column.badgeColor}`}
                    >
                      {columnOrders.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>{column.subtitle}</span>
                    <span className="font-mono font-medium text-slate-300">
                      {formatCurrency(columnTotal)}
                    </span>
                  </div>
                </div>

                {/* Orders List */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-800">
                  {columnOrders.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-600 mb-2 border border-slate-800">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-slate-500">لا توجد طلبات هنا حالياً</p>
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onSelectOrder={(ord) => setSelectedOrder(ord)}
                        onAdvanceStatus={handleAdvanceStatus}
                        onCancelOrder={handleCancelOrder}
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
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                  <th className="py-3 px-4 font-semibold">رقم الطلب</th>
                  <th className="py-3 px-4 font-semibold">التاريخ والوقت</th>
                  <th className="py-3 px-4 font-semibold">العميل</th>
                  <th className="py-3 px-4 font-semibold">رقم الهاتف</th>
                  <th className="py-3 px-4 font-semibold">العنوان</th>
                  <th className="py-3 px-4 font-semibold">الأصناف</th>
                  <th className="py-3 px-4 font-semibold">الإجمالي</th>
                  <th className="py-3 px-4 font-semibold">طريقة الدفع</th>
                  <th className="py-3 px-4 font-semibold">الحالة</th>
                  <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      لا توجد طلبات مطابقة لمعايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const badge = getOrderStatusBadge(order.status);
                    const totalItems = order.order_items.reduce(
                      (acc, it) => acc + (it.quantity || 1),
                      0
                    );

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="py-3.5 px-4 font-bold font-mono text-white">
                          #{order.order_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap" dir="ltr">
                          {order.customer_phone}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate" title={order.delivery_address}>
                          {order.delivery_address}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          {totalItems} أصناف
                        </td>
                        <td className="py-3.5 px-4 font-bold font-mono text-amber-400 whitespace-nowrap">
                          {formatCurrency(Number(order.total_amount) || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {order.payment_method === 'cash_on_delivery' ? 'كاش' : order.payment_method}
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
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="طباعة إيصال الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            {(order.status === 'pending' || order.status === 'confirmed') && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(order.id, order.status)}
                                className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                              >
                                تجهيز
                              </button>
                            )}

                            {order.status === 'preparing' && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(order.id, order.status)}
                                className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
                              >
                                دليفري
                              </button>
                            )}

                            {order.status === 'out_for_delivery' && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(order.id, order.status)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                              >
                                تسليم
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
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
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onAdvanceStatus={handleAdvanceStatus}
        onChangeStatus={handleChangeStatus}
        onUpdateNotes={handleUpdateNotes}
        onPrintReceipt={handlePrintReceipt}
      />

      {/* Thermal Receipt Print Component & Preview Modal */}
      {printingOrder && (
        <ThermalReceipt
          order={printingOrder}
          isPreview={isReceiptPreviewOpen}
          onClose={() => setIsReceiptPreviewOpen(false)}
        />
      )}
    </div>
  );
}
