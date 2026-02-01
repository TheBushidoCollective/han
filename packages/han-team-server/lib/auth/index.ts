/**
 * Authentication Module
 *
 * Exports all authentication-related functionality:
 * - AuthService for JWT token operations
 * - Middleware for protecting routes
 * - Types for auth context
 */

export { AuthService, getAuthService, initAuthService, resetAuthService } from "./auth-service.ts";
export { authMiddleware, optionalAuthMiddleware, getUser, requireUser } from "./auth-middleware.ts";
export type { AuthErrorResponse } from "./auth-middleware.ts";
export { AuthError } from "./types.ts";
export type { TokenPayload, AuthUser, VerifyResult, AuthErrorCode } from "./types.ts";
