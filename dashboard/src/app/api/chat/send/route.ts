import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import { loadChannelCredentials, ChannelCredentialsError } from '@/lib/meta/channels';
import { describeMessagingError } from '@/lib/meta/graph';
import { sendMessengerMessage } from '@/lib/meta/messenger';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authenticated user (admin only per owner requirement)
    const staff = await requireStaff(['admin']);
    if (!staff.ok) {
      return staff.response;
    }

    // 2. Parse and validate body payload
    const body = await request.json();
    const { contactId, content } = body;

    if (!contactId || typeof contactId !== 'string') {
      return jsonError('معرف جهة الاتصال (contactId) مطلوب', 400);
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return jsonError('محتوى الرسالة (content) لا يمكن أن يكون فارغاً', 400);
    }

    const trimmedContent = content.trim().substring(0, 2000);

    // 3. Fetch contact with admin client
    return await withAdminClient(async (adminDb) => {
      const { data: contact, error: contactError } = await adminDb
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError || !contact) {
        return jsonError('جهة الاتصال غير موجودة', 404);
      }

      // 6. If contact is on Messenger and has platform_user_id, send via Facebook Graph API
      let deliveryWarning: string | null = null;
      let platformMessageId: string | null = null;
      let sendError: string | null = null;

      const isMessenger = contact.platform === 'messenger' || contact.platform.toLowerCase() === 'facebook';

      if (isMessenger && contact.platform_user_id && contact.channel_id) {
        try {
          const creds = await loadChannelCredentials(adminDb, contact.channel_id);
          const msgId = await sendMessengerMessage(
            contact.platform_user_id,
            trimmedContent,
            creds.channel.external_id,
            creds.token,
            creds.appSecret || null
          );
          platformMessageId = msgId;
        } catch (fbError: unknown) {
          console.error('Failed to dispatch Facebook Graph API message:', fbError);
          sendError =
            fbError instanceof ChannelCredentialsError
              ? fbError.message
              : describeMessagingError(fbError);
          deliveryWarning = sendError;
        }
      } else if (isMessenger) {
        sendError = 'العميل ده مش مربوط بصفحة متصلة — الرسالة اتسجلت بس متبعتتش';
        deliveryWarning = sendError;
      }

      // 4. Insert new message row in database with sender_type = 'agent'
      const { data: insertedMessage, error: insertError } = await adminDb
        .from('messages')
        .insert({
          contact_id: contactId,
          sender_type: 'agent',
          content: trimmedContent,
          is_read: true,
          sent_by: staff.user.id,
          platform_message_id: platformMessageId,
          send_error: sendError,
        })
        .select('*')
        .single();

      if (insertError || !insertedMessage) {
        console.error('Failed to insert message into Supabase:', insertError);
        return jsonError('تعذر حفظ الرسالة في قاعدة البيانات', 500);
      }

      return NextResponse.json({
        success: true,
        message: insertedMessage,
        deliveryWarning,
      });
    });
  } catch (error: any) {
    console.error('Unexpected error in chat send route:', error);
    return jsonError(error.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب', 500);
  }
}
