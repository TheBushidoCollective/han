/**
 * Thin Reddit REST client: routes to the right host for the auth mode,
 * retries the failures worth retrying, and pages listings.
 */

import {
  type AuthMode,
  type RedditCredentials,
  TokenProvider,
} from './auth.js';

const OAUTH_HOST = 'https://oauth.reddit.com';
const PUBLIC_HOST = 'https://www.reddit.com';

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

export type QueryValue = string | number | boolean | undefined;

/** A Reddit "thing" wrapper: t1 comment, t3 link, t5 subreddit, and so on. */
export interface RedditThing {
  kind?: string;
  data?: Record<string, unknown>;
}

export interface Listing {
  kind?: string;
  data?: {
    children?: RedditThing[];
    after?: string | null;
    before?: string | null;
  };
}

export interface ListingPage {
  things: RedditThing[];
  after: string | null;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds the request URL for an auth mode.
 *
 * Anonymous requests go to www.reddit.com and need the .json suffix Reddit
 * requires there; authenticated ones go to the OAuth host, which rejects that
 * suffix. Empty and undefined query values are dropped rather than sent blank,
 * because Reddit treats an empty `after` as a malformed cursor.
 */
export function buildRedditUrl(
  mode: AuthMode,
  path: string,
  query: Record<string, QueryValue> = {}
): string {
  const anonymous = mode === 'anonymous';
  const host = anonymous ? PUBLIC_HOST : OAUTH_HOST;
  const suffix = anonymous && !path.endsWith('.json') ? '.json' : '';
  const url = new URL(`${host}${path}${suffix}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  // Ask for the raw JSON shape rather than the HTML-escaped one.
  url.searchParams.set('raw_json', '1');
  return url.toString();
}

export class RedditClient {
  private readonly tokens: TokenProvider;

  constructor(
    private readonly credentials: RedditCredentials,
    readonly mode: AuthMode
  ) {
    this.tokens = new TokenProvider(credentials, mode);
  }

  /** True when the client can reach the signed in user's own data. */
  get isUserScoped(): boolean {
    return this.mode === 'user';
  }

  /**
   * Performs an authenticated GET and returns the parsed JSON body.
   *
   * Anonymous mode targets www.reddit.com and appends the .json suffix Reddit
   * requires there; every other mode targets the OAuth host.
   */
  async get<T>(
    path: string,
    query: Record<string, QueryValue> = {}
  ): Promise<T> {
    const url = buildRedditUrl(this.mode, path, query);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const token = await this.tokens.getToken();
      const headers: Record<string, string> = {
        'User-Agent': this.credentials.userAgent,
        Accept: 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let response: Response;
      try {
        response = await fetch(url, { headers });
      } catch (cause) {
        lastError = new Error(`Network error contacting Reddit: ${cause}`);
        await sleep(BASE_BACKOFF_MS * attempt);
        continue;
      }

      // A stale token survives a restart of Reddit's auth tier; retry once
      // with a freshly minted one before giving up.
      //
      // This is the one failure path that does not back off, deliberately: a
      // 401 says the token is wrong, not that Reddit is overloaded, and the
      // next attempt mints a new one rather than repeating the same request.
      // The attempt counter still bounds it, so a persistent 401 gives up
      // instead of looping.
      if (response.status === 401 && token) {
        this.tokens.invalidate();
        lastError = new Error('Reddit rejected the access token (HTTP 401)');
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : BASE_BACKOFF_MS * attempt * attempt;
        lastError = new Error(`Reddit returned HTTP ${response.status}`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Reddit request failed: HTTP ${response.status} for ${path}`
        );
      }

      return (await response.json()) as T;
    }

    throw lastError ?? new Error(`Reddit request failed for ${path}`);
  }

  /** Fetches one page of a listing endpoint, normalized to things plus cursor. */
  async getListing(
    path: string,
    query: Record<string, QueryValue> = {}
  ): Promise<ListingPage> {
    const listing = await this.get<Listing>(path, query);
    return {
      things: listing.data?.children ?? [],
      after: listing.data?.after ?? null,
    };
  }

  /**
   * Walks a listing across pages until the limit or the page budget is hit.
   *
   * Reddit caps a page at 100 items, so anything asking for more than that,
   * and every full scan of saved history, has to page.
   */
  async collectListing(
    path: string,
    query: Record<string, QueryValue>,
    options: { limit: number; maxPages: number }
  ): Promise<RedditThing[]> {
    const collected: RedditThing[] = [];
    let after: string | null = null;

    for (let page = 0; page < options.maxPages; page++) {
      const remaining = options.limit - collected.length;
      if (remaining <= 0) break;

      const result: ListingPage = await this.getListing(path, {
        ...query,
        limit: Math.min(100, remaining),
        after: after ?? undefined,
      });

      collected.push(...result.things);
      after = result.after;
      if (!after || result.things.length === 0) break;
    }

    return collected.slice(0, options.limit);
  }
}
