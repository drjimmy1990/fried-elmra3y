import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Short-lived, httpOnly cookies used only during "Connect with Facebook".
 * Scoped to /api/channels/oauth so they never reach other routes.
 *  - state cookie   (10 min): CSRF protection for the OAuth redirect
 *  - session cookie (15 min): long-lived user token while the admin picks pages
 */
const PATH = '/api/channels/oauth';
const STATE_COOKIE = 'fb_oauth_state';
const SESSION_COOKIE = 'fb_oauth_session';

export interface OAuthState {
  state: string;
  metaAppRowId: string;
}
export interface OAuthSession {
  metaAppRowId: string;
  userToken: string;
}

function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: PATH, maxAge };
}

function read<T>(req: NextRequest, name: string): T | null {
  const raw = req.cookies.get(name)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

const encode = (v: unknown) => Buffer.from(JSON.stringify(v), 'utf8').toString('base64url');

export const oauthCookies = {
  setState(res: NextResponse, v: OAuthState, secure: boolean) {
    res.cookies.set(STATE_COOKIE, encode(v), cookieOptions(secure, 600));
  },
  getState: (req: NextRequest) => read<OAuthState>(req, STATE_COOKIE),
  clearState(res: NextResponse) {
    res.cookies.set(STATE_COOKIE, '', { path: PATH, maxAge: 0 });
  },
  setSession(res: NextResponse, v: OAuthSession, secure: boolean) {
    res.cookies.set(SESSION_COOKIE, encode(v), cookieOptions(secure, 900));
  },
  getSession: (req: NextRequest) => read<OAuthSession>(req, SESSION_COOKIE),
  clearSession(res: NextResponse) {
    res.cookies.set(SESSION_COOKIE, '', { path: PATH, maxAge: 0 });
  },
};
