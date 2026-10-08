'use client';

import React, { useState } from 'react';
import {
  Utensils,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Tag,
  Percent,
} from 'lucide-react';
import { MenuItem, MENU_BADGES, MenuBadgeKey } from './types';
import { formatCurrency, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface MenuItemCardProps {
  item: MenuItem;
  categoryName?: string;
  onEdit: (item: MenuItem) => void;
  onDelete: (itemId: string) => void;
  onItemUpdated: (updatedItem: MenuItem) => void;
}

export function MenuItemCard({
  item,
  categoryName,
  onEdit,
  onDelete,
  onItemUpdated,
}: MenuItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Discount calculation
  const hasDiscount =
    item.sale_price !== null &&
    item.sale_price !== undefined &&
    item.sale_price > 0 &&
    item.sale_price < item.price;

  const discountPercentage = hasDiscount
    ? Math.round(((item.price - (item.sale_price as number)) / item.price) * 100)
    : 0;

  // Toggle availability instantly with optimistic update
  const handleToggleAvailability = async () => {
    if (isTogglingAvailability) return;
    const newStatus = !item.is_available;
    setIsTogglingAvailability(true);

    // Optimistic parent update
    onItemUpdated({
      ...item,
      is_available: newStatus,
    });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .update({
          is_available: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Failed to toggle item availability:', err);
      // Rollback on failure
      onItemUpdated({
        ...item,
        is_available: !newStatus,
      });
      alert('تعذر تحديث حالة توفر الصنف في قاعدة البيانات. يرجى التحقق من الاتصال بالإنترنت.');
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  // Delete Item Handler
  const handleDeleteItem = async () => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      onDelete(item.id);
    } catch (err) {
      console.error('Failed to delete item:', err);
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-700 hover:shadow-xl hover:shadow-black/40',
          !item.is_available && 'opacity-75 border-slate-800/60'
        )}
      >
        {/* Card Header & Image Thumbnail */}
        <div className="relative w-full aspect-16/10 bg-slate-950 overflow-hidden">
          {item.image_url && !imageError ? (
            <img
              src={item.image_url}
              alt={item.name_ar}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-slate-800 to-slate-950 text-slate-600">
              <Utensils className="w-12 h-12 stroke-[1.5]" />
              <span className="text-[11px] mt-1 text-slate-500 font-medium">مطعم الخديوي</span>
            </div>
          )}

          {/* Top Overlays */}
          <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
            {/* Category Tag */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950/80 text-amber-300 border border-slate-700/80 backdrop-blur-xs">
              {categoryName || item.category?.name_ar || 'عام'}
            </span>

            {/* Discount Badge */}
            {hasDiscount && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30">
                <Percent className="w-3 h-3" />
                <span>خصم {discountPercentage}%</span>
              </span>
            )}
          </div>

          {/* Badges Bar (Bottom of image) */}
          {item.badges && item.badges.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
              {item.badges.map((badgeKey) => {
                const config = MENU_BADGES[badgeKey as MenuBadgeKey];
                if (!config) {
                  return (
                    <span
                      key={badgeKey}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {badgeKey}
                    </span>
                  );
                }
                return (
                  <span
                    key={badgeKey}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-xs shadow-xs',
                      config.bgClass,
                      config.textClass,
                      config.borderClass
                    )}
                  >
                    <span>{config.shortLabel}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Out of Stock Overlay Ribbon */}
          {!item.is_available && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-xl bg-rose-500/90 text-white font-bold text-xs shadow-lg flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>غير متوفر حالياً</span>
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            {/* Dish Names */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                {item.name_ar}
              </h4>
            </div>
            {item.name_en && (
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5" dir="ltr">
                {item.name_en}
              </p>
            )}

            {/* Description */}
            {item.description ? (
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            ) : (
              <p className="text-xs text-slate-600 mt-2 italic">لا يوجد وصف للطبق</p>
            )}
          </div>

          {/* Price Section */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium">السعر</span>
              <div className="flex items-baseline gap-2">
                {hasDiscount ? (
                  <>
                    <span className="text-lg font-black text-emerald-400">
                      {formatCurrency(item.sale_price as number)}
                    </span>
                    <del className="text-xs text-slate-500 font-medium">
                      {formatCurrency(item.price)}
                    </del>
                  </>
                ) : (
                  <span className="text-lg font-black text-white">
                    {formatCurrency(item.price)}
                  </span>
                )}
              </div>
            </div>

            {/* Availability Toggle Switch */}
            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={isTogglingAvailability}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs',
                item.is_available
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              )}
            >
              {isTogglingAvailability ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : item.is_available ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>متاح للطلب</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>نفذت الكمية</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            ترتيب: <strong className="text-slate-400">#{item.sort_order}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              title="تعديل بيانات الطبق"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="حذف الطبق"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Item Confirmation Dialog */}
      {isConfirmingDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">حذف الصنف من المنيو</h4>
                <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.name_ar}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف <strong>"{item.name_ar}"</strong> نهائياً من قائمة الطعام؟ لن يتمكن العملاء أو البوت من طلبه بعد الحذف.
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
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>نعم، احذف</span>
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
