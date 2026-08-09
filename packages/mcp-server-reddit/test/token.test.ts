import { afterEach, describe, expect, test } from 'bun:test';

import { type RedditCredentials, TokenProvider } from '../src/auth.js';

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Call {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Installs a token endpoint stub and records every request it receives. */
function stubToken(
  responses: Array<{ status?: number; payload: unknown }>
): Call[] {
  const calls: Call[] = [];
  let index = 0;

  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ''),
    });
    const next = responses[Math.min(index, responses.length - 1)];
    index++;
    return new Response(JSON.stringify(next.payload), {
      status: next.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return calls;
}

const creds = (extra: Partial<RedditCredentials>): RedditCredentials => ({
  userAgent: 'test-agent',
  clientId: 'id',
  clientSecret: 'secret',
  ...extra,
});

describe('TokenProvider', () => {
  test('never contacts Reddit in anonymous mode', async () => {
    const calls = stubToken([{ payload: {} }]);
    const provider = new TokenProvider(creds({}), 'anonymous');

    expect(await provider.getToken()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test('uses the refresh_token grant with basic auth and the user agent', async () => {
    const calls = stubToken([
      { payload: { access_token: 'tok-1', expires_in: 3600 } },
    ]);
    const provider = new TokenProvider(
      creds({ refreshToken: 'refresh-abc' }),
      'user'
    );

    expect(await provider.getToken()).toBe('tok-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TOKEN_URL);
    expect(calls[0].headers.Authorization).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`
    );
    expect(calls[0].headers['User-Agent']).toBe('test-agent');

    const body = new URLSearchParams(calls[0].body);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-abc');
  });

  test('prefers a refresh token over a password pair', async () => {
    const calls = stubToken([{ payload: { access_token: 't' } }]);
    const provider = new TokenProvider(
      creds({ refreshToken: 'r', username: 'u', password: 'p' }),
      'user'
    );

    await provider.getToken();
    expect(new URLSearchParams(calls[0].body).get('grant_type')).toBe(
      'refresh_token'
    );
  });

  test('falls back to the password grant', async () => {
    const calls = stubToken([{ payload: { access_token: 't' } }]);
    const provider = new TokenProvider(
      creds({ username: 'u', password: 'p' }),
      'user'
    );

    await provider.getToken();
    const body = new URLSearchParams(calls[0].body);
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('username')).toBe('u');
    expect(body.get('password')).toBe('p');
  });

  test('uses client_credentials in app mode', async () => {
    const calls = stubToken([{ payload: { access_token: 't' } }]);
    const provider = new TokenProvider(creds({}), 'app');

    await provider.getToken();
    expect(new URLSearchParams(calls[0].body).get('grant_type')).toBe(
      'client_credentials'
    );
  });

  test('caches the token until the expiry skew window opens', async () => {
    const calls = stubToken([
      { payload: { access_token: 'tok-1', expires_in: 3600 } },
      { payload: { access_token: 'tok-2', expires_in: 3600 } },
    ]);

    let now = 1_000_000;
    const provider = new TokenProvider(
      creds({ refreshToken: 'r' }),
      'user',
      () => now
    );

    expect(await provider.getToken()).toBe('tok-1');

    // Just inside the skew window: still the cached token.
    now += (3600 - 61) * 1000;
    expect(await provider.getToken()).toBe('tok-1');
    expect(calls).toHaveLength(1);

    // Past the skew boundary: refreshed before Reddit would reject it.
    now += 2000;
    expect(await provider.getToken()).toBe('tok-2');
    expect(calls).toHaveLength(2);
  });

  test('collapses concurrent refreshes into a single request', async () => {
    const calls = stubToken([
      { payload: { access_token: 'tok-1', expires_in: 3600 } },
    ]);
    const provider = new TokenProvider(creds({ refreshToken: 'r' }), 'user');

    const tokens = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);

    expect(tokens).toEqual(['tok-1', 'tok-1', 'tok-1']);
    expect(calls).toHaveLength(1);
  });

  test('refetches after a failed refresh rather than wedging', async () => {
    const calls = stubToken([
      { status: 401, payload: { error: 'invalid_grant' } },
      { payload: { access_token: 'tok-ok', expires_in: 3600 } },
    ]);
    const provider = new TokenProvider(creds({ refreshToken: 'r' }), 'user');

    await expect(provider.getToken()).rejects.toThrow('HTTP 401');
    // The in-flight promise must be cleared, or every later call reuses it.
    expect(await provider.getToken()).toBe('tok-ok');
    expect(calls).toHaveLength(2);
  });

  test('invalidate forces the next call to re-authenticate', async () => {
    const calls = stubToken([
      { payload: { access_token: 'tok-1', expires_in: 3600 } },
      { payload: { access_token: 'tok-2', expires_in: 3600 } },
    ]);
    const provider = new TokenProvider(creds({ refreshToken: 'r' }), 'user');

    expect(await provider.getToken()).toBe('tok-1');
    provider.invalidate();
    expect(await provider.getToken()).toBe('tok-2');
    expect(calls).toHaveLength(2);
  });

  test('never echoes the response body, which can carry the grant', async () => {
    stubToken([{ status: 400, payload: { password: 'hunter2' } }]);
    const provider = new TokenProvider(
      creds({ username: 'u', password: 'hunter2' }),
      'user'
    );

    await expect(provider.getToken()).rejects.toThrow(/HTTP 400(?!.*hunter2)/s);
  });

  test('rejects a 200 response that carries no access token', async () => {
    stubToken([{ payload: { error: 'unsupported_grant_type' } }]);
    const provider = new TokenProvider(creds({ refreshToken: 'r' }), 'user');

    await expect(provider.getToken()).rejects.toThrow('unsupported_grant_type');
  });

  test('requires a client id for authenticated modes', async () => {
    stubToken([{ payload: {} }]);
    const provider = new TokenProvider(
      { userAgent: 'test', refreshToken: 'r' },
      'user'
    );

    await expect(provider.getToken()).rejects.toThrow('REDDIT_CLIENT_ID');
  });
});
