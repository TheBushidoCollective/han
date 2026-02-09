/**
 * Authentication Types
 *
 * Core type definitions for the authentication system.
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'github' | 'gitlab';

/**
 * Authenticated user from the database
 */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth connection linking a user to an OAuth provider
 */
export interface OAuthConnection {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  providerEmail: string | null;
  providerUsername: string | null;
  /** Encrypted access token (AES-256-GCM) */
  accessTokenEncrypted: Buffer;
  /** Encrypted refresh token (AES-256-GCM) */
  refreshTokenEncrypted: Buffer | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User session for JWT tracking and revocation
 */
export interface UserSession {
  id: string;
  userId: string;
  /** SHA-256 hash of the JWT for revocation lookup */
  tokenHash: string;
  deviceInfo: Record<string, unknown> | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Magic link token for email authentication
 */
export interface MagicLinkToken {
  id: string;
  email: string;
  /** SHA-256 hash of the token */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/**
 * Rate limit entry for tracking auth attempts
 */
export interface AuthRateLimit {
  key: string;
  attempts: number;
  blockedUntil: Date | null;
  updatedAt: Date;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** JWT ID (unique identifier for revocation) */
  jti: string;
  /** Issuer */
  iss: string;
  /** Session ID for tracking */
  sid: string;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload extends JWTPayload {
  /** Token type identifier */
  type: 'refresh';
}

/**
 * Access token payload
 */
export interface AccessTokenPayload extends JWTPayload {
  /** Token type identifier */
  type: 'access';
  /** User email (cached for convenience) */
  email?: string;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * OAuth initiation result with PKCE challenge
 */
export interface OAuthInitiateResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

/**
 * OAuth callback result after token exchange
 */
export interface OAuthCallbackResult {
  provider: OAuthProvider;
  providerUserId: string;
  providerEmail: string | null;
  providerUsername: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
}

/**
 * Authentication result returned to client
 */
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  tokens?: TokenPair;
  error?: string;
}

/**
 * Magic link request result
 */
export interface MagicLinkResult {
  success: boolean;
  message: string;
}

/**
 * Account linking result
 */
export interface LinkResult {
  success: boolean;
  connection?: OAuthConnection;
  error?: string;
}

/**
 * Device info extracted from request
 */
export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
  isMobile?: boolean;
}

/**
 * Auth context for GraphQL resolvers
 */
export interface AuthContext {
  user: AuthUser | null;
  session: UserSession | null;
}

/**
 * Configuration for auth module
 */
export interface AuthConfig {
  /** JWT signing secret (32+ bytes) */
  jwtSecret: string;
  /** JWT issuer (e.g., https://han.guru) */
  jwtIssuer: string;
  /** AES-256 encryption key for token storage */
  encryptionKey: string;
  /** Access token expiry in seconds (default: 3600 = 1 hour) */
  accessTokenExpiry?: number;
  /** Refresh token expiry in seconds (default: 604800 = 7 days) */
  refreshTokenExpiry?: number;
  /** GitHub OAuth client ID */
  githubClientId?: string;
  /** GitHub OAuth client secret */
  githubClientSecret?: string;
  /** GitLab OAuth client ID */
  gitlabClientId?: string;
  /** GitLab OAuth client secret */
  gitlabClientSecret?: string;
  /** GitLab instance URL (default: https://gitlab.com) */
  gitlabInstanceUrl?: string;
  /** OAuth callback URL base (e.g., https://api.han.guru) */
  oauthCallbackUrl: string;
}

/**
 * Get auth configuration from environment variables
 */
export function getAuthConfig(): AuthConfig {
  const jwtSecret = process.env.AUTH_JWT_SECRET;
  const encryptionKey = process.env.AUTH_ENCRYPTION_KEY;
  const oauthCallbackUrl = process.env.AUTH_OAUTH_CALLBACK_URL;

  if (!jwtSecret) {
    throw new Error('AUTH_JWT_SECRET environment variable is required');
  }
  if (!encryptionKey) {
    throw new Error('AUTH_ENCRYPTION_KEY environment variable is required');
  }
  if (!oauthCallbackUrl) {
    throw new Error('AUTH_OAUTH_CALLBACK_URL environment variable is required');
  }

  return {
    jwtSecret,
    jwtIssuer: process.env.AUTH_JWT_ISSUER || 'https://han.guru',
    encryptionKey,
    accessTokenExpiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY
      ? Number.parseInt(process.env.AUTH_ACCESS_TOKEN_EXPIRY, 10)
      : 3600,
    refreshTokenExpiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY
      ? Number.parseInt(process.env.AUTH_REFRESH_TOKEN_EXPIRY, 10)
      : 604800,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    gitlabClientId: process.env.GITLAB_CLIENT_ID,
    gitlabClientSecret: process.env.GITLAB_CLIENT_SECRET,
    gitlabInstanceUrl: process.env.GITLAB_INSTANCE_URL || 'https://gitlab.com',
    oauthCallbackUrl,
  };
}
