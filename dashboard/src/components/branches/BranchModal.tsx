'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, Globe, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BranchWithZones, BranchRow } from './types';

interface BranchModalProps {
  branch: BranchWithZones | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (branch: BranchRow) => void;
}

export function BranchModal({ branch, isOpen, onClose, onSaved }: BranchModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEditing = Boolean(branch);

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setPhone(branch.phone || '');
      setAddress(branch.address || '');
      setGoogleMapsUrl(branch.google_maps_url || '');
      setIsActive(branch.is_active ?? true);
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setGoogleMapsUrl('');
      setIsActive(true);
    }
    setErrorMsg('');
  }, [branch, isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('اسم الفرع مطلوب');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('عنوان الفرع بالتفصيل مطلوب');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const supabase = createClient();

      if (isEditing && branch) {
        const { data, error } = await supabase
          .from('branches')
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
            address: address.trim(),
            google_maps_url: googleMapsUrl.trim() || null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', branch.id)
          .select()
          .single();

        if (error || !data) throw error || new Error('فشل تحديث الفرع');
        onSaved(data);
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert({
            name: name.trim(),
            phone: phone.trim() || null,
            address: address.trim(),
            google_maps_url: googleMapsUrl.trim() || null,
            is_active: isActive,
          })
          .select()
          .single();

        if (error || !data) throw error || new Error('فشل إضافة الفرع');
        onSaved(data);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Error saving branch:', err);
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الفرع');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `تعديل بيانات: ${branch?.name}` : 'إضافة فرع مطعم جديد'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد اسم الفرع وعنوانه وأرقام التواصل للبوت والعملاء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Branch Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اسم الفرع <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: فرع الدقي، فرع المهندسين..."
                required
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              رقم هاتف الفرع (للتواصل أو الطيارين)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-right"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              عنوان الفرع بالتفصيل <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: شارع مصدق تقاطع محيي الدين، بجوار سينما التحرير..."
                rows={2}
                required
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Google Maps URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              رابط موقع الفرع على خرائط جوجل (Google Maps)
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                dir="ltr"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              يستخدمه البوت لإرسال لوكيشن الفرع عندما يسأل العميل عنه.
            </p>
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-200 block">حالة الفرع للتشغيل</span>
              <span className="text-[11px] text-slate-400">
                عند التعطيل، لن يقترح البوت هذا الفرع ولن يستقبل طلبات جديدة
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isActive ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/50 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'حفظ التعديلات' : 'إضافة الفرع'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
