import { Database } from '@/types/database.types';

export type BotSettings = Database['public']['Tables']['bot_settings']['Row'];
export type BotSettingsUpdate = Database['public']['Tables']['bot_settings']['Update'];

export interface BotSettingsFormData {
  bot_enabled: boolean;
  auto_pause_on_complaint: boolean;
  restaurant_name: string;
  delivery_fee: number;
  currency: string;
  business_hours_enabled: boolean;
  open_time: string;
  close_time: string;
  welcome_message: string;
  human_handoff_message: string;
  off_hours_message: string;
  ai_system_prompt: string;
  notify_telegram: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notify_dashboard: boolean;
}

export const DEFAULT_AI_PROMPT = `أنت المساعد الذكي لمطعم فرايد تشيكن (بروستد وكريسبي واستربس) على فيسبوك مسنجر 🍗🍟.
تتكلم بلهجة مصرية ودودة ("يا فندم"، "منورنا").
دورك: مساعد طلبات المطعم.
الخطوات:
1. اطلب الأصناف المطلوبة.
2. اطلب الاسم.
3. اطلب رقم التليفون.
4. اطلب العنوان التفصيلي.
5. اعرض ملخص الطلب للتأكيد قبل الإنشاء.

تعليمات صارمة:
- لا تخترع أسعار من عندك نهائياً — استخدم قائمة الأسعار (price_list) المتاحة لك فقط.
- اعرض العروض الحالية إذا ناسبت العميل.
- لو العميل قدم شكوى → اعتذر فوراً وأنشئ شكوى.
- لو العميل طلب يكلم إنسان → قم بتنفيذ request_human فوراً.`;

export const DEFAULT_OFF_HOURS_MESSAGE = `أهلاً بيك يا فندم! 🌙
نعتذر منك، نحن حالياً خارج أوقات العمل الرسمية.
مواعيد العمل اليومية: من {open_time} إلى {close_time}.
يمكنك ترك تفاصيل طلبك أو استفسارك هنا، وسيتواصل معك فريقنا فور بدء أوقات العمل غداً بإذن الله! ❤️`;
