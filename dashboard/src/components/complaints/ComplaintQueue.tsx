'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  LayoutGrid,
  RotateCcw,
  X,
  Phone,
  MessageCircle,
  Table as TableIcon,
  ShoppingBag,
  User,
  Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { formatDateTime, getWhatsAppLink } from '@/lib/utils';
import { ComplaintCard } from './ComplaintCard';
import { ComplaintDetailsModal } from './ComplaintDetailsModal';
import {
  ComplaintWithDetails,
  ComplaintRow,
  ComplaintStatus,
  StaffProfile,
  StatusFilter,
  ViewMode,
  StatusColumnDef,
  getComplaintStatusBadge,
} from './types';

interface ComplaintQueueProps {
  initialComplaints: ComplaintWithDetails[];
  staffList: StaffProfile[];
}

const STATUS_COLUMNS: StatusColumnDef[] = [
  {
    id: 'open',
    title: 'مفتوحة / جديدة',
    subtitle: 'تذاكر بانتظار الفحص والمتابعة',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    dotColor: 'bg-rose-500',
    bgLight: 'bg-rose-500/5',
    borderLight: 'border-rose-500/20',
  },
  {
    id: 'resolved',
    title: 'تم الحل',
    subtitle: 'تم إرضاء العميل ومعالجة المشكلة',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    bgLight: 'bg-emerald-500/5',
    borderLight: 'border-emerald-500/20',
  },
];

export function ComplaintQueue({ initialComplaints, staffList }: ComplaintQueueProps) {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>(initialComplaints);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // Table view is the default as requested by the owner
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('complaintId');
    if (id) {
      const found = complaints.find((c) => c.id === id);
      if (found) {
        setSelectedComplaint(found);
      }
    }
  }, [searchParams, complaints]);

  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});

  const supabase = useMemo(() => createClient(), []);

  // Supabase Realtime Subscription for complaints
  useEffect(() => {
    const channel = supabase
      .channel('realtime_complaints_queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints',
        },
        async (payload) => {
          setIsRealtimeActive(true);

          if (payload.eventType === 'INSERT') {
            const newComplaintRow = payload.new as ComplaintRow;

            let contact = null;
            if (newComplaintRow.contact_id) {
              const { data } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', newComplaintRow.contact_id)
                .single();
              contact = data;
            }

            let order = null;
            if (newComplaintRow.order_id) {
              const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('id', newComplaintRow.order_id)
                .single();
              order = data;
            }

            let assigned_profile = null;
            if (newComplaintRow.assigned_to) {
              const { data } = await supabase
                .from('profiles')
                .select('id, full_name, role, is_active')
                .eq('id', newComplaintRow.assigned_to)
                .single();
              assigned_profile = data;
            }

            const fullComplaint: ComplaintWithDetails = {
              ...newComplaintRow,
              contact,
              order,
              assigned_profile,
            };

            setComplaints((prev) => [fullComplaint, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as ComplaintRow;
            setComplaints((prev) =>
              prev.map((c) => (c.id === updatedRow.id ? { ...c, ...updatedRow } : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === updatedRow.id ? { ...prev, ...updatedRow } : prev
            );
          } else if (payload.eventType === 'DELETE') {
            setComplaints((prev) => prev.filter((c) => c.id !== payload.old.id));
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

  // Filter complaints based on search and status
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = c.customer_name?.toLowerCase().includes(query);
        const matchesPhone = c.customer_phone?.includes(query);
        const matchesTicket = String(c.ticket_number).includes(query);
        const matchesDesc = c.issue_description?.toLowerCase().includes(query);

        if (!matchesName && !matchesPhone && !matchesTicket && !matchesDesc) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [complaints, searchQuery, statusFilter]);

  // Update complaint status
  const handleUpdateStatus = useCallback(
    async (complaintId: string, newStatus: ComplaintStatus) => {
      const previousComplaint = complaints.find((c) => c.id === complaintId);
      const resolvedAt = newStatus === 'resolved' ? new Date().toISOString() : null;

      setIsUpdatingStatus((prev) => ({ ...prev, [complaintId]: true }));

      // Optimistic state update
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId
            ? { ...c, status: newStatus, resolved_at: resolvedAt }
            : c
        )
      );
      setSelectedComplaint((prev) =>
        prev?.id === complaintId
          ? { ...prev, status: newStatus, resolved_at: resolvedAt }
          : prev
      );

      try {
        const { error } = await supabase
          .from('complaints')
          .update({
            status: newStatus,
            resolved_at: resolvedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', complaintId);

        if (error) {
          console.error('Failed to update complaint status in Supabase:', error);
          if (previousComplaint) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === complaintId ? previousComplaint : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === complaintId ? previousComplaint : prev
            );
          }
          alert('تعذر تحديث حالة الشكوى. يرجى التحقق من اتصال الإنترنت.');
        }
      } catch {
        if (previousComplaint) {
          setComplaints((prev) =>
            prev.map((c) => (c.id === complaintId ? previousComplaint : c))
          );
          setSelectedComplaint((prev) =>
            prev?.id === complaintId ? previousComplaint : prev
          );
        }
        alert('حدث خطأ غير متوقع أثناء تحديث الشكوى.');
      } finally {
        setIsUpdatingStatus((prev) => ({ ...prev, [complaintId]: false }));
      }
    },
    [complaints, supabase]
  );

  // Staff Assignment
  const handleAssignStaff = useCallback(
    async (complaintId: string, staffId: string | null) => {
      const previousComplaint = complaints.find((c) => c.id === complaintId);
      const assignedStaff = staffList.find((s) => s.id === staffId) || null;

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId
            ? { ...c, assigned_to: staffId, assigned_profile: assignedStaff }
            : c
        )
      );
      setSelectedComplaint((prev) =>
        prev?.id === complaintId
          ? { ...prev, assigned_to: staffId, assigned_profile: assignedStaff }
          : prev
      );

      try {
        const { error } = await supabase
          .from('complaints')
          .update({ assigned_to: staffId, updated_at: new Date().toISOString() })
          .eq('id', complaintId);

        if (error) {
          console.error('Failed to update assigned staff:', error);
          if (previousComplaint) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === complaintId ? previousComplaint : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === complaintId ? previousComplaint : prev
            );
          }
          alert('تعذر إسناد الشكوى للموظف.');
        }
      } catch {
        if (previousComplaint) {
          setComplaints((prev) =>
            prev.map((c) => (c.id === complaintId ? previousComplaint : c))
          );
          setSelectedComplaint((prev) =>
            prev?.id === complaintId ? previousComplaint : prev
          );
        }
        alert('حدث خطأ غير متوقع أثناء إسناد الشكوى.');
      }
    },
    [complaints, staffList, supabase]
  );

  // Resolution Notes Update
  const handleUpdateResolutionNotes = useCallback(
    async (complaintId: string, notes: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('complaints')
          .update({
            resolution_notes: notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', complaintId);

        if (!error) {
          setComplaints((prev) =>
            prev.map((c) =>
              c.id === complaintId ? { ...c, resolution_notes: notes } : c
            )
          );
          setSelectedComplaint((prev) =>
            prev?.id === complaintId ? { ...prev, resolution_notes: notes } : prev
          );
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [supabase]
  );

  // Summary Metrics calculations
  const totalCount = filteredComplaints.length;
  const openCount = filteredComplaints.filter((c) => c.status === 'open').length;
  const resolvedCount = filteredComplaints.filter((c) => c.status === 'resolved').length;
  const resolutionRate =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">إدارة شكاوى العملاء</h1>
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
              <span>{isRealtimeActive ? 'مزامنة لحظية' : 'جاري الاتصال...'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            متابعة المشكلات وحلها يدوياً مع إمكانية التدخل المباشر في الشات
          </p>
        </div>

        {/* View Mode Toggle: Table is default */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>الجدول</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>البطاقات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي التذاكر</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">{totalCount}</span>
            <AlertTriangle className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">شكاوى مفتوحة</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">{openCount}</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 flex flex-col justify-between">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">تم الحل بنجاح</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{resolvedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">نسبة الإغلاق والرضا</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {resolutionRate}%
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">مكتمل</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-2xl shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الشكوى، العميل، الهاتف، أو نص المشكلة..."
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

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            كل الشكاوى ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'open'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-950 text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>مفتوحة ({openCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>تم الحل ({resolvedCount})</span>
          </button>
        </div>
      </div>

      {/* Main View: Table (Default) or Cards */}
      {viewMode === 'table' ? (
        <div className="rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/70">
                  <th className="py-3 px-4 font-semibold">رقم التذكرة</th>
                  <th className="py-3 px-4 font-semibold">التاريخ</th>
                  <th className="py-3 px-4 font-semibold">صاحب الشكوى</th>
                  <th className="py-3 px-4 font-semibold">رقم الهاتف</th>
                  <th className="py-3 px-4 font-semibold">القناة</th>
                  <th className="py-3 px-4 font-semibold">الطلب المرتبط</th>
                  <th className="py-3 px-4 font-semibold">تفاصيل المشكلة</th>
                  <th className="py-3 px-4 font-semibold">الموظف المسؤول</th>
                  <th className="py-3 px-4 font-semibold">الحالة</th>
                  <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      لا توجد شكاوى مطابقة لمعايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((complaint) => {
                    const statusBadge = getComplaintStatusBadge(complaint.status);

                    return (
                      <tr
                        key={complaint.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedComplaint(complaint)}
                      >
                        <td className="py-3.5 px-4 font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          #{complaint.ticket_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(complaint.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {complaint.customer_name || 'عميل'}
                        </td>
                        <td
                          className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap"
                          dir="ltr"
                        >
                          {complaint.customer_phone || '-'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                            {complaint.source === 'messenger'
                              ? 'ماسنجر'
                              : complaint.source === 'comment'
                              ? 'تعليق'
                              : complaint.source === 'dashboard'
                              ? 'لوحة التحكم'
                              : 'تليفون'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {complaint.order ? (
                            <Link
                              href={`/dashboard/orders?orderId=${complaint.order_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                            >
                              #{complaint.order.order_number}
                            </Link>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate"
                          title={complaint.issue_description}
                        >
                          {complaint.issue_description}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {complaint.assigned_profile?.full_name || (
                            <span className="text-slate-400 dark:text-slate-500">غير مخصص</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {complaint.status === 'open' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(complaint.id, 'resolved')}
                                disabled={isUpdatingStatus[complaint.id]}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تم الحل</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(complaint.id, 'open')}
                                disabled={isUpdatingStatus[complaint.id]}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>إعادة فتح</span>
                              </button>
                            )}

                            {complaint.contact_id && (
                              <Link
                                href={`/dashboard/chat?contactId=${complaint.contact_id}`}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition"
                                title="فتح المحادثة المباشرة"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Link>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedComplaint(complaint)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
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
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {STATUS_COLUMNS.map((column) => {
            const columnComplaints = filteredComplaints.filter(
              (c) => c.status === column.id
            );

            return (
              <div
                key={column.id}
                className="flex flex-col rounded-3xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 shadow-xl overflow-hidden min-h-[500px]"
              >
                {/* Column Header */}
                <div
                  className={`p-4 border-b border-slate-200 dark:border-slate-800/80 ${column.bgLight} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{column.title}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${column.badgeColor}`}
                    >
                      {columnComplaints.length} شكوى
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{column.subtitle}</div>
                </div>

                {/* Complaints List */}
                <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                  {columnComplaints.length === 0 ? (
                    <div className="py-16 px-4 text-center">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 mb-2 border border-slate-200 dark:border-slate-800">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">لا توجد شكاوى في هذه القائمة حالياً</p>
                    </div>
                  ) : (
                    columnComplaints.map((c) => (
                      <ComplaintCard
                        key={c.id}
                        complaint={c}
                        onSelect={(comp) => setSelectedComplaint(comp)}
                        onQuickAdvanceStatus={handleUpdateStatus}
                        isUpdating={isUpdatingStatus[c.id]}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details & Resolution Modal */}
      <ComplaintDetailsModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        staffList={staffList}
        onClose={() => setSelectedComplaint(null)}
        onUpdateStatus={handleUpdateStatus}
        onAssignStaff={handleAssignStaff}
        onUpdateResolutionNotes={handleUpdateResolutionNotes}
      />
    </div>
  );
}
