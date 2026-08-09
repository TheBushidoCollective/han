/**
 * Reddit OAuth credential resolution and bearer token management.
 *
 * The server never refuses to start over missing credentials. It resolves the
 * strongest mode the environment supports and degrades to public access, so a
 * user with no Reddit app configured still gets the public tools.
 */

/** The access level the resolved credentials actually buy. */
export type AuthMode = 'user' | 'app' | 'anonymous';

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

/** Refresh this far before real expiry so an in-flight call cannot race it. */
const EXPIRY_SKEW_MS = 60_000;

const DEFAULT_USER_AGENT =
  'mcp-server-reddit/2.0 (+https://github.com/thebushidocollective/han)';

export interface RedditCredentials {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  username?: string;
  password?: string;
  userAgent: string;
}

/** Reads Reddit credentials from the environment, trimming blank values. */
export function readCredentials(
  env: NodeJS.ProcessEnv = process.env
): RedditCredentials {
  const pick = (key: string): string | undefined => {
    const value = env[key]?.trim();
    return value ? value : undefined;
  };

  return {
    clientId: pick('REDDIT_CLIENT_ID'),
    clientSecret: pick('REDDIT_CLIENT_SECRET'),
    refreshToken: pick('REDDIT_REFRESH_TOKEN'),
    username: pick('REDDIT_USERNAME'),
    password: pick('REDDIT_PASSWORD'),
    userAgent: pick('REDDIT_USER_AGENT') ?? DEFAULT_USER_AGENT,
  };
}

/**
 * Reports the access level a credential set buys, without contacting Reddit.
 *
 * A refresh token or a username and password pair reach the signed in user's
 * own data. A client id alone reaches public data at app rate limits. Nothing
 * reaches public data anonymously.
 */
export function resolveMode(credentials: RedditCredentials): AuthMode {
  if (!credentials.clientId) return 'anonymous';
  if (credentials.refreshToken) return 'user';
  if (credentials.username && credentials.password) return 'user';
  return 'app';
}

/** Human readable explanation of why user scoped tools are unavailable. */
export function explainMissingUserAuth(mode: AuthMode): string {
  const setup = [
    'To read your own Reddit data, create a Reddit app at',
    'https://www.reddit.com/prefs/apps (choose "script"), then set:',
    '',
    '  REDDIT_CLIENT_ID       the string under the app name',
    '  REDDIT_CLIENT_SECRET   the "secret" field',
    '',
    'and EITHER a durable refresh token:',
    '',
    '  REDDIT_REFRESH_TOKEN   obtained once via the OAuth code flow',
    '',
    'OR your own script app login:',
    '',
    '  REDDIT_USERNAME',
    '  REDDIT_PASSWORD',
    '',
    'Requested scopes: identity, history, read, mysubreddits, privatemessages.',
  ].join('\n');

  if (mode === 'anonymous') {
    return `This tool needs a signed in Reddit account, and no Reddit credentials are configured.\n\n${setup}`;
  }
  return `This tool needs a signed in Reddit account. The configured credentials only reach public data (application-only auth).\n\n${setup}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Acquires and refreshes the bearer token for the resolved auth mode. */
export class TokenProvider {
  private cached: CachedToken | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly credentials: RedditCredentials,
    private readonly mode: AuthMode,
    private readonly now: () => number = Date.now
  ) {}

  /** Returns a valid bearer token, or null when running anonymously. */
  async getToken(): Promise<string | null> {
    if (this.mode === 'anonymous') return null;

    const cached = this.cached;
    if (cached && cached.expiresAt - EXPIRY_SKEW_MS > this.now()) {
      return cached.token;
    }

    // Collapse concurrent refreshes so a burst of tool calls fetches once.
    if (!this.inFlight) {
      this.inFlight = this.fetchToken().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /** Drops the cached token so the next call re-authenticates. */
  invalidate(): void {
    this.cached = null;
  }

  private buildGrantBody(): URLSearchParams {
    const { refreshToken, username, password } = this.credentials;
    const body = new URLSearchParams();

    if (refreshToken) {
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', refreshToken);
      return body;
    }
    if (username && password) {
      body.set('grant_type', 'password');
      body.set('username', username);
      body.set('password', password);
      return body;
    }
    body.set('grant_type', 'client_credentials');
    return body;
  }

  private async fetchToken(): Promise<string> {
    const { clientId, clientSecret, userAgent } = this.credentials;
    if (!clientId) {
      throw new Error('REDDIT_CLIENT_ID is required for authenticated access');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret ?? ''}`).toString(
      'base64'
    );

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: this.buildGrantBody().toString(),
    });

    if (!response.ok) {
      // Never echo the response body: it can contain the submitted grant.
      throw new Error(
        `Reddit token request failed with HTTP ${response.status}. ` +
          'Check REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and the grant ' +
          'credentials (refresh token, or username and password).'
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (payload.error || !payload.access_token) {
      throw new Error(
        `Reddit refused the credentials: ${payload.error ?? 'no access_token returned'}`
      );
    }

    const lifetimeMs = (payload.expires_in ?? 3600) * 1000;
    this.cached = {
      token: payload.access_token,
      expiresAt: this.now() + lifetimeMs,
    };
    return payload.access_token;
  }
}
