import { Database } from '@/types/database.types';

export type MenuCategoryRow = Database['public']['Tables']['menu_categories']['Row'];
export type MenuItemRow = Database['public']['Tables']['menu_items']['Row'];
export type BotSettingsRow = Database['public']['Tables']['bot_settings']['Row'];

export interface MenuCategory {
  id: string;
  name_ar: string;
  name_en: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_available: boolean;
  badges: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: MenuCategory | null;
}

export interface FullMenuSettings {
  menu_full_image_url: string | null;
  menu_full_pdf_url: string | null;
}

export type MenuBadgeKey = 'bestseller' | 'spicy' | 'new' | 'signature';

export interface MenuBadgeConfig {
  key: MenuBadgeKey;
  label: string;
  shortLabel: string;
  icon: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const MENU_BADGES: Record<MenuBadgeKey, MenuBadgeConfig> = {
  bestseller: {
    key: 'bestseller',
    label: 'الأكثر طلباً',
    shortLabel: 'الأكثر طلباً ⭐',
    icon: '⭐',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  spicy: {
    key: 'spicy',
    label: 'حار سبايسي',
    shortLabel: 'حار 🌶️',
    icon: '🌶️',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
  },
  new: {
    key: 'new',
    label: 'صنف جديد',
    shortLabel: 'جديد 🔥',
    icon: '🔥',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
  },
  signature: {
    key: 'signature',
    label: 'طبق الخديوي المخصوص',
    shortLabel: 'مميز 👑',
    icon: '👑',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
  },
};
