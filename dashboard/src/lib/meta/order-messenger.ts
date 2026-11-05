import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { loadChannelCredentials } from '@/lib/meta/channels';
import { sendMessengerMessage } from '@/lib/meta/messenger';
import {
  DEFAULT_ORDER_MESSAGE_TEMPLATES,
  ORDER_TEMPLATES_CONFIG_ID,
  OrderMessageTemplates,
  parseOrderTemplatesFromAssets,
} from '@/lib/order-templates';

export async function fetchOrderMessageTemplates(
  adminDb: SupabaseClient<Database>
): Promise<OrderMessageTemplates> {
  try {
    const { data } = await adminDb
      .from('comment_settings')
      .select('action_assets')
      .limit(1)
      .maybeSingle();

    if (!data) return DEFAULT_ORDER_MESSAGE_TEMPLATES;
    return parseOrderTemplatesFromAssets(data.action_assets as Json);
  } catch {
    return DEFAULT_ORDER_MESSAGE_TEMPLATES;
  }
}

export async function saveOrderMessageTemplates(
  adminDb: SupabaseClient<Database>,
  templates: OrderMessageTemplates
): Promise<OrderMessageTemplates> {
  const { data: existing } = await adminDb
    .from('comment_settings')
    .select('id, action_assets')
    .limit(1)
    .maybeSingle();

  const currentAssets = Array.isArray(existing?.action_assets)
    ? (existing.action_assets as any[]).filter(
        (item) => !(item && typeof item === 'object' && item.id === ORDER_TEMPLATES_CONFIG_ID)
      )
    : [];

  const updatedAssets = [
    ...currentAssets,
    {
      id: ORDER_TEMPLATES_CONFIG_ID,
      templates,
    },
  ];

  if (existing?.id) {
    await adminDb
      .from('comment_settings')
      .update({
        action_assets: updatedAssets as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await adminDb.from('comment_settings').insert({
      action_assets: updatedAssets as unknown as Json,
    });
  }

  return parseOrderTemplatesFromAssets(updatedAssets as unknown as Json);
}

export async function sendOrderCustomerNotification(
  adminDb: SupabaseClient<Database>,
  params: {
    contactId?: string | null;
    customerPhone?: string | null;
    channelId?: string | null;
    messageText: string;
    sentByStaffId?: string | null;
  }
): Promise<{ sent: boolean; error: string | null }> {
  const text = (params.messageText || '').trim();
  if (!text) {
    return { sent: false, error: 'نص الرسالة فارغ' };
  }

  let contact: Database['public']['Tables']['contacts']['Row'] | null = null;

  if (params.contactId) {
    const { data } = await adminDb
      .from('contacts')
      .select('*')
      .eq('id', params.contactId)
      .maybeSingle();
    contact = data || null;
  }

  if (!contact && params.customerPhone) {
    const cleanPhone = params.customerPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 8) {
      const { data } = await adminDb
        .from('contacts')
        .select('*')
        .ilike('phone', `%${cleanPhone.slice(-9)}%`)
        .order('last_interaction_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      contact = data || null;
    }
  }

  if (!contact || !contact.platform_user_id) {
    return { sent: false, error: 'لم يتم العثور على حساب ماسنجر مرتبط بهذا العميل' };
  }

  let channelId = contact.channel_id || params.channelId || null;
  if (!channelId) {
    const { data: defaultChannel } = await adminDb
      .from('channels')
      .select('id')
      .eq('platform', 'facebook')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (defaultChannel?.id) {
      channelId = defaultChannel.id;
      await adminDb
        .from('contacts')
        .update({ channel_id: channelId })
        .eq('id', contact.id);
    }
  }

  if (!channelId) {
    return { sent: false, error: 'لا توجد قناة فيسبوك متصلة لإرسال الرسالة' };
  }

  try {
    const creds = await loadChannelCredentials(adminDb, channelId);
    const messageId = await sendMessengerMessage(
      contact.platform_user_id,
      text,
      creds.channel.external_id,
      creds.token,
      creds.appSecret || null
    );

    await adminDb.from('messages').insert({
      contact_id: contact.id,
      sender_type: 'bot',
      content: text,
      platform_message_id: messageId,
      sent_by: params.sentByStaffId || null,
      is_read: true,
    });

    return { sent: true, error: null };
  } catch (err: unknown) {
    console.error('Failed to send customer order notification on Messenger:', err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
