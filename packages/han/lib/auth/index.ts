/**
 * Authentication Module
 *
 * Provides multi-provider OAuth (GitHub, GitLab), magic link email auth,
 * JWT-based API authentication, and session management.
 *
 * @module auth
 */

// Encryption utilities
export {
  decrypt,
  encrypt,
  generateEncryptionKey,
  generateSecureToken,
  hashSHA256,
} from './encryption.ts';
// JWT utilities
export {
  createAccessToken,
  createRefreshToken,
  createTokenPair,
  decodeTokenUnsafe,
  extractSessionId,
  generateJWTSecret,
  getTokenHash,
  isTokenExpired,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.ts';
export type { EmailProvider } from './magic-link.ts';
// Magic link
export {
  ConsoleEmailProvider,
  cleanupExpiredTokens,
  consumeMagicLinkToken,
  generateMagicLinkToken,
  getEmailProvider,
  getTokenStoreSize,
  ResendEmailProvider,
  requestMagicLink,
  verifyMagicLinkToken,
} from './magic-link.ts';
// Middleware
export {
  checkMutationRateLimit,
  createAuthContext,
  createContextFactory,
  createUser,
  extractBearerToken,
  getUser,
  getUserByEmail,
  getUserStats,
  isAuthenticated,
  requireAuth,
  updateUser,
  upsertUser,
} from './middleware.ts';
// OAuth providers
export {
  completeGitHubOAuth,
  completeGitLabOAuth,
  completeOAuth,
  generateCodeChallenge,
  // PKCE utilities
  generateCodeVerifier,
  generatePKCEParams,
  generateState,
  getConfiguredProviders,
  getProviderDisplayName,
  // Provider-specific exports
  initiateGitHubOAuth,
  initiateGitLabOAuth,
  initiateOAuth,
  isProviderConfigured,
  refreshGitHubToken,
  refreshGitLabToken,
  refreshOAuthToken,
  revokeGitHubToken,
  revokeGitLabToken,
  revokeOAuthToken,
  validateGitHubToken,
  validateGitLabToken,
  validateOAuthToken,
  verifyCodeChallenge,
} from './oauth/index.ts';
export type { RateLimitConfig } from './rate-limiter.ts';
// Rate limiting
export {
  checkRateLimit,
  cleanupRateLimits,
  clearBlock,
  createRateLimiter,
  getClientIP,
  getRateLimitStats,
  RATE_LIMIT_CONFIGS,
  RATE_LIMIT_KEYS,
  recordAttempt,
  resetRateLimit,
} from './rate-limiter.ts';
// Session management
export {
  cleanupSessions,
  createSession,
  getSession,
  getSessionByTokenHash,
  getSessionStats,
  getUserSessions,
  isSessionValid,
  parseDeviceInfo,
  refreshSession,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeSession,
} from './session-manager.ts';
// Types
export type {
  AccessTokenPayload,
  AuthConfig,
  AuthContext,
  AuthRateLimit,
  AuthResult,
  AuthUser,
  DeviceInfo,
  JWTPayload,
  LinkResult,
  MagicLinkResult,
  MagicLinkToken,
  OAuthCallbackResult,
  OAuthConnection,
  OAuthInitiateResult,
  OAuthProvider,
  RefreshTokenPayload,
  TokenPair,
  UserSession,
} from './types.ts';
export { getAuthConfig } from './types.ts';
