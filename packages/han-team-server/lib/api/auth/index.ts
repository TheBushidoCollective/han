/**
 * Authentication API Routes
 *
 * Provides token refresh endpoint and other auth-related routes.
 */

import type { Context, Hono } from "hono";
import { getAuthService, AuthError } from "../../auth/index.ts";
import { authRateLimit } from "../middleware/index.ts";

/**
 * Request body for token refresh
 */
interface RefreshTokenRequest {
  refresh_token: string;
}

/**
 * Response for successful token refresh
 */
interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

/**
 * Error response for auth endpoints
 */
interface AuthErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/v1/auth/refresh
 *
 * Exchange a refresh token for a new access token.
 *
 * Request body:
 * ```json
 * { "refresh_token": "eyJ..." }
 * ```
 *
 * Success response (200):
 * ```json
 * {
 *   "access_token": "eyJ...",
 *   "token_type": "Bearer",
 *   "expires_in": 86400
 * }
 * ```
 *
 * Error responses (401):
 * - Missing refresh token: `{ error: 'missing_token', message: '...' }`
 * - Invalid token: `{ error: 'unauthorized', message: '...' }`
 * - Expired token: `{ error: 'token_expired', message: '...' }`
 */
async function refreshTokenHandler(c: Context): Promise<Response> {
  let body: RefreshTokenRequest;

  try {
    body = await c.req.json<RefreshTokenRequest>();
  } catch {
    return c.json<AuthErrorResponse>(
      {
        error: "validation_error",
        message: "Invalid JSON body",
      },
      400
    );
  }

  const refreshToken = body?.refresh_token;

  if (!refreshToken || typeof refreshToken !== "string") {
    return c.json<AuthErrorResponse>(
      {
        error: "missing_token",
        message: "refresh_token is required in request body",
      },
      401
    );
  }

  try {
    const authService = getAuthService();

    // Verify the refresh token
    const result = await authService.verifyRefreshToken(refreshToken);

    // Issue a new access token
    const accessToken = await authService.signAccessToken(
      result.userId,
      result.email
    );

    // Issue a new refresh token (token rotation for security)
    // TODO: HIGH-3 - Implement refresh token revocation with database storage
    // to prevent reuse of old refresh tokens. For MVP, we rotate tokens
    // but don't track/revoke old ones. Production should store issued
    // refresh tokens and invalidate them on rotation.
    const newRefreshToken = await authService.signRefreshToken(result.userId);

    const response: RefreshTokenResponse = {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: "Bearer",
      expires_in: 86400, // 24 hours in seconds
    };

    return c.json(response, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case "token_expired":
          return c.json<AuthErrorResponse>(
            {
              error: "token_expired",
              message: "Refresh token has expired. Please log in again.",
            },
            401
          );
        case "invalid_token_type":
          return c.json<AuthErrorResponse>(
            {
              error: "unauthorized",
              message: "Invalid token type. Refresh token required.",
            },
            401
          );
        default:
          return c.json<AuthErrorResponse>(
            {
              error: "unauthorized",
              message: "Invalid or malformed refresh token",
            },
            401
          );
      }
    }

    // Unknown error
    return c.json<AuthErrorResponse>(
      {
        error: "unauthorized",
        message: "Token validation failed",
      },
      401
    );
  }
}

/**
 * Register authentication routes with Hono app
 *
 * Routes:
 * - POST /api/v1/auth/refresh - Exchange refresh token for access token
 */
export function registerAuthRoutes(app: Hono): void {
  // Apply rate limiting to prevent brute-force attacks
  app.post("/api/v1/auth/refresh", authRateLimit, refreshTokenHandler);
}
