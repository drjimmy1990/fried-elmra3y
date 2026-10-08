export interface Offer {
  id: string;
  title: string;
  description: string | null;
  price_before: number | null;
  price_after: number;
  banner_url: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OfferFormInput {
  title: string;
  description: string | null;
  price_before: number | null;
  price_after: number;
  banner_url: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
}

export type OfferFilterTab = 'all' | 'active' | 'inactive' | 'expired';

export type OfferValidityType = 'active_now' | 'upcoming' | 'expired' | 'ongoing' | 'inactive';

export interface OfferValidityInfo {
  status: OfferValidityType;
  label: string;
  badgeClass: string;
}

export interface OfferStats {
  totalOffers: number;
  activeOffers: number;
  currentlyValidOffers: number;
  highestDiscount: number;
}

/**
 * Calculates discount information between old and new price.
 */
export function calculateDiscount(
  priceBefore: number | null | undefined,
  priceAfter: number
): {
  hasDiscount: boolean;
  discountPercentage: number;
  savingsAmount: number;
} {
  if (priceBefore && priceBefore > priceAfter && priceAfter >= 0) {
    const savings = priceBefore - priceAfter;
    const percentage = Math.round((savings / priceBefore) * 100);
    return {
      hasDiscount: true,
      discountPercentage: percentage,
      savingsAmount: savings,
    };
  }
  return {
    hasDiscount: false,
    discountPercentage: 0,
    savingsAmount: 0,
  };
}

/**
 * Determines the validity status and styling of an offer according to current time and dates.
 */
export function getOfferValidityStatus(offer: {
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}): OfferValidityInfo {
  if (!offer.is_active) {
    return {
      status: 'inactive',
      label: 'متوقف',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }

  const now = new Date();

  if (offer.end_date && new Date(offer.end_date) < now) {
    return {
      status: 'expired',
      label: 'منتهي الصلاحية',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  if (offer.start_date && new Date(offer.start_date) > now) {
    return {
      status: 'upcoming',
      label: 'يبدأ قريباً',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
  }

  if (offer.end_date) {
    return {
      status: 'active_now',
      label: 'ساري الآن',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
  }

  return {
    status: 'ongoing',
    label: 'مستمر',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  };
}

/**
 * Formats a date range into Arabic text.
 */
export function formatOfferDateRange(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate && !endDate) {
    return 'عرض مستمر بدون موعد انتهاء';
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (startDate && endDate) {
    return `من ${formatDate(startDate)} حتى ${formatDate(endDate)}`;
  }
  if (startDate) {
    return `يبدأ من ${formatDate(startDate)}`;
  }
  if (endDate) {
    return `ينتهي في ${formatDate(endDate)}`;
  }
  return 'عرض مستمر';
}

/**
 * Converts ISO string to datetime-local input value (YYYY-MM-DDTHH:mm).
 */
export function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts datetime-local input string to ISO 8601 string or null.
 */
export function fromDatetimeLocal(localString: string): string | null {
  if (!localString.trim()) return null;
  const d = new Date(localString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
