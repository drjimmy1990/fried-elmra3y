'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  UtensilsCrossed,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { MenuItem, MenuCategory } from './types';
import { MenuItemCard } from './MenuItemCard';
import { MenuItemModal } from './MenuItemModal';
import { cn } from '@/lib/utils';

interface MenuItemGridProps {
  items: MenuItem[];
  categories: MenuCategory[];
  selectedCategoryId: string | 'all';
  onSelectCategory: (categoryId: string | 'all') => void;
  onItemCreated: (newItem: MenuItem) => void;
  onItemUpdated: (updatedItem: MenuItem) => void;
  onItemDeleted: (deletedItemId: string) => void;
}

type AvailabilityFilter = 'all' | 'available' | 'unavailable';
type SortOption = 'sort_order' | 'price_asc' | 'price_desc' | 'newest';

export function MenuItemGrid({
  items,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onItemCreated,
  onItemUpdated,
  onItemDeleted,
}: MenuItemGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('sort_order');
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string | 'all'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<MenuItem | null>(null);

  // Map categories by ID for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => {
      map.set(c.id, c.name_ar);
    });
    return map;
  }, [categories]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Category filter
        if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) {
          return false;
        }

        // Availability filter
        if (availabilityFilter === 'available' && !item.is_available) {
          return false;
        }
        if (availabilityFilter === 'unavailable' && item.is_available) {
          return false;
        }

        // Badge filter
        if (selectedBadgeFilter !== 'all') {
          if (!item.badges || !item.badges.includes(selectedBadgeFilter)) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLowerCase();
          const nameArMatch = item.name_ar.toLowerCase().includes(query);
          const nameEnMatch = item.name_en?.toLowerCase().includes(query) ?? false;
          const descMatch = item.description?.toLowerCase().includes(query) ?? false;
          if (!nameArMatch && !nameEnMatch && !descMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'price_asc') {
          const priceA = a.sale_price || a.price;
          const priceB = b.sale_price || b.price;
          return priceA - priceB;
        }
        if (sortOption === 'price_desc') {
          const priceA = a.sale_price || a.price;
          const priceB = b.sale_price || b.price;
          return priceB - priceA;
        }
        if (sortOption === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        // Default: sort_order asc
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
  }, [items, selectedCategoryId, availabilityFilter, selectedBadgeFilter, searchQuery, sortOption]);

  const handleOpenAddModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const handleSaveModal = (savedItem: MenuItem) => {
    if (itemToEdit) {
      onItemUpdated(savedItem);
    } else {
      onItemCreated(savedItem);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث بالاسم العربي، الإنجليزي، أو المكونات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Availability Filter Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setAvailabilityFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                availabilityFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              الكل ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('available')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                availabilityFilter === 'available'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-emerald-400'
              )}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>متاح ({items.filter((i) => i.is_available).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('unavailable')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                availabilityFilter === 'unavailable'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-rose-400'
              )}
            >
              <XCircle className="w-3 h-3" />
              <span>غير متوفر ({items.filter((i) => !i.is_available).length})</span>
            </button>
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-300 transition-colors cursor-pointer"
            >
              <option value="sort_order">ترتيب القائمة الافتراضي</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
              <option value="newest">الأحدث إضافة</option>
            </select>
          </div>

          {/* Add Dish Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة طبق جديد</span>
          </button>
        </div>
      </div>

      {/* Quick Badge Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 shrink-0 font-medium">تصفية سريعة:</span>
        <button
          type="button"
          onClick={() => setSelectedBadgeFilter('all')}
          className={cn(
            'px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0',
            selectedBadgeFilter === 'all'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          جميع الأصناف
        </button>
        <button
          type="button"
          onClick={() => setSelectedBadgeFilter('bestseller')}
          className={cn(
            'px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1',
            selectedBadgeFilter === 'bestseller'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-amber-400'
          )}
        >
          <span>⭐ الأكثر طلباً</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedBadgeFilter('spicy')}
          className={cn(
            'px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1',
            selectedBadgeFilter === 'spicy'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-rose-400'
          )}
        >
          <span>🌶️ حار سبايسي</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedBadgeFilter('new')}
          className={cn(
            'px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1',
            selectedBadgeFilter === 'new'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
              : 'text-slate-400 hover:text-orange-400'
          )}
        >
          <span>🔥 أصناف جديدة</span>
        </button>
      </div>

      {/* Grid of Dish Cards */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mb-4">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">لم يتم العثور على أطباق مطابقة</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            {searchQuery || availabilityFilter !== 'all' || selectedBadgeFilter !== 'all'
              ? 'جرب تغيير معايير البحث أو تصفية التوفر لإظهار المزيد من الأصناف.'
              : 'هذا القسم لا يحتوي على أي أطباق مسجلة حتى الآن. أضف طبقك الأول لتنشيط القسم!'}
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طبق الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              categoryName={categoryMap.get(item.category_id)}
              onEdit={handleOpenEditModal}
              onDelete={onItemDeleted}
              onItemUpdated={onItemUpdated}
            />
          ))}
        </div>
      )}

      {/* Item Modal Form (Add / Edit) */}
      <MenuItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        initialItem={itemToEdit}
        defaultCategoryId={selectedCategoryId}
        onSave={handleSaveModal}
      />
    </div>
  );
}
