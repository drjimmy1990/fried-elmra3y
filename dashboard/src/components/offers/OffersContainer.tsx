'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Percent,
  Layers,
  Clock,
  Tag,
  AlertCircle,
  X,
  TrendingUp,
} from 'lucide-react';
import { Offer, OfferFilterTab, calculateDiscount } from './types';
import { OfferCard } from './OfferCard';
import { OfferModal } from './OfferModal';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface OffersContainerProps {
  initialOffers: Offer[];
}

export function OffersContainer({ initialOffers }: OffersContainerProps) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<OfferFilterTab>('all');
  const supabase = createClient();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOfferForEdit, setSelectedOfferForEdit] = useState<Offer | null>(null);

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 4000);
  };

  // Tab counts for badge indicator on filter tabs
  const tabCounts = useMemo(() => {
    const now = new Date();
    const isExpired = (o: Offer) => !!o.end_date && new Date(o.end_date) < now;
    return {
      all: offers.length,
      active: offers.filter((o) => o.is_active && !isExpired(o)).length,
      inactive: offers.filter((o) => !o.is_active && !isExpired(o)).length,
      expired: offers.filter(isExpired).length,
    };
  }, [offers]);

  // Filtered and searched offers
  const filteredOffers = useMemo(() => {
    const now = new Date();
    const query = searchQuery.trim().toLowerCase();

    return offers.filter((offer) => {
      const expired = !!offer.end_date && new Date(offer.end_date) < now;
      if (activeTab === 'active' && (!offer.is_active || expired)) return false;
      if (activeTab === 'inactive' && (offer.is_active || expired)) return false;
      if (activeTab === 'expired' && !expired) return false;

      if (query) {
        const titleMatch = offer.title.toLowerCase().includes(query);
        const descMatch = offer.description
          ? offer.description.toLowerCase().includes(query)
          : false;
        if (!titleMatch && !descMatch) return false;
      }
      return true;
    });
  }, [offers, activeTab, searchQuery]);

  const sortOffersList = (list: Offer[]): Offer[] => {
    return [...list].sort((a, b) => {
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleOpenCreateModal = () => {
    setSelectedOfferForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (offer: Offer) => {
    setSelectedOfferForEdit(offer);
    setIsModalOpen(true);
  };

  const handleSaveOffer = (savedOffer: Offer) => {
    setOffers((prev) => {
      const exists = prev.some((o) => o.id === savedOffer.id);
      let updated: Offer[];
      if (exists) {
        updated = prev.map((o) => (o.id === savedOffer.id ? savedOffer : o));
        showToast(`تم تعديل عرض "${savedOffer.title}" بنجاح.`);
      } else {
        updated = [savedOffer, ...prev];
        showToast(`تمت إضافة العرض الترويجي "${savedOffer.title}" بنجاح.`);
      }
      return sortOffersList(updated);
    });
  };

  const handleDeleteOffer = (offerId: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== offerId));
    showToast('تم حذف العرض الترويجي بنجاح.');
  };

  const handleOfferUpdated = (updatedOffer: Offer) => {
    setOffers((prev) => sortOffersList(prev.map((o) => (o.id === updatedOffer.id ? updatedOffer : o))));
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xl shadow-black/20 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                إدارة العروض والخصومات الترويجية
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                تنسيق العروض الخاصة، نسب الخصومات وبانرات الحملات للمطعم
              </p>
            </div>
          </div>
        </div>

        {/* Add New Offer Button */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>إضافة عرض ترويجي جديد</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
              activeTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            <span>الكل</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-md text-[10px]',
                activeTab === 'all'
                  ? 'bg-slate-950/20 text-slate-950 font-black'
                  : 'bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-400'
              )}
            >
              {tabCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
              activeTab === 'active'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            <span>شغال</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-md text-[10px]',
                activeTab === 'active'
                  ? 'bg-slate-950/20 text-slate-950 font-black'
                  : 'bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-400'
              )}
            >
              {tabCounts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inactive')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
              activeTab === 'inactive'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            <span>متوقف</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-md text-[10px]',
                activeTab === 'inactive'
                  ? 'bg-white/20 text-white dark:bg-slate-950/30 dark:text-slate-950 font-black'
                  : 'bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-400'
              )}
            >
              {tabCounts.inactive}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expired')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
              activeTab === 'expired'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            <span>منتهي الصلاحية</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-md text-[10px]',
                activeTab === 'expired'
                  ? 'bg-white/20 text-white font-black'
                  : 'bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-400'
              )}
            >
              {tabCounts.expired}
            </span>
          </button>
        </div>

        {/* Search input & Add Offer Button */}
        <div className="flex items-center gap-2 flex-1 md:flex-initial justify-end">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالعنوان أو الوصف..."
              className="w-full pr-10 pl-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>إضافة عرض جديد</span>
          </button>
        </div>
      </div>

      {/* Offers Grid */}
      {filteredOffers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredOffers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteOffer}
              onOfferUpdated={handleOfferUpdated}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500">
            <Sparkles className="w-10 h-10" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {offers.length === 0
                ? 'لا توجد عروض ترويجية حتى الآن'
                : 'لا توجد عروض مطابقة للبحث أو الفلتر المحدد'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {offers.length === 0
                ? 'ابدأ بإضافة أول عرض ترويجي وبانر لزيادة المبيعات وجذب العملاء عبر البوت'
                : 'جرّب تعديل كلمات البحث أو التبديل إلى فلتر عرض آخر لإظهار النتائج'}
            </p>
          </div>

          {offers.length === 0 ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة أول عرض ترويجي</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              <span>إعادة ضبط عوامل التصفية</span>
            </button>
          )}
        </div>
      )}

      {/* Offer Modal (Create/Edit) */}
      <OfferModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOfferForEdit(null);
        }}
        offerToEdit={selectedOfferForEdit}
        onSave={handleSaveOffer}
      />
    </div>
  );
}
