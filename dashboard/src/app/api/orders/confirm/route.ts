import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import { loadChannelCredentials } from '@/lib/meta/channels';
import { sendMessengerMessage } from '@/lib/meta/messenger';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authenticated staff
    const staff = await requireStaff(['admin', 'order_agent']);
    if (!staff.ok) {
      return staff.response;
    }

    // 2. Parse request payload
    const body = await request.json();
    const { orderId } = body;

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

      // 5. Send confirmation message to customer if contact_id exists
      let confirmationSent = false;
      let sendErrorMessage: string | null = null;

      if (order.contact_id) {
        const { data: contact } = await adminDb
          .from('contacts')
          .select('*')
          .eq('id', order.contact_id)
          .single();

        if (contact && contact.platform_user_id && (contact.channel_id || order.channel_id)) {
          const channelId = contact.channel_id || order.channel_id;
          try {
            const creds = await loadChannelCredentials(adminDb, channelId!);
            const confirmText = `ألف هنا يا ${order.customer_name || 'فندم'}! 🍗🔥\nتم تأكيد أوردرك رقم #${order.order_number} بنجاح!\nجاري تجهيزه في المطعم وتسليمه لمندوب التوصيل فوراً 🛵`;

            const messageId = await sendMessengerMessage(
              contact.platform_user_id,
              confirmText,
              creds.channel.external_id,
              creds.token,
              creds.appSecret || null
            );

            // Log bot confirmation message to messages table
            await adminDb.from('messages').insert({
              contact_id: contact.id,
              sender_type: 'bot',
              content: confirmText,
              platform_message_id: messageId,
              is_read: true,
            });

            confirmationSent = true;
          } catch (err: unknown) {
            console.error('Failed to send order confirmation messenger message:', err);
            sendErrorMessage = err instanceof Error ? err.message : String(err);
          }
        }
      }

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        confirmationSent,
        warning: sendErrorMessage,
      });
    });
  } catch (err: unknown) {
    console.error('Unexpected error in /api/orders/confirm:', err);
    return jsonError('حدث خطأ غير متوقع أثناء تأكيد الطلب', 500);
  }
}
