import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import {
  fetchOrderMessageTemplates,
  sendOrderCustomerNotification,
} from '@/lib/meta/order-messenger';
import { interpolateOrderTemplate } from '@/lib/order-templates';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authenticated staff
    const staff = await requireStaff(['admin', 'order_agent']);
    if (!staff.ok) {
      return staff.response;
    }

    // 2. Parse request payload
    const body = await request.json();
    const { orderId, messageText } = body;

    if (!orderId || typeof orderId !== 'string') {
      return jsonError('معرف الطلب (orderId) مطلوب', 400);
    }

    return await withAdminClient(async (adminDb) => {
      // 3. Fetch order with items
      const { data: order, error: orderError } = await adminDb
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return jsonError('الطلب غير موجود', 404);
      }

      // 4. Update order status to 'confirmed'
      const { data: updatedOrder, error: updateError } = await adminDb
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError || !updatedOrder) {
        return jsonError('فشل تحديث حالة الطلب', 500);
      }

      // 5. Send confirmation message to customer using saved template or custom message
      const templates = await fetchOrderMessageTemplates(adminDb);
      const confirmText =
        typeof messageText === 'string' && messageText.trim()
          ? messageText.trim()
          : interpolateOrderTemplate(templates.confirm_order, {
              customer_name: order.customer_name,
              order_number: order.order_number,
              total_amount: order.total_amount,
            });

      const sendResult = await sendOrderCustomerNotification(adminDb, {
        contactId: order.contact_id,
        customerPhone: order.customer_phone,
        channelId: order.channel_id,
        messageText: confirmText,
        sentByStaffId: staff.user.id,
      });

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        confirmationSent: sendResult.sent,
        warning: sendResult.error,
      });
    });
  } catch (err: unknown) {
    console.error('Unexpected error in /api/orders/confirm:', err);
    return jsonError('حدث خطأ غير متوقع أثناء تأكيد الطلب', 500);
  }
}
