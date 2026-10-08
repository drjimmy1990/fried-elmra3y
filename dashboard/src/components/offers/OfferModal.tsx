'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Sparkles,
  Percent,
  CheckCircle2,
  Trash2,
  Link as LinkIcon,
  Calendar,
} from 'lucide-react';
import {
  Offer,
  calculateDiscount,
  toDatetimeLocal,
  fromDatetimeLocal,
} from './types';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerToEdit?: Offer | null;
  onSave: (savedOffer: Offer) => void;
}

export function OfferModal({
  isOpen,
  onClose,
  offerToEdit,
  onSave,
}: OfferModalProps) {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceBefore, setPriceBefore] = useState('');
  const [priceAfter, setPriceAfter] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(0);

  // States for UX
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Populate or reset form whenever modal opens or offerToEdit changes
  useEffect(() => {
    if (offerToEdit) {
      setTitle(offerToEdit.title);
      setDescription(offerToEdit.description || '');
      setPriceBefore(
        offerToEdit.price_before !== null && offerToEdit.price_before !== undefined
          ? offerToEdit.price_before.toString()
          : ''
      );
      setPriceAfter(offerToEdit.price_after.toString());
      setBannerUrl(offerToEdit.banner_url || '');
      setStartDate(toDatetimeLocal(offerToEdit.start_date));
      setEndDate(toDatetimeLocal(offerToEdit.end_date));
      setIsActive(offerToEdit.is_active);
      setSortOrder(offerToEdit.sort_order ?? 0);
      setShowUrlFallback(Boolean(offerToEdit.banner_url));
    } else {
      setTitle('');
      setDescription('');
      setPriceBefore('');
      setPriceAfter('');
      setBannerUrl('');
      setStartDate('');
      setEndDate('');
      setIsActive(true);
      setSortOrder(0);
      setShowUrlFallback(false);
    }
    setFormError(null);
  }, [offerToEdit, isOpen]);

  // Accessibility: ESC listener and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Live discount calculations
  const numBefore = priceBefore ? parseFloat(priceBefore) : null;
  const numAfter = priceAfter ? parseFloat(priceAfter) : 0;
  const discountInfo = calculateDiscount(numBefore, numAfter);

  // Image Upload handler (Supabase Storage: offer-banners)
  const processUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جداً، الحد الأقصى المسموح به هو 10 ميجابايت');
      return;
    }

    setIsUploading(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const path = 'banners/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

      const { error: uploadError } = await supabase.storage
        .from('offer-banners')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('offer-banners')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        setBannerUrl(urlData.publicUrl);
      }
    } catch (err: unknown) {
      console.error('Offer banner upload failed:', err);
      const msg = err instanceof Error ? err.message : 'فشل رفع بانر العرض إلى السحابة';
      setFormError(`فشل رفع البانر: ${msg}. يمكنك إدخال رابط الصورة يدوياً بالأسفل.`);
      setShowUrlFallback(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('عنوان العرض الترويجي مطلوب');
      return;
    }

    if (!priceAfter.trim() || isNaN(parseFloat(priceAfter)) || parseFloat(priceAfter) < 0) {
      setFormError('يرجى إدخال سعر العرض الترويجي الحالي بشكل صحيح');
      return;
    }

    if (priceBefore && (isNaN(parseFloat(priceBefore)) || parseFloat(priceBefore) < 0)) {
      setFormError('السعر السابق غير صالح');
      return;
    }

    if (!bannerUrl.trim()) {
      setFormError('يرجى رفع بانر للعرض الترويجي أو إدخال رابط الصورة');
      return;
    }

    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      if (end < start) {
        setFormError('تاريخ انتهاء العرض يجب أن يكون بعد تاريخ البداية');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const parsedPriceAfter = parseFloat(priceAfter);
      const parsedPriceBefore = priceBefore ? parseFloat(priceBefore) : null;
      const parsedStartDate = fromDatetimeLocal(startDate);
      const parsedEndDate = fromDatetimeLocal(endDate);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        price_before: parsedPriceBefore,
        price_after: parsedPriceAfter,
        banner_url: bannerUrl.trim(),
        start_date: parsedStartDate,
        end_date: parsedEndDate,
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
        updated_at: new Date().toISOString(),
      };

      if (offerToEdit) {
        // Update existing offer
        const { data, error } = await supabase
          .from('offers')
          .update(payload)
          .eq('id', offerToEdit.id)
          .select('*')
          .single();

        if (error) throw error;
        if (!data) throw new Error('لم يتم استلام بيانات العرض بعد التعديل');

        onSave(data as Offer);
      } else {
        // Insert new offer
        const { data, error } = await supabase
          .from('offers')
          .insert([payload])
          .select('*')
          .single();

        if (error) throw error;
        if (!data) throw new Error('لم يتم استلام بيانات العرض المنشأ');

        onSave(data as Offer);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Failed to save offer:', err);
      const msg = err instanceof Error ? err.message : 'تعذر حفظ بيانات العرض';
      setFormError(`خطأ: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="offer-modal-title" className="text-base sm:text-lg font-bold text-white">
                {offerToEdit ? 'تعديل بيانات العرض الترويجي' : 'إضافة عرض ترويجي جديد'}
              </h2>
              <p className="text-xs text-slate-400">
                {offerToEdit
                  ? 'قم بتحديث تفاصيل العرض والأسعار والبانر الإعلاني'
                  : 'أدخل تفاصيل العرض الخاص ليظهر لعملاء المطعم وعبر البوت'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Error Banner */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{formError}</div>
            </div>
          )}

          {/* Offer Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>
                عنوان العرض الترويجي <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] text-slate-500">مثال: عرض مكس مشاوي الخديوي العائلي</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اكتب عنوان العرض بشكل جذاب وواضح..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>وصف ومكونات العرض الترويجي</span>
              <span className="text-[11px] text-slate-500">اختياري</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اذكر تفاصيل العرض: الأطباق المرفقة، الإضافات، شروط الاستخدام..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 resize-none leading-relaxed"
            />
          </div>

          {/* Pricing Row: Price Before & Price After */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Price After (Offer Price) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                <span>
                  السعر بعد الخصم (سعر العرض) <span className="text-rose-400">*</span>
                </span>
                <span className="text-[11px] text-slate-500">ج.م EGP</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={priceAfter}
                  onChange={(e) => setPriceAfter(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold pointer-events-none">
                  ج.م
                </span>
              </div>
            </div>

            {/* Price Before (Original Price) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>السعر الأصلي قبل الخصم</span>
                <span className="text-[11px] text-slate-500">اختياري للشطب</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={priceBefore}
                  onChange={(e) => setPriceBefore(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold pointer-events-none">
                  ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Live Discount Preview Banner */}
          {discountInfo.hasDiscount && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <Percent className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-xs font-bold">
                    خصم {discountInfo.discountPercentage}% فعال!
                  </p>
                  <p className="text-[11px] text-emerald-300/80">
                    العميل يوفر {formatCurrency(discountInfo.savingsAmount)} عند طلب هذا العرض
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs">
                وفر {discountInfo.discountPercentage}%
              </span>
            </div>
          )}

          {/* Banner Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  بانر العرض الترويجي <span className="text-rose-400">*</span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowUrlFallback(!showUrlFallback)}
                className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
              >
                <LinkIcon className="w-3 h-3" />
                <span>{showUrlFallback ? 'إخفاء الرابط المباشر' : 'إدخال رابط مباشر'}</span>
              </button>
            </div>

            {/* If Banner is uploaded/provided: Live Preview */}
            {bannerUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group">
                <img
                  src={bannerUrl}
                  alt="معاينة بانر العرض"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>تغيير الصورة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    disabled={isUploading}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/90 text-white hover:bg-rose-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Drag & Drop Upload Zone */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all',
                  isDragOver
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70',
                  isUploading && 'pointer-events-none opacity-60'
                )}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-xs text-slate-300 font-semibold">
                      جارٍ رفع البانر إلى السحابة...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-slate-850 border border-slate-700 text-amber-400">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        اضغط لرفع صورة البانر أو اسحبها وأفلتها هنا
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        صيغ مدعومة: JPG, PNG, WEBP حتى 10 ميجابايت (نسبة 16:9 موصى بها)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Fallback direct URL input */}
            {showUrlFallback && (
              <div className="pt-2 animate-in fade-in">
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500/60"
                  dir="ltr"
                />
              </div>
            )}
          </div>

          {/* Date Window Row: Start Date & End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>تاريخ وبداية العرض</span>
                </span>
                <span className="text-[11px] text-slate-500">اختياري</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-400" />
                  <span>تاريخ ونهاية العرض</span>
                </span>
                <span className="text-[11px] text-slate-500">اختياري</span>
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Active Status & Sort Order */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative focus:outline-none',
                  isActive ? 'bg-emerald-500' : 'bg-slate-800'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    isActive ? 'right-6' : 'right-1'
                  )}
                />
              </button>
              <div>
                <span className="text-xs font-bold text-white block">
                  {isActive ? 'العرض مفعل وجاهز للظهور' : 'العرض متوقف مؤقتاً'}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {isActive
                    ? 'يظهر العرض لعملاء المنيو والبوت'
                    : 'لن يتمكن العملاء من رؤية العرض حتى يتم تفعيله'}
                </span>
              </div>
            </div>

            {/* Sort Order */}
            <div className="flex items-center gap-2 sm:self-center">
              <label className="text-xs text-slate-400 font-medium shrink-0">
                ترتيب العرض:
              </label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs text-center font-bold focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>{offerToEdit ? 'حفظ التعديلات' : 'إنشاء العرض الترويجي'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
