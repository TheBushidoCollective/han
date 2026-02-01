/**
 * GitHub OAuth Authentication Handler
 *
 * Handles the complete OAuth flow for GitHub authentication:
 * 1. Redirect to GitHub authorize URL
 * 2. Exchange authorization code for access token
 * 3. Fetch user profile from GitHub API
 * 4. Create or update user record
 * 5. Generate JWT tokens
 */

import type { Context } from "hono";
import { getConfig, isGitHubOAuthEnabled } from "../config/schema.ts";
import { getAuthService } from "./auth-service.ts";
import { createOrUpdateUser, getUserByGitHubId } from "./user-repository.ts";
import { getRedisConnection } from "../db/index.ts";
import type { GitHubUser, OAuthTokenResponse, OAuthState, CliAuthCode } from "./types.ts";

/** GitHub OAuth authorize URL */
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

/** GitHub OAuth token URL */
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

/** GitHub API user endpoint */
const GITHUB_USER_URL = "https://api.github.com/user";

/** GitHub API user emails endpoint */
const GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails";

/** OAuth state TTL in seconds (10 minutes) */
const STATE_TTL_SECONDS = 600;

/** OAuth state prefix for Redis */
const STATE_PREFIX = "oauth_state:";

/** CLI auth code prefix for Redis */
const CLI_CODE_PREFIX = "cli_auth_code:";

/** CLI auth code TTL in seconds (30 seconds - very short-lived) */
const CLI_CODE_TTL_SECONDS = 30;

/**
 * Generate a cryptographically secure state parameter
 */
export function generateState(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a cryptographically random code verifier for PKCE
 * Length: 43-128 characters (we use 64 for a good balance)
 *
 * @returns URL-safe base64 encoded verifier
 */
export function generateCodeVerifier(): string {
  const buffer = new Uint8Array(48); // 48 bytes = 64 base64 characters
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate the code challenge from a code verifier using S256 method
 * Uses S256 method: BASE64URL(SHA256(code_verifier))
 *
 * @param verifier - The code verifier string
 * @returns URL-safe base64 encoded challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Store OAuth state in Redis for CSRF protection
 *
 * @param state - The state parameter to store
 * @param metadata - Optional metadata to associate with state (e.g., CLI port)
 */
export async function storeState(
  state: string,
  metadata: OAuthState = {}
): Promise<void> {
  const redis = await getRedisConnection();
  const value = JSON.stringify({
    createdAt: Date.now(),
    ...metadata,
  });
  await redis.setex(`${STATE_PREFIX}${state}`, STATE_TTL_SECONDS, value);
}

/**
 * Validate and consume OAuth state from Redis
 *
 * @param state - The state parameter to validate
 * @returns State metadata if valid, null if invalid or expired
 */
export async function consumeState(state: string): Promise<OAuthState | null> {
  if (!state || typeof state !== "string") {
    return null;
  }

  const redis = await getRedisConnection();
  const key = `${STATE_PREFIX}${state}`;
  const value = await redis.get(key);

  if (!value) {
    return null;
  }

  // Delete the state to prevent reuse (consume it)
  await redis.del(key);

  try {
    return JSON.parse(value) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Build the GitHub OAuth authorize URL with PKCE support
 *
 * @param state - CSRF protection state parameter
 * @param codeChallenge - PKCE code challenge (S256)
 * @param scopes - OAuth scopes to request
 * @returns Full GitHub authorize URL
 */
export function buildAuthorizeUrl(
  state: string,
  codeChallenge?: string,
  scopes: string[] = ["read:user", "user:email"]
): string {
  const config = getConfig();

  if (!config.GITHUB_CLIENT_ID) {
    throw new Error("GitHub OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    scope: scopes.join(" "),
    state,
    // We don't set redirect_uri to let GitHub use the registered callback URL
  });

  // Add PKCE parameters if provided
  // Note: GitHub supports PKCE as of 2021, using S256 method
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for GitHub access token
 *
 * @param code - Authorization code from GitHub callback
 * @param codeVerifier - PKCE code verifier (if PKCE was used in authorization)
 * @returns OAuth token response or null on failure
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier?: string
): Promise<OAuthTokenResponse | null> {
  const config = getConfig();

  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    throw new Error("GitHub OAuth is not configured");
  }

  try {
    const body: Record<string, string> = {
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
    };

    // Include PKCE code_verifier if provided
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        `GitHub token exchange failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as OAuthTokenResponse;

    if (data.error) {
      console.error(`GitHub OAuth error: ${data.error} - ${data.error_description}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error("GitHub token exchange error:", error);
    return null;
  }
}

/**
 * Fetch user profile from GitHub API
 *
 * @param accessToken - GitHub access token
 * @returns GitHub user profile or null on failure
 */
export async function fetchGitHubUser(
  accessToken: string
): Promise<GitHubUser | null> {
  try {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(
        `GitHub user fetch failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const user = (await response.json()) as GitHubUser;

    // If user's email is not public, fetch from emails endpoint
    if (!user.email) {
      const email = await fetchPrimaryEmail(accessToken);
      if (email) {
        user.email = email;
      }
    }

    return user;
  } catch (error) {
    console.error("GitHub user fetch error:", error);
    return null;
  }
}

/**
 * Fetch primary email from GitHub API (for users with private emails)
 *
 * @param accessToken - GitHub access token
 * @returns Primary email address or null
 */
async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_USER_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return null;
    }

    const emails = (await response.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    // Find primary verified email
    const primaryEmail = emails.find((e) => e.primary && e.verified);
    if (primaryEmail) {
      return primaryEmail.email;
    }

    // Fall back to any verified email
    const verifiedEmail = emails.find((e) => e.verified);
    return verifiedEmail?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Handle GET /auth/github
 *
 * Initiates OAuth flow by redirecting to GitHub authorize URL.
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security.
 */
export async function handleGitHubAuth(c: Context): Promise<Response> {
  if (!isGitHubOAuthEnabled()) {
    return c.json(
      {
        error: "oauth_not_configured",
        message: "GitHub OAuth is not configured on this server",
      },
      503
    );
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = generateState();
  // Store code verifier with state for later verification
  await storeState(state, { codeVerifier, codeChallenge });

  const authorizeUrl = buildAuthorizeUrl(state, codeChallenge);
  return c.redirect(authorizeUrl);
}

/**
 * Generate a short-lived CLI auth code and store it in Redis
 *
 * This implements the POST-redirect pattern to avoid token leakage via URL.
 * The CLI receives a short-lived code which it exchanges via POST for tokens.
 *
 * @param accessToken - The access token to store
 * @param refreshToken - The refresh token to store
 * @returns The short-lived auth code
 */
export async function storeCliAuthCode(
  accessToken: string,
  refreshToken: string
): Promise<string> {
  const code = generateState(); // Reuse secure random generation
  const redis = await getRedisConnection();

  const value = JSON.stringify({
    accessToken,
    refreshToken,
    createdAt: Date.now(),
  } as CliAuthCode);

  await redis.setex(`${CLI_CODE_PREFIX}${code}`, CLI_CODE_TTL_SECONDS, value);
  return code;
}

/**
 * Exchange a CLI auth code for tokens
 *
 * This is called by the CLI via POST to get the actual tokens.
 * The code is consumed (single-use) to prevent replay attacks.
 *
 * @param code - The auth code from the callback redirect
 * @returns The tokens if valid, null if invalid/expired/consumed
 */
export async function exchangeCliAuthCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!code || typeof code !== "string") {
    return null;
  }

  const redis = await getRedisConnection();
  const key = `${CLI_CODE_PREFIX}${code}`;
  const value = await redis.get(key);

  if (!value) {
    return null;
  }

  // Delete immediately to prevent reuse (consume it)
  await redis.del(key);

  try {
    const data = JSON.parse(value) as CliAuthCode;
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch {
    return null;
  }
}

/**
 * Handle GET /auth/github/callback
 *
 * Handles OAuth callback from GitHub:
 * 1. Validates state parameter
 * 2. Exchanges code for access token (with PKCE verification)
 * 3. Fetches user profile
 * 4. Creates/updates user record
 * 5. Returns JWT tokens (or auth code for CLI flow)
 */
export async function handleGitHubCallback(c: Context): Promise<Response> {
  // Check for OAuth errors from GitHub
  const error = c.req.query("error");
  if (error) {
    const errorDescription = c.req.query("error_description") || "Unknown error";
    return c.json(
      {
        error: "oauth_error",
        message: `GitHub OAuth error: ${errorDescription}`,
        github_error: error,
      },
      400
    );
  }

  const code = c.req.query("code");
  const state = c.req.query("state");

  // Validate required parameters
  if (!code || !state) {
    return c.json(
      {
        error: "invalid_request",
        message: "Missing required parameters: code and state",
      },
      400
    );
  }

  // Validate state parameter (CSRF protection)
  const stateData = await consumeState(state);
  if (!stateData) {
    return c.json(
      {
        error: "invalid_state",
        message: "Invalid or expired state parameter. Please try logging in again.",
      },
      400
    );
  }

  // Exchange code for access token (with PKCE code_verifier if available)
  const tokenResponse = await exchangeCodeForToken(code, stateData.codeVerifier);
  if (!tokenResponse || !tokenResponse.access_token) {
    return c.json(
      {
        error: "token_exchange_failed",
        message: "Failed to exchange authorization code for access token",
      },
      500
    );
  }

  // Fetch GitHub user profile
  const githubUser = await fetchGitHubUser(tokenResponse.access_token);
  if (!githubUser) {
    return c.json(
      {
        error: "user_fetch_failed",
        message: "Failed to fetch user profile from GitHub",
      },
      500
    );
  }

  // Validate we have required user info
  if (!githubUser.id) {
    return c.json(
      {
        error: "invalid_user",
        message: "GitHub user profile is missing required fields",
      },
      500
    );
  }

  // Create or update user record
  const user = await createOrUpdateUser({
    githubId: String(githubUser.id),
    githubUsername: githubUser.login,
    email: githubUser.email || `${githubUser.id}+${githubUser.login}@users.noreply.github.com`,
    name: githubUser.name || githubUser.login,
    avatarUrl: githubUser.avatar_url,
  });

  if (!user) {
    return c.json(
      {
        error: "user_creation_failed",
        message: "Failed to create or update user record",
      },
      500
    );
  }

  // Generate JWT tokens
  const authService = getAuthService();
  const accessToken = await authService.signAccessToken(user.id, user.email);
  const refreshToken = await authService.signRefreshToken(user.id);

  // Check if this is a CLI auth flow (has redirect port)
  const cliPort = stateData.cliPort;
  if (cliPort) {
    // SECURITY FIX: Use short-lived auth code instead of tokens in URL
    // This prevents token leakage via URL query parameters (browser history, logs, referrer)
    // The CLI exchanges the code via POST to /auth/cli/exchange to get actual tokens
    const authCode = await storeCliAuthCode(accessToken, refreshToken);
    const redirectUrl = new URL(`http://localhost:${cliPort}/callback`);
    redirectUrl.searchParams.set("code", authCode);
    return c.redirect(redirectUrl.toString());
  }

  // Standard web response
  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400, // 24 hours
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      github_username: user.githubUsername,
      avatar_url: user.avatarUrl,
    },
  });
}

/**
 * Handle POST /auth/cli/exchange
 *
 * Exchanges a short-lived CLI auth code for tokens.
 * This completes the secure CLI authentication flow.
 */
export async function handleCliExchange(c: Context): Promise<Response> {
  let body: { code?: string };

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: "validation_error",
        message: "Invalid JSON body",
      },
      400
    );
  }

  const { code } = body;

  if (!code || typeof code !== "string") {
    return c.json(
      {
        error: "missing_code",
        message: "Authorization code is required",
      },
      400
    );
  }

  const tokens = await exchangeCliAuthCode(code);

  if (!tokens) {
    return c.json(
      {
        error: "invalid_code",
        message: "Invalid, expired, or already-used authorization code",
      },
      401
    );
  }

  return c.json({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "Bearer",
    expires_in: 86400, // 24 hours
  });
}
