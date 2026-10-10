'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Check,
  Loader2,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { BranchWithZones, DeliveryZoneRow } from './types';

interface DeliveryZonesModalProps {
  branch: BranchWithZones | null;
  isOpen: boolean;
  onClose: () => void;
  onZonesUpdated: () => void;
}

export function DeliveryZonesModal({
  branch,
  isOpen,
  onClose,
  onZonesUpdated,
}: DeliveryZonesModalProps) {
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state for creating / editing zone
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<string>('20');
  const [estimatedTime, setEstimatedTime] = useState('30-45 دقيقة');
  const [isZoneActive, setIsZoneActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch zones when branch opens
  useEffect(() => {
    if (!branch || !isOpen) return;

    const fetchZones = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('branch_delivery_zones')
        .select('*')
        .eq('branch_id', branch.id)
        .order('zone_name', { ascending: true });

      if (!error && data) {
        setZones(data);
      }
      setIsLoading(false);
    };

    fetchZones();
    resetForm();
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

  const resetForm = () => {
    setEditingZoneId(null);
    setZoneName('');
    setDeliveryFee('20');
    setEstimatedTime('30-45 دقيقة');
    setIsZoneActive(true);
    setErrorMsg('');
  };

  const handleEditClick = (zone: DeliveryZoneRow) => {
    setEditingZoneId(zone.id);
    setZoneName(zone.zone_name);
    setDeliveryFee(String(zone.delivery_fee));
    setEstimatedTime(zone.estimated_delivery_time || '');
    setIsZoneActive(zone.is_active ?? true);
    setErrorMsg('');
  };

  const handleToggleZone = async (zone: DeliveryZoneRow) => {
    const newStatus = !zone.is_active;
    const supabase = createClient();

    // Optimistic
    setZones((prev) =>
      prev.map((z) => (z.id === zone.id ? { ...z, is_active: newStatus } : z))
    );

    const { error } = await supabase
      .from('branch_delivery_zones')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', zone.id);

    if (error) {
      console.error('Failed to toggle zone status:', error);
      setZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: !newStatus } : z))
      );
    } else {
      onZonesUpdated();
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المنطقة؟')) return;

    const supabase = createClient();
    const prevZones = [...zones];
    setZones((prev) => prev.filter((z) => z.id !== zoneId));

    const { error } = await supabase
      .from('branch_delivery_zones')
      .delete()
      .eq('id', zoneId);

    if (error) {
      console.error('Failed to delete zone:', error);
      setZones(prevZones);
      alert('تعذر حذف المنطقة');
    } else {
      onZonesUpdated();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    if (!zoneName.trim()) {
      setErrorMsg('اسم المنطقة أو الحي مطلوب');
      return;
    }
    const feeNum = parseFloat(deliveryFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setErrorMsg('سعر التوصيل يجب أن يكون رقماً صحيحاً أو صفراً');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const supabase = createClient();

      if (editingZoneId) {
        const { data, error } = await supabase
          .from('branch_delivery_zones')
          .update({
            zone_name: zoneName.trim(),
            delivery_fee: feeNum,
            estimated_delivery_time: estimatedTime.trim() || null,
            is_active: isZoneActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingZoneId)
          .select()
          .single();

        if (error || !data) throw error || new Error('فشل تحديث المنطقة');
        setZones((prev) => prev.map((z) => (z.id === editingZoneId ? data : z)));
      } else {
        const { data, error } = await supabase
          .from('branch_delivery_zones')
          .insert({
            branch_id: branch.id,
            zone_name: zoneName.trim(),
            delivery_fee: feeNum,
            estimated_delivery_time: estimatedTime.trim() || null,
            is_active: isZoneActive,
          })
          .select()
          .single();

        if (error || !data) throw error || new Error('فشل إضافة المنطقة');
        setZones((prev) => [...prev, data]);
      }

      resetForm();
      onZonesUpdated();
    } catch (err: unknown) {
      console.error('Error saving zone:', err);
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ المنطقة');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !branch) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                مناطق وأسعار توصيل: {branch.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد الأحياء والمناطق التابعة للفرع وتكلفة ومدة التوصيل لكل منطقة للبوت
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Add / Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>{editingZoneId ? 'تعديل المنطقة' : 'إضافة منطقة توصيل جديدة للفرع'}</span>
              </span>
              {editingZoneId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  اسم المنطقة / الحي <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="مثال: المهندسين، الدقي..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  سعر التوصيل (ج.م) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="20"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  الوقت التقديري للتوصيل
                </label>
                <input
                  type="text"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder="30-45 دقيقة"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isZoneActive}
                  onChange={(e) => setIsZoneActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                />
                <span>منطقة متاحة ومفعلة للطلب</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{editingZoneId ? 'حفظ التعديل' : 'إضافة المنطقة'}</span>
              </button>
            </div>
          </form>

          {/* Zones List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                قائمة المناطق الحالية ({zones.length})
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                <span>جاري تحميل مناطق التوصيل...</span>
              </div>
            ) : zones.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-center">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  لم يتم إضافة أي مناطق توصيل لهذا الفرع بعد.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  أضف المناطق أعلاه لتحديد تكلفة التوصيل التي سيحسبها البوت للعملاء.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 rounded-2xl bg-slate-950/40 border border-slate-800 overflow-hidden">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleZone(zone)}
                        className={`h-2.5 w-2.5 rounded-full ${
                          zone.is_active ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={zone.is_active ? 'مفعلة (انقر للتعطيل)' : 'معطلة (انقر للتفعيل)'}
                      />
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>{zone.zone_name}</span>
                          {!zone.is_active && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 text-[10px]">
                              متوقفة
                            </span>
                          )}
                        </div>
                        {zone.estimated_delivery_time && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{zone.estimated_delivery_time}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-amber-400">
                        {formatCurrency(Number(zone.delivery_fee) || 0)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditClick(zone)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                          title="تعديل المنطقة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                          title="حذف المنطقة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/80 text-xs">
          <span className="text-slate-400">
            يستخدم البوت هذه المناطق وأسعارها لحساب الإجمالي بدقة للعميل
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
