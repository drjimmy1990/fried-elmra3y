'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  BellRing,
  Plus,
  Search,
  Printer,
  Phone,
  MessageCircle,
  MapPin,
  ShoppingBag,
  Building2,
  Tag,
  CheckCircle2,
  Clock,
  Flame,
  Edit3,
  Trash2,
  ArrowLeft,
  X,
  Loader2,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  PREP_ALERT_OPTIONS,
  encodeScheduleMeta,
  parseScheduleMeta,
  formatMinutesAr,
  toCairoDateTimeLocalInput,
  fromCairoDateTimeLocalInput,
} from '@/lib/scheduled-orders';
import { OrderWithItems, OrderRow } from '@/components/orders/types';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { ScheduleOrderModal } from '@/components/orders/ScheduleOrderModal';
import { ThermalReceipt } from '@/components/orders/ThermalReceipt';

interface ScheduledOrdersBoardProps {
  initialOrders: OrderWithItems[];
  branches: { id: string; name: string }[];
  offers: { id: string; title: string; price_after?: number | null }[];
}

export function ScheduledOrdersBoard({
  initialOrders,
  branches,
  offers,
}: ScheduledOrdersBoardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [now, setNow] = useState<Date>(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [editingScheduleOrder, setEditingScheduleOrder] = useState<OrderWithItems | null>(null);
  const [printingOrder, setPrintingOrder] = useState<OrderWithItems | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  // Manual Add Scheduled Order Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBranchId, setNewBranchId] = useState('');
  const [newOfferId, setNewOfferId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newSpicePreference, setNewSpicePreference] = useState('سبايسي');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [newDeliveryFee, setNewDeliveryFee] = useState(20);
  const [newTotalAmount, setNewTotalAmount] = useState(0);
  const [newDateTimeLocal, setNewDateTimeLocal] = useState(() => {
    const tomorrow7pm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return toCairoDateTimeLocalInput(tomorrow7pm);
  });
  const [newPrepAlertMinutes, setNewPrepAlertMinutes] = useState(60);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Live clock tick every 15 seconds for accurate countdowns and prep alerts
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Realtime subscription to orders table
  useEffect(() => {
    const channel = supabase
      .channel('scheduled-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as OrderRow;
            const isSched = typeof row.payment_method === 'string' && row.payment_method.startsWith('scheduled|');

            if (!isSched) {
              setOrders((prev) => prev.filter((o) => o.id !== row.id));
              return;
            }

            const { data: items } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', row.id);

            const enriched: OrderWithItems = {
              ...row,
              order_items: items || [],
              branch: branches.find((b) => b.id === row.branch_id) || null,
              offer: offers.find((of) => of.id === row.offer_id) || null,
            };

            setOrders((prev) => {
              const exists = prev.some((o) => o.id === row.id);
              if (exists) {
                return prev.map((o) => (o.id === row.id ? enriched : o));
              }
              return [enriched, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, branches, offers]);

  // Enrich with parsed schedule metadata and sort by scheduled delivery time (soonest first)
  const scheduledOrders = useMemo(() => {
    return orders
      .map((order) => ({
        order,
        meta: parseScheduleMeta(order.payment_method, now),
      }))
      .filter((entry) => entry.meta.isScheduled)
      .filter(({ order }) => {
        if (selectedBranchId !== 'all' && order.branch_id !== selectedBranchId) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = order.customer_name?.toLowerCase().includes(q);
          const matchPhone = order.customer_phone?.includes(q);
          const matchNum = String(order.order_number).includes(q);
          const matchNotes = order.customer_notes?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchNum && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const tA = a.meta.scheduledDate?.getTime() || Infinity;
        const tB = b.meta.scheduledDate?.getTime() || Infinity;
        return tA - tB;
      });
  }, [orders, now, selectedBranchId, searchQuery]);

  // Orders whose prep alert window has arrived!
  const duePrepOrders = useMemo(
    () => scheduledOrders.filter((entry) => entry.meta.isAlertDue),
    [scheduledOrders]
  );

  // KPIs
  const todayCairoStr = toCairoDateTimeLocalInput(now).split('T')[0];
  const todayScheduledCount = scheduledOrders.filter((entry) => {
    if (!entry.meta.scheduledDate) return false;
    return toCairoDateTimeLocalInput(entry.meta.scheduledDate).startsWith(todayCairoStr);
  }).length;
  const futureDaysCount = Math.max(0, scheduledOrders.length - todayScheduledCount);

  // Update schedule time
  const handleUpdateSchedule = async (
    orderId: string,
    scheduledForIso: string,
    prepAlertMinutes: number
  ) => {
    const encoded = encodeScheduleMeta(scheduledForIso, prepAlertMinutes);
    const { error } = await supabase
      .from('orders')
      .update({
        payment_method: encoded,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      alert('تعذر تحديث موعد الطلب المجدول.');
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_method: encoded } : o))
    );
  };

  // Send scheduled order to kitchen & confirm (moves to active Orders page!)
  const handleSendToKitchenAndConfirm = async (order: OrderWithItems) => {
    setIsUpdating((prev) => ({ ...prev, [order.id]: true }));
    try {
      const meta = parseScheduleMeta(order.payment_method, now);
      const timeNote = meta.scheduledFor
        ? `طلب مجدول (موعد التوصيل: ${formatDateTime(meta.scheduledFor)})`
        : '';
      const existingNotes = (order.customer_notes || '').trim();
      const updatedNotes =
        timeNote && !existingNotes.includes('موعد التوصيل')
          ? [existingNotes, timeNote].filter(Boolean).join(' | ')
          : existingNotes;

      // 1. Convert payment_method back to cash_on_delivery so it appears in active Orders
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          payment_method: 'cash_on_delivery',
          customer_notes: updatedNotes,
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

      // 2. Also trigger /api/orders/confirm to notify customer if connected to Messenger
      fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(() => {});

      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) {
      console.error('Failed to activate scheduled order:', err);
      alert('تعذر تحويل الطلب إلى المطبخ.');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Move back to Pending queue in active Orders without auto-confirming
  const handleMoveToPendingQueue = async (order: OrderWithItems) => {
    setIsUpdating((prev) => ({ ...prev, [order.id]: true }));
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: 'cash_on_delivery',
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch {
      alert('تعذر نقل الطلب إلى قائمة الانتظار.');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Delete scheduled order
  const handleDeleteScheduledOrder = async (order: OrderWithItems) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطلب المجدول #${order.order_number} للعميل ${order.customer_name}؟`)) {
      return;
    }
    setIsUpdating((prev) => ({ ...prev, [order.id]: true }));
    try {
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch {
      alert('تعذر حذف الطلب المجدول.');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Print receipt
  const handlePrintReceipt = (order: OrderWithItems) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Create new manual scheduled order
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim() || !newDateTimeLocal) return;

    setIsCreatingOrder(true);
    try {
      const scheduledIso = fromCairoDateTimeLocalInput(newDateTimeLocal);
      const encodedSchedule = encodeScheduleMeta(scheduledIso, newPrepAlertMinutes);
      const deliveryTimeLabel = formatDateTime(scheduledIso);
      const combinedNotes = [
        `التوصيل: ${deliveryTimeLabel}`,
        `الطلب ${newSpicePreference}`,
        newCustomerNotes.trim(),
      ]
        .filter(Boolean)
        .join(' | ');

      const itemUnitPrice = Math.max(
        0,
        (Number(newTotalAmount) - Number(newDeliveryFee)) / (Number(newItemQty) || 1)
      );
      const subtotal = Math.max(0, Number(newTotalAmount) - Number(newDeliveryFee));

      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_name: newCustomerName.trim(),
          customer_phone: newCustomerPhone.trim(),
          delivery_address: newAddress.trim() || 'لم يحدد',
          branch_id: newBranchId || null,
          offer_id: newOfferId || null,
          subtotal,
          delivery_fee: Number(newDeliveryFee) || 0,
          total_amount: Number(newTotalAmount) || 0,
          status: 'pending',
          payment_method: encodedSchedule,
          customer_notes: combinedNotes,
          source: 'dashboard',
        })
        .select('*')
        .single();

      if (orderErr || !createdOrder) throw orderErr;

      const finalItemName =
        newItemName.trim() ||
        offers.find((o) => o.id === newOfferId)?.title ||
        'طلب مجدول';

      const { data: createdItem } = await supabase
        .from('order_items')
        .insert({
          order_id: createdOrder.id,
          item_name: finalItemName,
          quantity: Number(newItemQty) || 1,
          unit_price: itemUnitPrice,
          total_price: subtotal,
          notes: newSpicePreference,
        })
        .select('*');

      const enriched: OrderWithItems = {
        ...createdOrder,
        order_items: createdItem || [],
        branch: branches.find((b) => b.id === createdOrder.branch_id) || null,
        offer: offers.find((of) => of.id === createdOrder.offer_id) || null,
      };

      setOrders((prev) => [enriched, ...prev]);
      setIsAddModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewAddress('');
      setNewItemName('');
      setNewItemQty(1);
      setNewCustomerNotes('');
      setNewTotalAmount(0);
    } catch (err) {
      console.error('Error creating scheduled order:', err);
      alert('تعذر حفظ الطلب المجدول الجديد.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const applyManualShortcut = (daysAhead: number, hour24: number) => {
    const parts = toCairoDateTimeLocalInput(now).split('T')[0].split('-').map(Number);
    const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + daysAhead, hour24 - 2, 0, 0));
    setNewDateTimeLocal(toCairoDateTimeLocalInput(base));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                الطلبات المجدولة وتنبيهات التحضير
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                حفظ الأوردرات المطلوبة في مواعيد لاحقة أو لليوم التالي مع تنبيه صوتي وبصري قبل ميعاد التحضير
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>كروت</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>جدول</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طلب مجدول يدوياً</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            إجمالي الطلبات المجدولة
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {scheduledOrders.length}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">طلب محفوظ</span>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-xs transition-all ${
            duePrepOrders.length > 0
              ? 'bg-rose-500/10 border-rose-500/40 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-[#101726] border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <Flame className="w-4 h-4" />
            <span>حان موعد تحضيرها الآن!</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {duePrepOrders.length}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-300 font-semibold">
              تنبيه تحضير للمطبخ
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            مجدولة لتوصيل اليوم
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {todayScheduledCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">اليوم</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            مجدولة للغد والأيام القادمة
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {futureDaysCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">غداً وما بعده</span>
          </div>
        </div>
      </div>

      {/* Pinned Active Kitchen Prep Alerts Box (Separate from Complaints!) */}
      {duePrepOrders.length > 0 && (
        <div className="rounded-3xl bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-rose-500/15 border-2 border-rose-500/50 p-5 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-black text-base">
              <BellRing className="w-5 h-5 animate-bounce text-rose-500" />
              <span>
                🔔 تنبيهات التجهيز الحالية للمطبخ ({duePrepOrders.length} طلب يحتاج البدء في التحضير الآن!)
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              يظل التنبيه ظاهراً هنا حتى يتم الضغط على &quot;إرسال للمطبخ وتأكيد الطلب&quot;
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {duePrepOrders.map(({ order, meta }) => (
              <div
                key={order.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/40 p-3.5 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                      #{order.order_number}
                    </span>
                    <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
                      {order.customer_name}
                    </span>
                    {order.branch?.name && (
                      <span className="rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[10px] font-bold border border-blue-500/20">
                        {order.branch.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    📦 موعد التوصيل للعميل:{' '}
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {meta.scheduledFor ? formatDateTime(meta.scheduledFor) : '-'}
                    </span>
                  </div>
                  {order.customer_notes && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      📝 {order.customer_notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt(order)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    title="طباعة الفاتورة 80mm"
                  >
                    <Printer className="w-4 h-4 text-amber-500" />
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating[order.id]}
                    onClick={() => handleSendToKitchenAndConfirm(order)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    {isUpdating[order.id] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>إرسال للمطبخ وتأكيد 🚀</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Branch Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العميل، رقم الهاتف، رقم الطلب، أو الملاحظات..."
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pr-9 pl-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900">
                كل الفروع
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Cards or Table */}
      {scheduledOrders.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 p-14 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <CalendarClock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            لا توجد طلبات مجدولة حالياً
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            يمكنك جدولة أي طلب من صفحة &quot;الطلبات&quot; بالضغط على زر &quot;جدولة 📅&quot; على كارت الطلب، أو إضافة طلب مجدول يدوياً من الزر أعلى الصفحة.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scheduledOrders.map(({ order, meta }) => {
            const itemsPreview = (order.order_items || [])
              .map((it) => `${it.quantity}x ${it.item_name}${it.notes ? ` (${it.notes})` : ''}`)
              .join('، ');

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`group relative rounded-3xl p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 border shadow-sm hover:shadow-md ${
                  meta.isAlertDue
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-500/50 ring-2 ring-rose-500/20'
                    : 'bg-white dark:bg-[#101726] border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                        #{order.order_number}
                      </span>
                      {order.branch?.name && (
                        <span className="flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[11px] font-bold border border-blue-500/20">
                          <Building2 className="w-3 h-3" />
                          <span>{order.branch.name}</span>
                        </span>
                      )}
                    </div>

                    {meta.isAlertDue ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-[11px] font-bold animate-pulse">
                        <Flame className="w-3 h-3" />
                        <span>حان وقت التجهيز الآن!</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                        <Clock className="w-3 h-3" />
                        <span>التنبيه بعد {formatMinutesAr(meta.minutesUntilAlert)}</span>
                      </span>
                    )}
                  </div>

                  {/* Schedule Time Banner */}
                  <div className="rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/25 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        📦 موعد التوصيل للعميل:
                      </span>
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                        {meta.scheduledFor ? formatDateTime(meta.scheduledFor) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        🔔 تنبيه المطبخ (قبل الميعاد بـ {meta.prepAlertMinutes} د):
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {meta.alertAt ? formatDateTime(meta.alertAt.toISOString()) : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {order.customer_name}
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/15 text-slate-600 dark:text-slate-300 hover:text-blue-500 transition"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        {order.contact_id && (
                          <Link
                            href={{ pathname: '/dashboard/chat', query: { contactId: order.contact_id } }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 text-slate-600 dark:text-slate-300 hover:text-indigo-500 transition"
                            title="فتح محادثة العميل"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                      {order.customer_phone}
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="break-words">{order.delivery_address}</span>
                    </div>
                  </div>

                  {/* Offer & Items */}
                  {order.offer?.title && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span>عرض: {order.offer.title}</span>
                    </div>
                  )}

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {itemsPreview || 'تفاصيل الأصناف بالداخل'}
                    </div>
                    {order.customer_notes && (
                      <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 pt-1 border-t border-amber-500/20">
                        📝 ملاحظة: {order.customer_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer & Actions */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">الإجمالي النهائي</span>
                    <span className="font-mono font-extrabold text-base text-amber-600 dark:text-amber-400">
                      {formatCurrency(Number(order.total_amount) || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(order)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        title="طباعة الفاتورة 80mm"
                      >
                        <Printer className="w-4 h-4 text-amber-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingScheduleOrder(order)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700"
                        title="تعديل موعد الجدولة والتنبيه"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToPendingQueue(order)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        title="إرجاع لقائمة الانتظار العادية"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScheduledOrder(order)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        title="حذف الطلب المجدول"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdating[order.id]}
                      onClick={() => handleSendToKitchenAndConfirm(order)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                    >
                      {isUpdating[order.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>إرسال للمطبخ وتأكيد 🚀</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View (Zero Horizontal Scroll) */
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="w-full">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/70">
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">رقم الطلب والفرع</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">موعد التوصيل والتنبيه</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">العميل والهاتف</th>
                  <th className="py-3 px-3 font-semibold">العنوان</th>
                  <th className="py-3 px-3 font-semibold">الأصناف والملاحظات</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">الإجمالي</th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {scheduledOrders.map(({ order, meta }) => {
                  const itemsSummary = (order.order_items || [])
                    .map((it) => `${it.quantity}x ${it.item_name}${it.notes ? ` (${it.notes})` : ''}`)
                    .join('، ');

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`transition-colors cursor-pointer align-top ${
                        meta.isAlertDue
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold font-mono text-slate-900 dark:text-white">
                          #{order.order_number}
                        </div>
                        {order.branch?.name && (
                          <span className="mt-1 inline-block rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[10px] font-medium border border-blue-500/20">
                            {order.branch.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-indigo-600 dark:text-indigo-300">
                          📦 {meta.scheduledFor ? formatDateTime(meta.scheduledFor) : '-'}
                        </div>
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                          🔔 التنبيه قبلها بـ {meta.prepAlertMinutes} د
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {order.customer_name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" dir="ltr">
                          {order.customer_phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-normal break-words leading-relaxed min-w-[160px]">
                        {order.delivery_address}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-normal break-words leading-relaxed min-w-[180px]">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {itemsSummary || 'تفاصيل بالداخل'}
                        </div>
                        {order.customer_notes && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                            📝 {order.customer_notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {formatCurrency(Number(order.total_amount) || 0)}
                      </td>
                      <td
                        className="py-3.5 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendToKitchenAndConfirm(order)}
                            disabled={isUpdating[order.id]}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>للمطبخ 🚀</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingScheduleOrder(order)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                            title="تعديل الموعد"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(order)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-500"
                            title="طباعة الإيصال"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Add Scheduled Order Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    إضافة طلب مجدول جديد يدوياً
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    سجل بيانات الأوردر وموعد التوصيل وسيقوم النظام بالتنبيه قبل الموعد لتجهيزه
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">اسم العميل *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="مثال: عماد ممدوح"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">الفرع</label>
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                  >
                    <option value="">اختر الفرع...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">العرض (إن وجد)</label>
                  <select
                    value={newOfferId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNewOfferId(id);
                      const matched = offers.find((o) => o.id === id);
                      if (matched) {
                        if (!newItemName) setNewItemName(matched.title);
                        if (matched.price_after) {
                          setNewTotalAmount(Number(matched.price_after) * newItemQty + Number(newDeliveryFee));
                        }
                      }
                    }}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                  >
                    <option value="">بدون عرض خاص</option>
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">عنوان التوصيل بالتفصيل *</label>
                <input
                  type="text"
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="الشارع، رقم العمارة، الدور، الشقة، علامة مميزة..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">تفاصيل الوجبات / الأصناف المطلوبة *</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: عرض الاثنين والثلاثاء 4 قطع دجاج بدون أجنحة"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">الكمية ودرجة السبايسي</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Math.max(1, Number(e.target.value)))}
                      className="w-16 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-2.5 text-center font-mono"
                    />
                    <select
                      value={newSpicePreference}
                      onChange={(e) => setNewSpicePreference(e.target.value)}
                      className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-2.5 font-bold"
                    >
                      <option value="سبايسي">سبايسي 🔥</option>
                      <option value="عادي">عادي</option>
                      <option value="مكس (نصف عادي ونصف سبايسي)">مكس</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">رسوم التوصيل (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    value={newDeliveryFee}
                    onChange={(e) => setNewDeliveryFee(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">الإجمالي النهائي شامل التوصيل (ج.م) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newTotalAmount}
                    onChange={(e) => setNewTotalAmount(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={newCustomerNotes}
                    onChange={(e) => setNewCustomerNotes(e.target.value)}
                    placeholder="أي ملاحظة للمطبخ أو الطيار..."
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                  />
                </div>
              </div>

              {/* Schedule Date/Time & Alert Lead Time */}
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/25 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>تحديد موعد التوصيل ووقت التنبيه:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyManualShortcut(0, 19)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    >
                      اليوم 7:00 م
                    </button>
                    <button
                      type="button"
                      onClick={() => applyManualShortcut(1, 17)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    >
                      غداً 5:00 م
                    </button>
                    <button
                      type="button"
                      onClick={() => applyManualShortcut(1, 19)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    >
                      غداً 7:00 م
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">تاريخ وساعة التوصيل المطلوبة *</label>
                    <input
                      type="datetime-local"
                      required
                      dir="ltr"
                      value={newDateTimeLocal}
                      onChange={(e) => setNewDateTimeLocal(e.target.value)}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">تنبيه المطبخ قبل الميعاد بـ *</label>
                    <select
                      value={newPrepAlertMinutes}
                      onChange={(e) => setNewPrepAlertMinutes(Number(e.target.value))}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 font-semibold"
                    >
                      {PREP_ALERT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrder}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span>{isCreatingOrder ? 'جاري الحفظ...' : 'حفظ الطلب المجدول 📅'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onAdvanceStatus={async (id) => {
          const target = orders.find((o) => o.id === id);
          if (target) await handleSendToKitchenAndConfirm(target);
        }}
        onChangeStatus={async (id) => {
          const target = orders.find((o) => o.id === id);
          if (target) await handleSendToKitchenAndConfirm(target);
        }}
        onUpdateNotes={async (id, notes) => {
          const { error } = await supabase
            .from('orders')
            .update({ internal_notes: notes, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (!error) {
            setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, internal_notes: notes } : o)));
            return true;
          }
          return false;
        }}
        onPrintReceipt={handlePrintReceipt}
        onScheduleOrder={(ord) => setEditingScheduleOrder(ord)}
      />

      {/* Edit Schedule Modal */}
      <ScheduleOrderModal
        order={editingScheduleOrder}
        isOpen={Boolean(editingScheduleOrder)}
        onClose={() => setEditingScheduleOrder(null)}
        onConfirmSchedule={handleUpdateSchedule}
      />

      {/* Thermal Receipt Print Component */}
      {printingOrder && (
        <ThermalReceipt
          restaurantName="تشيكن مراعي"
          order={printingOrder}
          isPreview={false}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}
