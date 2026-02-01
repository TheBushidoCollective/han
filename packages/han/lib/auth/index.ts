/**
 * Authentication Module
 *
 * Provides multi-provider OAuth (GitHub, GitLab), magic link email auth,
 * JWT-based API authentication, and session management.
 *
 * @module auth
 */

// Types
export type {
	AuthConfig,
	AuthContext,
	AuthResult,
	AuthUser,
	DeviceInfo,
	LinkResult,
	MagicLinkResult,
	MagicLinkToken,
	OAuthCallbackResult,
	OAuthConnection,
	OAuthInitiateResult,
	OAuthProvider,
	TokenPair,
	UserSession,
	AccessTokenPayload,
	RefreshTokenPayload,
	JWTPayload,
	AuthRateLimit,
} from "./types.ts";

export { getAuthConfig } from "./types.ts";

// JWT utilities
export {
	createAccessToken,
	createRefreshToken,
	createTokenPair,
	verifyAccessToken,
	verifyRefreshToken,
	decodeTokenUnsafe,
	getTokenHash,
	extractSessionId,
	isTokenExpired,
	generateJWTSecret,
} from "./jwt.ts";

// Encryption utilities
export {
	encrypt,
	decrypt,
	generateEncryptionKey,
	hashSHA256,
	generateSecureToken,
} from "./encryption.ts";

// OAuth providers
export {
	initiateOAuth,
	completeOAuth,
	refreshOAuthToken,
	revokeOAuthToken,
	validateOAuthToken,
	getProviderDisplayName,
	isProviderConfigured,
	getConfiguredProviders,
	// PKCE utilities
	generateCodeVerifier,
	generateCodeChallenge,
	generateState,
	generatePKCEParams,
	verifyCodeChallenge,
	// Provider-specific exports
	initiateGitHubOAuth,
	completeGitHubOAuth,
	refreshGitHubToken,
	revokeGitHubToken,
	validateGitHubToken,
	initiateGitLabOAuth,
	completeGitLabOAuth,
	refreshGitLabToken,
	revokeGitLabToken,
	validateGitLabToken,
} from "./oauth/index.ts";

// Magic link
export {
	generateMagicLinkToken,
	verifyMagicLinkToken,
	consumeMagicLinkToken,
	requestMagicLink,
	cleanupExpiredTokens,
	getTokenStoreSize,
	getEmailProvider,
	ConsoleEmailProvider,
	ResendEmailProvider,
} from "./magic-link.ts";

export type { EmailProvider } from "./magic-link.ts";

// Session management
export {
	createSession,
	getSession,
	getSessionByTokenHash,
	getUserSessions,
	isSessionValid,
	refreshSession,
	revokeSession,
	revokeAllUserSessions,
	revokeOtherUserSessions,
	cleanupSessions,
	getSessionStats,
	parseDeviceInfo,
} from "./session-manager.ts";

// Rate limiting
export {
	checkRateLimit,
	recordAttempt,
	resetRateLimit,
	clearBlock,
	cleanupRateLimits,
	getRateLimitStats,
	createRateLimiter,
	getClientIP,
	RATE_LIMIT_CONFIGS,
	RATE_LIMIT_KEYS,
} from "./rate-limiter.ts";

export type { RateLimitConfig } from "./rate-limiter.ts";

// Middleware
export {
	extractBearerToken,
	createAuthContext,
	createContextFactory,
	isAuthenticated,
	requireAuth,
	checkMutationRateLimit,
	getUser,
	upsertUser,
	getUserByEmail,
	createUser,
	updateUser,
	getUserStats,
} from "./middleware.ts";
