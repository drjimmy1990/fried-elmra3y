'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  X,
  Image as ImageIcon,
  UploadCloud,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import { Offer, OfferFilterTab } from './types';
import { OfferCard } from './OfferCard';
import { OfferModal } from './OfferModal';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export const ALL_OFFERS_SENTINEL_TITLE = '__ALL_OFFERS_IMAGE__';

interface OffersContainerProps {
  initialOffers: Offer[];
}

export function OffersContainer({ initialOffers }: OffersContainerProps) {
  const existingMasterRow = initialOffers.find((o) => o.title === ALL_OFFERS_SENTINEL_TITLE) || null;
  const [masterOfferRow, setMasterOfferRow] = useState<Offer | null>(existingMasterRow);
  const [allOffersBannerUrl, setAllOffersBannerUrl] = useState<string>(existingMasterRow?.banner_url || '');
  const [isUploadingAllBanner, setIsUploadingAllBanner] = useState(false);
  const [isSavingAllBanner, setIsSavingAllBanner] = useState(false);
  const allBannerFileInputRef = useRef<HTMLInputElement>(null);

  const [offers, setOffers] = useState<Offer[]>(
    initialOffers.filter((o) => o.title !== ALL_OFFERS_SENTINEL_TITLE)
  );
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

  // Upload & Save All-Offers Master Image
  const saveAllOffersBannerToDb = async (urlToSave: string) => {
    setIsSavingAllBanner(true);
    try {
      const cleanUrl = urlToSave.trim() || null;
      if (masterOfferRow?.id) {
        const { data, error } = await supabase
          .from('offers')
          .update({
            banner_url: cleanUrl,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', masterOfferRow.id)
          .select('*')
          .single();
        if (error) throw error;
        if (data) setMasterOfferRow(data as Offer);
      } else {
        const { data, error } = await supabase
          .from('offers')
          .insert({
            title: ALL_OFFERS_SENTINEL_TITLE,
            description: 'صورة مجمعة لكل العروض الترويجية (تُرسل في الماسنجر عند السؤال عن كل العروض)',
            price_before: null,
            price_after: 0,
            banner_url: cleanUrl,
            is_active: true,
          })
          .select('*')
          .single();
        if (error) throw error;
        if (data) setMasterOfferRow(data as Offer);
      }
      showToast('تم حفظ صورة "جميع العروض" المجمعة بنجاح.');
    } catch (err: unknown) {
      console.error('Failed to save all-offers banner:', err);
      showToast('حدث خطأ أثناء حفظ صورة جميع العروض.');
    } finally {
      setIsSavingAllBanner(false);
    }
  };

  const handleUploadAllOffersFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      showToast('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    setIsUploadingAllBanner(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
      const slug = Math.random().toString(36).substring(2, 8);
      const path = `banners/all-offers-${Date.now()}-${slug}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('offer-banners')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('offer-banners')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        setAllOffersBannerUrl(urlData.publicUrl);
        await saveAllOffersBannerToDb(urlData.publicUrl);
      }
    } catch (err: unknown) {
      console.error('All-offers banner upload failed:', err);
      showToast('فشل رفع الصورة، يمكنك لصق رابط الصورة مباشرة ثم الضغط على حفظ.');
    } finally {
      setIsUploadingAllBanner(false);
      e.target.value = '';
    }
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

      {/* All Offers Master Image Card (for intent = "all_offers") */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#101726] border border-amber-500/30 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
            {allOffersBannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={allOffersBannerUrl}
                alt="صورة جميع العروض"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                صورة جميع العروض المجمعة (تُرسل في الماسنجر عند السؤال عن كل العروض)
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold font-mono">
                intent: all_offers
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              عندما يسأل العميل &quot;إيه العروض المتاحة؟&quot; بشكل عام، يرسل البوت قائمة العروض مع هذه الصورة المجمعة. أما عند السؤال عن عرض محدد (`single_offer`) فيرسل البوت صورة ذلك العرض من بطاقته بالأسفل.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="text"
                dir="ltr"
                value={allOffersBannerUrl}
                onChange={(e) => setAllOffersBannerUrl(e.target.value)}
                placeholder="https://... رابط صورة كل العروض أو ارفع صورة من جهازك"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                ref={allBannerFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadAllOffersFile}
              />
              <button
                type="button"
                disabled={isUploadingAllBanner}
                onClick={() => allBannerFileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                {isUploadingAllBanner ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-amber-500" />
                )}
                <span>رفع صورة</span>
              </button>
              <button
                type="button"
                disabled={isSavingAllBanner}
                onClick={() => saveAllOffersBannerToDb(allOffersBannerUrl)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                {isSavingAllBanner ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ الصورة</span>
              </button>
              {allOffersBannerUrl && (
                <button
                  type="button"
                  disabled={isSavingAllBanner}
                  onClick={() => {
                    setAllOffersBannerUrl('');
                    saveAllOffersBannerToDb('');
                  }}
                  title="حذف الصورة"
                  className="inline-flex items-center justify-center p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
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
