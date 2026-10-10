import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  ShoppingBag,
  AlertTriangle,
  Sparkles,
  Bot,
  ArrowUpRight,
  TrendingUp,
  Clock,
  MessageSquare,
  UtensilsCrossed,
  Sliders,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  Calendar,
  Building2,
  DollarSign,
  Drumstick,
} from 'lucide-react';
import { formatCurrency, formatDateTime, getOrderStatusBadge, getComplaintStatusBadge } from '@/lib/utils';
import { OrderStatus } from '@/types/database.types';

export const revalidate = 0; // Dynamic server component

export default async function OverviewDashboardPage() {
  const supabase = await createClient();

  // Calculate start of today in ISO
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Run all dashboard metric queries in parallel
  const [
    todayOrdersRes,
    openComplaintsRes,
    needsHumanRes,
    commentsTodayRes,
    recentOrdersRes,
    recentComplaintsRes,
  ] = await Promise.all([
    // Today's Orders & revenue
    supabase
      .from('orders')
      .select('id, total_amount, status, created_at')
      .gte('created_at', todayISO),

    // Open complaints
    supabase
      .from('complaints')
      .select('id, status')
      .eq('status', 'open'),

    // Contacts needing human intervention
    supabase
      .from('contacts')
      .select('id')
      .eq('needs_human', true),

    // Comments today
    supabase
      .from('comment_events')
      .select('id')
      .gte('created_at', todayISO),

    // Latest 5 orders
    supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, total_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // Latest 4 complaints
    supabase
      .from('complaints')
      .select('id, ticket_number, customer_name, issue_description, status, created_at')
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const todayOrders = todayOrdersRes.data || [];
  const todayPendingCount = todayOrders.filter((o) => o.status === 'pending').length;
  const todayConfirmedCount = todayOrders.filter((o) => o.status === 'confirmed').length;
  const todaySales = todayOrders
    .filter((o) => o.status === 'confirmed')
    .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  const openComplaintsCount = openComplaintsRes.data ? openComplaintsRes.data.length : 0;
  const needsHumanCount = needsHumanRes.data ? needsHumanRes.data.length : 0;
  const commentsTodayCount = commentsTodayRes.data ? commentsTodayRes.data.length : 0;

  const recentOrders = recentOrdersRes.data || [];
  const recentComplaints = recentComplaintsRes.data || [];

  // Arabic Date Formatter
  const formattedTodayDate = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 sm:space-y-8 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40 dark:border-slate-800 dark:text-white p-6 sm:p-8 shadow-xs dark:shadow-2xl dark:shadow-black/40">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-700 dark:text-amber-300">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>{formattedTodayDate}</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <span>غرفة عمليات بروستد الخديوي</span>
              <span className="text-2xl">🍗👑</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              متابعة مباشرة للطلبات اليومية، أداء البوت الذكي للرد على الرسائل، والشكاوى العاجلة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition active:scale-98"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>لوحة الطلبات (Kanban)</span>
            </Link>
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
            >
              <MessageSquare className="h-4 w-4 text-amber-500" />
              <span>المحادثات الحية</span>
            </Link>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Top 5 Operational Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {/* Pending Orders */}
        <div className="rounded-2xl border border-amber-500/30 bg-white dark:bg-slate-900/80 backdrop-blur-sm p-5 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between hover:border-amber-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">طلبات جديدة</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">{todayPendingCount}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">بانتظار التأكيد والإرسال</p>
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-slate-900/80 backdrop-blur-sm p-5 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between hover:border-emerald-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">طلبات مؤكدة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{todayConfirmedCount}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">قيد التجهيز والتسليم</p>
          </div>
        </div>

        {/* Open Complaints */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm p-5 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between hover:border-rose-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">شكاوى مفتوحة</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${openComplaintsCount > 0 ? 'bg-rose-500/10 border border-rose-500/25 text-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-3xl font-black font-mono ${openComplaintsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {openComplaintsCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {openComplaintsCount > 0 ? 'تحتاج فحص وتواصل' : 'لا توجد شكاوى نشطة'}
            </p>
          </div>
        </div>

        {/* Needs Human */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm p-5 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between hover:border-amber-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">تدخل بشري</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${needsHumanCount > 0 ? 'bg-amber-500/10 border border-amber-500/25 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-3xl font-black font-mono ${needsHumanCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {needsHumanCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">عملاء طلبوا التحدث لموظف</p>
          </div>
        </div>

        {/* Comments Today */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm p-5 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between hover:border-sky-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">تعليقات اليوم</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-sky-600 dark:text-sky-400 font-mono">{commentsTodayCount}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">تمت معالجتها بالرد والخاص</p>
          </div>
        </div>
      </div>

      {/* Revenue summary banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-xs dark:shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مبيعات اليوم (الطلبات المؤكدة):</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {formatCurrency(todaySales)}
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition"
        >
          <span>تفاصيل الطلبات والمبالغ</span>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Quick Action Shortcuts Grid */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xs dark:shadow-lg dark:shadow-black/20">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>روابط سريعة للعمليات اليومية</span>
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link
            href="/dashboard/orders"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 p-5 text-center hover:border-amber-400 dark:hover:border-amber-500/40 hover:bg-amber-50/40 dark:hover:bg-slate-900 hover:shadow-md transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition shadow-xs">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <span className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">متابعة الأوردرات</span>
            <span className="mt-0.5 text-xs text-slate-500">كانبان المطبخ والتوصيل</span>
          </Link>

          <Link
            href="/dashboard/menu"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 p-5 text-center hover:border-emerald-400 dark:hover:border-emerald-500/40 hover:bg-emerald-50/40 dark:hover:bg-slate-900 hover:shadow-md transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition shadow-xs">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <span className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition">قائمة الطعام (المنيو)</span>
            <span className="mt-0.5 text-xs text-slate-500">صور وأسعار وPDF</span>
          </Link>

          <Link
            href="/dashboard/offers"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 p-5 text-center hover:border-purple-400 dark:hover:border-purple-500/40 hover:bg-purple-50/40 dark:hover:bg-slate-900 hover:shadow-md transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition shadow-xs">
              <PlusCircle className="h-6 w-6" />
            </div>
            <span className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">العروض والخصومات</span>
            <span className="mt-0.5 text-xs text-slate-500">عروض الخصم الخاصة</span>
          </Link>

          <Link
            href="/dashboard/chat"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 p-5 text-center hover:border-sky-400 dark:hover:border-sky-500/40 hover:bg-sky-50/40 dark:hover:bg-slate-900 hover:shadow-md transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition shadow-xs">
              <MessageSquare className="h-6 w-6" />
            </div>
            <span className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition">المحادثة المباشرة</span>
            <span className="mt-0.5 text-xs text-slate-500">التدخل اليدوي مع الزبائن</span>
          </Link>
        </div>
      </div>

      {/* Two-column operational feed: Recent Orders & Recent Complaints */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders Table */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xs dark:shadow-lg dark:shadow-black/20">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">أحدث الطلبات الواردة</h3>
            </div>
            <Link
              href="/dashboard/orders"
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition"
            >
              عرض الكل ({todayOrders.length})
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentOrders.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                لا توجد طلبات واردة حتى الآن اليوم.
              </div>
            ) : (
              recentOrders.map((order) => {
                const badge = getOrderStatusBadge(order.status);
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
                          #{order.order_number}
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {order.customer_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5">
                        {formatDateTime(order.created_at)} • {order.customer_phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                        {formatCurrency(Number(order.total_amount) || 0)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Complaints Feed */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xs dark:shadow-lg dark:shadow-black/20">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">أحدث البلاغات والشكاوى</h3>
            </div>
            <Link
              href="/dashboard/complaints"
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition"
            >
              عرض الكل ({openComplaintsCount})
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentComplaints.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                ممتاز! لا توجد أي شكاوى مفتوحة حالياً.
              </div>
            ) : (
              recentComplaints.map((complaint) => {
                const statusBadge = getComplaintStatusBadge(complaint.status);
                return (
                  <div
                    key={complaint.id}
                    className="py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                          #{complaint.ticket_number}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {complaint.customer_name}
                        </span>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge.color}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {complaint.issue_description}
                    </p>
                    <span className="mt-1.5 block text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDateTime(complaint.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
