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
} from 'lucide-react';
import { formatCurrency, formatDateTime, getOrderStatusBadge, getComplaintPriorityBadge } from '@/lib/utils';
import { OrderStatus, ComplaintPriority } from '@/types/database.types';

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

    // Open & In-progress complaints
    supabase
      .from('complaints')
      .select('id, priority, status')
      .in('status', ['open', 'in_progress']),

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
      .select('id, ticket_number, customer_name, issue_description, priority, status, created_at')
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const todayOrders = todayOrdersRes.data || [];
  const todayConfirmedCount = todayOrders.filter(o => o.status === 'confirmed').length;
  const todayIssuesCount = todayOrders.filter(o => o.status === 'issue').length;
  const todayCancelledCount = todayOrders.filter(o => o.status === 'cancelled').length;
  const todaySales = todayOrders
    .filter(o => o.status === 'confirmed')
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
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
              <Calendar className="h-4 w-4" />
              <span>{formattedTodayDate}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              أهلاً بك في غرفة عمليات المطعم 👑
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
              متابعة مباشرة للطلبات الواردة، أداء البوت الذكي للرد على الرسائل، والشكاوى العاجلة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-amber-500 transition"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>لوحة الطلبات (Kanban)</span>
            </Link>
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-sm hover:bg-slate-900/20 transition border border-white/10"
            >
              <MessageSquare className="h-4 w-4" />
              <span>المحادثات الحية</span>
            </Link>
          </div>
        </div>

        {/* Decorative ambient background glows */}
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Top 6 Operational Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Confirmed Orders */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">طلبات مؤكدة</div>
          <div className="text-2xl font-black text-emerald-400">{todayConfirmedCount}</div>
        </div>

        {/* Issues */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">مشاكل الأوردرات</div>
          <div className="text-2xl font-black text-rose-400">{todayIssuesCount}</div>
        </div>

        {/* Cancelled */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">طلبات ملغية</div>
          <div className="text-2xl font-black text-slate-300">{todayCancelledCount}</div>
        </div>

        {/* Open Complaints */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">شكاوى مفتوحة</div>
          <div className={`text-2xl font-black ${openComplaintsCount > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{openComplaintsCount}</div>
        </div>

        {/* Needs Human */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">تدخل بشري مطلوب</div>
          <div className={`text-2xl font-black ${needsHumanCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{needsHumanCount}</div>
        </div>

        {/* Comments Today */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 mb-2">تعليقات اليوم</div>
          <div className="text-2xl font-black text-blue-400">{commentsTodayCount}</div>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex justify-between items-center">
         <span className="text-sm font-bold text-slate-300">إجمالي المبيعات (طلبات مؤكدة):</span>
         <span className="text-3xl font-black text-emerald-400">{formatCurrency(todaySales)}</span>
      </div>

      {/* Quick Action Shortcuts Grid */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-100 mb-4">روابط سريعة للعمليات اليومية</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link
            href="/dashboard/orders"
            className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-800 p-4 text-center hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-xs transition group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:scale-110 transition">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <span className="mt-2.5 text-sm font-bold text-slate-200">متابعة الأوردرات</span>
            <span className="mt-0.5 text-xs text-slate-400">كانبان المطبخ والتوصيل</span>
          </Link>

          <Link
            href="/dashboard/menu"
            className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-800 p-4 text-center hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-xs transition group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <span className="mt-2.5 text-sm font-bold text-slate-200">قائمة الطعام</span>
            <span className="mt-0.5 text-xs text-slate-400">تعديل الوجبات والأسعار</span>
          </Link>

          <Link
            href="/dashboard/offers"
            className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-800 p-4 text-center hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-xs transition group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 group-hover:scale-110 transition">
              <PlusCircle className="h-6 w-6" />
            </div>
            <span className="mt-2.5 text-sm font-bold text-slate-200">إضافة عرض جديد</span>
            <span className="mt-0.5 text-xs text-slate-400">عروض الخصم الخاصة</span>
          </Link>

          <Link
            href="/dashboard/chat"
            className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-800 p-4 text-center hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-xs transition group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:scale-110 transition">
              <MessageSquare className="h-6 w-6" />
            </div>
            <span className="mt-2.5 text-sm font-bold text-slate-200">المحادثة المباشرة</span>
            <span className="mt-0.5 text-xs text-slate-400">التدخل اليدوي مع الزبائن</span>
          </Link>
        </div>
      </div>

      {/* Two-column operational feed: Recent Orders & Recent Complaints */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-slate-100 text-base">أحدث الطلبات الواردة</h3>
            </div>
            <Link
              href="/dashboard/orders"
              className="text-xs font-semibold text-amber-600 hover:text-amber-800"
            >
              عرض الكل ({todayOrders.length})
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentOrders.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                لا توجد طلبات واردة حتى الآن اليوم.
              </div>
            ) : (
              recentOrders.map((order) => {
                const badge = getOrderStatusBadge(order.status);
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3.5 hover:bg-slate-800/80 px-2 rounded-lg transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">
                          #{order.order_number}
                        </span>
                        <span className="text-sm font-medium text-slate-300">
                          {order.customer_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {formatDateTime(order.created_at)} • {order.customer_phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-100">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="font-bold text-slate-100 text-base">أحدث البلاغات والشكاوى</h3>
            </div>
            <Link
              href="/dashboard/complaints"
              className="text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              عرض الكل ({openComplaintsCount})
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentComplaints.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                ممتاز! لا توجد أي شكاوى مفتوحة حالياً.
              </div>
            ) : (
              recentComplaints.map((complaint) => {
                const priorityBadge = getComplaintPriorityBadge(complaint.priority);
                return (
                  <div
                    key={complaint.id}
                    className="py-3.5 hover:bg-slate-800/80 px-2 rounded-lg transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">
                          #{complaint.ticket_number}
                        </span>
                        <span className="text-sm font-semibold text-slate-100">
                          {complaint.customer_name}
                        </span>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityBadge.color}`}
                      >
                        {priorityBadge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {complaint.issue_description}
                    </p>
                    <span className="mt-1.5 block text-[11px] text-slate-400">
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
