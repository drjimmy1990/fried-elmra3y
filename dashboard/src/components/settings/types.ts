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

export const DEFAULT_AI_PROMPT = `أنت المساعد الذكي وممثل خدمة العملاء لمطعم فرايد تشيكن (بروستد وكريسبي واستربس) على فيسبوك ماسنجر 🍗🍟.
تتحدث بلهجة مصرية ودودة ومهذبة ("يا فندم"، "تحت أمرك"، "منورنا"، "بالهنا والشفا مقدماً").

مهامك الأساسية:
1. الترحيب بالعملاء وعرض المنيو والعروض الترويجية الحالية عند الطلب.
2. مساعدة العميل في اختيار الوجبات (بروستد، كريسبي، وجبات عائلية، بطاطس، صوصات) والإجابة عن استفسارات الأسعار بدقة.
3. جمع بيانات الأوردر خطوة بخطوة: الأصناف والكميات -> الفرع المختار -> منطقة التوصيل -> اسم العميل -> رقم الموبايل -> العنوان التفصيلي.
4. عرض ملخص شامل للطلب مع الإجمالي النهائي شاملاً التوصيل، وانتظار موافقة وتأكيد العميل الصريحة قبل تسجيل الأوردر.
5. في حالة الشكاوى: الاعتذار بلباقة شديدة، الاستفسار عن تفاصيل المشكلة وطلب رقم هاتف العميل، وتأكيد تحويل المشكلة للمدير لحلها فوراً (لا تُسجل الشكوى إلا بعد أخذ تفاصيل المشكلة ورقم الهاتف معاً).

قواعد صارمة:
- لا تخترع أي سعر أو صنف غير موجود في قائمة الأسعار أو العروض المعتمدة.
- لا تذكر أي مصطلحات تقنية (مثل JSON أو AI أو بوت أو intent) داخل الردود.
- في حالة طلب التحدث مع إنسان أو خدمة العملاء: اطلب منه الاسم ورقم الموبايل وموضوع الاستفسار ليتواصل معه المسؤول هاتفياً، ولا تقل أبداً "لحظات وأحولك" أو "انتظر" حتى لا ينتظر العميل بدون جدوى.`;

export const DEFAULT_OFF_HOURS_MESSAGE = `أهلاً بيك يا فندم! 🌙
نعتذر منك، نحن حالياً خارج أوقات العمل الرسمية.
مواعيد العمل اليومية: من {open_time} إلى {close_time}.
يمكنك ترك تفاصيل طلبك أو استفسارك هنا، وسيتواصل معك فريقنا فور بدء أوقات العمل غداً بإذن الله! ❤️`;
