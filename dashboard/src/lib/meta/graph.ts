import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * Minimal Meta Graph API client for connecting Facebook Pages.
 * Every call can carry `appSecret` so we send `appsecret_proof` (needed when the
 * Meta app has "Require App Secret" enabled, and recommended anyway).
 */

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Page webhook fields the bot needs (comments + Messenger + staff replies from Meta inbox). */
export const PAGE_WEBHOOK_FIELDS = ['feed', 'messages', 'messaging_postbacks', 'message_echoes'] as const;

/** Permissions requested in the Facebook Login dialog. */
export const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata', // subscribe the page to the app webhooks
  'pages_messaging', // send Messenger replies
  'pages_manage_engagement', // reply / like / hide comments
  'pages_read_user_content', // read comments on posts
  'business_management', // list pages owned by a Business Manager
] as const;

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  type?: string;
  constructor(message: string, code?: number, subcode?: number, type?: string) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
    this.subcode = subcode;
    this.type = type;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function appSecretProof(token: string, appSecret: string) {
  return createHmac('sha256', appSecret).update(token).digest('hex');
}

async function graph<T>(
  path: string,
  { method = 'GET', params = {}, token, appSecret }: { method?: 'GET' | 'POST' | 'DELETE'; params?: Params; token?: string; appSecret?: string } = {}
): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  if (token) {
    search.set('access_token', token);
    if (appSecret) search.set('appsecret_proof', appSecretProof(token, appSecret));
  }

  const url = `${GRAPH_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(method === 'POST' ? url : `${url}?${search.toString()}`, {
    method,
    cache: 'no-store',
    ...(method === 'POST'
      ? { body: search, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      : {}),
    signal: AbortSignal.timeout(15000),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: { message: string; code?: number; error_subcode?: number; type?: string } };
  if (!res.ok || json.error) {
    const e = json.error;
    throw new GraphError(e?.message || `Graph API HTTP ${res.status}`, e?.code, e?.error_subcode, e?.type);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// App credentials
// ---------------------------------------------------------------------------
/** Confirms App ID + App Secret are a valid pair (uses the app access token). Returns the app name. */
export async function verifyAppCredentials(appId: string, appSecret: string) {
  const r = await graph<{ id: string; name?: string }>(`/${appId}`, {
    params: { fields: 'id,name', access_token: `${appId}|${appSecret}` },
  });
  return { id: r.id, name: r.name ?? null };
}

// ---------------------------------------------------------------------------
// OAuth (Facebook Login)
// ---------------------------------------------------------------------------
export function buildOAuthDialogUrl({
  appId,
  redirectUri,
  state,
  configId,
}: {
  appId: string;
  redirectUri: string;
  state: string;
  configId?: string | null;
}) {
  const p = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: 'code' });
  if (configId) {
    // Facebook Login for Business: permissions come from the configuration
    p.set('config_id', configId);
    p.set('override_default_response_type', 'true');
  } else {
    p.set('scope', OAUTH_SCOPES.join(','));
  }
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${p.toString()}`;
}

export async function exchangeCodeForUserToken(a: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  const r = await graph<{ access_token: string }>('/oauth/access_token', {
    params: { client_id: a.appId, client_secret: a.appSecret, redirect_uri: a.redirectUri, code: a.code },
  });
  return r.access_token;
}

/** Short-lived (~1h) user token -> long-lived (~60 days) user token. Page tokens derived from it never expire. */
export async function exchangeForLongLivedUserToken(a: { appId: string; appSecret: string; token: string }) {
  const r = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    params: { grant_type: 'fb_exchange_token', client_id: a.appId, client_secret: a.appSecret, fb_exchange_token: a.token },
  });
  return r.access_token;
}

export interface ManagedPage {
  id: string;
  name: string;
  access_token: string;
  picture_url: string | null;
  tasks: string[];
}

export async function listManagedPages(userToken: string, appSecret?: string): Promise<ManagedPage[]> {
  const pages: ManagedPage[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await graph<{
      data: Array<{ id: string; name: string; access_token: string; tasks?: string[]; picture?: { data?: { url?: string } } }>;
      paging?: { cursors?: { after?: string }; next?: string };
    }>('/me/accounts', {
      token: userToken,
      appSecret,
      params: { fields: 'id,name,access_token,tasks,picture{url}', limit: 100, after },
    });
    for (const p of r.data) {
      pages.push({ id: p.id, name: p.name, access_token: p.access_token, tasks: p.tasks ?? [], picture_url: p.picture?.data?.url ?? null });
    }
    if (!r.paging?.next) break;
    after = r.paging.cursors?.after;
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Page token helpers
// ---------------------------------------------------------------------------
export async function getPageFromToken(pageToken: string, appSecret?: string) {
  const r = await graph<{ id: string; name: string; picture?: { data?: { url?: string } } }>('/me', {
    token: pageToken,
    appSecret,
    params: { fields: 'id,name,picture{url}' },
  });
  return { id: r.id, name: r.name, picture_url: r.picture?.data?.url ?? null };
}

export interface TokenDebugInfo {
  is_valid: boolean;
  type?: string; // "PAGE" | "USER" | ...
  app_id?: string;
  profile_id?: string;
  expires_at?: number; // 0 = never
  scopes?: string[];
}

/** Inspect a token using the app access token (app_id|app_secret). */
export async function debugToken(a: { appId: string; appSecret: string; token: string }): Promise<TokenDebugInfo> {
  const r = await graph<{ data: TokenDebugInfo }>('/debug_token', {
    params: { input_token: a.token, access_token: `${a.appId}|${a.appSecret}` },
  });
  return r.data;
}

export async function subscribePageToApp(pageId: string, pageToken: string, appSecret?: string) {
  await graph<{ success: boolean }>(`/${pageId}/subscribed_apps`, {
    method: 'POST',
    token: pageToken,
    appSecret,
    params: { subscribed_fields: PAGE_WEBHOOK_FIELDS.join(',') },
  });
}

export async function getPageSubscriptions(pageId: string, pageToken: string, appSecret?: string) {
  const r = await graph<{ data: Array<{ id: string; name?: string; subscribed_fields?: string[] }> }>(
    `/${pageId}/subscribed_apps`,
    { token: pageToken, appSecret }
  );
  return r.data;
}

export async function unsubscribePageFromApp(pageId: string, pageToken: string, appSecret?: string) {
  await graph<{ success: boolean }>(`/${pageId}/subscribed_apps`, { method: 'DELETE', token: pageToken, appSecret });
}

// ---------------------------------------------------------------------------
// Posts & comments (Comment Control Center)
// ---------------------------------------------------------------------------
export interface PagePost {
  id: string;
  message: string;
  created_time: string;
  full_picture: string | null;
  permalink_url: string | null;
}

/** Latest page posts (newest first). Pass `after` from the previous call to load more. */
export async function listPagePosts(
  pageId: string,
  pageToken: string,
  appSecret?: string,
  opts: { limit?: number; after?: string | null } = {}
): Promise<{ posts: PagePost[]; nextCursor: string | null }> {
  const r = await graph<{
    data: Array<{ id: string; message?: string; created_time: string; full_picture?: string; permalink_url?: string }>;
    paging?: { cursors?: { after?: string }; next?: string };
  }>(`/${pageId}/posts`, {
    token: pageToken,
    appSecret,
    params: {
      fields: 'id,message,created_time,full_picture,permalink_url',
      limit: opts.limit ?? 24,
      after: opts.after ?? undefined,
    },
  });
  return {
    posts: r.data.map((p) => ({
      id: p.id,
      message: p.message ?? '',
      created_time: p.created_time,
      full_picture: p.full_picture ?? null,
      permalink_url: p.permalink_url ?? null,
    })),
    nextCursor: r.paging?.next ? (r.paging.cursors?.after ?? null) : null,
  };
}

type PageAuth = { token: string; appSecret?: string };

/** Public reply under a comment, as the page. Returns the new comment id. */
export async function replyToComment(commentId: string, message: string, auth: PageAuth) {
  const r = await graph<{ id: string }>(`/${commentId}/comments`, {
    method: 'POST',
    token: auth.token,
    appSecret: auth.appSecret,
    params: { message },
  });
  return r.id;
}

/** Private Messenger reply to a comment (allowed once per comment, within 7 days). */
export async function sendPrivateReply(pageId: string, commentId: string, text: string, auth: PageAuth) {
  return graph<{ recipient_id?: string; message_id?: string }>(`/${pageId}/messages`, {
    method: 'POST',
    token: auth.token,
    appSecret: auth.appSecret,
    params: {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify({ text }),
      messaging_type: 'RESPONSE',
    },
  });
}

export async function setCommentHidden(commentId: string, hidden: boolean, auth: PageAuth) {
  await graph<{ success: boolean }>(`/${commentId}`, {
    method: 'POST',
    token: auth.token,
    appSecret: auth.appSecret,
    params: { is_hidden: hidden },
  });
}

export async function likeComment(commentId: string, auth: PageAuth) {
  await graph<{ success: boolean }>(`/${commentId}/likes`, { method: 'POST', token: auth.token, appSecret: auth.appSecret });
}


/** Arabic, owner-friendly explanation of common Graph API failures. */
export function describeGraphError(err: unknown): string {
  if (!(err instanceof GraphError)) {
    if (err instanceof Error && err.name === 'TimeoutError') return 'انتهت مهلة الاتصال بفيسبوك، حاول مرة أخرى';
    return err instanceof Error ? err.message : 'خطأ غير معروف من فيسبوك';
  }
  const raw = ` (Facebook #${err.code ?? '?'}: ${err.message})`;
  switch (err.code) {
    case 190:
      return 'رمز الوصول (Token) غير صالح أو منتهي — أعد ربط الصفحة' + raw;
    case 10:
    case 200:
    case 230:
      return 'صلاحيات ناقصة — تأكد من الموافقة على كل الصلاحيات عند الربط، وأنك أدمن على الصفحة' + raw;
    case 100:
      return 'بيانات غير صحيحة (تأكد من App ID / App Secret أو رقم الصفحة)' + raw;
    case 101:
      return 'App ID أو App Secret غير صحيح' + raw;
    case 4:
    case 17:
    case 32:
    case 613:
      return 'فيسبوك أوقف الطلبات مؤقتاً بسبب كثرتها، حاول بعد دقائق' + raw;
    default:
      return 'فشل الاتصال بفيسبوك' + raw;
  }
}

/**
 * Like describeGraphError, plus Messenger / comment-specific limits
 * (24h window, one private reply per comment, deleted comments...).
 */
export function describeMessagingError(err: unknown): string {
  if (err instanceof GraphError) {
    const raw = ` (Facebook #${err.code ?? '?'}${err.subcode ? `/${err.subcode}` : ''}: ${err.message})`;
    if (err.subcode === 2018278 || err.subcode === 2018108) {
      return 'لا يمكن الإرسال: مرّ أكثر من 24 ساعة على آخر رسالة من العميل (قيود فيسبوك)' + raw;
    }
    if (err.code === 10900) return 'تم إرسال رد خاص على هذا التعليق من قبل (فيسبوك يسمح برد خاص واحد فقط)' + raw;
    if (err.code === 10903) return 'لا يمكن الرد الخاص: مرّ أكثر من 7 أيام على التعليق' + raw;
    if (err.code === 551) return 'هذا الشخص غير متاح لاستقبال الرسائل حالياً' + raw;
    if (err.code === 100 && err.subcode === 33) return 'التعليق غير موجود (ربما تم حذفه)' + raw;
  }
  return describeGraphError(err);
}
