import type { Json, Tables, TablesInsert } from '@/types/database.types';

export type CommentEvent = Tables<'comment_events'>;
export type CommentRule = Tables<'comment_rules'>;
export type CommentSettings = Tables<'comment_settings'>;
export type PostSetting = Tables<'post_settings'>;

/** Connected page (public fields only). */
export type PageOption = Pick<Tables<'channels'>, 'id' | 'name' | 'external_id' | 'picture_url' | 'status'>;

export interface FbPost {
  id: string;
  message: string;
  created_time: string;
  full_picture: string | null;
  permalink_url: string | null;
}

export interface ActionAsset {
  id: string;
  name: string;        // identifier key: "menu", "branches", "offers", "wheel", etc.
  label: string;       // display title: "صور الفروع", etc.
  description: string; // intent guidance for AI: "عندما يسأل العميل عن الفروع وأماكن التواجد"
  image_url: string;   // public image url
}

export const DEFAULT_ACTION_ASSETS: ActionAsset[] = [
  {
    id: 'branches',
    name: 'branches',
    label: 'عناوين وفروع المطعم',
    description: 'إذا سأل العميل عن الفروع، أماكن التواجد، العناوين، أو هل ليكم فرع في منطقة معينة',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  },
  {
    id: 'menu',
    name: 'menu',
    label: 'قائمة المنيو والأسعار',
    description: 'إذا طلب العميل المنيو، قائمة الطعام، أسعار الوجبات، أو صور الأصناف',
    image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  },
  {
    id: 'offers',
    name: 'offers',
    label: 'عروض التوفير والخصومات',
    description: 'إذا سأل العميل عن العروض، الخصومات الحالية، عروض التوفير، أو وجبات التوفير',
    image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800',
  },
];

export interface FixedRepliesConfig {
  enabled: boolean;
  normal_replies: string[];
}

export const DEFAULT_NORMAL_FIXED_REPLIES: string[] = [
  'أهلاً بحضرتك يا فندم في تشيكن مراعي! 🍗 تم إرسال كل التفاصيل في رسائل الصفحة 📩',
  'منورنا يا فندم! 🌟 بعتنالك رسالة على الخاص حالاً بكل التفاصيل 🛵',
  'تحت أمرك يا فندم! راجع رسائل الماسنجر، فريقنا معاك هناك فوراً ❤️',
];

export function parseActionAssets(value: Json): ActionAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item : null))
    .filter((item): item is { [k: string]: Json | undefined } => !!item && !item.is_config && item.id !== '__fixed_replies_config__')
    .map((item) => ({
      id: String(item.id || item.name || Math.random().toString(36).substring(2, 9)),
      name: String(item.name || '').trim().toLowerCase().replace(/\s+/g, '_'),
      label: String(item.label || item.name || ''),
      description: String(item.description || ''),
      image_url: String(item.image_url || ''),
    }))
    .filter((item) => item.name);
}

export function parseFixedRepliesConfig(value: Json): FixedRepliesConfig {
  if (Array.isArray(value)) {
    const cfg = value.find(
      (item): item is { [k: string]: Json | undefined } =>
        !!item && typeof item === 'object' && !Array.isArray(item) && (item.id === '__fixed_replies_config__' || item.is_config === true)
    );
    if (cfg) {
      const list = Array.isArray(cfg.normal_replies)
        ? cfg.normal_replies.map((r) => String(r ?? '').trim()).filter(Boolean)
        : [];
      return {
        enabled: Boolean(cfg.enabled),
        normal_replies: list.length > 0 ? list : DEFAULT_NORMAL_FIXED_REPLIES,
      };
    }
  }
  return {
    enabled: false,
    normal_replies: DEFAULT_NORMAL_FIXED_REPLIES,
  };
}

export interface DmButton {
  title: string;
  payload: string;
}

/** Quick-reply payloads the Messenger workflow understands. */
export const DM_BUTTON_PRESETS: DmButton[] = [
  { title: 'اطلب دلوقتي 🛵', payload: 'START_ORDER' },
  { title: 'المنيو 🍗', payload: 'VIEW_MENU' },
  { title: 'العروض 🔥', payload: 'VIEW_OFFERS' },
  { title: 'كلم موظف 👨‍💼', payload: 'HUMAN_AGENT' },
];
export const MAX_DM_BUTTONS = 3; // Messenger button template limit
export const MAX_BUTTON_TITLE = 20;

export function parseDmButtons(value: Json): DmButton[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((b) => (b && typeof b === 'object' && !Array.isArray(b) ? b : null))
    .filter((b): b is { [k: string]: Json | undefined } => !!b)
    .map((b) => ({ title: String(b.title ?? b.label ?? ''), payload: String(b.payload ?? '') }))
    .filter((b) => b.title && b.payload);
}

export type RuleDraft = Omit<TablesInsert<'comment_rules'>, 'dm_buttons'> & { id?: string; dm_buttons: DmButton[] };

export function emptyRule(scope: 'post' | 'global', facebookPostId: string | null = null, channelId: string | null = null): RuleDraft {
  return {
    scope,
    facebook_post_id: scope === 'post' ? facebookPostId : null,
    channel_id: channelId,
    name: '',
    trigger_type: scope === 'post' ? 'any' : 'keywords',
    keywords: [],
    priority: scope === 'post' ? 50 : 100,
    reply_enabled: true,
    reply_variations: [],
    like_comment: true,
    dm_enabled: true,
    dm_message: '',
    dm_image_url: null,
    dm_buttons: [],
    dm_send_menu: false,
    dm_send_offers: false,
    hide_comment: false,
    create_complaint: false,
    notify_staff: false,
    comment_image_url: null,
    delete_keywords: [],
    auto_delete: false,
    is_active: true,
  };
}

export function ruleToDraft(rule: CommentRule): RuleDraft {
  return { ...rule, dm_buttons: parseDmButtons(rule.dm_buttons) };
}

/** Short Arabic action summary for rule cards. */
export function ruleActionBadges(rule: Pick<CommentRule, 'reply_enabled' | 'like_comment' | 'dm_enabled' | 'dm_send_menu' | 'dm_send_offers' | 'hide_comment' | 'create_complaint' | 'notify_staff'>) {
  const out: string[] = [];
  if (rule.reply_enabled) out.push('رد علني');
  if (rule.like_comment) out.push('لايك');
  if (rule.dm_enabled) out.push('رسالة خاصة');
  if (rule.dm_send_menu) out.push('المنيو');
  if (rule.dm_send_offers) out.push('العروض');
  if (rule.hide_comment) out.push('إخفاء');
  if (rule.create_complaint) out.push('شكوى');
  if (rule.notify_staff) out.push('تنبيه تليجرام');
  return out;
}

/** Facebook link to a post / comment when no permalink is cached. */
export const fbLink = (objectId: string) => `https://www.facebook.com/${objectId}`;

export type Notice = { type: 'success' | 'error'; text: string } | null;
