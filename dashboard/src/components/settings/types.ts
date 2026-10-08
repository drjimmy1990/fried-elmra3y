import { Database } from '@/types/database.types';

export type BotSettings = Database['public']['Tables']['bot_settings']['Row'];
export type BotSettingsUpdate = Database['public']['Tables']['bot_settings']['Update'];

export interface BotSettingsFormData {
  bot_enabled: boolean;
  auto_pause_on_complaint: boolean;
  delivery_fee: number;
  currency: string;
  business_hours_enabled: boolean;
  open_time: string;
  close_time: string;
  off_hours_message: string;
  ai_system_prompt: string;
  notify_telegram: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  facebook_page_id: string;
  facebook_page_access_token: string;
  notify_dashboard: boolean;
  menu_full_image_url: string;
  menu_full_pdf_url: string;
}

export const DEFAULT_AI_PROMPT = `أنت المساعد الذكي لمطعم الخديوي على فيسبوك مسنجر 👑.
مهمتك:
1. الترحيب بالعملاء بلباقة وكرم ضيافة مصري أصيل ("يا فندم"، "منورنا يا باشا").
2. مساعدة العملاء في استعراض أصناف المنيو واختيار أشهى الأطباق والمشويات والطواجن والوجبات العائلية.
3. اقتراح العروض الترويجية والإضافات المناسبة (مقبلات، سلطات، مشروبات).
4. جمع تفاصيل الطلب بدقة: الأصناف، الكميات، العنوان التفصيلي، ورقم هاتف التواصل.
5. في حال رغبة العميل في تقديم شكوى أو استفسار معقد، قم بتحويله بلطف لأحد ممثلي خدمة العملاء.

ملاحظات هامة:
- التزم بالأسعار الرسمية المذكورة في المنيو.
- لا تقدم أي وعود بوقت توصيل محدد بل وضح متوسط الوقت التقريبي (45-60 دقيقة).
- الردود يجب أن تكون مختصرة وواضحة ومنسقة باستخدام الرموز التعبيرية المناسبة.`;

export const DEFAULT_OFF_HOURS_MESSAGE = `أهلاً بك في مطعم الخديوي! 🌙
نعتذر منك، نحن حالياً خارج أوقات العمل الرسمية.
مواعيد العمل اليومية: من {open_time} إلى {close_time}.
يمكنك ترك تفاصيل طلبك أو استفسارك هنا، وسيتواصل معك فريقنا فور بدء أوقات العمل غداً بإذن الله! ❤️`;
