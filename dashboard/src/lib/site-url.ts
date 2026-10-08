/**
 * Public base URL of the dashboard (used to build the Facebook OAuth redirect URI).
 * Set APP_BASE_URL in production (e.g. https://dashboard.example.com) when running behind a proxy;
 * otherwise it is derived from the request headers.
 */
export function resolveBaseUrl(headers: Headers): string {
  const fromEnv = process.env.APP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3000';
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const OAUTH_CALLBACK_PATH = '/api/channels/oauth/callback';

export function oauthRedirectUri(headers: Headers) {
  return `${resolveBaseUrl(headers)}${OAUTH_CALLBACK_PATH}`;
}
