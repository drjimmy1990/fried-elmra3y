'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  ListFilter,
  Radio,
  RotateCcw,
  UserCheck,
  Flame,
  Check,
  X,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDateTime, getComplaintPriorityBadge } from '@/lib/utils';
import { ComplaintCard } from './ComplaintCard';
import { ComplaintDetailsModal } from './ComplaintDetailsModal';
import {
  ComplaintWithDetails,
  ComplaintRow,
  ComplaintStatus,
  ComplaintPriority,
  StaffProfile,
  PriorityFilter,
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
    id: 'in_progress',
    title: 'قيد المتابعة',
    subtitle: 'جاري العمل على حل المشكلة والتواصل',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-500',
    bgLight: 'bg-blue-500/5',
    borderLight: 'border-blue-500/20',
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
  {
    id: 'closed',
    title: 'مغلقة',
    subtitle: 'أرشيف التذاكر المغلقة نهائياً',
    badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    dotColor: 'bg-slate-500',
    bgLight: 'bg-slate-500/5',
    borderLight: 'border-slate-500/20',
  },
];

export function ComplaintQueue({ initialComplaints, staffList }: ComplaintQueueProps) {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>(initialComplaints);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('columns');
    const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const id = searchParams.get('complaintId');
    if (id) {
      const found = complaints.find(c => c.id === id);
      if (found) {
        setSelectedComplaint(found);
      }
    }
  }, [searchParams, complaints]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});

  // Referentially stable Supabase client instance
  const supabase = useMemo(() => createClient(), []);

  // Set up Supabase Realtime Subscription for complaints
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
            const newRow = payload.new as ComplaintRow;
            const assignedProfile = newRow.assigned_to
              ? staffList.find((s) => s.id === newRow.assigned_to) || null
              : null;

            let contact = null;
            if (newRow.contact_id) {
              const { data } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', newRow.contact_id)
                .maybeSingle();
              contact = data;
            }

            const completeComplaint: ComplaintWithDetails = {
              ...newRow,
              assigned_profile: assignedProfile,
              contact: contact,
            };

            setComplaints((prev) => [
              completeComplaint,
              ...prev.filter((c) => c.id !== newRow.id),
            ]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as ComplaintRow;
            const assignedProfile = updatedRow.assigned_to
              ? staffList.find((s) => s.id === updatedRow.assigned_to) || null
              : null;

            setComplaints((prev) =>
              prev.map((c) => {
                if (c.id === updatedRow.id) {
                  return {
                    ...c,
                    ...updatedRow,
                    assigned_profile: assignedProfile,
                  };
                }
                return c;
              })
            );

            setSelectedComplaint((prev) => {
              if (prev?.id === updatedRow.id) {
                return {
                  ...prev,
                  ...updatedRow,
                  assigned_profile: assignedProfile,
                };
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setComplaints((prev) => prev.filter((c) => c.id !== deletedId));
            setSelectedComplaint((prev) => (prev?.id === deletedId ? null : prev));
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, staffList]);

  // KPI Calculations
  const kpiMetrics = useMemo(() => {
    const openCount = complaints.filter((c) => c.status === 'open').length;
    const urgentCount = complaints.filter(
      (c) => c.priority === 'urgent' && c.status !== 'closed' && c.status !== 'resolved'
    ).length;
    const inProgressCount = complaints.filter((c) => c.status === 'in_progress').length;
    const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

    return { openCount, urgentCount, inProgressCount, resolvedCount };
  }, [complaints]);

  // Filtering: Search, Priority, Status
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // 1. Search Query Filter: customer name, customer phone, ticket number, issue description
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase().replace(/^#/, '');
        const matchesName = c.customer_name?.toLowerCase().includes(query);
        const matchesPhone = c.customer_phone?.includes(query);
        const matchesTicket = String(c.ticket_number).includes(query);
        const matchesIssue = c.issue_description?.toLowerCase().includes(query);

        if (!matchesName && !matchesPhone && !matchesTicket && !matchesIssue) {
          return false;
        }
      }

      // 2. Priority Filter
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) {
        return false;
      }

      // 3. Status Filter (when used in tabs or general filter)
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [complaints, searchQuery, priorityFilter, statusFilter]);

  // Complaint Actions: Status
  const handleUpdateStatus = useCallback(
    async (complaintId: string, newStatus: ComplaintStatus) => {
      setIsUpdatingStatus((prev) => ({ ...prev, [complaintId]: true }));
      const previousComplaint = complaints.find((c) => c.id === complaintId);

      const resolvedAt =
        newStatus === 'resolved'
          ? previousComplaint?.resolved_at || new Date().toISOString()
          : newStatus === 'open'
          ? null
          : previousComplaint?.resolved_at || null;

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

  // Complaint Actions: Priority
  const handleUpdatePriority = useCallback(
    async (complaintId: string, newPriority: ComplaintPriority) => {
      const previousComplaint = complaints.find((c) => c.id === complaintId);

      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? { ...c, priority: newPriority } : c))
      );
      setSelectedComplaint((prev) =>
        prev?.id === complaintId ? { ...prev, priority: newPriority } : prev
      );

      try {
        const { error } = await supabase
          .from('complaints')
          .update({ priority: newPriority, updated_at: new Date().toISOString() })
          .eq('id', complaintId);

        if (error) {
          console.error('Failed to update complaint priority:', error);
          if (previousComplaint) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === complaintId ? previousComplaint : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === complaintId ? previousComplaint : prev
            );
          }
          alert('تعذر تحديث أولوية الشكوى.');
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
        alert('حدث خطأ غير متوقع أثناء تحديث الأولوية.');
      }
    },
    [complaints, supabase]
  );

  // Complaint Actions: Staff Assignment
  const handleAssignStaff = useCallback(
    async (complaintId: string, staffId: string | null) => {
      const previousComplaint = complaints.find((c) => c.id === complaintId);
      const assignedProfile = staffId ? staffList.find((s) => s.id === staffId) || null : null;

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId
            ? { ...c, assigned_to: staffId, assigned_profile: assignedProfile }
            : c
        )
      );
      setSelectedComplaint((prev) =>
        prev?.id === complaintId
          ? { ...prev, assigned_to: staffId, assigned_profile: assignedProfile }
          : prev
      );

      try {
        const { error } = await supabase
          .from('complaints')
          .update({ assigned_to: staffId, updated_at: new Date().toISOString() })
          .eq('id', complaintId);

        if (error) {
          console.error('Failed to assign staff:', error);
          if (previousComplaint) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === complaintId ? previousComplaint : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === complaintId ? previousComplaint : prev
            );
          }
          alert('تعذر تغيير إسناد الموظف.');
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
        alert('حدث خطأ غير متوقع أثناء إسناد الموظف.');
      }
    },
    [complaints, staffList, supabase]
  );

  // Complaint Actions: Resolution Notes
  const handleUpdateResolutionNotes = useCallback(
    async (complaintId: string, notes: string): Promise<boolean> => {
      const previousComplaint = complaints.find((c) => c.id === complaintId);

      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? { ...c, resolution_notes: notes } : c))
      );
      setSelectedComplaint((prev) =>
        prev?.id === complaintId ? { ...prev, resolution_notes: notes } : prev
      );

      try {
        const { error } = await supabase
          .from('complaints')
          .update({ resolution_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', complaintId);

        if (error) {
          console.error('Failed to save resolution notes:', error);
          if (previousComplaint) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === complaintId ? previousComplaint : c))
            );
            setSelectedComplaint((prev) =>
              prev?.id === complaintId ? previousComplaint : prev
            );
          }
          alert('تعذر حفظ ملاحظات الحل. يرجى التحقق من اتصال الإنترنت.');
          return false;
        }
        return true;
      } catch {
        if (previousComplaint) {
          setComplaints((prev) =>
            prev.map((c) => (c.id === complaintId ? previousComplaint : c))
          );
          setSelectedComplaint((prev) =>
            prev?.id === complaintId ? previousComplaint : prev
          );
        }
        alert('حدث خطأ غير متوقع أثناء حفظ الملاحظات.');
        return false;
      }
    },
    [complaints, supabase]
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              إدارة الشكاوى وبلاغات العملاء
            </h1>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isRealtimeActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isRealtimeActive ? 'animate-pulse text-emerald-500' : 'text-amber-500'}`} />
              <span>{isRealtimeActive ? 'مزامنة مباشرة 🟢' : 'جاري الاتصال...'}</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            متابعة فورية لتذاكر وبلاغات الزبائن، تحديد الأولويات، وتدخل الدعم المباشر (Chat Takeover).
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => {
              setViewMode('columns');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === 'columns'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-amber-600" />
            <span>لوحة الأعمدة (Kanban)</span>
          </button>
          <button
            onClick={() => setViewMode('tabs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === 'tabs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-4 h-4 text-amber-600" />
            <span>عرض التبويبات (Tabs)</span>
          </button>
        </div>
      </div>

      {/* 4 Top KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Open Complaints */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              شكاوى مفتوحة وجديدة
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{kpiMetrics.openCount}</span>
            <span className="text-xs text-slate-500">تذكرة بانتظار الفحص</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">تحتاج لمعالجة سريعة لضمان رضا الزبون</div>
        </div>

        {/* Metric 2: Urgent Tickets */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              تذاكر عاجلة طارئة 🔴
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Flame className="h-5 w-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-600">{kpiMetrics.urgentCount}</span>
            <span className="text-xs text-red-500 font-bold">أولوية قصوى</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">تتطلب تدخلاً فورياً أو اتصالاً هاتفياً</div>
        </div>

        {/* Metric 3: In Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              قيد المتابعة والحل
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">{kpiMetrics.inProgressCount}</span>
            <span className="text-xs text-slate-500">تذكرة تحت المعالجة</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">جاري التواصل مع العميل والمطبخ</div>
        </div>

        {/* Metric 4: Resolved */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              تم الحل وإرضاء العميل
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{kpiMetrics.resolvedCount}</span>
            <span className="text-xs text-slate-500">تذكرة منتهية بنجاح</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">إجمالي التذاكر المحلولة في النظام</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input: name, phone, ticket number, issue */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="بحث في تذاكر الشكاوى"
              placeholder="ابحث باسم العميل، رقم الهاتف، رقم التذكرة #، أو نص الشكوى..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 pr-10 pl-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-bold text-slate-500 ml-1 shrink-0">الأولوية:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'urgent', label: 'عاجل جداً 🔴' },
              { id: 'high', label: 'عالية 🟠' },
              { id: 'medium', label: 'متوسط 🟡' },
              { id: 'low', label: 'عادي 🟢' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPriorityFilter(item.id as PriorityFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  priorityFilter === item.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs Filter Bar (Only active when in Tabs View or as quick selector) */}
        {viewMode === 'tabs' && (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 ml-1 shrink-0">الحالة:</span>
            {[
              { id: 'all', label: 'جميع الحالات', count: complaints.length },
              { id: 'open', label: 'مفتوحة / جديدة', count: kpiMetrics.openCount },
              { id: 'in_progress', label: 'قيد المتابعة', count: kpiMetrics.inProgressCount },
              { id: 'resolved', label: 'تم الحل', count: kpiMetrics.resolvedCount },
              {
                id: 'closed',
                label: 'مغلقة',
                count: complaints.filter((c) => c.status === 'closed').length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.id ? 'bg-amber-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'columns' ? (
        /* Kanban Columns View: 4 Status Columns */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STATUS_COLUMNS.map((col) => {
            const colComplaints = filteredComplaints.filter((c) => c.status === col.id);

            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-3xl border ${col.borderLight} bg-slate-950/20 p-3 min-h-[500px]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-2 mb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h3 className="font-bold text-slate-900 text-sm">{col.title}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${col.badgeColor}`}
                  >
                    {colComplaints.length}
                  </span>
                </div>

                {/* Subtitle */}
                <p className="text-[11px] text-slate-500 px-2 mb-3">{col.subtitle}</p>

                {/* Column Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[75vh] p-1">
                  {colComplaints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white/50">
                      <span className="text-xs">لا توجد تذاكر في هذه المرحلة</span>
                    </div>
                  ) : (
                    colComplaints.map((complaint) => (
                      <ComplaintCard
                        key={complaint.id}
                        complaint={complaint}
                        onSelect={(c) => setSelectedComplaint(c)}
                        onQuickAdvanceStatus={handleUpdateStatus}
                        isUpdating={isUpdatingStatus[complaint.id]}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tab / List View */
        <div className="space-y-3">
          {filteredComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 rounded-3xl bg-white border border-slate-200">
              <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold">لا توجد شكاوى مطابقة لمعايير البحث الحالية.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPriorityFilter('all');
                  setStatusFilter('all');
                }}
                className="mt-3 text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredComplaints.map((complaint) => (
                <ComplaintCard
                  key={complaint.id}
                  complaint={complaint}
                  onSelect={(c) => setSelectedComplaint(c)}
                  onQuickAdvanceStatus={handleUpdateStatus}
                  isUpdating={isUpdatingStatus[complaint.id]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complaint Details & Resolution Modal */}
      <ComplaintDetailsModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        staffList={staffList}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePriority={handleUpdatePriority}
        onAssignStaff={handleAssignStaff}
        onUpdateResolutionNotes={handleUpdateResolutionNotes}
      />
    </div>
  );
}

