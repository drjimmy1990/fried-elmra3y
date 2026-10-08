// Run with: node --conditions=react-server --test (graph.ts imports 'server-only')
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { createHmac } from 'node:crypto';
import {
  GraphError,
  PAGE_WEBHOOK_FIELDS,
  buildOAuthDialogUrl,
  describeGraphError,
  describeMessagingError,
  listManagedPages,
  listPagePosts,
  replyToComment,
  sendPrivateReply,
  setCommentHidden,
  subscribePageToApp,
  verifyAppCredentials,
} from '../lib/meta/graph.ts';

const realFetch = globalThis.fetch;
type Call = { url: string; init?: RequestInit };

function mockFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Meta Graph client', () => {
  it('builds a classic scope OAuth dialog URL', () => {
    const url = new URL(buildOAuthDialogUrl({ appId: '111', redirectUri: 'https://d.example/cb', state: 'abc' }));
    assert.strictEqual(url.hostname, 'www.facebook.com');
    assert.strictEqual(url.searchParams.get('client_id'), '111');
    assert.strictEqual(url.searchParams.get('redirect_uri'), 'https://d.example/cb');
    assert.strictEqual(url.searchParams.get('state'), 'abc');
    assert.strictEqual(url.searchParams.get('response_type'), 'code');
    const scope = url.searchParams.get('scope') ?? '';
    for (const p of ['pages_messaging', 'pages_manage_metadata', 'pages_manage_engagement', 'pages_read_user_content']) {
      assert.ok(scope.includes(p), `scope must include ${p}`);
    }
    assert.strictEqual(url.searchParams.get('config_id'), null);
  });

  it('uses config_id instead of scope for Facebook Login for Business', () => {
    const url = new URL(buildOAuthDialogUrl({ appId: '111', redirectUri: 'https://d/cb', state: 's', configId: '999' }));
    assert.strictEqual(url.searchParams.get('config_id'), '999');
    assert.strictEqual(url.searchParams.get('override_default_response_type'), 'true');
    assert.strictEqual(url.searchParams.get('scope'), null);
  });

  it('subscribes a page with all bot webhook fields and an appsecret_proof (POST body, not URL)', async () => {
    const calls = mockFetch([{ body: { success: true } }]);
    await subscribePageToApp('12345', 'PAGE_TOKEN', 'SECRET');
    assert.strictEqual(calls.length, 1);
    assert.match(calls[0].url, /\/12345\/subscribed_apps$/);
    assert.strictEqual(calls[0].init?.method, 'POST');
    const body = new URLSearchParams(String(calls[0].init?.body));
    assert.strictEqual(body.get('subscribed_fields'), PAGE_WEBHOOK_FIELDS.join(','));
    assert.strictEqual(body.get('access_token'), 'PAGE_TOKEN');
    assert.strictEqual(body.get('appsecret_proof'), createHmac('sha256', 'SECRET').update('PAGE_TOKEN').digest('hex'));
    assert.ok(!calls[0].url.includes('PAGE_TOKEN'), 'token must not be in the POST URL');
  });

  it('includes feed, messages, postbacks and echoes in webhook fields', () => {
    assert.deepStrictEqual([...PAGE_WEBHOOK_FIELDS], ['feed', 'messages', 'messaging_postbacks', 'message_echoes']);
  });

  it('turns Graph error payloads into GraphError with code', async () => {
    mockFetch([{ status: 400, body: { error: { message: 'Invalid OAuth access token.', code: 190, type: 'OAuthException' } } }]);
    await assert.rejects(verifyAppCredentials('1', 'bad'), (err: unknown) => {
      assert.ok(err instanceof GraphError);
      assert.strictEqual(err.code, 190);
      return true;
    });
  });

  it('follows pagination when listing managed pages', async () => {
    mockFetch([
      { body: { data: [{ id: '1', name: 'A', access_token: 't1', tasks: ['MODERATE'] }], paging: { next: 'x', cursors: { after: 'c1' } } } },
      { body: { data: [{ id: '2', name: 'B', access_token: 't2', picture: { data: { url: 'https://p/2.jpg' } } }] } },
    ]);
    const pages = await listManagedPages('USER');
    assert.deepStrictEqual(
      pages.map((p) => [p.id, p.picture_url, p.tasks.length]),
      [
        ['1', null, 1],
        ['2', 'https://p/2.jpg', 0],
      ]
    );
  });

  it('explains common errors in Arabic for the owner', () => {
    assert.match(describeGraphError(new GraphError('x', 190)), /أعد ربط الصفحة/);
    assert.match(describeGraphError(new GraphError('x', 200)), /صلاحيات ناقصة/);
    assert.match(describeGraphError(new GraphError('x', 4)), /حاول بعد دقائق/);
    assert.match(describeGraphError(new GraphError('x', 101)), /App Secret/);
  });
});

describe('Meta Graph: posts & comment actions', () => {
  const auth = { token: 'PAGE_TOKEN', appSecret: 'SECRET' };
  const body = (c: Call) => new URLSearchParams(String(c.init?.body ?? ''));

  it('lists page posts with paging cursor only when a next page exists', async () => {
    const calls = mockFetch([
      {
        body: {
          data: [{ id: '1_2', message: 'بروستد', created_time: '2026-10-01T00:00:00+0000', full_picture: 'https://img' }],
          paging: { cursors: { after: 'CUR' }, next: 'https://graph/next' },
        },
      },
      { body: { data: [], paging: { cursors: { after: 'X' } } } },
    ]);
    const first = await listPagePosts('1', 'T', undefined, { limit: 5 });
    assert.match(calls[0].url, /\/1\/posts\?/);
    assert.ok(new URL(calls[0].url).searchParams.get('fields')?.includes('full_picture'));
    assert.strictEqual(first.posts[0].permalink_url, null);
    assert.strictEqual(first.nextCursor, 'CUR');
    const second = await listPagePosts('1', 'T', undefined, { after: 'CUR' });
    assert.strictEqual(new URL(calls[1].url).searchParams.get('after'), 'CUR');
    assert.strictEqual(second.nextCursor, null);
  });

  it('replies publicly, hides and sends a private reply via POST bodies', async () => {
    const calls = mockFetch([{ body: { id: 'reply_1' } }, { body: { success: true } }, { body: { message_id: 'm1' } }]);
    assert.strictEqual(await replyToComment('c_1', 'شكراً', auth), 'reply_1');
    assert.match(calls[0].url, /\/c_1\/comments$/);
    assert.strictEqual(body(calls[0]).get('message'), 'شكراً');
    assert.ok(body(calls[0]).get('appsecret_proof'));

    await setCommentHidden('c_1', true, auth);
    assert.match(calls[1].url, /\/c_1$/);
    assert.strictEqual(body(calls[1]).get('is_hidden'), 'true');

    await sendPrivateReply('PAGE', 'c_1', 'أهلاً', auth);
    assert.match(calls[2].url, /\/PAGE\/messages$/);
    assert.deepStrictEqual(JSON.parse(body(calls[2]).get('recipient')!), { comment_id: 'c_1' });
    assert.deepStrictEqual(JSON.parse(body(calls[2]).get('message')!), { text: 'أهلاً' });
  });

  it('explains messaging limits in Arabic and falls back to describeGraphError', () => {
    assert.match(describeMessagingError(new GraphError('x', 10900)), /رد خاص واحد/);
    assert.match(describeMessagingError(new GraphError('x', 10, 2018278)), /24 ساعة/);
    assert.strictEqual(describeMessagingError(new GraphError('bad', 190)), describeGraphError(new GraphError('bad', 190)));
  });
});
