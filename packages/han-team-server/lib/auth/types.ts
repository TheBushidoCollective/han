/**
 * Authentication Types
 *
 * Type definitions for JWT authentication and authorization.
 */

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  /** Subject - the user ID */
  sub: string;
  /** User email (optional) */
  email?: string;
  /** Token type: 'access' or 'refresh' */
  type: "access" | "refresh";
  /** Issued at timestamp (seconds) */
  iat: number;
  /** Expiration timestamp (seconds) */
  exp: number;
}

/**
 * Authenticated user context set by middleware
 */
export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Token verification result
 */
export interface VerifyResult {
  payload: TokenPayload;
  userId: string;
  email?: string;
}

/**
 * Error codes for authentication failures
 */
export type AuthErrorCode =
  | "missing_token"
  | "unauthorized"
  | "token_expired"
  | "invalid_token_type";

/**
 * Auth error with standardized code
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * GitHub user profile from API
 */
export interface GitHubUser {
  /** GitHub user ID */
  id: number;
  /** GitHub username */
  login: string;
  /** Display name (may be null) */
  name: string | null;
  /** Email address (may be null if private) */
  email: string | null;
  /** Avatar URL */
  avatar_url: string;
  /** Profile URL */
  html_url: string;
}

/**
 * GitHub OAuth token response
 */
export interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * OAuth state metadata stored in Redis
 */
export interface OAuthState {
  /** CLI callback port (for CLI auth flow) */
  cliPort?: number;
  /** Timestamp when state was created */
  createdAt?: number;
  /** PKCE code verifier (stored server-side for security) */
  codeVerifier?: string;
  /** PKCE code challenge sent to GitHub */
  codeChallenge?: string;
}

/**
 * Short-lived auth code for CLI callback (replaces tokens in URL)
 * This prevents token leakage via URL query parameters
 */
export interface CliAuthCode {
  /** The short-lived authorization code */
  code: string;
  /** Access token to return when code is exchanged */
  accessToken: string;
  /** Refresh token to return when code is exchanged */
  refreshToken: string;
  /** Timestamp when code was created */
  createdAt: number;
}
