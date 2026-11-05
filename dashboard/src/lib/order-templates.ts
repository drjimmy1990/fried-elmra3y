import type { Json } from '@/types/database.types';

export const ORDER_TEMPLATES_CONFIG_ID = '__order_message_templates__';

export interface TemplatePreset {
  id: string;
  label: string;
  text: string;
}

export interface OrderMessageTemplates {
  confirm_order: string;
  modification_approve: string;
  modification_decline: string;
  modification_decline_presets: TemplatePreset[];
  cancellation_approve: string;
  cancellation_decline: string;
  cancellation_decline_presets: TemplatePreset[];
  staff_cancel_order: string;
  staff_cancel_presets: TemplatePreset[];
}

export const DEFAULT_ORDER_MESSAGE_TEMPLATES: OrderMessageTemplates = {
  confirm_order:
    'ألف هنا يا {customer_name}! 🍗🔥\nتم تأكيد أوردرك رقم #{order_number} بنجاح!\nجاري تجهيزه في المطعم وتسليمه لمندوب التوصيل فوراً 🛵',
  modification_approve:
    'تمت الموافقة على تعديل أوردرك رقم #{order_number} بنجاح يا {customer_name} ✅🍗\nالإجمالي بعد التعديل: {total_amount} ج.م\nجاري تجهيز طلبك المعدل في المطبخ فوراً 🛵',
  modification_decline:
    'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف مش هنقدر ننفذ التعديل المطلوب على الأوردر رقم #{order_number} لأن الطلب دخل مرحلة التجهيز النهائي وخرج مع الدليفري بالفعل 🛵',
  modification_decline_presets: [
    {
      id: 'mod_out_for_delivery',
      label: 'خرج مع الدليفري 🛵',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف مش هنقدر ننفذ التعديل المطلوب على الأوردر رقم #{order_number} لأن الطلب خرج مع مندوب التوصيل وفي الطريق لحضرتك حالياً 🛵',
    },
    {
      id: 'mod_already_prepared',
      label: 'تم تجهيزه في المطبخ 🍗',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف الأوردر رقم #{order_number} تم تجهيزه وتغليفه بالكامل في المطبخ ومش هنقدر نعدل عليه في المرحلة دي 🍗',
    },
    {
      id: 'mod_item_unavailable',
      label: 'الصنف المطلوب غير متاح حالياً ⚠️',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف الصنف المطلوب إضافته غير متاح حالياً في الفرع، وهيتم توصيل أوردرك الأصلي رقم #{order_number} كما هو في ميعاده 🛵',
    },
  ],
  cancellation_approve:
    'تم إلغاء أوردرك رقم #{order_number} بناءً على طلب حضرتك يا {customer_name} ✅\nنتشرف بخدمتك في تشيكن مراعي في أي وقت 🍗❤️',
  cancellation_decline:
    'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف مش هنقدر نلغي الأوردر رقم #{order_number} في المرحلة دي لأن الطلب اتجهز وخرج مع مندوب التوصيل وفي الطريق لحضرتك حالياً 🛵',
  cancellation_decline_presets: [
    {
      id: 'cancel_out_for_delivery',
      label: 'خرج مع الدليفري 🛵',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف مش هنقدر نلغي الأوردر رقم #{order_number} في المرحلة دي لأن الطلب اتجهز وخرج مع مندوب التوصيل وفي الطريق لحضرتك حالياً 🛵',
    },
    {
      id: 'cancel_already_cooked',
      label: 'تم تحضيره وتغليفه بالكامل 🍗',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nللأسف الأوردر رقم #{order_number} تم تحضيره وتغليفه بالكامل في المطبخ وخلال دقائق هيكون عند حضرتك 🍗🛵',
    },
  ],
  staff_cancel_order:
    'بنعتذر جداً لحضرتك يا {customer_name} 🙏\nتم إلغاء الأوردر رقم #{order_number} نظراً لضغط التشغيل الحالي في الفرع. نتشرف بخدمتك في وقت قريب إن شاء الله 🍗',
  staff_cancel_presets: [
    {
      id: 'staff_high_load',
      label: 'ضغط التشغيل في الفرع 🔥',
      text: 'بنعتذر جداً لحضرتك يا {customer_name} 🙏\nتم إلغاء الأوردر رقم #{order_number} نظراً لضغط التشغيل الشديد في الفرع حالياً. نتشرف بخدمتك في وقت قريب إن شاء الله 🍗',
    },
    {
      id: 'staff_out_of_zone',
      label: 'خارج نطاق التوصيل 📍',
      text: 'بنعتذر جداً لحضرتك يا {customer_name} 🙏\nتم إلغاء الأوردر رقم #{order_number} لأن العنوان المذكور خارج نطاق التوصيل المتاح للفرع حالياً.',
    },
    {
      id: 'staff_no_answer',
      label: 'عدم الرد على الهاتف 📱',
      text: 'بنعتذر لحضرتك يا {customer_name} 🙏\nحاولنا التواصل مع حضرتك هاتفياً لتأكيد الأوردر رقم #{order_number} ولم نتمكن من الوصول للرقم، لذلك تم إلغاء الطلب. لو حابب نفعله تاني ابعتلنا هنا فوراً 📱',
    },
    {
      id: 'staff_item_out_of_stock',
      label: 'نفاد الصنف المطلوب ⚠️',
      text: 'بنعتذر جداً لحضرتك يا {customer_name} 🙏\nتم إلغاء الأوردر رقم #{order_number} نظراً لنفاد الصنف المطلوب في الفرع حالياً. تقدر تختار بديل أو تطلب في أي وقت تاني ❤️',
    },
  ],
};

export function parseOrderTemplatesFromAssets(raw: Json | null | undefined): OrderMessageTemplates {
  if (!Array.isArray(raw)) return DEFAULT_ORDER_MESSAGE_TEMPLATES;
  const entry = raw.find(
    (item): item is { [k: string]: Json | undefined } =>
      !!item && typeof item === 'object' && !Array.isArray(item) && item.id === ORDER_TEMPLATES_CONFIG_ID
  );
  if (!entry || !entry.templates || typeof entry.templates !== 'object' || Array.isArray(entry.templates)) {
    return DEFAULT_ORDER_MESSAGE_TEMPLATES;
  }
  const t = entry.templates as Record<string, any>;
  return {
    confirm_order:
      typeof t.confirm_order === 'string' && t.confirm_order.trim()
        ? t.confirm_order
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.confirm_order,
    modification_approve:
      typeof t.modification_approve === 'string' && t.modification_approve.trim()
        ? t.modification_approve
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_approve,
    modification_decline:
      typeof t.modification_decline === 'string' && t.modification_decline.trim()
        ? t.modification_decline
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_decline,
    modification_decline_presets: Array.isArray(t.modification_decline_presets)
      ? t.modification_decline_presets
      : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_decline_presets,
    cancellation_approve:
      typeof t.cancellation_approve === 'string' && t.cancellation_approve.trim()
        ? t.cancellation_approve
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_approve,
    cancellation_decline:
      typeof t.cancellation_decline === 'string' && t.cancellation_decline.trim()
        ? t.cancellation_decline
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_decline,
    cancellation_decline_presets: Array.isArray(t.cancellation_decline_presets)
      ? t.cancellation_decline_presets
      : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_decline_presets,
    staff_cancel_order:
      typeof t.staff_cancel_order === 'string' && t.staff_cancel_order.trim()
        ? t.staff_cancel_order
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.staff_cancel_order,
    staff_cancel_presets: Array.isArray(t.staff_cancel_presets)
      ? t.staff_cancel_presets
      : DEFAULT_ORDER_MESSAGE_TEMPLATES.staff_cancel_presets,
  };
}

export function interpolateOrderTemplate(
  template: string,
  vars: {
    customer_name?: string | null;
    order_number?: number | string | null;
    total_amount?: number | string | null;
    modification_details?: string | null;
    branch_name?: string | null;
  }
): string {
  const name = (vars.customer_name || 'فندم').trim();
  const orderNum = vars.order_number != null ? String(vars.order_number) : '';
  const total =
    vars.total_amount != null && !Number.isNaN(Number(vars.total_amount))
      ? Number(vars.total_amount).toFixed(0)
      : String(vars.total_amount || '0');
  const modDetails = (vars.modification_details || '').trim();
  const branch = (vars.branch_name || '').trim();

  return String(template || '')
    .replace(/\{customer_name\}/g, name)
    .replace(/\{order_number\}/g, orderNum)
    .replace(/\{total_amount\}/g, total)
    .replace(/\{modification_details\}/g, modDetails)
    .replace(/\{branch_name\}/g, branch)
    .trim();
}

export function isMergedOrDeclinedModOrder(order?: {
  payment_method?: string | null;
  internal_notes?: string | null;
} | null): boolean {
  if (!order) return false;
  const pm = order.payment_method || '';
  if (pm === 'mod_merged' || pm === 'mod_declined') return true;
  const inotes = order.internal_notes || '';
  return inotes.includes('[MOD_MERGED]') || inotes.includes('[MOD_DECLINED]');
}

export function isOrderModificationRow(order?: {
  customer_notes?: string | null;
  payment_method?: string | null;
} | null): boolean {
  if (!order) return false;
  const notes = (order.customer_notes || '').trim();
  return (
    notes.includes('تعديل على الأوردر') ||
    notes.includes('تعديل على الاوردر') ||
    notes.startsWith('تعديل:') ||
    order.payment_method === 'mod_pending'
  );
}

export function isPendingModificationRequest(order?: {
  status?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  payment_method?: string | null;
} | null): boolean {
  if (!order) return false;
  if (isMergedOrDeclinedModOrder(order)) return false;
  const pm = order.payment_method || '';
  if (pm === 'cancelled' || pm.startsWith('cancelled|')) return false;
  const inotes = order.internal_notes || '';
  if (inotes.includes('[MOD_APPROVED]') || inotes.includes('[MOD_DECLINED]') || inotes.includes('[MOD_MERGED]')) {
    return false;
  }
  if (order.status !== 'pending') return false;
  return isOrderModificationRow(order);
}

export function extractModificationSummary(customerNotes?: string | null): string {
  if (!customerNotes) return 'طلب تعديل على الأصناف أو الملاحظات';
  const cleaned = customerNotes.trim();
  const parts = cleaned.split('|').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) {
    return parts[0]
      .replace(/^تعديل على الأوردر المؤكد\s*:\s*/i, '')
      .replace(/^تعديل على الاوردر المؤكد\s*:\s*/i, '')
      .replace(/^تعديل\s*:\s*/i, '')
      .trim() || cleaned;
  }
  return cleaned;
}

export function isCustomerCancellationComplaint(complaint?: {
  status?: string | null;
  issue_description?: string | null;
} | null): boolean {
  if (!complaint) return false;
  if (complaint.status && complaint.status !== 'open') return false;
  const text = (complaint.issue_description || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('إلغاء الأوردر') ||
    text.includes('الغاء الاوردر') ||
    text.includes('إلغاء الاوردر') ||
    text.includes('الغاء الأوردر') ||
    text.includes('إلغاء الطلب') ||
    text.includes('الغاء الطلب') ||
    text.includes('طلب عاجل لإلغاء') ||
    text.includes('يرغب في الإلغاء') ||
    text.includes('يريد إلغاء') ||
    text.includes('يريد الغاء') ||
    text.includes('عايز يلغي') ||
    text.includes('عايزة تلغي')
  );
}
