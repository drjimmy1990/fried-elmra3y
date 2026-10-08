'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Percent,
  Calendar,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Offer,
  calculateDiscount,
  getOfferValidityStatus,
  formatOfferDateRange,
} from './types';
import { formatCurrency, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface OfferCardProps {
  offer: Offer;
  onEdit: (offer: Offer) => void;
  onDelete: (offerId: string) => void;
  onOfferUpdated: (updatedOffer: Offer) => void;
}

export function OfferCard({
  offer,
  onEdit,
  onDelete,
  onOfferUpdated,
}: OfferCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const discount = calculateDiscount(offer.price_before, offer.price_after);
  const validity = getOfferValidityStatus(offer);
  const formattedDateRange = formatOfferDateRange(offer.start_date, offer.end_date);

  // Keyboard accessibility and body scroll lock for delete modal
  useEffect(() => {
    if (!isConfirmingDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsConfirmingDelete(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isConfirmingDelete]);

  // Toggle active status instantly with optimistic local update and Supabase sync
  const handleToggleActive = async () => {
    if (isTogglingActive) return;
    const newActiveState = !offer.is_active;
    setIsTogglingActive(true);

    // 1. Optimistic update
    onOfferUpdated({
      ...offer,
      is_active: newActiveState,
    });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('offers')
        .update({
          is_active: newActiveState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Failed to toggle offer active state:', err);
      // Rollback on failure
      onOfferUpdated({
        ...offer,
        is_active: !newActiveState,
      });
      alert('تعذر تحديث حالة تفعيل العرض في السيرفر. يرجى مراجعة الاتصال بالإنترنت.');
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Delete Offer handler
  const handleDeleteOffer = async () => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', offer.id);

      if (error) throw error;

      onDelete(offer.id);
    } catch (err) {
      console.error('Failed to delete offer:', err);
      alert('حدث خطأ أثناء محاولة حذف العرض، يرجى المحاولة مرة أخرى.');
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-700 hover:shadow-xl hover:shadow-black/40',
          !offer.is_active && 'opacity-75 border-slate-800/60'
        )}
      >
        {/* Banner Section (aspect-video) */}
        <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
          {offer.banner_url && !imageError ? (
            <img
              src={offer.banner_url}
              alt={offer.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-slate-800 to-slate-950 text-slate-600">
              <ImageIcon className="w-12 h-12 stroke-[1.5] text-slate-500 mb-1" />
              <span className="text-xs text-slate-400 font-medium">بانر العرض الترويجي</span>
              <span className="text-[10px] text-slate-600">مطعم الخديوي</span>
            </div>
          )}

          {/* Top Overlays */}
          <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Validity Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border backdrop-blur-xs shadow-xs',
                validity.badgeClass
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{validity.label}</span>
            </span>

            {/* Discount Percentage Badge */}
            {discount.hasDiscount && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30">
                <Percent className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>خصم {discount.discountPercentage}%</span>
              </span>
            )}
          </div>

          {/* Inactive Ribbon Overlay */}
          {!offer.is_active && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-850/95 border border-slate-700 text-slate-300 font-bold text-xs shadow-lg flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>العرض غير مفعل حالياً</span>
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            {/* Title */}
            <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-amber-400 transition-colors line-clamp-1">
              {offer.title}
            </h3>

            {/* Description */}
            {offer.description ? (
              <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
                {offer.description}
              </p>
            ) : (
              <p className="text-xs text-slate-600 italic">لا يوجد وصف إضافي للعرض</p>
            )}
          </div>

          {/* Date Window */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-800/80">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{formattedDateRange}</span>
          </div>

          {/* Pricing Row */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-medium">سعر العرض الترويجي</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-400">
                  {formatCurrency(offer.price_after)}
                </span>
                {offer.price_before && offer.price_before > offer.price_after && (
                  <del className="text-xs text-slate-500 font-medium">
                    {formatCurrency(offer.price_before)}
                  </del>
                )}
              </div>
            </div>

            {/* Active Toggle Switch */}
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isTogglingActive}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs',
                offer.is_active
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              )}
            >
              {isTogglingActive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : offer.is_active ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>مفعل</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>معطل</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Footer: Sort Order & Actions */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            ترتيب الظهور: <strong className="text-slate-400">#{offer.sort_order}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(offer)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              title="تعديل بيانات العرض"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="حذف العرض الترويجي"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Offer Confirmation Dialog */}
      {isConfirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsConfirmingDelete(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">حذف العرض الترويجي</h4>
                <p className="text-xs text-slate-400 truncate max-w-[200px]">{offer.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف عرض <strong>"{offer.title}"</strong> نهائياً؟ سيتم حذفه من لوحة التحكم ولن يظهر للعملاء أو البوت.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteOffer}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
