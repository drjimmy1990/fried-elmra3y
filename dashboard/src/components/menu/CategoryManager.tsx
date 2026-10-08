'use client';

import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MenuCategory } from './types';
import { cn } from '@/lib/utils';

interface CategoryManagerProps {
  categories: MenuCategory[];
  selectedCategoryId: string | 'all';
  onSelectCategory: (categoryId: string | 'all') => void;
  onCategoryCreated: (category: MenuCategory) => void;
  onCategoryUpdated: (category: MenuCategory) => void;
  onCategoryDeleted: (categoryId: string) => void;
  totalItemsCount: number;
}

export function CategoryManager({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCategoryCreated,
  onCategoryUpdated,
  onCategoryDeleted,
  totalItemsCount,
}: CategoryManagerProps) {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggling status state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingCategory(null);
    setFormNameAr('');
    setFormNameEn('');
    setFormImageUrl('');
    setFormSortOrder(categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 : 1);
    setFormIsActive(true);
    setFormError(null);
    setIsFormOpen(false);
  };

  const openAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (category: MenuCategory) => {
    setEditingCategory(category);
    setFormNameAr(category.name_ar);
    setFormNameEn(category.name_en || '');
    setFormImageUrl(category.image_url || '');
    setFormSortOrder(category.sort_order ?? 0);
    setFormIsActive(category.is_active);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جداً، الحد الأقصى هو 5 ميجابايت');
      return;
    }

    setIsUploading(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `categories/${Date.now()}-${sanitizedName}`;

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

      setFormImageUrl(urlData.publicUrl);
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      const msg = err instanceof Error ? err.message : 'فشل رفع الصورة للسحابة';
      setFormError(`فشل رفع الصورة: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Save Category Handler
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameAr.trim()) {
      setFormError('يرجى إدخال اسم القسم بالعربية');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const supabase = createClient();

      if (editingCategory) {
        // Update existing category
        const { data, error } = await supabase
          .from('menu_categories')
          .update({
            name_ar: formNameAr.trim(),
            name_en: formNameEn.trim() || null,
            image_url: formImageUrl.trim() || null,
            sort_order: Number(formSortOrder) || 0,
            is_active: formIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id)
          .select()
          .single();

        if (error) throw error;

        const updated: MenuCategory = {
          ...data,
          item_count: editingCategory.item_count || 0,
        };
        onCategoryUpdated(updated);
      } else {
        // Create new category
        const { data, error } = await supabase
          .from('menu_categories')
          .insert({
            name_ar: formNameAr.trim(),
            name_en: formNameEn.trim() || null,
            image_url: formImageUrl.trim() || null,
            sort_order: Number(formSortOrder) || 0,
            is_active: formIsActive,
          })
          .select()
          .single();

        if (error) throw error;

        const created: MenuCategory = {
          ...data,
          item_count: 0,
        };
        onCategoryCreated(created);
      }

      resetForm();
    } catch (err: unknown) {
      console.error('Error saving category:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحفظ';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Category Handler
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', categoryToDelete.id);

      if (error) throw error;

      onCategoryDeleted(categoryToDelete.id);

      // Reset selection if currently selected
      if (selectedCategoryId === categoryToDelete.id) {
        onSelectCategory('all');
      }

      setCategoryToDelete(null);
    } catch (err: unknown) {
      console.error('Error deleting category:', err);
      const msg = err instanceof Error ? err.message : 'فشل حذف القسم، يرجى المحاولة لاحقاً';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle Category Active Status
  const handleToggleActive = async (category: MenuCategory) => {
    setTogglingId(category.id);
    const newStatus = !category.is_active;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_categories')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) throw error;

      onCategoryUpdated({
        ...category,
        is_active: newStatus,
      });
    } catch (err) {
      console.error('Failed to toggle category active status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Pills Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Scrollable Pills List */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {/* "All" Chip */}
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={cn(
              'shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm',
              selectedCategoryId === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/25'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700'
            )}
          >
            <span>الكل</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-xs font-bold',
                selectedCategoryId === 'all'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              )}
            >
              {totalItemsCount}
            </span>
          </button>

          {/* Category Chips */}
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm',
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/25'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700',
                  !category.is_active && 'opacity-60 border-dashed'
                )}
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name_ar}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{category.name_ar}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs font-bold',
                    isSelected
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {category.item_count || 0}
                </span>
                {!category.is_active && (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300">
                    معطل
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Manage Categories Button */}
        <button
          type="button"
          onClick={() => setIsManageModalOpen(true)}
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 shadow-sm transition-all"
        >
          <FolderKanban className="w-4 h-4" />
          <span>إدارة الأقسام</span>
          <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full font-bold">
            {categories.length}
          </span>
        </button>
      </div>

      {/* Categories Management Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">إدارة أقسام قائمة الطعام</h3>
                  <p className="text-xs text-slate-400">
                    إضافة أقسام جديدة، تعديل أسمائها وصورها، وإعادة ترتيب ظهورها بالمنيو
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  resetForm();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Action Bar in Modal */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  الأقسام المسجلة حالياً: <span className="font-bold text-white">{categories.length}</span>
                </div>
                {!isFormOpen && (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة قسم جديد</span>
                  </button>
                )}
              </div>

              {/* Collapsible Form for Add / Edit Category */}
              {isFormOpen && (
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-lg animate-in slide-in-from-top duration-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                      {editingCategory ? (
                        <>
                          <Edit2 className="w-4 h-4 text-amber-400" />
                          <span>تعديل قسم: {editingCategory.name_ar}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-amber-400" />
                          <span>إضافة قسم جديد للمنيو</span>
                        </>
                      )}
                    </h4>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>

                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name Arabic */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          اسم القسم بالعربية <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: مشويات الخديوي"
                          value={formNameAr}
                          onChange={(e) => setFormNameAr(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors"
                        />
                      </div>

                      {/* Name English */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          اسم القسم بالإنجليزية (اختياري)
                        </label>
                        <input
                          type="text"
                          placeholder="Example: Grills & Barbecue"
                          value={formNameEn}
                          onChange={(e) => setFormNameEn(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      {/* Sort Order */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          ترتيب الظهور في المنيو (Sort Order)
                        </label>
                        <input
                          type="number"
                          value={formSortOrder}
                          onChange={(e) => setFormSortOrder(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors"
                        />
                      </div>

                      {/* Active Status Toggle */}
                      <div className="flex items-center gap-3 pt-5">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsActive}
                            onChange={(e) => setFormIsActive(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                        <span className="text-xs font-medium text-slate-300">
                          {formIsActive ? 'القسم مفعل وظاهر للعملاء' : 'القسم معطل مؤقتاً'}
                        </span>
                      </div>
                    </div>

                    {/* Image Upload / URL */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        صورة القسم (أيقونة أو صورة توضيحية)
                      </label>
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-900/50 hover:bg-slate-900 cursor-pointer text-xs text-slate-300 transition-colors">
                            <UploadCloud className="w-4 h-4 text-amber-400" />
                            <span>{isUploading ? 'جاري رفع الصورة...' : 'رفع صورة من جهازك'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploading}
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                          <span className="text-xs text-slate-500 text-center">أو أدخل الرابط مباشرة</span>
                          <input
                            type="url"
                            placeholder="https://... رابط الصورة"
                            value={formImageUrl}
                            onChange={(e) => setFormImageUrl(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-colors text-left"
                            dir="ltr"
                          />
                        </div>

                        {formImageUrl && (
                          <div className="flex items-center gap-3 p-2 bg-slate-900/90 rounded-xl border border-slate-800">
                            <img
                              src={formImageUrl}
                              alt="معاينة"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300 font-mono truncate">{formImageUrl}</p>
                              <span className="text-[10px] text-emerald-400">معاينة الصورة جاهزة</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormImageUrl('')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={resetForm}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving || isUploading}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{editingCategory ? 'حفظ التعديلات' : 'إضافة القسم'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Categories Table / List */}
              <div className="space-y-2">
                {categories.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                    <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-300">لا توجد أقسام مسجلة حتى الآن</p>
                    <p className="text-xs text-slate-500 mt-1">
                      أضف أول قسم في قائمة طعامك (مثل: مشويات، ساندوتشات، مشروبات)
                    </p>
                    <button
                      type="button"
                      onClick={openAddForm}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة قسم جديد الآن</span>
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 divide-y divide-slate-800">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className={cn(
                          'flex items-center justify-between p-4 transition-colors hover:bg-slate-900/50',
                          !category.is_active && 'bg-slate-950/40 opacity-70'
                        )}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Image or Icon */}
                          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {category.image_url ? (
                              <img
                                src={category.image_url}
                                alt={category.name_ar}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FolderKanban className="w-5 h-5 text-amber-400" />
                            )}
                          </div>

                          {/* Names and info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-white truncate">{category.name_ar}</h5>
                              {category.name_en && (
                                <span className="text-xs text-slate-400 font-normal">
                                  ({category.name_en})
                                </span>
                              )}
                              <span
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full font-bold',
                                  category.is_active
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                )}
                              >
                                {category.is_active ? 'مفعل' : 'معطل'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              <span>
                                عدد الأطباق: <strong className="text-slate-300">{category.item_count || 0}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                ترتيب الظهور: <strong className="text-slate-300">#{category.sort_order}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Active Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(category)}
                            disabled={togglingId === category.id}
                            title={category.is_active ? 'تعطيل القسم' : 'تفعيل القسم'}
                            className={cn(
                              'p-2 rounded-xl transition-colors',
                              category.is_active
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-slate-500 hover:bg-slate-800'
                            )}
                          >
                            {togglingId === category.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : category.is_active ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => openEditForm(category)}
                            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                            title="تعديل بيانات القسم"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setCategoryToDelete(category)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="حذف القسم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                ملاحظة: يمكنك إخفاء القسم دون حذفه عبر تبديل حالة التفعيل.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">تأكيد حذف القسم</h4>
                <p className="text-xs text-slate-400">{categoryToDelete.name_ar}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 leading-relaxed">
              ⚠️ <strong>تحذير هام:</strong> حذف هذا القسم سيؤدي إلى <strong>حذف جميع الأطباق والأصناف المندرجة تحته تلقائياً ({categoryToDelete.item_count || 0} صنف)</strong> من قاعدة البيانات والمنيو! هل أنت متأكد من الحذف نهائياً؟
            </div>

            {deleteError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>نعم، حذف نهائياً</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
