'use client';

import React from 'react';
import {
  Clock,
  Phone,
  MessageCircle,
  User,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  getComplaintStatusBadge,
  getWhatsAppLink,
  formatTimeElapsed,
} from '@/lib/utils';
import { ComplaintWithDetails, ComplaintStatus } from './types';

interface ComplaintCardProps {
  complaint: ComplaintWithDetails;
  onSelect: (complaint: ComplaintWithDetails) => void;
  onQuickAdvanceStatus?: (complaintId: string, nextStatus: ComplaintStatus) => Promise<void>;
  isUpdating?: boolean;
}

function ComplaintCardComponent({
  complaint,
  onSelect,
  onQuickAdvanceStatus,
  isUpdating = false,
}: ComplaintCardProps) {
  const statusBadge = getComplaintStatusBadge(complaint.status);

  // Quick next status action helper
  const getNextStatusAction = (current: ComplaintStatus): { label: string; nextStatus: ComplaintStatus } | null => {
    switch (current) {
      case 'open':
        return { label: 'تم الحل وإرضاء العميل ✅', nextStatus: 'resolved' };
      case 'resolved':
        return { label: 'إعادة فتح التذكرة 🔄', nextStatus: 'open' };
      default:
        return null;
    }
  };

  const nextAction = getNextStatusAction(complaint.status);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(complaint)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(complaint);
        }
      }}
      className="group relative rounded-2xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 p-4 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer text-slate-200 flex flex-col gap-3 select-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
    >
      {/* Top Meta Bar: Ticket Number, Elapsed Time, Status Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-white tracking-wide font-mono bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700/50">
            #{complaint.ticket_number}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{formatTimeElapsed(complaint.created_at)}</span>
        </div>
      </div>

      {/* Customer Information Bar */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div>
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
            <span>{complaint.customer_name || 'عميل بدون اسم'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span dir="ltr" className="font-mono">{complaint.customer_phone}</span>
          </div>
        </div>

        {/* Quick Contact Buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <a
            href={`tel:${complaint.customer_phone}`}
            title="اتصال هاتفي"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <a
            href={getWhatsAppLink(complaint.customer_phone)}
            target="_blank"
            rel="noopener noreferrer"
            title="محادثة واتساب"
            className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-400 hover:text-emerald-300 transition"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Issue Description Box */}
      <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60 text-xs text-slate-300 leading-relaxed">
        <p className="line-clamp-3">
          {complaint.issue_description || 'لا يوجد تفاصيل للشكوى.'}
        </p>
      </div>

      {/* Resolution Notes Indicator (if present) */}
      {complaint.resolution_notes && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
          <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">ملاحظات الحل: {complaint.resolution_notes}</span>
        </div>
      )}

      {/* Footer: Assigned Staff & Status or Quick Advance */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/50 text-xs">
        {/* Assigned Staff */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 border border-slate-700">
            {complaint.assigned_profile ? (
              complaint.assigned_profile.full_name.charAt(0)
            ) : (
              <User className="w-3 h-3 text-slate-500" />
            )}
          </div>
          <span className="text-[11px] font-medium truncate max-w-[110px]">
            {complaint.assigned_profile ? complaint.assigned_profile.full_name : 'غير مسند لأحد'}
          </span>
        </div>

        {/* Status Badge or Quick Advance Action */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>

          {nextAction && onQuickAdvanceStatus && (
            <button
              onClick={() => onQuickAdvanceStatus(complaint.id, nextAction.nextStatus)}
              disabled={isUpdating}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition border border-slate-700 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span>{nextAction.label}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const ComplaintCard = React.memo(ComplaintCardComponent);
