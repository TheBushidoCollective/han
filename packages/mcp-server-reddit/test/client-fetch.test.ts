import { afterEach, describe, expect, test } from 'bun:test';

import type { RedditCredentials } from '../src/auth.js';
import { RedditClient } from '../src/client.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

interface ApiResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

interface Recorded {
  apiUrls: string[];
  tokensIssued: number;
}

/**
 * Routes the token endpoint to an incrementing token and every other request
 * to the next scripted response, so a test can script a failure sequence.
 */
function stubApi(responses: ApiResponse[]): Recorded {
  const recorded: Recorded = { apiUrls: [], tokensIssued: 0 };
  let index = 0;

  globalThis.fetch = (async (input: string) => {
    const url = String(input);

    if (url.startsWith('https://www.reddit.com/api/v1/access_token')) {
      recorded.tokensIssued++;
      return new Response(
        JSON.stringify({
          access_token: `tok-${recorded.tokensIssued}`,
          expires_in: 3600,
        }),
        { status: 200 }
      );
    }

    recorded.apiUrls.push(url);
    const next = responses[Math.min(index, responses.length - 1)];
    index++;
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status ?? 200,
      headers: next.headers,
    });
  }) as unknown as typeof fetch;

  return recorded;
}

const creds: RedditCredentials = {
  userAgent: 'test-agent',
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'refresh',
};

const listing = (
  children: Array<{ kind: string; data: Record<string, unknown> }>,
  after: string | null
) => ({ kind: 'Listing', data: { children, after } });

const post = (id: string) => ({
  kind: 't3',
  data: { id, name: `t3_${id}`, title: id },
});

describe('RedditClient.get', () => {
  test('sends the bearer token and user agent', async () => {
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('access_token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }),
          { status: 200 }
        );
      }
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new RedditClient(creds, 'user');
    await client.get('/api/v1/me');

    expect(seenHeaders.Authorization).toBe('Bearer tok-1');
    expect(seenHeaders['User-Agent']).toBe('test-agent');
  });

  test('invalidates the token and retries once on 401', async () => {
    const recorded = stubApi([
      { status: 401 },
      { status: 200, body: { ok: true } },
    ]);

    const client = new RedditClient(creds, 'user');
    const result = await client.get<{ ok: boolean }>('/api/v1/me');

    expect(result.ok).toBe(true);
    expect(recorded.apiUrls).toHaveLength(2);
    // A fresh token proves the stale one was actually dropped.
    expect(recorded.tokensIssued).toBe(2);
  });

  test('gives up after repeated 401s rather than looping', async () => {
    const recorded = stubApi([{ status: 401 }]);
    const client = new RedditClient(creds, 'user');

    await expect(client.get('/api/v1/me')).rejects.toThrow('401');
    expect(recorded.apiUrls).toHaveLength(3);
  });

  test('retries a 429 and succeeds', async () => {
    const recorded = stubApi([
      { status: 429 },
      { status: 200, body: { ok: true } },
    ]);

    const client = new RedditClient(creds, 'user');
    const result = await client.get<{ ok: boolean }>('/hot');

    expect(result.ok).toBe(true);
    expect(recorded.apiUrls).toHaveLength(2);
  });

  test('retries a 500 and succeeds', async () => {
    const recorded = stubApi([
      { status: 503 },
      { status: 200, body: { ok: true } },
    ]);

    const client = new RedditClient(creds, 'user');
    await client.get('/hot');
    expect(recorded.apiUrls).toHaveLength(2);
  });

  test('does not retry a 404, which will never become a 200', async () => {
    const recorded = stubApi([{ status: 404 }]);
    const client = new RedditClient(creds, 'user');

    await expect(client.get('/r/nope/about')).rejects.toThrow('HTTP 404');
    expect(recorded.apiUrls).toHaveLength(1);
  });

  test('anonymous mode issues no token and targets the public host', async () => {
    const recorded = stubApi([{ status: 200, body: { ok: true } }]);
    const client = new RedditClient({ userAgent: 'test' }, 'anonymous');

    await client.get('/r/bun/hot');

    expect(recorded.tokensIssued).toBe(0);
    expect(recorded.apiUrls[0]).toContain(
      'https://www.reddit.com/r/bun/hot.json'
    );
  });
});

describe('RedditClient.getListing', () => {
  test('normalizes children and the after cursor', async () => {
    stubApi([{ body: listing([post('a'), post('b')], 't3_b') }]);
    const client = new RedditClient(creds, 'user');

    const page = await client.getListing('/user/x/saved');
    expect(page.things).toHaveLength(2);
    expect(page.after).toBe('t3_b');
  });

  test('tolerates a listing with no data at all', async () => {
    stubApi([{ body: {} }]);
    const client = new RedditClient(creds, 'user');

    const page = await client.getListing('/user/x/saved');
    expect(page.things).toEqual([]);
    expect(page.after).toBeNull();
  });
});

describe('RedditClient.collectListing', () => {
  test('pages until the cursor runs out', async () => {
    const recorded = stubApi([
      { body: listing([post('a'), post('b')], 't3_b') },
      { body: listing([post('c')], null) },
    ]);
    const client = new RedditClient(creds, 'user');

    const things = await client.collectListing(
      '/user/x/saved',
      {},
      { limit: 100, maxPages: 5 }
    );

    expect(things).toHaveLength(3);
    expect(recorded.apiUrls).toHaveLength(2);
    // The second request must carry the cursor from the first.
    expect(recorded.apiUrls[1]).toContain('after=t3_b');
    expect(recorded.apiUrls[0]).not.toContain('after=');
  });

  test('stops at maxPages even when more pages exist', async () => {
    const recorded = stubApi([{ body: listing([post('a')], 't3_a') }]);
    const client = new RedditClient(creds, 'user');

    const things = await client.collectListing(
      '/user/x/saved',
      {},
      { limit: 100, maxPages: 3 }
    );

    expect(recorded.apiUrls).toHaveLength(3);
    expect(things).toHaveLength(3);
  });

  test('never returns more than the limit', async () => {
    stubApi([{ body: listing([post('a'), post('b'), post('c')], 't3_c') }]);
    const client = new RedditClient(creds, 'user');

    const things = await client.collectListing(
      '/user/x/saved',
      {},
      { limit: 2, maxPages: 5 }
    );

    expect(things).toHaveLength(2);
  });

  test("caps each page request at Reddit's 100 item maximum", async () => {
    const recorded = stubApi([{ body: listing([post('a')], null) }]);
    const client = new RedditClient(creds, 'user');

    await client.collectListing(
      '/user/x/saved',
      {},
      { limit: 500, maxPages: 2 }
    );

    expect(recorded.apiUrls[0]).toContain('limit=100');
  });

  test('stops on an empty page rather than spinning', async () => {
    const recorded = stubApi([{ body: listing([], 't3_x') }]);
    const client = new RedditClient(creds, 'user');

    const things = await client.collectListing(
      '/user/x/saved',
      {},
      { limit: 100, maxPages: 5 }
    );

    expect(things).toEqual([]);
    expect(recorded.apiUrls).toHaveLength(1);
  });

  test('forwards caller query parameters on every page', async () => {
    const recorded = stubApi([
      { body: listing([post('a')], 't3_a') },
      { body: listing([post('b')], null) },
    ]);
    const client = new RedditClient(creds, 'user');

    await client.collectListing(
      '/user/x/saved',
      { type: 'links' },
      { limit: 100, maxPages: 5 }
    );

    expect(recorded.apiUrls[0]).toContain('type=links');
    expect(recorded.apiUrls[1]).toContain('type=links');
  });
});
