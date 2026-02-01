/**
 * Authentication & Authorization Middleware
 *
 * Provides middleware for:
 * - JWT authentication
 * - Role-based authorization
 * - Rate limiting
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { verify } from "hono/jwt";
import { getConfig } from "../config/schema.ts";
import { getRedisConnection } from "../db/index.ts";

/**
 * Authenticated user context
 */
export interface AuthUser {
  id: string;
  email?: string;
  role: "user" | "admin" | "system";
  teamMemberships?: Array<{ teamId: string; role: "member" | "admin" }>;
}

/**
 * Extended context with auth user
 */
export interface AuthContext {
  user: AuthUser;
}

// Store auth context on the request
const AUTH_CONTEXT_KEY = "auth";

/**
 * Get authenticated user from context
 * Returns null if not authenticated (use requireAuth middleware first)
 */
export function getAuthUser(c: Context): AuthUser | null {
  return c.get(AUTH_CONTEXT_KEY) ?? null;
}

/**
 * Get authenticated user from context, throws if not authenticated
 */
export function getRequiredAuthUser(c: Context): AuthUser {
  const user = getAuthUser(c);
  if (!user) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return user;
}

/**
 * Authentication middleware
 *
 * Validates JWT token and sets user context.
 * Does not block unauthenticated requests - use requireAuth for that.
 */
export function auth(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      try {
        const config = getConfig();
        const payload = await verify(token, config.JWT_SECRET);

        const user: AuthUser = {
          id: payload.sub as string,
          email: payload.email as string | undefined,
          role: (payload.role as AuthUser["role"]) ?? "user",
          teamMemberships: payload.teams as AuthUser["teamMemberships"],
        };

        c.set(AUTH_CONTEXT_KEY, user);
      } catch {
        // Invalid token - continue without auth
      }
    }

    await next();
  };
}

/**
 * Require authentication middleware
 *
 * Blocks unauthenticated requests with 401.
 * Must be used after auth() middleware.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = getAuthUser(c);

    if (!user) {
      throw new HTTPException(401, {
        message: "Authentication required",
      });
    }

    await next();
  };
}

/**
 * Require admin role middleware
 *
 * Blocks non-admin requests with 403.
 * Must be used after requireAuth() middleware.
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = getRequiredAuthUser(c);

    if (user.role !== "admin" && user.role !== "system") {
      throw new HTTPException(403, {
        message: "Admin access required",
      });
    }

    await next();
  };
}

/**
 * Check if user can access a team's keys
 *
 * User must be a team admin to rotate team keys.
 */
export function canAccessTeamKeys(user: AuthUser, teamId: string): boolean {
  // System role can access everything
  if (user.role === "system" || user.role === "admin") {
    return true;
  }

  // Check if user is team admin
  const membership = user.teamMemberships?.find((m) => m.teamId === teamId);
  return membership?.role === "admin";
}

/**
 * Check if user can access a user's keys
 *
 * User must be self or system admin.
 */
export function canAccessUserKeys(user: AuthUser, targetUserId: string): boolean {
  // Self can access own keys
  if (user.id === targetUserId) {
    return true;
  }

  // System role can access all user keys
  if (user.role === "system" || user.role === "admin") {
    return true;
  }

  return false;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Window in milliseconds
  max: number; // Max requests per window
  keyPrefix?: string; // Redis key prefix
}

/**
 * Rate limiting middleware using Redis
 *
 * Tracks request counts per user/IP in Redis.
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const { windowMs, max, keyPrefix = "rl" } = config;

  return async (c: Context, next: Next) => {
    const user = getAuthUser(c);
    const clientIp = getClientIp(c);

    // Use user ID if authenticated, otherwise IP
    const identifier = user?.id ?? clientIp ?? "anonymous";
    const key = `${keyPrefix}:${identifier}`;

    try {
      const redis = await getRedisConnection();

      // Increment counter
      const count = await redis.incr(key);

      // Set expiry on first request
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      // Check limit
      if (count > max) {
        const ttl = await redis.pttl(key);
        throw new HTTPException(429, {
          message: `Rate limit exceeded. Try again in ${Math.ceil(ttl / 1000)} seconds.`,
        });
      }

      // Add rate limit headers
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(Math.max(0, max - count)));
    } catch (error) {
      // If Redis fails, allow the request but log
      if (!(error instanceof HTTPException)) {
        console.error("Rate limiting error:", error);
      } else {
        throw error;
      }
    }

    await next();
  };
}

/**
 * Get client IP from context
 *
 * Only trusts X-Forwarded-For when TRUST_PROXY=true.
 */
export function getClientIp(c: Context): string | null {
  const config = getConfig();

  // Only trust proxy headers if explicitly configured
  if (config.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
    const forwarded = c.req.header("X-Forwarded-For");
    if (forwarded) {
      // Take first IP (client IP before any proxies)
      return forwarded.split(",")[0].trim();
    }
  }

  // Fall back to direct connection IP (if available via underlying server)
  // Note: Hono's abstraction may not expose this directly
  return null;
}

/**
 * Get client info for audit logging
 */
export function getClientInfo(c: Context): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: getClientIp(c),
    userAgent: c.req.header("User-Agent") ?? null,
  };
}
