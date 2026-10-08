import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database.types';
import { debugToken, describeGraphError, subscribePageToApp } from '@/lib/meta/graph';

type Db = SupabaseClient<Database>;
export type MetaAppRow = Tables<'meta_apps'>;
export type ChannelRow = Tables<'channels'>;

export interface ConnectResult {
  channel: ChannelRow;
  warning: string | null;
}

/**
 * Stores (or refreshes) a Facebook Page connection:
 *  1. subscribes the page to the app webhooks (feed, messages, postbacks, echoes),
 *  2. reads the token expiry (NULL = never expires),
 *  3. upserts `channels` (public metadata) and `channel_secrets` (token, service role only).
 * A failed webhook subscription does not block saving: the page is stored with status "error"
 * and the reason, so the owner can fix permissions and press "اختبار".
 */
export async function savePageConnection(
  db: Db,
  args: {
    metaApp: MetaAppRow | null;
    page: { id: string; name: string | null; picture_url: string | null };
    pageToken: string;
  }
): Promise<ConnectResult> {
  const { metaApp, page, pageToken } = args;
  let warning: string | null = null;
  let status: ChannelRow['status'] = 'connected';
  let tokenExpiresAt: string | null = null;

  try {
    await subscribePageToApp(page.id, pageToken, metaApp?.app_secret);
  } catch (err) {
    status = 'error';
    warning = `تم حفظ الصفحة لكن فشل ربطها بالويب هوك: ${describeGraphError(err)}`;
  }

  if (metaApp) {
    try {
      const info = await debugToken({ appId: metaApp.app_id, appSecret: metaApp.app_secret, token: pageToken });
      if (info.expires_at && info.expires_at > 0) {
        tokenExpiresAt = new Date(info.expires_at * 1000).toISOString();
        warning ??= 'تنبيه: هذا الرمز له تاريخ انتهاء. الأفضل الربط عن طريق زر "ربط عبر فيسبوك" للحصول على رمز دائم.';
      }
    } catch {
      // Expiry is informational only; ignore debug failures.
    }
  }

  const now = new Date().toISOString();
  const { data: channel, error } = await db
    .from('channels')
    .upsert(
      {
        platform: 'facebook',
        external_id: page.id,
        name: page.name,
        picture_url: page.picture_url,
        meta_app_id: metaApp?.id ?? null,
        status,
        token_expires_at: tokenExpiresAt,
        connected_at: now,
        last_checked_at: now,
        last_error: status === 'error' ? warning : null,
      },
      { onConflict: 'platform,external_id' }
    )
    .select()
    .single();

  if (error || !channel) throw new Error(`تعذر حفظ الصفحة: ${error?.message}`);

  const { error: secretError } = await db
    .from('channel_secrets')
    .upsert({ channel_id: channel.id, access_token: pageToken, updated_at: now }, { onConflict: 'channel_id' });
  if (secretError) throw new Error(`تعذر حفظ رمز الصفحة: ${secretError.message}`);

  return { channel, warning };
}

export async function getMetaApp(db: Db, id: string | null | undefined): Promise<MetaAppRow | null> {
  if (!id) return null;
  const { data } = await db.from('meta_apps').select('*').eq('id', id).maybeSingle();
  return data;
}

/** Shape returned to the browser: never includes app_secret or tokens. */
export function toPublicMetaApp(app: MetaAppRow, pagesCount = 0) {
  return {
    id: app.id,
    name: app.name,
    app_id: app.app_id,
    webhook_verify_token: app.webhook_verify_token,
    login_config_id: app.login_config_id,
    is_active: app.is_active,
    secret_hint: app.app_secret ? `••••${app.app_secret.slice(-4)}` : null,
    pages_count: pagesCount,
    created_at: app.created_at,
  };
}
export type PublicMetaApp = ReturnType<typeof toPublicMetaApp>;

export class ChannelCredentialsError extends Error {}

/**
 * Loads a connected page with its token and its app secret (for appsecret_proof).
 * Service-role client only. Throws ChannelCredentialsError with an Arabic message.
 */
export async function loadChannelCredentials(db: Db, channelId: string | null | undefined) {
  if (!channelId) throw new ChannelCredentialsError('لا توجد صفحة مرتبطة بهذا العنصر');
  const { data: channel } = await db.from('channels').select('*').eq('id', channelId).maybeSingle();
  if (!channel) throw new ChannelCredentialsError('الصفحة غير موجودة — اربطها من صفحة القنوات');
  if (channel.status === 'disconnected') throw new ChannelCredentialsError(`الصفحة "${channel.name ?? channel.external_id}" غير متصلة`);

  const { data: secret } = await db.from('channel_secrets').select('access_token').eq('channel_id', channelId).maybeSingle();
  if (!secret?.access_token) throw new ChannelCredentialsError('لا يوجد رمز وصول للصفحة — أعد ربطها من صفحة القنوات');

  const metaApp = await getMetaApp(db, channel.meta_app_id);
  return { channel, token: secret.access_token, appSecret: metaApp?.app_secret || undefined };
}
