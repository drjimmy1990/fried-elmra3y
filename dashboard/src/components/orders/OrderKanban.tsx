'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  CalendarClock,
  Ban,
  RotateCcw,
  MessageSquareText,
  ArrowLeftRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatCurrency, formatDateTime, getOrderStatusBadge, isOrderCancelled } from '@/lib/utils';
import { encodeScheduleMeta, isScheduledPaymentMethod } from '@/lib/scheduled-orders';
import {
  DEFAULT_ORDER_MESSAGE_TEMPLATES,
  OrderMessageTemplates,
  extractModificationSummary,
  interpolateOrderTemplate,
  isCustomerCancellationComplaint,
  isMergedOrDeclinedModOrder,
  isPendingModificationRequest,
} from '@/lib/order-templates';
import { OrderCard } from './OrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';
import { ScheduleOrderModal } from './ScheduleOrderModal';
import { ThermalReceipt } from './ThermalReceipt';
import {
  OrderActionMessageModal,
  OrderActionModalConfig,
} from './OrderActionMessageModal';
import { OrderTemplatesModal } from './OrderTemplatesModal';
import {
  OrderModificationRequestsSection,
  ModificationRequestPair,
  CancellationRequestItem,
} from './OrderModificationRequestsSection';
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
  initialOpenComplaints?: any[];
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

export function OrderKanban({
  initialOrders,
  branches = [],
  offers = [],
  initialOpenComplaints = [],
}: OrderKanbanProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const hasLoadedHistoryRef = useRef(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>(branches);
  const [offersList, setOffersList] = useState<{ id: string; title: string }[]>(offers);

  const searchParams = useSearchParams();
  const router = useRouter();
  const [customerFilter, setCustomerFilter] = useState<{
    contactId: string | null;
    phone: string | null;
    customer: string | null;
  } | null>(null);
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

  // Handle deep link ?orderId= or customer filter (?contactId=&phone=&customer=)
  useEffect(() => {
    const id = searchParams.get('orderId');
    if (id) {
      const found = orders.find((o) => o.id === id);
      if (found) {
        setSelectedOrder(found);
      } else {
        const fetchMissing = async () => {
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', id)
            .single();
          if (data) {
            const raw = data as any;
            const fullOrder: OrderWithItems = {
              ...raw,
              order_items: Array.isArray(raw.order_items) ? raw.order_items : [],
              branch: branchesList.find((b) => b.id === raw.branch_id) || null,
              offer: offersList.find((of) => of.id === raw.offer_id) || null,
            };
            setSelectedOrder(fullOrder);
            setOrders((prev) => (prev.some((x) => x.id === fullOrder.id) ? prev : [fullOrder, ...prev]));
          }
        };
        fetchMissing();
      }
    }

    const cId = searchParams.get('contactId');
    const cPhone = searchParams.get('phone');
    const cName = searchParams.get('customer');

    if (cId || cPhone || cName) {
      setCustomerFilter({
        contactId: cId || null,
        phone: cPhone || null,
        customer: cName || null,
      });

      const fetchCustomerOrders = async () => {
        const orClauses: string[] = [];
        if (cId) orClauses.push(`contact_id.eq.${cId}`);
        if (cPhone) orClauses.push(`customer_phone.eq.${cPhone}`);
        if (orClauses.length === 0) return;

        const { data: custOrders } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .or(orClauses.join(','))
          .order('created_at', { ascending: false });

        if (custOrders && custOrders.length > 0) {
          const enrichedList: OrderWithItems[] = (custOrders as any[]).map((ord) => ({
            ...ord,
            order_items: Array.isArray(ord.order_items) ? ord.order_items : [],
            branch: branchesList.find((b) => b.id === ord.branch_id) || null,
            offer: offersList.find((of) => of.id === ord.offer_id) || null,
          }));

          setOrders((prev) => {
            const map = new Map(prev.map((o) => [o.id, o]));
            for (const eo of enrichedList) {
              map.set(eo.id, eo);
            }
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      };

      fetchCustomerOrders();
    } else {
      setCustomerFilter(null);
    }
  }, [searchParams, supabase, branchesList, offersList]);

  // Complaint tracking for orders & open customer cancellation requests
  const [complaintsMap, setComplaintsMap] = useState<Record<string, any[]>>({});
  const [openComplaints, setOpenComplaints] = useState<any[]>(initialOpenComplaints);
  const [orderTemplates, setOrderTemplates] = useState<OrderMessageTemplates>(
    DEFAULT_ORDER_MESSAGE_TEMPLATES
  );
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [actionModalConfig, setActionModalConfig] = useState<OrderActionModalConfig | null>(null);
  const [showModificationSection, setShowModificationSection] = useState(true);

  useEffect(() => {
    fetch('/api/orders/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data.templates) {
          setOrderTemplates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchComplaints = async () => {
      const since30h = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
      const [{ data: linkedData }, { data: openData }] = await Promise.all([
        supabase
          .from('complaints')
          .select('id, ticket_number, order_id, status')
          .not('order_id', 'is', null)
          .gte('created_at', since30h)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('complaints')
          .select('id, ticket_number, contact_id, customer_name, customer_phone, issue_description, status, order_id, created_at')
          .eq('status', 'open')
          .gte('created_at', since30h)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (linkedData) {
        const map: Record<string, any[]> = {};
        linkedData.forEach((c) => {
          if (c.order_id) {
            if (!map[c.order_id]) map[c.order_id] = [];
            map[c.order_id].push(c);
          }
        });
        setComplaintsMap(map);
      }

      if (openData) {
        setOpenComplaints((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const item of openData) {
            byId.set(item.id, item);
          }
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }
    };
    fetchComplaints();
  }, [supabase]);

  // Lazy-load 8-day historical orders & complaints on demand when user switches away from 'today' or searches
  useEffect(() => {
    if (dateFilter === 'today' && !searchQuery.trim()) return;
    if (hasLoadedHistoryRef.current) return;
    hasLoadedHistoryRef.current = true;

    let active = true;
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const since8d = new Date();
        since8d.setHours(0, 0, 0, 0);
        since8d.setDate(since8d.getDate() - 8);
        const sinceIso = since8d.toISOString();

        const [{ data: histOrders }, { data: histOpenComps }] = await Promise.all([
          supabase
            .from('orders')
            .select('*, order_items(*)')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(1500),
          supabase
            .from('complaints')
            .select('id, ticket_number, contact_id, customer_name, customer_phone, issue_description, status, order_id, created_at')
            .eq('status', 'open')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

        if (!active) return;

        if (histOrders && histOrders.length > 0) {
          setOrders((prev) => {
            const byId = new Map(prev.map((o) => [o.id, o]));
            for (const row of histOrders as any[]) {
              if (!byId.has(row.id)) {
                byId.set(row.id, {
                  ...row,
                  order_items: Array.isArray(row.order_items) ? row.order_items : [],
                  branch: branchesList.find((b) => b.id === row.branch_id) || null,
                  offer: offersList.find((of) => of.id === row.offer_id) || null,
                });
              }
            }
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }

        if (histOpenComps && histOpenComps.length > 0) {
          setOpenComplaints((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            for (const c of histOpenComps) {
              byId.set(c.id, c);
            }
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      } catch (err) {
        console.warn('Historical orders lazy-load warning:', err);
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [dateFilter, searchQuery, supabase, branchesList, offersList]);

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

  // Realtime subscription on orders and complaints + 4-second live background sync
  useEffect(() => {
    let isMounted = true;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];

    const fetchItemsWithRetries = (orderId: string) => {
      const fetchOnce = async () => {
        if (!isMounted) return;
        try {
          const { data: items, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

          if (!error && items && items.length > 0 && isMounted) {
            setOrders((prev) =>
              prev.map((o) => (o.id === orderId ? { ...o, order_items: items as any } : o))
            );
            setSelectedOrder((prev) =>
              prev?.id === orderId ? { ...prev, order_items: items as any } : prev
            );
          }
        } catch (err) {
          console.warn('Non-blocking items fetch warning:', err);
        }
      };

      // Immediate + staggered retries to catch n8n Create a row6 (which runs 1-4s after Create a row5)
      fetchOnce();
      [1000, 2500, 5000].forEach((delay) => {
        retryTimers.push(setTimeout(fetchOnce, delay));
      });
    };

    const syncLatestOrders = async () => {
      if (!isMounted) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false })
          .limit(35);

        if (error || !data || !isMounted) return;

        const latestRows = data as (OrderRow & { order_items?: any[] })[];

        setOrders((prev) => {
          let changed = false;
          const prevMap = new Map(prev.map((o) => [o.id, o]));
          const newlyDiscovered: OrderWithItems[] = [];

          for (const row of latestRows) {
            const incomingItems = Array.isArray(row.order_items) ? row.order_items : [];
            const existing = prevMap.get(row.id);

            if (!existing) {
              changed = true;
              newlyDiscovered.push({
                ...row,
                order_items: incomingItems,
                branch: branchesList.find((b) => b.id === row.branch_id) || null,
                offer: offersList.find((of) => of.id === row.offer_id) || null,
              });
            } else {
              const existingItemsCount = existing.order_items?.length || 0;
              const statusChanged = existing.status !== row.status;
              const paymentChanged = existing.payment_method !== row.payment_method;
              const totalChanged = Number(existing.total_amount) !== Number(row.total_amount);
              const notesChanged = existing.customer_notes !== row.customer_notes;
              const internalNotesChanged = existing.internal_notes !== row.internal_notes;
              const addressChanged = existing.delivery_address !== row.delivery_address;
              const itemsArrived =
                incomingItems.length > 0 &&
                (incomingItems.length !== existingItemsCount ||
                  JSON.stringify(incomingItems) !== JSON.stringify(existing.order_items || []));

              if (
                statusChanged ||
                paymentChanged ||
                totalChanged ||
                notesChanged ||
                internalNotesChanged ||
                addressChanged ||
                itemsArrived
              ) {
                changed = true;
                prevMap.set(row.id, {
                  ...existing,
                  ...row,
                  order_items: incomingItems.length > 0 ? incomingItems : existing.order_items || [],
                  branch: branchesList.find((b) => b.id === row.branch_id) || existing.branch || null,
                  offer: offersList.find((of) => of.id === row.offer_id) || existing.offer || null,
                });
              }
            }
          }

          if (!changed) return prev;
          const combined = [...newlyDiscovered, ...Array.from(prevMap.values())];
          return combined.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        setSelectedOrder((prevSelected) => {
          if (!prevSelected) return prevSelected;
          const match = latestRows.find((r) => r.id === prevSelected.id);
          if (!match) return prevSelected;
          const incomingItems = Array.isArray(match.order_items) ? match.order_items : [];
          const hasChanged =
            match.status !== prevSelected.status ||
            match.payment_method !== prevSelected.payment_method ||
            Number(match.total_amount) !== Number(prevSelected.total_amount) ||
            match.internal_notes !== prevSelected.internal_notes ||
            match.customer_notes !== prevSelected.customer_notes ||
            (incomingItems.length > 0 &&
              incomingItems.length !== (prevSelected.order_items?.length || 0));
          if (!hasChanged) return prevSelected;
          return {
            ...prevSelected,
            ...match,
            order_items: incomingItems.length > 0 ? incomingItems : prevSelected.order_items || [],
            branch: branchesList.find((b) => b.id === match.branch_id) || prevSelected.branch || null,
            offer: offersList.find((of) => of.id === match.offer_id) || prevSelected.offer || null,
          };
        });

        // Also sync recent open complaints for customer cancellation requests (merge without dropping older loaded rows)
        const { data: openComps } = await supabase
          .from('complaints')
          .select('id, ticket_number, contact_id, customer_name, customer_phone, issue_description, status, order_id, created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50);

        if (openComps && isMounted) {
          setOpenComplaints((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            let compChanged = false;
            for (const c of openComps) {
              const existing = byId.get(c.id);
              if (!existing || existing.status !== c.status || existing.issue_description !== c.issue_description) {
                byId.set(c.id, c);
                compChanged = true;
              }
            }
            if (!compChanged) return prev;
            return Array.from(byId.values())
              .filter((c) => c.status === 'open')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        }
      } catch (err) {
        console.warn('Background orders sync warning:', err);
      }
    };

    const setupRealtime = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch {}

      if (!isMounted) return;

      const channelName = `realtime_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            if (!isMounted) return;
            setIsRealtimeActive(true);

            if (payload.eventType === 'INSERT') {
              const newOrder = payload.new as OrderRow;

              const fullOrder: OrderWithItems = {
                ...newOrder,
                order_items: [],
                branch: branchesList.find((b) => b.id === newOrder.branch_id) || null,
                offer: offersList.find((o) => o.id === newOrder.offer_id) || null,
              };

              setOrders((prev) => {
                if (prev.some((o) => o.id === newOrder.id)) {
                  return prev.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o));
                }
                return [fullOrder, ...prev];
              });

              fetchItemsWithRetries(newOrder.id);
            } else if (payload.eventType === 'UPDATE') {
              const updatedOrder = payload.new as OrderRow;
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === updatedOrder.id
                    ? {
                        ...o,
                        ...updatedOrder,
                        branch: branchesList.find((b) => b.id === updatedOrder.branch_id) || o.branch || null,
                        offer: offersList.find((of) => of.id === updatedOrder.offer_id) || o.offer || null,
                      }
                    : o
                )
              );
              setSelectedOrder((prev) =>
                prev?.id === updatedOrder.id ? { ...prev, ...updatedOrder } : prev
              );
              fetchItemsWithRetries(updatedOrder.id);
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
            if (!isMounted) return;
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const c = payload.new as any;
              if (c.status === 'open') {
                setOpenComplaints((prev) => {
                  const exists = prev.some((x) => x.id === c.id);
                  if (exists) return prev.map((x) => (x.id === c.id ? c : x));
                  return [c, ...prev];
                });
              } else {
                setOpenComplaints((prev) => prev.filter((x) => x.id !== c.id));
              }

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
          if (!isMounted) return;
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`Realtime channel status: ${status}`, err);
            // Keep badge active since 4-second live background sync is always running
            setIsRealtimeActive(true);
          }
        });
    };

    setupRealtime();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Run background sync every 4 seconds + when tab regains focus/visibility
    const pollInterval = setInterval(syncLatestOrders, 4000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncLatestOrders();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      retryTimers.forEach(clearTimeout);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      authListener.subscription.unsubscribe();
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
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

  const matchesDateRange = useCallback(
    (dateStr: string): boolean => {
      if (dateFilter === 'all') return true;
      const itemDate = parseOrderDate(dateStr);
      const now = new Date();
      const isVeryRecent = Math.abs(now.getTime() - itemDate.getTime()) < 3 * 60 * 60 * 1000;

      if (dateFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return isVeryRecent || (itemDate >= startOfToday && itemDate <= endOfToday);
      }
      if (dateFilter === 'yesterday') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        return itemDate >= startOfYesterday && itemDate < startOfToday;
      }
      if (dateFilter === 'last_7_days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= sevenDaysAgo;
      }
      return true;
    },
    [dateFilter]
  );

  // Pair pending modification orders with their original orders
  const modificationRequests = useMemo<ModificationRequestPair[]>(() => {
    const pendingMods = orders.filter(
      (o) =>
        isPendingModificationRequest(o) &&
        matchesDateRange(o.created_at) &&
        (selectedBranchId === 'all' || o.branch_id === selectedBranchId)
    );
    return pendingMods.map((modOrder) => {
      const modTime = new Date(modOrder.created_at).getTime();
      const cleanModPhone = (modOrder.customer_phone || '').replace(/\D/g, '').slice(-9);

      const candidates = orders.filter((cand) => {
        if (cand.id === modOrder.id) return false;
        if (isOrderCancelled(cand) || isMergedOrDeclinedModOrder(cand) || isPendingModificationRequest(cand)) {
          return false;
        }
        const candTime = new Date(cand.created_at).getTime();
        if (candTime > modTime) return false;
        // Within 18 hours before the modification request
        if (modTime - candTime > 18 * 60 * 60 * 1000) return false;

        const sameContact = Boolean(modOrder.contact_id && cand.contact_id === modOrder.contact_id);
        const cleanCandPhone = (cand.customer_phone || '').replace(/\D/g, '').slice(-9);
        const samePhone = Boolean(cleanModPhone.length >= 8 && cleanModPhone === cleanCandPhone);

        return sameContact || samePhone;
      });

      candidates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return {
        modOrder,
        originalOrder: candidates[0] || null,
      };
    });
  }, [orders, matchesDateRange, selectedBranchId]);

  // Pair open customer cancellation requests from complaints with their active orders
  const cancellationRequests = useMemo<CancellationRequestItem[]>(() => {
    const cancelComplaints = openComplaints.filter(
      (c) => isCustomerCancellationComplaint(c) && matchesDateRange(c.created_at)
    );
    const items: CancellationRequestItem[] = [];

    for (const complaint of cancelComplaints) {
      const cleanCompPhone = (complaint.customer_phone || '').replace(/\D/g, '').slice(-9);
      let linkedOrder: OrderWithItems | null = null;

      if (complaint.order_id) {
        linkedOrder = orders.find((o) => o.id === complaint.order_id) || null;
      }

      if (!linkedOrder) {
        const candidates = orders.filter((cand) => {
          if (isOrderCancelled(cand) || isMergedOrDeclinedModOrder(cand)) return false;
          const sameContact = Boolean(
            complaint.contact_id && cand.contact_id === complaint.contact_id
          );
          const cleanCandPhone = (cand.customer_phone || '').replace(/\D/g, '').slice(-9);
          const samePhone = Boolean(
            cleanCompPhone.length >= 8 && cleanCompPhone === cleanCandPhone
          );
          return sameContact || samePhone;
        });

        candidates.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        linkedOrder = candidates[0] || null;
      }

      // If the linked order is already cancelled, hide from pending cancellation requests
      if (linkedOrder && isOrderCancelled(linkedOrder)) {
        continue;
      }

      if (selectedBranchId !== 'all' && linkedOrder && linkedOrder.branch_id !== selectedBranchId) {
        continue;
      }

      items.push({
        complaint,
        linkedOrder,
      });
    }

    return items;
  }, [openComplaints, orders, matchesDateRange, selectedBranchId]);

  // Filtered orders based on Search, Date, Branch, Offer, and optional Customer Filter
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Hide merged or declined modification rows from the board
      if (isMergedOrDeclinedModOrder(order)) {
        return false;
      }

      // If viewing a specific customer's orders (from Complaints), match only their orders
      if (customerFilter) {
        const matchContact =
          customerFilter.contactId && order.contact_id === customerFilter.contactId;
        const cleanFilterPhone = (customerFilter.phone || '').replace(/\D/g, '');
        const cleanOrderPhone = (order.customer_phone || '').replace(/\D/g, '');
        const matchPhone =
          cleanFilterPhone.length >= 8 &&
          cleanOrderPhone.length >= 8 &&
          (cleanOrderPhone.includes(cleanFilterPhone) || cleanFilterPhone.includes(cleanOrderPhone));
        const matchName =
          !customerFilter.contactId &&
          !cleanFilterPhone &&
          customerFilter.customer &&
          order.customer_name?.trim().toLowerCase() === customerFilter.customer.trim().toLowerCase();

        if (!matchContact && !matchPhone && !matchName) {
          return false;
        }
        return true;
      }

      // Pending modification requests are shown in the dedicated Modification Requests section
      if (isPendingModificationRequest(order)) {
        return false;
      }

      if (isScheduledPaymentMethod(order.payment_method)) {
        return false;
      }
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
      if (!matchesDateRange(order.created_at)) {
        return false;
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
  }, [orders, searchQuery, dateFilter, selectedBranchId, selectedOfferId, customerFilter]);

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
  const handleAdvanceStatus = async (orderId: string, statusArg?: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || targetOrder.status === 'pending' || statusArg === 'pending' || statusArg === 'confirmed') {
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
  const [schedulingOrder, setSchedulingOrder] = useState<OrderWithItems | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const handleCancelOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const defaultMsg = interpolateOrderTemplate(orderTemplates.staff_cancel_order, {
      customer_name: targetOrder.customer_name,
      order_number: targetOrder.order_number,
      total_amount: targetOrder.total_amount,
    });

    setActionModalConfig({
      type: 'staff_cancel_order',
      title: `إلغاء الأوردر #${targetOrder.order_number} وإبلاغ العميل`,
      subtitle: 'اختر سبب الإلغاء أو عدّل نص الرسالة التي ستصل للعميل على ماسنجر',
      confirmButtonLabel: 'تأكيد إلغاء الطلب وإرسال الرسالة',
      confirmButtonVariant: 'rose',
      customerName: targetOrder.customer_name || 'العميل',
      orderNumber: targetOrder.order_number,
      totalAmount: targetOrder.total_amount,
      defaultMessage: defaultMsg,
      presets: orderTemplates.staff_cancel_presets,
      onConfirm: async ({ messageText, sendNotification, reasonNote }) => {
        const prevPaymentMethod = targetOrder.payment_method;
        setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: true }));

        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, payment_method: 'cancelled' } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, payment_method: 'cancelled' } : null));
        }

        try {
          const res = await fetch('/api/orders/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              messageText,
              sendNotification,
              reasonNote,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to cancel order');
          }
        } catch (err) {
          console.error('Error cancelling order:', err);
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, payment_method: prevPaymentMethod } : o))
          );
          if (selectedOrder?.id === orderId) {
            setSelectedOrder((prev) => (prev ? { ...prev, payment_method: prevPaymentMethod } : null));
          }
          alert('تعذر إلغاء الطلب. يرجى المحاولة مرة أخرى.');
        } finally {
          setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: false }));
        }
      },
    });
  };

  const handleApproveModification = (pair: ModificationRequestPair) => {
    const { modOrder, originalOrder } = pair;
    const displayOrderNum = originalOrder ? originalOrder.order_number : modOrder.order_number;
    const modSummary = extractModificationSummary(modOrder.customer_notes);

    const defaultMsg = interpolateOrderTemplate(orderTemplates.modification_approve, {
      customer_name: modOrder.customer_name,
      order_number: displayOrderNum,
      total_amount: modOrder.total_amount,
      modification_details: modSummary,
    });

    setActionModalConfig({
      type: 'modification_approve',
      title: `الموافقة على تعديل الأوردر #${displayOrderNum}`,
      subtitle: 'سيتم تحديث الأوردر الأصلي بالأصناف والإجمالي الجديد وإبلاغ العميل فوراً',
      confirmButtonLabel: 'موافقة وتحديث الأوردر وإرسال الرسالة',
      confirmButtonVariant: 'emerald',
      customerName: modOrder.customer_name || 'العميل',
      orderNumber: displayOrderNum,
      totalAmount: modOrder.total_amount,
      modificationDetails: modSummary,
      defaultMessage: defaultMsg,
      onConfirm: async ({ messageText, sendNotification }) => {
        setIsUpdatingOrder((prev) => ({
          ...prev,
          [modOrder.id]: true,
          ...(originalOrder ? { [originalOrder.id]: true } : {}),
        }));

        try {
          const res = await fetch('/api/orders/modification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'modification',
              action: 'approve',
              modOrderId: modOrder.id,
              originalOrderId: originalOrder?.id || null,
              messageText,
              sendNotification,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to approve modification');
          }

          setOrders((prev) =>
            prev.map((o) => {
              if (originalOrder && o.id === originalOrder.id) {
                const freshItems =
                  Array.isArray(data.updatedOrder?.order_items) &&
                  data.updatedOrder.order_items.length > 0
                    ? data.updatedOrder.order_items
                    : modOrder.order_items && modOrder.order_items.length > 0
                    ? modOrder.order_items
                    : o.order_items;
                const newBranchId = data.updatedOrder?.branch_id || modOrder.branch_id || o.branch_id;
                const newOfferId = data.updatedOrder?.offer_id || modOrder.offer_id || o.offer_id;
                return {
                  ...o,
                  ...(data.updatedOrder || {}),
                  order_items: freshItems,
                  branch: branchesList.find((b) => b.id === newBranchId) || o.branch || null,
                  offer: offersList.find((of) => of.id === newOfferId) || o.offer || null,
                  status: 'confirmed',
                };
              }
              if (o.id === modOrder.id) {
                return originalOrder
                  ? { ...o, payment_method: 'mod_merged', internal_notes: '[MOD_MERGED]' }
                  : {
                      ...o,
                      status: 'confirmed',
                      internal_notes: `${o.internal_notes || ''} | [MOD_APPROVED]`,
                    };
              }
              return o;
            })
          );
        } catch (err) {
          console.error('Error approving modification:', err);
          alert('تعذر اعتماد تعديل الأوردر. يرجى المحاولة مرة أخرى.');
        } finally {
          setIsUpdatingOrder((prev) => ({
            ...prev,
            [modOrder.id]: false,
            ...(originalOrder ? { [originalOrder.id]: false } : {}),
          }));
        }
      },
    });
  };

  const handleDeclineModification = (pair: ModificationRequestPair) => {
    const { modOrder, originalOrder } = pair;
    const displayOrderNum = originalOrder ? originalOrder.order_number : modOrder.order_number;
    const modSummary = extractModificationSummary(modOrder.customer_notes);

    const defaultMsg = interpolateOrderTemplate(orderTemplates.modification_decline, {
      customer_name: modOrder.customer_name,
      order_number: displayOrderNum,
      total_amount: modOrder.total_amount,
      modification_details: modSummary,
    });

    setActionModalConfig({
      type: 'modification_decline',
      title: `رفض تعديل الأوردر #${displayOrderNum}`,
      subtitle: 'سيبقى الأوردر الأصلي كما هو بدون تغيير وسيتم إبلاغ العميل بسبب الرفض',
      confirmButtonLabel: 'تأكيد رفض التعديل وإرسال الرسالة',
      confirmButtonVariant: 'rose',
      customerName: modOrder.customer_name || 'العميل',
      orderNumber: displayOrderNum,
      totalAmount: modOrder.total_amount,
      modificationDetails: modSummary,
      defaultMessage: defaultMsg,
      presets: orderTemplates.modification_decline_presets,
      onConfirm: async ({ messageText, sendNotification }) => {
        setIsUpdatingOrder((prev) => ({ ...prev, [modOrder.id]: true }));
        try {
          const res = await fetch('/api/orders/modification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'modification',
              action: 'decline',
              modOrderId: modOrder.id,
              originalOrderId: originalOrder?.id || null,
              messageText,
              sendNotification,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to decline modification');
          }

          setOrders((prev) =>
            prev.map((o) =>
              o.id === modOrder.id
                ? { ...o, payment_method: 'mod_declined', internal_notes: '[MOD_DECLINED]' }
                : o
            )
          );
        } catch (err) {
          console.error('Error declining modification:', err);
          alert('تعذر رفض التعديل. يرجى المحاولة مرة أخرى.');
        } finally {
          setIsUpdatingOrder((prev) => ({ ...prev, [modOrder.id]: false }));
        }
      },
    });
  };

  const handleApproveCancellation = (item: CancellationRequestItem) => {
    const { complaint, linkedOrder } = item;
    const displayOrderNum = linkedOrder ? linkedOrder.order_number : complaint.ticket_number;
    const custName = complaint.customer_name || linkedOrder?.customer_name || 'العميل';

    const defaultMsg = interpolateOrderTemplate(orderTemplates.cancellation_approve, {
      customer_name: custName,
      order_number: displayOrderNum,
      total_amount: linkedOrder?.total_amount || 0,
    });

    setActionModalConfig({
      type: 'cancellation_approve',
      title: `الموافقة على إلغاء الأوردر #${displayOrderNum}`,
      subtitle: 'سيتم تحويل الأوردر إلى ملغي وإغلاق تذكرة الإلغاء وإبلاغ العميل',
      confirmButtonLabel: 'موافقة وإلغاء الأوردر وإرسال الرسالة',
      confirmButtonVariant: 'emerald',
      customerName: custName,
      orderNumber: displayOrderNum,
      totalAmount: linkedOrder?.total_amount || 0,
      defaultMessage: defaultMsg,
      onConfirm: async ({ messageText, sendNotification }) => {
        setIsUpdatingOrder((prev) => ({
          ...prev,
          [complaint.id]: true,
          ...(linkedOrder ? { [linkedOrder.id]: true } : {}),
        }));

        try {
          const res = await fetch('/api/orders/modification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'cancellation',
              action: 'approve',
              complaintId: complaint.id,
              orderId: linkedOrder?.id || null,
              messageText,
              sendNotification,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to approve cancellation');
          }

          setOpenComplaints((prev) => prev.filter((c) => c.id !== complaint.id));
          if (linkedOrder) {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === linkedOrder.id ? { ...o, payment_method: 'cancelled' } : o
              )
            );
          }
        } catch (err) {
          console.error('Error approving cancellation:', err);
          alert('تعذر تنفيذ إلغاء الطلب. يرجى المحاولة مرة أخرى.');
        } finally {
          setIsUpdatingOrder((prev) => ({
            ...prev,
            [complaint.id]: false,
            ...(linkedOrder ? { [linkedOrder.id]: false } : {}),
          }));
        }
      },
    });
  };

  const handleDeclineCancellation = (item: CancellationRequestItem) => {
    const { complaint, linkedOrder } = item;
    const displayOrderNum = linkedOrder ? linkedOrder.order_number : complaint.ticket_number;
    const custName = complaint.customer_name || linkedOrder?.customer_name || 'العميل';

    const defaultMsg = interpolateOrderTemplate(orderTemplates.cancellation_decline, {
      customer_name: custName,
      order_number: displayOrderNum,
      total_amount: linkedOrder?.total_amount || 0,
    });

    setActionModalConfig({
      type: 'cancellation_decline',
      title: `رفض طلب إلغاء الأوردر #${displayOrderNum}`,
      subtitle: 'سيبقى الأوردر فعالاً كما هو وسيتم إبلاغ العميل بسبب عدم إمكانية الإلغاء',
      confirmButtonLabel: 'رفض الإلغاء وإرسال الرسالة للعميل',
      confirmButtonVariant: 'rose',
      customerName: custName,
      orderNumber: displayOrderNum,
      totalAmount: linkedOrder?.total_amount || 0,
      defaultMessage: defaultMsg,
      presets: orderTemplates.cancellation_decline_presets,
      onConfirm: async ({ messageText, sendNotification }) => {
        setIsUpdatingOrder((prev) => ({ ...prev, [complaint.id]: true }));
        try {
          const res = await fetch('/api/orders/modification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'cancellation',
              action: 'decline',
              complaintId: complaint.id,
              orderId: linkedOrder?.id || null,
              messageText,
              sendNotification,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to decline cancellation');
          }

          setOpenComplaints((prev) => prev.filter((c) => c.id !== complaint.id));
        } catch (err) {
          console.error('Error declining cancellation:', err);
          alert('تعذر رفض طلب الإلغاء. يرجى المحاولة مرة أخرى.');
        } finally {
          setIsUpdatingOrder((prev) => ({ ...prev, [complaint.id]: false }));
        }
      },
    });
  };

  const handleRestoreOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const prevPaymentMethod = targetOrder.payment_method;
    setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: true }));

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_method: 'cash' } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, payment_method: 'cash' } : null));
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: 'cash',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err) {
      console.error('Error restoring order:', err);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_method: prevPaymentMethod } : o))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, payment_method: prevPaymentMethod } : null));
      }
      alert('تعذر استعادة الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUpdatingOrder((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleConfirmSchedule = async (
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
      alert('تعذر جدولة الطلب. يرجى المحاولة مرة أخرى.');
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_method: encoded } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(null);
    }
  };

  const handlePrintReceipt = (order: OrderWithItems) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Summary Metrics calculations
  const activeOrders = useMemo(
    () => filteredOrders.filter((o) => !isOrderCancelled(o)),
    [filteredOrders]
  );
  const cancelledOrders = useMemo(
    () => filteredOrders.filter((o) => isOrderCancelled(o)),
    [filteredOrders]
  );
  const totalOrdersCount = activeOrders.length;
  const pendingCount = activeOrders.filter((o) => o.status !== 'confirmed').length;
  const confirmedCount = activeOrders.filter((o) => o.status === 'confirmed').length;
  const cancelledCount = cancelledOrders.length;
  const totalRevenue = activeOrders
    .filter((o) => o.status === 'confirmed')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Active Customer Orders Filter Banner (when navigated from Complaints) */}
      {customerFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/40 px-4 py-3.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                عرض جميع طلبات العميل:{' '}
                <span className="text-indigo-600 dark:text-indigo-400">
                  {customerFilter.customer || 'العميل'}
                </span>
                {customerFilter.phone && (
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 mr-2" dir="ltr">
                    ({customerFilter.phone})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                إجمالي الطلبات المسجلة لهذا العميل: <strong>{filteredOrders.length} طلب</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCustomerFilter(null);
              router.push('/dashboard/orders');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>إلغاء الفلتر وعرض كل الطلبات</span>
          </button>
        </div>
      )}

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

        {/* View Mode Toggle, Modification Requests, Message Templates & Show Cancelled Orders Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsTemplatesModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer shadow-2xs"
          >
            <MessageSquareText className="w-3.5 h-3.5 text-amber-500" />
            <span>قوالب رسائل الأوردرات</span>
          </button>

          {(modificationRequests.length > 0 || cancellationRequests.length > 0) && (
            <button
              type="button"
              onClick={() => setShowModificationSection((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                showModificationSection
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/20'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>
                طلبات التعديل والإلغاء ({modificationRequests.length + cancellationRequests.length})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCancelled((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showCancelled
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/20'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>
              {showCancelled
                ? `إخفاء الأوردرات الملغية (${cancelledCount})`
                : `إظهار الأوردرات الملغية (${cancelledCount})`}
            </span>
          </button>

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

      {/* Dedicated Modification & Customer Cancellation Requests Section */}
      {showModificationSection &&
        (modificationRequests.length > 0 || cancellationRequests.length > 0) && (
          <OrderModificationRequestsSection
            modificationRequests={modificationRequests}
            cancellationRequests={cancellationRequests}
            isUpdating={isUpdatingOrder}
            onApproveModification={handleApproveModification}
            onDeclineModification={handleDeclineModification}
            onApproveCancellation={handleApproveCancellation}
            onDeclineCancellation={handleDeclineCancellation}
            onSelectOrder={(ord) => setSelectedOrder(ord)}
          />
        )}

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

            {isLoadingHistory && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-[11px] font-bold whitespace-nowrap">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>جاري التحميل...</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Board View: Kanban or Table */}
      {viewMode === 'kanban' ? (
        <div className="space-y-5">
          {showCancelled && (
            <div className="rounded-3xl bg-white dark:bg-[#101726] border-2 border-rose-500/40 shadow-md overflow-hidden">
              <div className="p-4 border-b border-rose-500/20 bg-rose-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-500" />
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    الأوردرات الملغية ({cancelledOrders.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelled(false)}
                  className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
                >
                  إخفاء الأوردرات الملغية
                </button>
              </div>
              {cancelledOrders.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  لا توجد أوردرات ملغية حالياً
                </div>
              ) : (
                <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cancelledOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      complaints={complaintsMap[order.id] || []}
                      onSelectOrder={(ord) => setSelectedOrder(ord)}
                      onAdvanceStatus={handleAdvanceStatus}
                      onPrintReceipt={handlePrintReceipt}
                      onScheduleOrder={(ord) => setSchedulingOrder(ord)}
                      onCancelOrder={handleCancelOrder}
                      onRestoreOrder={handleRestoreOrder}
                      isUpdating={isUpdatingOrder[order.id]}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {KANBAN_COLUMNS.map((column) => {
              const columnOrders = activeOrders.filter((order) => {
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
                          onScheduleOrder={(ord) => setSchedulingOrder(ord)}
                          onCancelOrder={handleCancelOrder}
                          onRestoreOrder={handleRestoreOrder}
                          isUpdating={isUpdatingOrder[order.id]}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed Table View */
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl overflow-hidden">
          {showCancelled && (
            <div className="px-4 py-3 border-b border-rose-500/20 bg-rose-500/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-extrabold text-rose-600 dark:text-rose-400">
                <Ban className="w-4 h-4" />
                <span>يتم الآن عرض الأوردرات الملغية ({cancelledOrders.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelled(false)}
                className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
              >
                العودة للطلبات النشطة
              </button>
            </div>
          )}
          <div className="w-full">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-950/70">
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">رقم الطلب والفرع</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">التاريخ والوقت</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">العميل والهاتف</th>
                  <th className="py-3 px-3 font-semibold">العنوان</th>
                  <th className="py-3 px-3 font-semibold">الأصناف والملاحظات</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">الإجمالي</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">الحالة</th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(showCancelled ? cancelledOrders : activeOrders).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      {showCancelled ? 'لا توجد أوردرات ملغية حالياً' : 'لا توجد طلبات مطابقة لمعايير البحث'}
                    </td>
                  </tr>
                ) : (
                  (showCancelled ? cancelledOrders : activeOrders).map((order) => {
                    const isCancelled = isOrderCancelled(order);
                    const badge = getOrderStatusBadge(order.status, order.payment_method);
                    const totalItems = (order.order_items || []).reduce(
                      (acc, it) => acc + (it.quantity || 1),
                      0
                    );
                    const itemsSummary = (order.order_items || [])
                      .map((it) => `${it.quantity}x ${it.item_name}${it.notes ? ` (${it.notes})` : ''}`)
                      .join('، ');

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer align-top"
                        onClick={() => setSelectedOrder(order)}
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
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {order.customer_name || '-'}
                          </div>
                          {order.customer_phone && (
                            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" dir="ltr">
                              {order.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-normal break-words leading-relaxed min-w-[170px]">
                          {order.delivery_address || '-'}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-normal break-words leading-relaxed min-w-[180px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {itemsSummary || `${totalItems} أصناف`}
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
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => setSchedulingOrder(order)}
                                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 transition-colors cursor-pointer"
                                title="جدولة الطلب 📅"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(order)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                              title="طباعة إيصال الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            </button>

                            {!isCancelled && order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleConfirmOrder(order.id)}
                                disabled={isUpdatingOrder[order.id]}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                {isUpdatingOrder[order.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>تأكيد</span>
                              </button>
                            )}

                            {!isCancelled ? (
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={isUpdatingOrder[order.id]}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition-colors cursor-pointer"
                                title="إلغاء الطلب"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreOrder(order.id)}
                                disabled={isUpdatingOrder[order.id]}
                                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="استعادة الطلب"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>استعادة</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
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
        onScheduleOrder={(ord) => setSchedulingOrder(ord)}
        onCancelOrder={handleCancelOrder}
        onRestoreOrder={handleRestoreOrder}
      />

      {/* Schedule Order Modal */}
      <ScheduleOrderModal
        order={schedulingOrder}
        isOpen={Boolean(schedulingOrder)}
        onClose={() => setSchedulingOrder(null)}
        onConfirmSchedule={handleConfirmSchedule}
      />

      {/* Action Message Preview Modal (Approve/Decline Modification, Approve/Decline Cancellation, Staff Cancel) */}
      <OrderActionMessageModal
        config={actionModalConfig}
        onClose={() => setActionModalConfig(null)}
      />

      {/* Editable Order Message Templates Modal */}
      <OrderTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        initialTemplates={orderTemplates}
        onSaved={(updated) => setOrderTemplates(updated)}
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
