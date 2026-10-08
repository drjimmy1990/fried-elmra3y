'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UtensilsCrossed,
  FileImage,
  Utensils,
  Layers,
  Sparkles,
  Percent,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { MenuCategory, MenuItem, FullMenuSettings } from './types';
import { CategoryManager } from './CategoryManager';
import { MenuItemGrid } from './MenuItemGrid';
import { FullMenuUploader } from './FullMenuUploader';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface MenuManagerProps {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  initialFullMenu: FullMenuSettings;
}

type TabType = 'catalog' | 'master_menu';

export function MenuManager({
  initialCategories,
  initialItems,
  initialFullMenu,
}: MenuManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [fullMenu, setFullMenu] = useState<FullMenuSettings>(initialFullMenu);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');

  // Recalculate categories with updated item counts
  const categoriesWithCounts = useMemo(() => {
    return categories.map((cat) => {
      const count = items.filter((item) => item.category_id === cat.id).length;
      return {
        ...cat,
        item_count: count,
      };
    });
  }, [categories, items]);

  // Overall Catalog Statistics
  const stats = useMemo(() => {
    const totalItems = items.length;
    const availableItems = items.filter((i) => i.is_available).length;
    const outOfStockItems = totalItems - availableItems;
    const discountedItems = items.filter(
      (i) => i.sale_price !== null && i.sale_price !== undefined && i.sale_price > 0 && i.sale_price < i.price
    ).length;
    const totalCategories = categories.length;

    return {
      totalItems,
      availableItems,
      outOfStockItems,
      discountedItems,
      totalCategories,
    };
  }, [items, categories]);

  // Realtime subscription to menu_items and menu_categories (optional live sync)
  useEffect(() => {
    const supabase = createClient();

    const itemsChannel = supabase
      .channel('menu-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as MenuItem;
            setItems((prev) => {
              if (prev.some((item) => item.id === newItem.id)) return prev;
              const cat = categories.find((c) => c.id === newItem.category_id);
              return [{ ...newItem, category: cat }, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MenuItem;
            setItems((prev) =>
              prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setItems((prev) => prev.filter((item) => item.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCat = payload.new as MenuCategory;
            setCategories((prev) => {
              if (prev.some((c) => c.id === newCat.id)) return prev;
              return [...prev, newCat];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MenuCategory;
            setCategories((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setCategories((prev) => prev.filter((c) => c.id !== deletedId));
            // Cascade delete in client state
            setItems((prev) => prev.filter((i) => i.category_id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [categories]);

  // Handlers for Items
  const handleItemCreated = (newItem: MenuItem) => {
    setItems((prev) => [newItem, ...prev]);
  };

  const handleItemUpdated = (updatedItem: MenuItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item))
    );
  };

  const handleItemDeleted = (deletedItemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== deletedItemId));
  };

  // Handlers for Categories
  const handleCategoryCreated = (newCat: MenuCategory) => {
    setCategories((prev) => [...prev, newCat]);
  };

  const handleCategoryUpdated = (updatedCat: MenuCategory) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === updatedCat.id ? { ...cat, ...updatedCat } : cat))
    );
  };

  const handleCategoryDeleted = (deletedCatId: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== deletedCatId));
    // Cascade removal of items belonging to this category
    setItems((prev) => prev.filter((item) => item.category_id !== deletedCatId));
    if (selectedCategoryId === deletedCatId) {
      setSelectedCategoryId('all');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                إدارة قائمة الطعام والمنيو الرقمي
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                تخصيص أطباق مطعم الخديوي، الأقسام، الأسعار والعروض الترويجية ورفع المنيو الكامل
              </p>
            </div>
          </div>
        </div>

        {/* Top-Level Tabs */}
        <div className="flex items-center bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
              activeTab === 'catalog'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Utensils className="w-4 h-4" />
            <span>قائمة الأطباق والأصناف</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-black',
                activeTab === 'catalog'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              )}
            >
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master_menu')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
              activeTab === 'master_menu'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <FileImage className="w-4 h-4" />
            <span>المنيو الكامل (صورة / PDF)</span>
            {(fullMenu.menu_full_image_url || fullMenu.menu_full_pdf_url) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Stats Summary Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Items */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">إجمالي الأطباق</span>
            <span className="text-2xl font-black text-white mt-1 block">
              {stats.totalItems}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
            <Utensils className="w-5 h-5" />
          </div>
        </div>

        {/* Available Items */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">متاح للطلب الآن</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">
              {stats.availableItems}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Out of stock */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">نفذت الكمية</span>
            <span className="text-2xl font-black text-rose-400 mt-1 block">
              {stats.outOfStockItems}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Discounted Offers */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">عروض وتخفيضات</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">
              {stats.discountedItems}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab 1: Catalog & Dishes */}
      {activeTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Category Bar */}
          <CategoryManager
            categories={categoriesWithCounts}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onCategoryCreated={handleCategoryCreated}
            onCategoryUpdated={handleCategoryUpdated}
            onCategoryDeleted={handleCategoryDeleted}
            totalItemsCount={items.length}
          />

          {/* Dishes Grid */}
          <MenuItemGrid
            items={items}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onItemCreated={handleItemCreated}
            onItemUpdated={handleItemUpdated}
            onItemDeleted={handleItemDeleted}
          />
        </div>
      )}

      {/* Tab 2: Full Master Menu (Image / PDF) */}
      {activeTab === 'master_menu' && (
        <div className="animate-in fade-in duration-200">
          <FullMenuUploader
            initialSettings={fullMenu}
            onSettingsUpdated={setFullMenu}
          />
        </div>
      )}
    </div>
  );
}
