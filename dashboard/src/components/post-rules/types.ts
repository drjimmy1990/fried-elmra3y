import { Database, RuleMatchType } from '@/types/database.types';

export type PostRuleRow = Database['public']['Tables']['post_rules']['Row'];
export type PostRuleInsert = Database['public']['Tables']['post_rules']['Insert'];
export type PostRuleUpdate = Database['public']['Tables']['post_rules']['Update'];

export type GlobalCommentRuleRow = Database['public']['Tables']['global_comment_rules']['Row'];
export type GlobalCommentRuleInsert = Database['public']['Tables']['global_comment_rules']['Insert'];
export type GlobalCommentRuleUpdate = Database['public']['Tables']['global_comment_rules']['Update'];

export type { RuleMatchType };

export interface DmButton {
  title: string;
  payload: string;
}

export interface FacebookPost {
  id: string;
  message?: string;
  created_time?: string;
  full_picture?: string;
  permalink_url?: string;
}

export interface FacebookPostsResponse {
  success: boolean;
  posts: FacebookPost[];
  isMock?: boolean;
  pageId?: string;
  error?: string;
}

export interface PostRuleFormData {
  id?: string;
  title: string;
  facebook_post_id: string;
  post_thumbnail_url: string;
  post_url: string;
  post_caption: string;
  match_type: RuleMatchType;
  trigger_keywords: string[];
  auto_like_comment: boolean;
  comment_replies: string[];
  dm_message: string;
  dm_image_url: string;
  dm_buttons: DmButton[];
  is_active: boolean;
}

export interface GlobalRuleFormData {
  id?: string;
  is_enabled: boolean;
  auto_like_comment: boolean;
  comment_replies: string[];
  send_dm: boolean;
  dm_message: string;
  dm_image_url: string;
  dm_buttons: DmButton[];
}

export const PRESET_DM_BUTTONS: { title: string; payload: string; description: string }[] = [
  {
    title: 'قائمة المنيو 🍔',
    payload: 'VIEW_MENU',
    description: 'إرسال صورة ورابط قائمة طعام الخديوي',
  },
  {
    title: 'العروض الحالية 🏷️',
    payload: 'VIEW_OFFERS',
    description: 'استعراض أحدث العروض والخصومات الترويجية',
  },
  {
    title: 'تحدث مع موظف 👨‍💼',
    payload: 'HUMAN_AGENT',
    description: 'تحويل العميل فوراً إلى خدمة العملاء وإيقاف الرد الآلي',
  },
];
