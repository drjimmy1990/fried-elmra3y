'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Phone,
  MessageCircle,
  Clock,
  FileText,
  Save,
  Check,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ArrowRight,
  User,
  Sparkles,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  getComplaintPriorityBadge,
  getComplaintStatusBadge,
  getWhatsAppLink,
  formatDateTime,
} from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  ComplaintWithDetails,
  ComplaintStatus,
  ComplaintPriority,
  StaffProfile,
} from './types';

interface ComplaintDetailsModalProps {
  complaint: ComplaintWithDetails | null;
  isOpen: boolean;
  staffList: StaffProfile[];
  onClose: () => void;
  onUpdateStatus: (complaintId: string, newStatus: ComplaintStatus) => Promise<void>;
  onUpdatePriority: (complaintId: string, newPriority: ComplaintPriority) => Promise<void>;
  onAssignStaff: (complaintId: string, staffId: string | null) => Promise<void>;
  onUpdateResolutionNotes: (complaintId: string, notes: string) => Promise<boolean>;
}

export function ComplaintDetailsModal({
  complaint,
  isOpen,
  staffList,
  onClose,
  onUpdateStatus,
  onUpdatePriority,
  onAssignStaff,
  onUpdateResolutionNotes,
}: ComplaintDetailsModalProps) {
  const router = useRouter();

  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveSuccess, setNotesSaveSuccess] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isChangingPriority, setIsChangingPriority] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  // Sync resolution notes only when complaint ID changes
  useEffect(() => {
    if (complaint) {
      setResolutionNotes(complaint.resolution_notes || '');
      setNotesSaveSuccess(false);
    }
  }, [complaint?.id]);

  // Safe Close preventing accidental loss of unsaved draft notes
  const handleSafeClose = () => {
    const isDirty = resolutionNotes.trim() !== (complaint?.resolution_notes || '').trim();
    if (
      isDirty &&
      typeof window !== 'undefined' &&
      !window.confirm('لديك ملاحظات حل غير محفوظة، هل أنت متأكد من الإغلاق وتجاهل التعديلات؟')
    ) {
      return;
    }
    onClose();
  };

  // Handle Escape key to dismiss modal safely
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resolutionNotes, complaint]);

  if (!isOpen || !complaint) return null;

  const priorityBadge = getComplaintPriorityBadge(complaint.priority);
  const statusBadge = getComplaintStatusBadge(complaint.status);

  // Handle saving internal resolution notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const success = await onUpdateResolutionNotes(complaint.id, resolutionNotes);
      if (success) {
        setNotesSaveSuccess(true);
        setTimeout(() => setNotesSaveSuccess(false), 3000);
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Handle status transition
  const handleStatusChange = async (newStatus: ComplaintStatus) => {
    setIsChangingStatus(true);
    try {
      await onUpdateStatus(complaint.id, newStatus);
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Handle priority change
  const handlePriorityChange = async (newPriority: ComplaintPriority) => {
    setIsChangingPriority(true);
    try {
      await onUpdatePriority(complaint.id, newPriority);
    } finally {
      setIsChangingPriority(false);
    }
  };

  // Handle staff assignment
  const handleAssignChange = async (staffId: string) => {
    setIsAssigning(true);
    try {
      await onAssignStaff(complaint.id, staffId === '' ? null : staffId);
    } finally {
      setIsAssigning(false);
    }
  };

  // One-Click Chat Takeover: disables AI on contact & navigates to live chat
  const handleChatTakeover = async () => {
    if (!complaint.contact_id) {
      alert('هذه الشكوى مسجلة هاتفياً - لا يوجد حساب محادثة مرتبط.');
      return;
    }

    setIsTakingOver(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('contacts')
        .update({ ai_enabled: false })
        .eq('id', complaint.contact_id);

      if (error) {
        console.error('Failed to disable AI for contact on takeover:', error);
        alert('تعذر إيقاف البوت آلياً، يمكنك إيقاف البوت يدوياً من واجهة المحادثة المباشرة.');
      }
      router.push(`/dashboard/chat?contactId=${complaint.contact_id}`);
    } catch (err) {
      console.error('Error during chat takeover:', err);
      alert('حدث خطأ أثناء الانتقال للمحادثة.');
    } finally {
      setIsTakingOver(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complaint-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="complaint-modal-title" className="text-lg font-black text-white font-mono">
                  تذكرة شكوى #{complaint.ticket_number}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityBadge.color}`}
                >
                  {priorityBadge.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.color}`}
                >
                  {statusBadge.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>تاريخ التسجيل: {formatDateTime(complaint.created_at)}</span>
                </span>
                {complaint.resolved_at && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تاريخ الحل: {formatDateTime(complaint.resolved_at)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSafeClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Customer Info & Chat Takeover Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                بيانات صاحب الشكوى
              </span>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100 text-base">
                    {complaint.customer_name || 'عميل بدون اسم'}
                  </div>
                  <div className="text-sm font-mono text-slate-300 mt-0.5" dir="ltr">
                    {complaint.customer_phone}
                  </div>
                  {complaint.contact && (
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <span>المنصة: {complaint.contact.platform === 'messenger' ? 'فيسبوك ماسنجر' : complaint.contact.platform}</span>
                      <span>•</span>
                      <span>إجمالي الطلبات: {complaint.contact.total_orders || 0}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${complaint.customer_phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>اتصال</span>
                  </a>
                  <a
                    href={getWhatsAppLink(complaint.customer_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 text-xs font-semibold transition border border-emerald-800/50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </a>
                </div>
              </div>
            </div>

            {/* One-Click Chat Takeover Box */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>التدخل المباشر مع العميل (Chat Takeover)</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  إيقاف الرد الآلي للذكاء الاصطناعي فوراً وتولي المحادثة كدعم فني بشري لإرضاء العميل وحل مشكلته.
                </p>
              </div>

              <div className="mt-3">
                <button
                  onClick={handleChatTakeover}
                  disabled={isTakingOver || !complaint.contact_id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-950/50 transition disabled:opacity-50"
                >
                  {isTakingOver ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري تحويل الشات وإيقاف البوت...</span>
                    </>
                  ) : !complaint.contact_id ? (
                    <span>شكوى مسجلة هاتفياً - لا توجد محادثة شات</span>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>الانتقال للمحادثة المباشرة وتولي الرد 💬</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Full Issue Description */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">نص الشكوى وبلاغ العميل:</span>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap select-text">
              {complaint.issue_description}
            </div>
          </div>

          {/* Operational Workflow Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Transition Actions */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                تحديث حالة التذكرة (Workflow Status):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isChangingStatus || complaint.status === 'in_progress'}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold border transition ${
                    complaint.status === 'in_progress'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>بدء المعالجة</span>
                </button>

                <button
                  onClick={() => handleStatusChange('resolved')}
                  disabled={isChangingStatus || complaint.status === 'resolved'}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold border transition ${
                    complaint.status === 'resolved'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم الحل بنجاح</span>
                </button>

                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={isChangingStatus || complaint.status === 'closed'}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold border transition ${
                    complaint.status === 'closed'
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5 text-slate-400" />
                  <span>أرشفة وإغلاق</span>
                </button>

                <button
                  onClick={() => handleStatusChange('open')}
                  disabled={isChangingStatus || complaint.status === 'open'}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold border transition ${
                    complaint.status === 'open'
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>إعادة فتح</span>
                </button>
              </div>
            </div>

            {/* Priority & Staff Assignment */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
              {/* Priority Selector */}
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-1.5">
                  مستوى الأولوية والخطورة:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['low', 'medium', 'high', 'urgent'] as ComplaintPriority[]).map((p) => {
                    const badge = getComplaintPriorityBadge(p);
                    const isSelected = complaint.priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        disabled={isChangingPriority}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {p === 'urgent' ? 'عاجل' : p === 'high' ? 'عالي' : p === 'medium' ? 'متوسط' : 'عادي'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff Assignment Selector */}
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-1.5">
                  إسناد التذكرة لموظف الدعم:
                </span>
                <select
                  value={complaint.assigned_to || ''}
                  onChange={(e) => handleAssignChange(e.target.value)}
                  disabled={isAssigning}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                >
                  <option value="">-- غير مخصص (بدون موظف) --</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.role === 'admin' ? 'مدير' : staff.role === 'support_agent' ? 'خدمة عملاء' : 'طلبات'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Internal Resolution Notes */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">
                  ملاحظات الحل الداخلية والتعويضات (Resolution Notes):
                </span>
              </div>
              {notesSaveSuccess && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>تم الحفظ بنجاح ✓</span>
                </span>
              )}
            </div>

            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="اكتب تفاصيل حل المشكلة، الإجراء المتخذ، أو تفاصيل التعويض المقدم للعميل (وجبة بديلة، كود خصم، استرداد)..."
              rows={3}
              className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition leading-relaxed resize-none"
            />

            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes || resolutionNotes === (complaint.resolution_notes || '')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition disabled:opacity-40"
              >
                {isSavingNotes ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-400" />
                    <span>حفظ ملاحظات الحل</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 text-xs">
          <div className="text-slate-400">
            تحديث فوري عبر Supabase Realtime • مطعم الخديوي
          </div>
          <button
            onClick={handleSafeClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition border border-slate-700"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
