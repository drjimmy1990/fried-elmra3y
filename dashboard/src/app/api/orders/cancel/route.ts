import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import {
  fetchOrderMessageTemplates,
  sendOrderCustomerNotification,
} from '@/lib/meta/order-messenger';
import { interpolateOrderTemplate } from '@/lib/order-templates';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(['admin', 'order_agent']);
    if (!staff.ok) {
      return staff.response;
    }

    const body = await request.json();
    const { orderId, messageText, sendNotification = true, reasonNote } = body;

    if (!orderId || typeof orderId !== 'string') {
      return jsonError('معرف الطلب (orderId) مطلوب', 400);
    }

    return await withAdminClient(async (adminDb) => {
      const { data: order, error: orderError } = await adminDb
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return jsonError('الطلب غير موجود', 404);
      }

      const nowIso = new Date().toISOString();
      const updatedInternalNotes = [
        order.internal_notes,
        reasonNote ? `🚫 سبب الإلغاء: ${reasonNote}` : '🚫 تم إلغاء الطلب من لوحة التحكم',
      ]
        .filter(Boolean)
        .join(' | ');

      const { data: updatedOrder, error: updateError } = await adminDb
        .from('orders')
        .update({
          payment_method: 'cancelled',
          internal_notes: updatedInternalNotes,
          updated_at: nowIso,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError || !updatedOrder) {
        return jsonError('فشل تحديث حالة إلغاء الطلب', 500);
      }

      // Also resolve any open cancellation complaints tied to this order or contact
      if (order.contact_id) {
        await adminDb
          .from('complaints')
          .update({
            status: 'resolved',
            resolved_at: nowIso,
            resolution_notes: 'تم إلغاء الأوردر وإبلاغ العميل',
            updated_at: nowIso,
          })
          .eq('contact_id', order.contact_id)
          .eq('status', 'open');
      }

      let notificationSent = false;
      let warning: string | null = null;

      if (sendNotification !== false) {
        const templates = await fetchOrderMessageTemplates(adminDb);
        const finalMessage =
          typeof messageText === 'string' && messageText.trim()
            ? messageText.trim()
            : interpolateOrderTemplate(templates.staff_cancel_order, {
                customer_name: order.customer_name,
                order_number: order.order_number,
                total_amount: order.total_amount,
              });

        const sendResult = await sendOrderCustomerNotification(adminDb, {
          contactId: order.contact_id,
          customerPhone: order.customer_phone,
          channelId: order.channel_id,
          messageText: finalMessage,
          sentByStaffId: staff.user.id,
        });

        notificationSent = sendResult.sent;
        warning = sendResult.error;
      }

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        notificationSent,
        warning,
      });
    });
  } catch (err: unknown) {
    console.error('Unexpected error in /api/orders/cancel:', err);
    return jsonError('حدث خطأ غير متوقع أثناء إلغاء الطلب', 500);
  }
}
