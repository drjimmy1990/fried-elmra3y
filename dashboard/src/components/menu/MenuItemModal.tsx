'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Sparkles,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { MenuItem, MenuCategory, MENU_BADGES, MenuBadgeKey } from './types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MenuCategory[];
  initialItem?: MenuItem | null;
  defaultCategoryId?: string;
  onSave: (savedItem: MenuItem) => void;
}

export function MenuItemModal({
  isOpen,
  onClose,
  categories,
  initialItem,
  defaultCategoryId,
  onSave,
}: MenuItemModalProps) {
  // Form State
  const [categoryId, setCategoryId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [badges, setBadges] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<number>(0);

  // Upload and Submission State
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize or reset form when modal opens or initialItem changes
  useEffect(() => {
    if (initialItem) {
      setCategoryId(initialItem.category_id);
      setNameAr(initialItem.name_ar);
      setNameEn(initialItem.name_en || '');
      setDescription(initialItem.description || '');
      setPrice(initialItem.price.toString());
      setSalePrice(
        initialItem.sale_price !== null && initialItem.sale_price !== undefined
          ? initialItem.sale_price.toString()
          : ''
      );
      setImageUrl(initialItem.image_url || '');
      setIsAvailable(initialItem.is_available);
      setBadges(initialItem.badges || []);
      setSortOrder(initialItem.sort_order || 0);
    } else {
      // Default values for new dish
      const fallbackCat =
        defaultCategoryId && defaultCategoryId !== 'all'
          ? defaultCategoryId
          : categories.length > 0
          ? categories[0].id
          : '';

      setCategoryId(fallbackCat);
      setNameAr('');
      setNameEn('');
      setDescription('');
      setPrice('');
      setSalePrice('');
      setImageUrl('');
      setIsAvailable(true);
      setBadges([]);
      setSortOrder(0);
    }
    setFormError(null);
  }, [initialItem, defaultCategoryId, categories, isOpen]);

  if (!isOpen) return null;

  // Toggle badge checkbox
  const handleToggleBadge = (badgeKey: string) => {
    setBadges((prev) =>
      prev.includes(badgeKey) ? prev.filter((b) => b !== badgeKey) : [...prev, badgeKey]
    );
  };

  // Image Upload directly to Supabase Storage `menu-assets`
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جداً، الحد الأقصى المسموح به هو 8 ميجابايت');
      return;
    }

    setIsUploading(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `items/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('menu-assets')
        .getPublicUrl(filePath);

      setImageUrl(urlData.publicUrl);
    } catch (err: unknown) {
      console.error('Menu item image upload failed:', err);
      const msg = err instanceof Error ? err.message : 'فشل رفع صورة الطبق إلى السحابة';
      setFormError(`فشل رفع الصورة: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Keyboard accessibility and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Calculate live discount percentage
  const numPrice = parseFloat(price);
  const numSalePrice = salePrice.trim() !== '' ? parseFloat(salePrice) : null;
  const hasValidDiscount =
    !isNaN(numPrice) &&
    numPrice > 0 &&
    numSalePrice !== null &&
    !isNaN(numSalePrice) &&
    numSalePrice > 0 &&
    numSalePrice < numPrice;

  const discountPercent = hasValidDiscount
    ? Math.round(((numPrice - (numSalePrice as number)) / numPrice) * 100)
    : 0;

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!nameAr.trim()) {
      setFormError('يرجى إدخال اسم الطبق باللغة العربية');
      return;
    }

    if (!categoryId) {
      setFormError('يرجى اختيار القسم التابع له هذا الطبق');
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('يرجى إدخال سعر صحيح للطبق (أكبر من أو يساوي 0)');
      return;
    }

    if (numSalePrice !== null && !isNaN(numSalePrice)) {
      if (numSalePrice < 0) {
        setFormError('سعر الخصم يجب ألا يكون بالسالب');
        return;
      }
      if (numSalePrice >= numPrice) {
        setFormError('سعر الخصم (سعر العرض) يجب أن يكون أقل من السعر الأصلي للطبق');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const payload = {
        category_id: categoryId,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || null,
        description: description.trim() || null,
        price: numPrice,
        sale_price: numSalePrice !== null && !isNaN(numSalePrice) ? numSalePrice : null,
        image_url: imageUrl.trim() || null,
        is_available: isAvailable,
        badges: badges,
        sort_order: Number(sortOrder) || 0,
        updated_at: new Date().toISOString(),
      };

      const cat = categories.find((c) => c.id === categoryId) || null;

      if (initialItem) {
        // Update
        const { data, error } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', initialItem.id)
          .select('*')
          .single();

        if (error) throw error;

        const updatedItem: MenuItem = {
          ...data,
          category: cat,
        };

        onSave(updatedItem);
      } else {
        // Insert
        const { data, error } = await supabase
          .from('menu_items')
          .insert(payload)
          .select('*')
          .single();

        if (error) throw error;

        const createdItem: MenuItem = {
          ...data,
          category: cat,
        };

        onSave(createdItem);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Failed to save menu item:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الصنف في قاعدة البيانات';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-item-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 id="menu-item-modal-title" className="text-lg font-bold text-white">
                {initialItem ? 'تعديل بيانات الطبق' : 'إضافة طبق جديد للمنيو'}
              </h3>
              <p className="text-xs text-slate-400">
                {initialItem
                  ? `تعديل معلومات وأسعار: ${initialItem.name_ar}`
                  : 'أدخل تفاصيل الطبق، الأسعار، الصور والشارات الترويجية'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form id="menu-item-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                القسم الرئيسي <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors"
              >
                <option value="" disabled>
                  -- اختر القسم المندرج تحته هذا الطبق --
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_ar} {cat.name_en ? `(${cat.name_en})` : ''} {!cat.is_active ? ' - [معطل]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Names: Arabic & English */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم الطبق بالعربية <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كيلو مشكل كباب وكفتة"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم الطبق بالإنجليزية (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="Example: Mixed Kebab & Kofta (1kg)"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Description Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                وصف الطبق والمكونات (يساعد البوت في إجابة أسئلة العملاء)
              </label>
              <textarea
                rows={2}
                placeholder="مثال: كباب بتلو متبل مع كفتة ضاني مشوية على الفحم، تقدم مع أرز بسمتي وسلطات وخبز ساخن..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Pricing Section: Price & Sale Price */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>التسعير والعروض</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-mono">
                    EGP (ج.م)
                  </span>
                </span>
                {hasValidDiscount && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg animate-pulse">
                    <Percent className="w-3 h-3" />
                    <span>نسبة الخصم: {discountPercent}%</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    السعر الأساسي (ج.م) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="مثال: 150"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-mono transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    سعر العرض / التخفيض (اختياري)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="مثال: 120 (اتركه فارغاً إن لم يكن هناك خصم)"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-mono transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Food Image Upload & Preview */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                صورة الطبق (تظهر في المنيو وبوت المحادثة)
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-950/50 hover:bg-slate-950 cursor-pointer text-xs text-slate-300 transition-colors">
                  <UploadCloud className="w-4 h-4 text-amber-400" />
                  <span>{isUploading ? 'جاري رفع الصورة إلى السحابة...' : 'رفع صورة من جهازك'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500 text-center">أو الرابط المباشر</span>
                <input
                  type="url"
                  placeholder="https://... رابط الصورة المباشر"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 transition-colors text-left"
                  dir="ltr"
                />
              </div>

              {imageUrl && (
                <div className="flex items-center gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <img
                    src={imageUrl}
                    alt="معاينة"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-700"
                    onError={() => setFormError('تعذر تحميل معاينة الصورة، تأكد من صحة الرابط')}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 font-mono truncate">{imageUrl}</p>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      الصورة جاهزة
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Badges Toggles */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                الشارات الترويجية (Badges)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(Object.keys(MENU_BADGES) as MenuBadgeKey[]).map((key) => {
                  const badge = MENU_BADGES[key];
                  const isChecked = badges.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleToggleBadge(key)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all',
                        isChecked
                          ? `${badge.bgClass} ${badge.textClass} ${badge.borderClass} shadow-xs`
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                      {isChecked && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Availability & Sort Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800 items-center">
              {/* Availability Toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {isAvailable ? 'متاح للطلب الآن' : 'غير متوفر حالياً (نفذت الكمية)'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isAvailable ? 'يظهر للعملاء في البوت' : 'لن يتمكن العملاء من طلبه'}
                  </span>
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ترتيب الظهور داخل القسم
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-colors"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="menu-item-form"
            disabled={isSubmitting || isUploading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري حفظ الطبق...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{initialItem ? 'تحديث الطبق' : 'إضافة الطبق للمنيو'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
