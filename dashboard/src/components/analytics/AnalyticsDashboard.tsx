'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Building2,
  Flame,
  Tag,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Ban,
  CalendarClock,
  Download,
  Users,
  Bot,
  MessageSquare,
  Award,
  DollarSign,
  Truck,
  Utensils,
  Sparkles,
  Filter,
  RotateCcw,
  Phone,
  MessageCircle,
} from 'lucide-react';
import {
  formatCurrency,
  formatDateTime,
  isOrderCancelled,
  normalizeOrderPricing,
} from '@/lib/utils';
import { isScheduledPaymentMethod } from '@/lib/scheduled-orders';
import {
  isMergedOrDeclinedModOrder,
  isPendingModificationRequest,
} from '@/lib/order-templates';
import { OrderWithItems } from '@/components/orders/types';

interface BranchInfo {
  id: string;
  name: string;
  address?: string;
  is_active?: boolean;
}

interface OfferInfo {
  id: string;
  title: string;
  price_after?: number | null;
  is_active?: boolean;
}

interface ComplaintInfo {
  id: string;
  ticket_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  issue_description: string;
  status: 'open' | 'resolved';
  order_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface ContactInfo {
  id: string;
  ai_enabled: boolean;
  needs_human: boolean;
  platform: string;
  created_at: string;
}

interface CommentEventInfo {
  id: string;
  decision: string;
  dm_sent: boolean;
  created_at: string;
}

interface AnalyticsDashboardProps {
  initialOrders: OrderWithItems[];
  branches: BranchInfo[];
  offers: OfferInfo[];
  complaints: ComplaintInfo[];
  contacts: ContactInfo[];
  messageStats: {
    botCount: number;
    agentCount: number;
    userCount: number;
  };
  commentEvents: CommentEventInfo[];
}

type DatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'all' | 'custom';
type RevenueBasis = 'all_active' | 'confirmed_only';

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function getCairoDateParts(isoStr: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  dayOfWeek: number;
  dateKey: string;
} {
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      dateKey: now.toISOString().slice(0, 10),
    };
  }

  // Format in Africa/Cairo
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value || 1);
  let hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  if (hour === 24) hour = 0;

  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const cairoLocalDate = new Date(year, month - 1, day);
  const dayOfWeek = cairoLocalDate.getDay();

  return { year, month, day, hour, dayOfWeek, dateKey };
}

export function AnalyticsDashboard({
  initialOrders,
  branches,
  offers,
  complaints,
  contacts,
  messageStats,
  commentEvents,
}: AnalyticsDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedOfferFilter, setSelectedOfferFilter] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [revenueBasis, setRevenueBasis] = useState<RevenueBasis>('all_active');

  // Current Cairo date parts
  const nowParts = useMemo(() => getCairoDateParts(new Date().toISOString()), []);

  // Helper to check if an ISO timestamp falls within the active date filter
  const matchesDateFilter = useMemo(() => {
    return (isoStr: string) => {
      if (datePreset === 'all') return true;
      const itemParts = getCairoDateParts(isoStr);
      const itemDateMs = new Date(itemParts.year, itemParts.month - 1, itemParts.day).getTime();
      const todayMs = new Date(nowParts.year, nowParts.month - 1, nowParts.day).getTime();

      if (datePreset === 'today') {
        return itemParts.dateKey === nowParts.dateKey;
      }
      if (datePreset === 'yesterday') {
        const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;
        return itemDateMs === yesterdayMs;
      }
      if (datePreset === 'last_7_days') {
        const sevenDaysAgoMs = todayMs - 6 * 24 * 60 * 60 * 1000;
        return itemDateMs >= sevenDaysAgoMs && itemDateMs <= todayMs;
      }
      if (datePreset === 'last_30_days') {
        const thirtyDaysAgoMs = todayMs - 29 * 24 * 60 * 60 * 1000;
        return itemDateMs >= thirtyDaysAgoMs && itemDateMs <= todayMs;
      }
      if (datePreset === 'this_month') {
        return itemParts.year === nowParts.year && itemParts.month === nowParts.month;
      }
      if (datePreset === 'custom') {
        if (customStartDate && itemParts.dateKey < customStartDate) return false;
        if (customEndDate && itemParts.dateKey > customEndDate) return false;
        return true;
      }
      return true;
    };
  }, [datePreset, customStartDate, customEndDate, nowParts]);

  // Helper to detect if an order contains an offer (either via offer_id or item name matching an offer)
  const getOrderMatchedOffers = useMemo(() => {
    return (order: OrderWithItems): OfferInfo[] => {
      const matched: OfferInfo[] = [];
      const seenIds = new Set<string>();

      if (order.offer_id) {
        const found = offers.find((o) => o.id === order.offer_id);
        if (found) {
          matched.push(found);
          seenIds.add(found.id);
        }
      }

      for (const item of order.order_items || []) {
        const iName = (item.item_name || '').trim().toLowerCase();
        if (!iName) continue;
        for (const off of offers) {
          if (seenIds.has(off.id)) continue;
          const oTitle = off.title.trim().toLowerCase();
          // Match exact or core offer name (e.g. "عرض حدائق أكتوبر", "عرض الصفقة 1", "عرض سوبر ستار")
          const shortTitle = oTitle.split('—')[0].split('-')[0].trim();
          if (
            iName.includes(oTitle) ||
            oTitle.includes(iName) ||
            (shortTitle.length >= 8 && iName.includes(shortTitle)) ||
            iName.startsWith('عرض ')
          ) {
            if (
              iName.includes(oTitle) ||
              oTitle.includes(iName) ||
              (shortTitle.length >= 8 && iName.includes(shortTitle))
            ) {
              matched.push(off);
              seenIds.add(off.id);
            }
          }
        }
      }
      return matched;
    };
  }, [offers]);

  // 1. Filter Orders by Date, Branch, Offer, Source
  const periodOrders = useMemo(() => {
    return initialOrders.filter((order) => {
      if (isMergedOrDeclinedModOrder(order)) return false;
      if (isPendingModificationRequest(order)) return false;
      if (!matchesDateFilter(order.created_at)) return false;

      if (selectedBranchId !== 'all' && order.branch_id !== selectedBranchId) {
        return false;
      }

      if (selectedSource !== 'all' && order.source !== selectedSource) {
        return false;
      }

      if (selectedOfferFilter !== 'all') {
        const matchedOffers = getOrderMatchedOffers(order);
        const hasAnyOffer =
          Boolean(order.offer_id) ||
          matchedOffers.length > 0 ||
          (order.order_items || []).some((i) => (i.item_name || '').includes('عرض'));

        if (selectedOfferFilter === 'has_offer') {
          if (!hasAnyOffer) return false;
        } else if (selectedOfferFilter === 'no_offer') {
          if (hasAnyOffer) return false;
        } else {
          const matchesSpecific =
            order.offer_id === selectedOfferFilter ||
            matchedOffers.some((m) => m.id === selectedOfferFilter);
          if (!matchesSpecific) return false;
        }
      }

      return true;
    });
  }, [
    initialOrders,
    matchesDateFilter,
    selectedBranchId,
    selectedSource,
    selectedOfferFilter,
    getOrderMatchedOffers,
  ]);

  // Filter complaints in the same period (and branch if linked to an order)
  const periodComplaints = useMemo(() => {
    const orderBranchMap = new Map(initialOrders.map((o) => [o.id, o.branch_id]));
    return complaints.filter((c) => {
      if (!matchesDateFilter(c.created_at)) return false;
      if (selectedBranchId !== 'all' && c.order_id) {
        const bId = orderBranchMap.get(c.order_id);
        if (bId && bId !== selectedBranchId) return false;
      }
      return true;
    });
  }, [complaints, initialOrders, matchesDateFilter, selectedBranchId]);

  // 2. Categorize Orders & Compute Financial Metrics
  const financialStats = useMemo(() => {
    const cancelledOrders = periodOrders.filter((o) => isOrderCancelled(o));
    const scheduledOrders = periodOrders.filter(
      (o) => !isOrderCancelled(o) && isScheduledPaymentMethod(o.payment_method)
    );
    const activeOrders = periodOrders.filter((o) => !isOrderCancelled(o));
    const confirmedOrders = activeOrders.filter((o) => o.status === 'confirmed');
    const pendingOrders = activeOrders.filter((o) => o.status !== 'confirmed');

    // Orders used for main sales analysis based on revenueBasis toggle
    const targetOrders = revenueBasis === 'confirmed_only' ? confirmedOrders : activeOrders;

    let totalSales = 0;
    let totalFoodSubtotal = 0;
    let totalDeliveryFees = 0;
    let totalItemsSold = 0;
    let highestOrderValue = 0;
    let offersOrdersSales = 0;
    let regularMenuOrdersSales = 0;
    let offersOrdersCount = 0;
    let regularMenuOrdersCount = 0;

    for (const o of targetOrders) {
      const norm = normalizeOrderPricing(o);
      totalSales += norm.totalAmount;
      totalFoodSubtotal += norm.displaySubtotal;
      totalDeliveryFees += norm.deliveryFee;

      if (norm.totalAmount > highestOrderValue) {
        highestOrderValue = norm.totalAmount;
      }

      const itemQtySum = norm.items.reduce((s, it) => s + it.normalizedQty, 0);
      totalItemsSold += itemQtySum;

      // Check if order has offer items or offer_id
      const hasOffer =
        Boolean(o.offer_id) ||
        getOrderMatchedOffers(o).length > 0 ||
        norm.items.some((it) => (it.item_name || '').includes('عرض'));

      if (hasOffer) {
        offersOrdersSales += norm.totalAmount;
        offersOrdersCount += 1;
      } else {
        regularMenuOrdersSales += norm.totalAmount;
        regularMenuOrdersCount += 1;
      }
    }

    const confirmedSalesTotal = confirmedOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const pendingSalesTotal = pendingOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const cancelledSalesTotal = cancelledOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const scheduledSalesTotal = scheduledOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );

    const avgOrderValue = targetOrders.length > 0 ? totalSales / targetOrders.length : 0;
    const avgDeliveryFee =
      targetOrders.filter((o) => (Number(o.delivery_fee) || 0) > 0).length > 0
        ? totalDeliveryFees /
          targetOrders.filter((o) => (Number(o.delivery_fee) || 0) > 0).length
        : 0;
    const cancellationRate =
      periodOrders.length > 0 ? (cancelledOrders.length / periodOrders.length) * 100 : 0;

    return {
      totalAllCount: periodOrders.length,
      activeCount: activeOrders.length,
      confirmedCount: confirmedOrders.length,
      pendingCount: pendingOrders.length,
      cancelledCount: cancelledOrders.length,
      scheduledCount: scheduledOrders.length,
      targetOrders,
      totalSales,
      totalFoodSubtotal,
      totalDeliveryFees,
      confirmedSalesTotal,
      pendingSalesTotal,
      cancelledSalesTotal,
      scheduledSalesTotal,
      totalItemsSold,
      avgOrderValue,
      avgDeliveryFee,
      highestOrderValue,
      cancellationRate,
      offersOrdersSales,
      regularMenuOrdersSales,
      offersOrdersCount,
      regularMenuOrdersCount,
    };
  }, [periodOrders, revenueBasis, getOrderMatchedOffers]);

  // 3. Ranked Top-Selling Branches Analysis (أكثر الفروع مبيعاً بالترتيب)
  const branchLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        ordersCount: number;
        confirmedCount: number;
        pendingCount: number;
        cancelledCount: number;
        foodSubtotal: number;
        deliveryFees: number;
        totalRevenue: number;
        itemsSold: number;
      }
    >();

    for (const b of branches) {
      map.set(b.id, {
        id: b.id,
        name: b.name,
        ordersCount: 0,
        confirmedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        foodSubtotal: 0,
        deliveryFees: 0,
        totalRevenue: 0,
        itemsSold: 0,
      });
    }

    for (const o of periodOrders) {
      const bId = o.branch_id || 'unassigned';
      const bName = o.branch?.name || branches.find((b) => b.id === o.branch_id)?.name || 'غير محدد الفرع';

      if (!map.has(bId)) {
        map.set(bId, {
          id: bId,
          name: bName,
          ordersCount: 0,
          confirmedCount: 0,
          pendingCount: 0,
          cancelledCount: 0,
          foodSubtotal: 0,
          deliveryFees: 0,
          totalRevenue: 0,
          itemsSold: 0,
        });
      }

      const entry = map.get(bId)!;
      if (isOrderCancelled(o)) {
        entry.cancelledCount += 1;
        continue;
      }

      if (o.status === 'confirmed') {
        entry.confirmedCount += 1;
      } else {
        entry.pendingCount += 1;
      }

      if (revenueBasis === 'confirmed_only' && o.status !== 'confirmed') {
        continue;
      }

      const norm = normalizeOrderPricing(o);
      entry.ordersCount += 1;
      entry.foodSubtotal += norm.displaySubtotal;
      entry.deliveryFees += norm.deliveryFee;
      entry.totalRevenue += norm.totalAmount;
      entry.itemsSold += norm.items.reduce((s, it) => s + it.normalizedQty, 0);
    }

    return Array.from(map.values())
      .filter((b) => b.ordersCount > 0 || b.cancelledCount > 0 || branches.some((br) => br.id === b.id))
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.ordersCount - a.ordersCount);
  }, [periodOrders, branches, revenueBasis]);

  // 4. Ranked Top-Selling Offers Leaderboard (أكثر العروض مبيعاً بالترتيب)
  const offersLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        title: string;
        unitPrice: number;
        ordersCount: number;
        quantitySold: number;
        totalRevenue: number;
      }
    >();

    for (const o of financialStats.targetOrders) {
      const norm = normalizeOrderPricing(o);
      const countedInThisOrder = new Set<string>();

      // Check each item in the order to see if it's an offer item
      let matchedAnyItem = false;
      for (const item of norm.items) {
        const rawName = (item.item_name || '').trim();
        if (!rawName) continue;

        // Match against known offers first
        const lowerName = rawName.toLowerCase();
        let matchedOffer = offers.find((off) => {
          const oTitle = off.title.trim().toLowerCase();
          const shortTitle = oTitle.split('—')[0].split('-')[0].trim();
          return (
            lowerName.includes(oTitle) ||
            oTitle.includes(lowerName) ||
            (shortTitle.length >= 8 && lowerName.includes(shortTitle))
          );
        });

        if (!matchedOffer && o.offer_id && norm.items.length === 1) {
          matchedOffer = offers.find((off) => off.id === o.offer_id);
        }

        const isOfferItem = Boolean(matchedOffer) || rawName.includes('عرض');
        if (isOfferItem) {
          matchedAnyItem = true;
          const key = matchedOffer ? matchedOffer.id : rawName;
          const title = matchedOffer ? matchedOffer.title : rawName;
          const existing = map.get(key) || {
            key,
            title,
            unitPrice: Number(matchedOffer?.price_after) || item.normalizedUnitPrice || 0,
            ordersCount: 0,
            quantitySold: 0,
            totalRevenue: 0,
          };

          if (!countedInThisOrder.has(key)) {
            existing.ordersCount += 1;
            countedInThisOrder.add(key);
          }
          existing.quantitySold += item.normalizedQty;
          existing.totalRevenue += item.normalizedLineTotal || norm.displaySubtotal;
          if (!existing.unitPrice && item.normalizedUnitPrice > 0) {
            existing.unitPrice = item.normalizedUnitPrice;
          }
          map.set(key, existing);
        }
      }

      // If order has offer_id but no individual item matched
      if (!matchedAnyItem && o.offer_id) {
        const matchedOffer = offers.find((off) => off.id === o.offer_id);
        if (matchedOffer) {
          const existing = map.get(matchedOffer.id) || {
            key: matchedOffer.id,
            title: matchedOffer.title,
            unitPrice: Number(matchedOffer.price_after) || 0,
            ordersCount: 0,
            quantitySold: 0,
            totalRevenue: 0,
          };
          existing.ordersCount += 1;
          existing.quantitySold += 1;
          existing.totalRevenue += norm.displaySubtotal;
          map.set(matchedOffer.id, existing);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue || b.quantitySold - a.quantitySold
    );
  }, [financialStats.targetOrders, offers]);

  // 5. Ranked Top-Selling Menu Items / Meals (أكثر الأصناف والوجبات مبيعاً بالترتيب)
  const itemsLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        quantitySold: number;
        ordersCount: number;
        totalRevenue: number;
        unitPrice: number;
      }
    >();

    for (const o of financialStats.targetOrders) {
      const norm = normalizeOrderPricing(o);
      const seenInOrder = new Set<string>();

      for (const it of norm.items) {
        // Clean item name (strip trailing (سبايسي)/(عادي) variation so same item groups cleanly)
        const cleanName = (it.item_name || 'وجبة')
          .replace(/\s*\((?:سبايسي|اسبايسي|عادي|حار)\)\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const existing = map.get(cleanName) || {
          name: cleanName,
          quantitySold: 0,
          ordersCount: 0,
          totalRevenue: 0,
          unitPrice: it.normalizedUnitPrice || 0,
        };

        if (!seenInOrder.has(cleanName)) {
          existing.ordersCount += 1;
          seenInOrder.add(cleanName);
        }
        existing.quantitySold += it.normalizedQty;
        existing.totalRevenue += it.normalizedLineTotal;
        if (!existing.unitPrice && it.normalizedUnitPrice > 0) {
          existing.unitPrice = it.normalizedUnitPrice;
        }
        map.set(cleanName, existing);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold || b.totalRevenue - a.totalRevenue
    );
  }, [financialStats.targetOrders]);

  // 6. Time-Series & Behavioral Charts (Daily Trend, Peak Hours, Days of Week, Spicy vs Regular)
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { dateKey: string; revenue: number; orders: number }>();
    const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: 0,
      revenue: 0,
    }));
    const weekdayCounts = Array.from({ length: 7 }, (_, day) => ({
      day,
      label: ARABIC_DAYS[day],
      orders: 0,
      revenue: 0,
    }));

    let spicyCount = 0;
    let regularCount = 0;
    let mixedCount = 0;

    for (const o of financialStats.targetOrders) {
      const norm = normalizeOrderPricing(o);
      const parts = getCairoDateParts(o.created_at);

      // Daily
      const dEntry = dailyMap.get(parts.dateKey) || {
        dateKey: parts.dateKey,
        revenue: 0,
        orders: 0,
      };
      dEntry.revenue += norm.totalAmount;
      dEntry.orders += 1;
      dailyMap.set(parts.dateKey, dEntry);

      // Hourly
      if (hourlyCounts[parts.hour]) {
        hourlyCounts[parts.hour].orders += 1;
        hourlyCounts[parts.hour].revenue += norm.totalAmount;
      }

      // Day of week
      if (weekdayCounts[parts.dayOfWeek]) {
        weekdayCounts[parts.dayOfWeek].orders += 1;
        weekdayCounts[parts.dayOfWeek].revenue += norm.totalAmount;
      }

      // Spicy vs Regular
      const combinedText = [
        o.customer_notes || '',
        ...(o.order_items || []).map((i) => `${i.item_name || ''} ${i.notes || ''}`),
      ]
        .join(' ')
        .toLowerCase();

      const hasSpicy =
        combinedText.includes('سبايسي') ||
        combinedText.includes('اسبايسي') ||
        combinedText.includes('حار');
      const hasRegular = combinedText.includes('عادي') || combinedText.includes('بارد');

      if (hasSpicy && hasRegular) {
        mixedCount += 1;
      } else if (hasSpicy) {
        spicyCount += 1;
      } else if (hasRegular) {
        regularCount += 1;
      }
    }

    const dailySeries = Array.from(dailyMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
    );

    return {
      dailySeries,
      hourlyCounts,
      weekdayCounts,
      spicyCount,
      regularCount,
      mixedCount,
    };
  }, [financialStats.targetOrders]);

  // 7. Top VIP Customers Leaderboard
  const vipCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        phone: string;
        contactId: string | null;
        ordersCount: number;
        totalSpent: number;
        lastOrderAt: string;
      }
    >();

    for (const o of financialStats.targetOrders) {
      const cleanPhone = (o.customer_phone || '').replace(/\D/g, '');
      const key = cleanPhone || o.contact_id || o.customer_name || o.id;
      const norm = normalizeOrderPricing(o);

      const existing = map.get(key) || {
        key,
        name: o.customer_name || 'عميل',
        phone: o.customer_phone || '-',
        contactId: o.contact_id || null,
        ordersCount: 0,
        totalSpent: 0,
        lastOrderAt: o.created_at,
      };

      existing.ordersCount += 1;
      existing.totalSpent += norm.totalAmount;
      if (new Date(o.created_at) > new Date(existing.lastOrderAt)) {
        existing.lastOrderAt = o.created_at;
        if (o.customer_name) existing.name = o.customer_name;
      }
      if (!existing.contactId && o.contact_id) {
        existing.contactId = o.contact_id;
      }
      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalSpent - a.totalSpent || b.ordersCount - a.ordersCount)
      .slice(0, 10);
  }, [financialStats.targetOrders]);

  // 8. Complaints & AI Bot Metrics
  const supportAndBotMetrics = useMemo(() => {
    const totalComplaints = periodComplaints.length;
    const resolvedComplaints = periodComplaints.filter((c) => c.status === 'resolved').length;
    const openComplaints = totalComplaints - resolvedComplaints;
    const resolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 100;

    // Average resolution time in minutes
    const resolvedWithTime = periodComplaints.filter(
      (c) => c.status === 'resolved' && c.resolved_at && c.created_at
    );
    const avgResolutionMinutes =
      resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, c) => {
            const diffMs =
              new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime();
            return sum + Math.max(1, Math.round(diffMs / 60000));
          }, 0) / resolvedWithTime.length
        : 0;

    const periodContacts = contacts.filter((c) => matchesDateFilter(c.created_at));
    const aiEnabledContacts = contacts.filter((c) => c.ai_enabled).length;
    const needsHumanContacts = contacts.filter((c) => c.needs_human).length;
    const botAutomationRate =
      messageStats.botCount + messageStats.agentCount > 0
        ? (messageStats.botCount / (messageStats.botCount + messageStats.agentCount)) * 100
        : 100;

    const periodComments = commentEvents.filter((c) => matchesDateFilter(c.created_at));
    const dmsSentFromComments = periodComments.filter((c) => c.dm_sent).length;

    return {
      totalComplaints,
      resolvedComplaints,
      openComplaints,
      resolutionRate,
      avgResolutionMinutes,
      totalContacts: contacts.length,
      newContactsInPeriod: periodContacts.length,
      aiEnabledContacts,
      needsHumanContacts,
      botAutomationRate,
      periodCommentsCount: periodComments.length,
      dmsSentFromComments,
    };
  }, [periodComplaints, contacts, messageStats, commentEvents, matchesDateFilter]);

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = [
      'رقم الطلب',
      'التاريخ والوقت',
      'اسم العميل',
      'رقم الهاتف',
      'الفرع',
      'العنوان',
      'الأصناف',
      'ملاحظات العميل',
      'صافي الوجبات (ج.م)',
      'رسوم التوصيل (ج.م)',
      'الإجمالي الكلي (ج.م)',
      'الحالة',
    ];

    const rows = periodOrders.map((o) => {
      const norm = normalizeOrderPricing(o);
      const statusLabel = isOrderCancelled(o)
        ? 'ملغي'
        : isScheduledPaymentMethod(o.payment_method)
        ? 'مجدول'
        : o.status === 'confirmed'
        ? 'مؤكد'
        : 'قيد الانتظار';
      const itemsText = norm.items
        .map((i) => `${i.normalizedQty}x ${i.item_name}`)
        .join(' + ');

      return [
        `#${o.order_number}`,
        formatDateTime(o.created_at),
        o.customer_name || '',
        o.customer_phone || '',
        o.branch?.name || 'غير محدد',
        o.delivery_address || '',
        itemsText,
        o.customer_notes || '',
        norm.displaySubtotal.toFixed(2),
        norm.deliveryFee.toFixed(2),
        norm.totalAmount.toFixed(2),
        statusLabel,
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_إحصائيات_تشيكن_مراعي_${nowParts.dateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedBranchId('all');
    setSelectedOfferFilter('all');
    setSelectedSource('all');
    setRevenueBasis('all_active');
  };

  const totalOffersRevenueSum = offersLeaderboard.reduce((s, o) => s + o.totalRevenue, 0);
  const maxDailyRevenue = Math.max(1, ...chartData.dailySeries.map((d) => d.revenue));
  const maxHourlyOrders = Math.max(1, ...chartData.hourlyCounts.map((h) => h.orders));
  const maxWeekdayRevenue = Math.max(1, ...chartData.weekdayCounts.map((w) => w.revenue));

  return (
    <div className="space-y-6">
      {/* 1. Page Header & CSV Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                لوحة الإحصائيات والتقارير المالية 📈
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                تحليل شامل للمبيعات المالية، ترتيب الفروع الأكثر مبيعاً، العروض، الأصناف، وساعات الذروة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير التقرير (Excel / CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Comprehensive Filter Bar */}
      <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>تخصيص وفلترة الإحصائيات:</span>
          </div>

          {/* Revenue Calculation Basis Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRevenueBasis('all_active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                revenueBasis === 'all_active'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              كل الطلبات النشطة ({financialStats.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setRevenueBasis('confirmed_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                revenueBasis === 'confirmed_only'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              المؤكدة فقط ({financialStats.confirmedCount})
            </button>
          </div>
        </div>

        {/* Date Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>الفترة الزمنية:</span>
          </span>

          {(
            [
              { id: 'all', label: 'كل الأوقات' },
              { id: 'today', label: 'اليوم' },
              { id: 'yesterday', label: 'أمس' },
              { id: 'last_7_days', label: 'آخر 7 أيام' },
              { id: 'last_30_days', label: 'آخر 30 يوم' },
              { id: 'this_month', label: 'هذا الشهر' },
              { id: 'custom', label: 'فترة مخصصة 📅' },
            ] as { id: DatePreset; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDatePreset(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                datePreset === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Inputs */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">من تاريخ:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">إلى تاريخ:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters Row: Branch, Offer, Source */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Branch Select */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold">فلترة حسب الفرع</div>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">
                  كل الفروع ({branches.length})
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Offer Select */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <Tag className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold">فلترة حسب العروض</div>
              <select
                value={selectedOfferFilter}
                onChange={(e) => setSelectedOfferFilter(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer truncate"
              >
                <option value="all" className="bg-white dark:bg-slate-900">
                  كل الطلبات (عروض + منيو)
                </option>
                <option value="has_offer" className="bg-white dark:bg-slate-900">
                  طلبات العروض الترويجية فقط 🔥
                </option>
                <option value="no_offer" className="bg-white dark:bg-slate-900">
                  طلبات المنيو العادي فقط 🍗
                </option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id} className="bg-white dark:bg-slate-900">
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Source Select */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold">القناة / المصدر</div>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">
                  كل القنوات
                </option>
                <option value="messenger" className="bg-white dark:bg-slate-900">
                  فيسبوك ماسنجر
                </option>
                <option value="whatsapp" className="bg-white dark:bg-slate-900">
                  واتساب
                </option>
                <option value="web" className="bg-white dark:bg-slate-900">
                  الموقع الإلكتروني
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Financial Overview & Executive KPI Cards (الإحصائيات المالية التفصيلية) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            الإحصائيات والتحليلات المالية التفصيلية 💰
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sales */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {revenueBasis === 'confirmed_only'
                  ? 'صافي المبيعات المؤكدة'
                  : 'إجمالي المبيعات النشطة'}
              </span>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {formatCurrency(financialStats.totalSales)}
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>مؤكد: {formatCurrency(financialStats.confirmedSalesTotal)}</span>
                <span>انتظار: {formatCurrency(financialStats.pendingSalesTotal)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Net Food Sales vs Delivery Fees */}
          <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                صافي مبيعات الوجبات (بدون توصيل)
              </span>
              <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Utensils className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(financialStats.totalFoodSubtotal)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                  <span>حصيلة التوصيل: {formatCurrency(financialStats.totalDeliveryFees)}</span>
                </span>
                <span>{financialStats.totalItemsSold} صنف مباع</span>
              </div>
            </div>
          </div>

          {/* Card 3: Average Order Value & Highest Order */}
          <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                متوسط قيمة الفاتورة (AOV)
              </span>
              <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                {formatCurrency(financialStats.avgOrderValue)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>أعلى أوردر: {formatCurrency(financialStats.highestOrderValue)}</span>
                <span>متوسط التوصيل: {formatCurrency(financialStats.avgDeliveryFee)}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Order Counts & Cancelled Value */}
          <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                إجمالي الطلبات وحالاتها
              </span>
              <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {financialStats.activeCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  طلب نشط ({financialStats.confirmedCount} مؤكد • {financialStats.pendingCount} انتظار)
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  ملغي: {financialStats.cancelledCount} ({formatCurrency(financialStats.cancelledSalesTotal)})
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  مجدول: {financialStats.scheduledCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Split Bar: Offers Sales vs Regular Menu Sales */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>مقارنة مبيعات العروض الترويجية مقابل المنيو العادي</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-amber-600 dark:text-amber-400">
                🔥 طلبات العروض: {formatCurrency(financialStats.offersOrdersSales)} ({financialStats.offersOrdersCount} طلب)
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                🍗 المنيو العادي: {formatCurrency(financialStats.regularMenuOrdersSales)} ({financialStats.regularMenuOrdersCount} طلب)
              </span>
            </div>
          </div>
          {(() => {
            const total = Math.max(
              1,
              financialStats.offersOrdersSales + financialStats.regularMenuOrdersSales
            );
            const offersPct = Math.round((financialStats.offersOrdersSales / total) * 100);
            const menuPct = 100 - offersPct;
            return (
              <div className="space-y-1.5">
                <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${offersPct}%` }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all"
                    title={`العروض: ${offersPct}%`}
                  />
                  <div
                    style={{ width: `${menuPct}%` }}
                    className="bg-blue-500 h-full transition-all"
                    title={`المنيو العادي: ${menuPct}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>نسبة مبيعات العروض: {offersPct}%</span>
                  <span>نسبة مبيعات المنيو العادي: {menuPct}%</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 4. Ranked Top-Selling Branches Analysis (ترتيب الفروع الأكثر مبيعاً 🏆) */}
      <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                ترتيب الفروع الأكثر مبيعاً 🏆
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مقارنة تفصيلية لمبيعات كل فرع، صافي الوجبات، التوصيل، ونسبة المساهمة من إجمالي المطعم
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/60">
                <th className="py-3 px-3 font-bold">الترتيب</th>
                <th className="py-3 px-3 font-bold">اسم الفرع</th>
                <th className="py-3 px-3 font-bold text-center">عدد الطلبات النشطة</th>
                <th className="py-3 px-3 font-bold">صافي الوجبات</th>
                <th className="py-3 px-3 font-bold">حصيلة التوصيل</th>
                <th className="py-3 px-3 font-bold">إجمالي المبيعات</th>
                <th className="py-3 px-3 font-bold">متوسط الفاتورة</th>
                <th className="py-3 px-3 font-bold min-w-[180px]">نسبة المساهمة من المبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {branchLeaderboard.map((b, idx) => {
                const sharePct =
                  financialStats.totalSales > 0
                    ? Math.round((b.totalRevenue / financialStats.totalSales) * 100)
                    : 0;
                const avgBranchOrder = b.ordersCount > 0 ? b.totalRevenue / b.ordersCount : 0;
                const rankMedal =
                  idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;

                return (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-3 font-black text-sm whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : idx === 2
                            ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {rankMedal}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                      {b.name}
                    </td>
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        {b.ordersCount}
                      </span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        ({b.confirmedCount} مؤكد • {b.pendingCount} انتظار
                        {b.cancelledCount > 0 ? ` • ${b.cancelledCount} ملغي` : ''})
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(b.foodSubtotal)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatCurrency(b.deliveryFees)}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(b.totalRevenue)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(avgBranchOrder)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${sharePct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          />
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 w-10 text-left">
                          {sharePct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Two-Column Ranked Leaderboards: Top Offers & Top Menu Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranked Top-Selling Offers (ترتيب العروض الأكثر مبيعاً 🔥) */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  أكثر العروض الترويجية مبيعاً بالترتيب 🔥
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مرتبة تنازلياً حسب إجمالي المبيعات وعدد مرات الطلب
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              {offersLeaderboard.length} عرض
            </span>
          </div>

          {offersLeaderboard.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              لا توجد مبيعات عروض مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
              {offersLeaderboard.map((off, idx) => {
                const sharePct =
                  totalOffersRevenueSum > 0
                    ? Math.round((off.totalRevenue / totalOffersRevenueSum) * 100)
                    : 0;
                const medal =
                  idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;

                return (
                  <div
                    key={off.key}
                    className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500 text-slate-950'
                              : idx === 1
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : idx === 2
                              ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {medal}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {off.title}
                        </span>
                      </div>

                      <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 shrink-0">
                        {formatCurrency(off.totalRevenue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                        <span>
                          الكمية المباعة: <strong className="text-slate-800 dark:text-slate-200">{off.quantitySold}</strong>
                        </span>
                        <span>
                          عدد الأوردرات: <strong className="text-slate-800 dark:text-slate-200">{off.ordersCount}</strong>
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {sharePct}% من مبيعات العروض
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${sharePct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranked Top-Selling Menu Items / Meals (الأصناف والوجبات الأكثر مبيعاً 🍗) */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  الأصناف والوجبات الأكثر مبيعاً بالترتيب 🍗
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ترتيب جميع الوجبات والإضافات حسب إجمالي الكميات المباعة والإيرادات
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              {itemsLeaderboard.length} صنف
            </span>
          </div>

          {itemsLeaderboard.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              لا توجد أصناف مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
              {itemsLeaderboard.slice(0, 15).map((item, idx) => {
                const maxQty = Math.max(1, itemsLeaderboard[0]?.quantitySold || 1);
                const barPct = Math.round((item.quantitySold / maxQty) * 100);
                const medal =
                  idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;

                return (
                  <div
                    key={item.name}
                    className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ${
                            idx === 0
                              ? 'bg-emerald-500 text-slate-950'
                              : idx === 1
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : idx === 2
                              ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {medal}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {item.name}
                        </span>
                      </div>

                      <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                        {formatCurrency(item.totalRevenue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        إجمالي الكمية المباعة:{' '}
                        <strong className="text-slate-900 dark:text-white">{item.quantitySold} قطعة / وجبة</strong>
                      </span>
                      <span>في {item.ordersCount} أوردر</span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${barPct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 6. Visual Charts Section: Daily Sales Trend, Peak Hours, Days of Week & Spicy vs Regular */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Trend Chart */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                منحنى المبيعات وعدد الطلبات اليومي 📊
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تطور المبيعات اليومية خلال الفترة المحددة
              </p>
            </div>
          </div>

          {chartData.dailySeries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              لا توجد بيانات مبيعات يومية لعرضها
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {chartData.dailySeries.map((day) => {
                const pct = Math.max(4, Math.round((day.revenue / maxDailyRevenue) * 100));
                return (
                  <div key={day.dateKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {day.dateKey}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 dark:text-slate-400">{day.orders} طلب</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(day.revenue)}
                        </span>
                      </div>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 24-Hour Peak Hours Distribution */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              ساعات الذروة على مدار اليوم (بتوقيت القاهرة) ⏰
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              أكثر الساعات نشاطاً في استقبال الطلبات لتجهيز طاقم المطبخ والطيارين
            </p>
          </div>

          <div className="grid grid-cols-12 gap-1.5 items-end h-44 pt-4 px-1 border-b border-slate-200 dark:border-slate-800">
            {chartData.hourlyCounts
              .filter((_, i) => i % 2 === 0 || chartData.hourlyCounts[i].orders > 0)
              .slice(0, 12)
              .map((slot) => {
                const heightPct = Math.max(8, Math.round((slot.orders / maxHourlyOrders) * 100));
                const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12;
                const ampm = slot.hour >= 12 ? 'م' : 'ص';
                return (
                  <div
                    key={slot.hour}
                    className="flex flex-col items-center justify-end h-full gap-1 group"
                    title={`${hour12} ${ampm}: ${slot.orders} طلب (${formatCurrency(slot.revenue)})`}
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                      {slot.orders > 0 ? slot.orders : ''}
                    </span>
                    <div
                      style={{ height: `${slot.orders > 0 ? heightPct : 4}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        slot.orders > 0
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-yellow-300'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    />
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                      {hour12}
                      {ampm}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Days of the Week Sales */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              أداء المبيعات حسب أيام الأسبوع 📅
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              معرفة أكثر أيام الأسبوع إقبالاً ومبيعاً
            </p>
          </div>

          <div className="space-y-2.5">
            {chartData.weekdayCounts.map((w) => {
              const pct =
                w.revenue > 0 ? Math.max(5, Math.round((w.revenue / maxWeekdayRevenue) * 100)) : 0;
              return (
                <div key={w.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{w.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 dark:text-slate-400">{w.orders} طلب</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(w.revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spicy vs Regular Preference + Bot & Support Summary */}
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              تفضيلات العملاء (سبايسي 🔥 مقابل عادي 🍗)
            </h3>
            {(() => {
              const totalPref = Math.max(
                1,
                chartData.spicyCount + chartData.regularCount + chartData.mixedCount
              );
              const spicyPct = Math.round((chartData.spicyCount / totalPref) * 100);
              const regPct = Math.round((chartData.regularCount / totalPref) * 100);
              const mixPct = Math.max(0, 100 - spicyPct - regPct);

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">سبايسي 🔥</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {chartData.spicyCount} ({spicyPct}%)
                      </div>
                    </div>
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">عادي 🍗</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {chartData.regularCount} ({regPct}%)
                      </div>
                    </div>
                    <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-3">
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400">ميكس (مشكل)</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {chartData.mixedCount} ({mixPct}%)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Complaints & Bot Performance Box */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-500" />
              <span>أداء البوت الآلي والشكاوى</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">نسبة أتمتة البوت</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {supportAndBotMetrics.botAutomationRate.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {messageStats.botCount} رد آلي مقابل {messageStats.agentCount} بشري
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">إجمالي الشكاوى</span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                  {supportAndBotMetrics.totalComplaints}
                </span>
                <span className="text-[10px] text-slate-400">
                  {supportAndBotMetrics.resolvedComplaints} محلولة • {supportAndBotMetrics.openComplaints} مفتوحة
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">نسبة حل الشكاوى</span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400 mt-1 block">
                  {supportAndBotMetrics.resolutionRate.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-400">
                  متوسط الحل: {Math.round(supportAndBotMetrics.avgResolutionMinutes)} د
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">تفاعل التعليقات</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                  {supportAndBotMetrics.periodCommentsCount}
                </span>
                <span className="text-[10px] text-slate-400">
                  {supportAndBotMetrics.dmsSentFromComments} رسالة خاصة مرسلة
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. VIP Customers Leaderboard (أكثر العملاء طلباً وإنفاقاً 👑) */}
      <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                قائمة كبار العملاء الأكثر طلباً وإنفاقاً (VIP) 👑
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أكثر 10 عملاء شراءً خلال الفترة المحددة مع إمكانية فتح طلباتهم أو محادثاتهم مباشرة
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/60">
                <th className="py-3 px-3 font-bold">الترتيب</th>
                <th className="py-3 px-3 font-bold">اسم العميل</th>
                <th className="py-3 px-3 font-bold">رقم الهاتف</th>
                <th className="py-3 px-3 font-bold text-center">عدد الطلبات</th>
                <th className="py-3 px-3 font-bold">إجمالي الإنفاق</th>
                <th className="py-3 px-3 font-bold">آخر طلب</th>
                <th className="py-3 px-3 font-bold text-center">روابط سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {vipCustomers.map((cust, idx) => (
                <tr key={cust.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-black">#{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{cust.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">
                    {cust.phone}
                  </td>
                  <td className="py-3 px-3 text-center font-black text-amber-600 dark:text-amber-400">
                    {cust.ordersCount} طلب
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(cust.totalSpent)}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                    {formatDateTime(cust.lastOrderAt)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/dashboard/orders?${
                          cust.contactId ? `contactId=${encodeURIComponent(cust.contactId)}&` : ''
                        }phone=${encodeURIComponent(cust.phone)}&customer=${encodeURIComponent(cust.name)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-[11px] transition"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>طلبات العميل</span>
                      </Link>
                      {cust.contactId && (
                        <Link
                          href={`/dashboard/chat?contactId=${encodeURIComponent(cust.contactId)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold text-[11px] transition"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>المحادثة</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
