/**
 * Authentication Module
 *
 * Exports all authentication-related functionality:
 * - AuthService for JWT token operations
 * - Middleware for protecting routes
 * - Types for auth context
 * - GitHub OAuth flow
 * - CLI authentication
 * - User repository
 */

export { AuthService, getAuthService, initAuthService, resetAuthService } from "./auth-service.ts";
export { authMiddleware, optionalAuthMiddleware, getUser, requireUser } from "./auth-middleware.ts";
export type { AuthErrorResponse } from "./auth-middleware.ts";
export { AuthError } from "./types.ts";
export type {
  TokenPayload,
  AuthUser,
  VerifyResult,
  AuthErrorCode,
  GitHubUser,
  OAuthTokenResponse,
  OAuthState,
  CliAuthCode,
} from "./types.ts";

// GitHub OAuth
export {
  handleGitHubAuth,
  handleGitHubCallback,
  handleCliExchange,
  generateState,
  storeState,
  consumeState,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  generateCodeVerifier,
  generateCodeChallenge,
  storeCliAuthCode,
  exchangeCliAuthCode,
} from "./github-oauth.ts";

// CLI Auth
export { handleCliAuth, validatePort } from "./cli-auth.ts";
export type { CliTokenResponse, CliAuthErrorResponse } from "./cli-auth.ts";

// User Repository
export {
  createOrUpdateUser,
  getUserByGitHubId,
  getUserById,
  getUserByEmail,
  updateStripeCustomerId,
} from "./user-repository.ts";
export type { GitHubUserInput, User } from "./user-repository.ts";
