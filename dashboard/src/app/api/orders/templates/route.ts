import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import {
  fetchOrderMessageTemplates,
  saveOrderMessageTemplates,
} from '@/lib/meta/order-messenger';
import { DEFAULT_ORDER_MESSAGE_TEMPLATES, OrderMessageTemplates } from '@/lib/order-templates';

export async function GET() {
  const staff = await requireStaff(['admin', 'order_agent', 'support_agent']);
  if (!staff.ok) {
    return staff.response;
  }

  return await withAdminClient(async (adminDb) => {
    const templates = await fetchOrderMessageTemplates(adminDb);
    return NextResponse.json({ success: true, templates });
  });
}

export async function PUT(request: NextRequest) {
  try {
    const staff = await requireStaff(['admin', 'order_agent']);
    if (!staff.ok) {
      return staff.response;
    }

    const body = await request.json();
    const raw = (body?.templates || body || {}) as Partial<OrderMessageTemplates>;

    const merged: OrderMessageTemplates = {
      confirm_order:
        typeof raw.confirm_order === 'string' && raw.confirm_order.trim()
          ? raw.confirm_order.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.confirm_order,
      modification_approve:
        typeof raw.modification_approve === 'string' && raw.modification_approve.trim()
          ? raw.modification_approve.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_approve,
      modification_decline:
        typeof raw.modification_decline === 'string' && raw.modification_decline.trim()
          ? raw.modification_decline.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_decline,
      modification_decline_presets: Array.isArray(raw.modification_decline_presets)
        ? raw.modification_decline_presets
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.modification_decline_presets,
      cancellation_approve:
        typeof raw.cancellation_approve === 'string' && raw.cancellation_approve.trim()
          ? raw.cancellation_approve.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_approve,
      cancellation_decline:
        typeof raw.cancellation_decline === 'string' && raw.cancellation_decline.trim()
          ? raw.cancellation_decline.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_decline,
      cancellation_decline_presets: Array.isArray(raw.cancellation_decline_presets)
        ? raw.cancellation_decline_presets
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.cancellation_decline_presets,
      staff_cancel_order:
        typeof raw.staff_cancel_order === 'string' && raw.staff_cancel_order.trim()
          ? raw.staff_cancel_order.trim()
          : DEFAULT_ORDER_MESSAGE_TEMPLATES.staff_cancel_order,
      staff_cancel_presets: Array.isArray(raw.staff_cancel_presets)
        ? raw.staff_cancel_presets
        : DEFAULT_ORDER_MESSAGE_TEMPLATES.staff_cancel_presets,
    };

    return await withAdminClient(async (adminDb) => {
      const saved = await saveOrderMessageTemplates(adminDb, merged);
      return NextResponse.json({ success: true, templates: saved });
    });
  } catch (err: unknown) {
    console.error('Error saving order message templates:', err);
    return jsonError('تعذر حفظ قوالب الرسائل', 500);
  }
}
