import 'server-only';
import { createHmac } from 'node:crypto';
import { GraphError, GRAPH_VERSION } from './graph';

/**
 * Sends a plain-text Messenger reply from a Page to a customer (PSID).
 * Throws GraphError so callers can use describeMessagingError() for Arabic messages
 * (e.g. 24h window subcode 2018278). Returns the Graph `message_id`.
 */
export async function sendMessengerMessage(
  psid: string,
  text: string,
  pageId: string,
  accessToken: string,
  appSecret: string | null
): Promise<string | null> {
  const form = new URLSearchParams();
  form.append('recipient', JSON.stringify({ id: psid }));
  form.append('message', JSON.stringify({ text }));
  form.append('messaging_type', 'RESPONSE');
  form.append('access_token', accessToken);
  if (appSecret) {
    form.append('appsecret_proof', createHmac('sha256', appSecret).update(accessToken).digest('hex'));
  }

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/messages`, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GraphError('تعذر الاتصال بفيسبوك (انتهت المهلة أو مشكلة شبكة)');
  }

  const data = (await res.json().catch(() => ({}))) as {
    message_id?: string;
    error?: { message?: string; code?: number; error_subcode?: number; type?: string };
  };

  if (!res.ok || data.error) {
    const err = data.error ?? {};
    throw new GraphError(err.message || `HTTP ${res.status}`, err.code, err.error_subcode, err.type);
  }

  return data.message_id ?? null;
}
