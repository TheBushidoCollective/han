/**
 * Authentication Middleware for Hono
 *
 * Extracts and validates Bearer tokens from Authorization header.
 * Sets authenticated user context for downstream handlers.
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import { getAuthService } from "./auth-service.ts";
import { AuthError, type AuthUser } from "./types.ts";

/** Context key for storing authenticated user */
const USER_CONTEXT_KEY = "user";

/**
 * Standard error response format for authentication errors
 */
export interface AuthErrorResponse {
  error: "missing_token" | "unauthorized" | "token_expired";
  message: string;
}

/**
 * Get authenticated user from Hono context
 *
 * @param c - Hono context
 * @returns AuthUser or null if not authenticated
 */
export function getUser(c: Context): AuthUser | null {
  return c.get(USER_CONTEXT_KEY) ?? null;
}

/**
 * Get authenticated user from Hono context (throws if not set)
 *
 * @param c - Hono context
 * @returns AuthUser
 * @throws Error if user is not authenticated
 */
export function requireUser(c: Context): AuthUser {
  const user = getUser(c);
  if (!user) {
    throw new Error("User not authenticated - use authMiddleware first");
  }
  return user;
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token string or null if not present/invalid format
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Create JSON error response for auth failures
 *
 * @param c - Hono context
 * @param error - Error code
 * @param message - Error message
 * @returns Response
 */
function authErrorResponse(
  c: Context,
  error: AuthErrorResponse["error"],
  message: string
): Response {
  return c.json<AuthErrorResponse>({ error, message }, 401);
}

/**
 * Authentication middleware factory
 *
 * Validates Bearer token and sets `c.set('user', { id, email })` for downstream handlers.
 *
 * Error responses:
 * - Missing token: `{ error: 'missing_token', message: '...' }` with 401
 * - Invalid token: `{ error: 'unauthorized', message: '...' }` with 401
 * - Expired token: `{ error: 'token_expired', message: '...' }` with 401
 *
 * @returns Hono middleware handler
 */
export function authMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);

    // Check for missing token
    if (!token) {
      return authErrorResponse(
        c,
        "missing_token",
        "Authorization header with Bearer token is required"
      );
    }

    try {
      // Get auth service and verify token
      const authService = getAuthService();
      const result = await authService.verifyAccessToken(token);

      // Set user context for downstream handlers
      const user: AuthUser = {
        id: result.userId,
        email: result.email,
      };

      c.set(USER_CONTEXT_KEY, user);

      await next();
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.code) {
          case "token_expired":
            return authErrorResponse(
              c,
              "token_expired",
              "Access token has expired. Please refresh your token."
            );
          case "invalid_token_type":
            return authErrorResponse(
              c,
              "unauthorized",
              "Invalid token type. Access token required."
            );
          case "missing_token":
            return authErrorResponse(
              c,
              "missing_token",
              error.message
            );
          default:
            return authErrorResponse(
              c,
              "unauthorized",
              "Invalid or malformed token"
            );
        }
      }

      // Unknown error - treat as unauthorized
      return authErrorResponse(
        c,
        "unauthorized",
        "Token validation failed"
      );
    }
  };
}

/**
 * Optional authentication middleware
 *
 * Like authMiddleware but allows unauthenticated requests through.
 * Sets user context if valid token present, otherwise continues without user.
 *
 * @returns Hono middleware handler
 */
export function optionalAuthMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);

    if (token) {
      try {
        const authService = getAuthService();
        const result = await authService.verifyAccessToken(token);

        const user: AuthUser = {
          id: result.userId,
          email: result.email,
        };

        c.set(USER_CONTEXT_KEY, user);
      } catch {
        // Token invalid/expired - continue without user context
      }
    }

    await next();
  };
}
