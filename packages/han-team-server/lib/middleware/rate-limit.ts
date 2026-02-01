/**
 * Rate Limiting Middleware with Redis Backend
 *
 * Provides distributed rate limiting using Redis for state management.
 * Supports different rate limit tiers based on authentication status and endpoint type.
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import type Redis from "ioredis";
import { getRedisConnection } from "../db/index.ts";

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  /** Maximum requests allowed in the window */
  requests: number;
  /** Window size in seconds */
  window: number;
}

/**
 * Rate limit tiers
 */
export const RATE_LIMITS = {
  /** Default rate limit for unauthenticated requests: 100 req/min per IP */
  default: { requests: 100, window: 60 },
  /** Higher rate limit for authenticated users: 1000 req/min per user */
  authenticated: { requests: 1000, window: 60 },
  /** Strict rate limit for billing endpoints: 10 req/min (prevent checkout spam) */
  billing: { requests: 10, window: 60 },
  /**
   * Very strict rate limit for invite code attempts: 5 req/min
   * SECURITY: Prevents brute force attacks on invite codes
   */
  inviteCode: { requests: 5, window: 60 },
  /** No rate limit for webhook endpoints (Stripe needs reliability) */
  webhook: null as RateLimitTier | null,
} as const;

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Override the rate limit tier to use */
  tier?: keyof typeof RATE_LIMITS | "custom";
  /** Custom rate limit (used when tier is 'custom') */
  custom?: RateLimitTier;
  /** Key prefix for Redis (default: 'rl') */
  keyPrefix?: string;
  /** Skip rate limiting (for webhook endpoints) */
  skip?: boolean;
  /** Custom key generator */
  keyGenerator?: (c: Context) => string;
}

/**
 * Rate limit result from Redis
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

/**
 * In-memory fallback store for when Redis is unavailable
 * SECURITY: Conservative fallback prevents unlimited requests during Redis outage
 */
interface FallbackEntry {
  count: number;
  windowStart: number;
}
const fallbackStore = new Map<string, FallbackEntry>();

/**
 * Conservative in-memory rate limiting fallback
 * Used when Redis is unavailable to prevent unlimited requests
 * Uses a reduced limit (10% of normal) as a safety measure
 */
function inMemoryFallback(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  // Use reduced limit during fallback (10% of normal, minimum 5)
  const fallbackLimit = Math.max(5, Math.floor(limit * 0.1));

  let entry = fallbackStore.get(key);

  // Clean up expired entry or create new one
  if (!entry || now - entry.windowStart >= windowSeconds) {
    entry = { count: 0, windowStart: now };
    fallbackStore.set(key, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= fallbackLimit;
  const remaining = Math.max(0, fallbackLimit - entry.count);
  const reset = entry.windowStart + windowSeconds;

  // Periodic cleanup of old entries (every 100 requests)
  if (fallbackStore.size > 1000 && Math.random() < 0.01) {
    const cutoff = now - windowSeconds;
    for (const [k, v] of fallbackStore.entries()) {
      if (v.windowStart < cutoff) {
        fallbackStore.delete(k);
      }
    }
  }

  return {
    allowed,
    remaining,
    reset,
    limit: fallbackLimit,
    retryAfter: allowed ? undefined : Math.max(1, reset - now),
  };
}

/**
 * Get client IP address from request
 *
 * Respects X-Forwarded-For when TRUST_PROXY is EXPLICITLY enabled.
 * SECURITY: Never auto-trust proxy headers based on NODE_ENV alone -
 * an attacker can spoof X-Forwarded-For to bypass rate limiting.
 */
export function getClientIp(c: Context): string {
  // Only trust proxy headers when EXPLICITLY configured, not based on NODE_ENV
  // This prevents IP spoofing attacks where attacker sets X-Forwarded-For
  const trustProxy = process.env.TRUST_PROXY === "true";

  if (trustProxy) {
    // Trust X-Forwarded-For from reverse proxy
    const forwarded = c.req.header("X-Forwarded-For");
    if (forwarded) {
      // Take first IP (client IP before any proxies)
      return forwarded.split(",")[0].trim();
    }

    // Also check X-Real-IP (common alternative)
    const realIp = c.req.header("X-Real-IP");
    if (realIp) {
      return realIp.trim();
    }
  }

  // Fall back to unknown (Hono doesn't expose raw socket IP)
  return "unknown";
}

/**
 * Generate rate limit key based on authentication status
 *
 * Handles both AuthUser (from auth.ts) and AuthenticatedContext (from decryption-access.ts)
 */
function defaultKeyGenerator(c: Context): string {
  // Try to get auth context - could be either AuthUser or AuthenticatedContext
  const authContext = c.get("auth");

  if (authContext) {
    // AuthUser uses `id`, AuthenticatedContext uses `userId`
    const userId = (authContext as { id?: string; userId?: string }).id ??
                   (authContext as { id?: string; userId?: string }).userId;

    if (userId) {
      return `user:${userId}`;
    }
  }

  // Unauthenticated: rate limit by IP
  const ip = getClientIp(c);
  return `ip:${ip}`;
}

/**
 * Check rate limit using Redis with sliding window algorithm
 */
async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  const windowEnd = now + windowSeconds;

  // Use a sorted set for sliding window rate limiting
  // Score = timestamp, member = unique request ID (timestamp + random)
  const requestId = `${now}:${Math.random().toString(36).substring(2, 15)}`;

  // Lua script for atomic rate limiting operation
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local window = tonumber(ARGV[3])
    local requestId = ARGV[4]
    local windowStart = now - window

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

    -- Get current count
    local count = redis.call('ZCARD', key)

    if count < limit then
      -- Add this request
      redis.call('ZADD', key, now, requestId)
      -- Set expiry on the key
      redis.call('EXPIRE', key, window)
      return {1, limit - count - 1, now + window}
    else
      -- Get oldest entry to calculate retry-after
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local retryAfter = 0
      if #oldest > 0 then
        retryAfter = oldest[2] + window - now
      end
      return {0, 0, now + window, retryAfter}
    end
  `;

  try {
    const result = (await redis.eval(
      luaScript,
      1,
      key,
      limit.toString(),
      now.toString(),
      windowSeconds.toString(),
      requestId
    )) as number[];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      reset: result[2],
      limit,
      retryAfter: result[3] ? Math.max(1, Math.ceil(result[3])) : undefined,
    };
  } catch (error) {
    // SECURITY: Use conservative in-memory fallback instead of allowing everything
    // This prevents unlimited requests during Redis outage
    console.error("Rate limiting Redis error, using in-memory fallback:", error);
    return inMemoryFallback(key, limit, windowSeconds);
  }
}

/**
 * Rate limiting middleware factory
 *
 * Creates a rate limiting middleware that uses Redis for distributed state.
 * Different rate limits are applied based on authentication status:
 * - Unauthenticated: 100 req/min per IP
 * - Authenticated: 1000 req/min per user
 *
 * Special endpoint tiers:
 * - billing: 10 req/min (prevent checkout spam)
 * - webhook: No rate limit (external services need reliability)
 */
export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const {
    tier = "default",
    custom,
    keyPrefix = "rl",
    skip = false,
    keyGenerator = defaultKeyGenerator,
  } = options;

  return async (c: Context, next: Next) => {
    // Skip rate limiting if configured (for webhook endpoints)
    if (skip) {
      await next();
      return;
    }

    // Determine which tier to use
    let rateLimitConfig: RateLimitTier | null;

    if (tier === "custom" && custom) {
      rateLimitConfig = custom;
    } else if (tier === "webhook") {
      // No rate limit for webhooks
      await next();
      return;
    } else {
      // Check if user is authenticated for automatic tier selection
      const authContext = c.get("auth");
      const isAuthenticated = authContext &&
        ((authContext as { id?: string }).id || (authContext as { userId?: string }).userId);

      if (tier === "billing") {
        rateLimitConfig = RATE_LIMITS.billing;
      } else if (isAuthenticated && tier === "default") {
        // Authenticated users get higher limit
        rateLimitConfig = RATE_LIMITS.authenticated;
      } else {
        rateLimitConfig = RATE_LIMITS[tier as keyof typeof RATE_LIMITS] ?? RATE_LIMITS.default;
      }
    }

    // Null config means no rate limit
    if (!rateLimitConfig) {
      await next();
      return;
    }

    const { requests, window } = rateLimitConfig;
    const baseKey = keyGenerator(c);
    const key = `${keyPrefix}:${tier}:${baseKey}`;

    try {
      const redis = await getRedisConnection();
      const result = await checkRateLimit(redis, key, requests, window);

      // Always set rate limit headers
      c.header("X-RateLimit-Limit", String(result.limit));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header("X-RateLimit-Reset", String(result.reset));

      if (!result.allowed) {
        // Request is rate limited
        const retryAfter = result.retryAfter ?? window;
        c.header("Retry-After", String(retryAfter));

        return c.json(
          {
            error: "rate_limit_exceeded",
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter,
          },
          429
        );
      }

      await next();
    } catch (error) {
      // SECURITY: Use conservative in-memory fallback instead of allowing everything
      console.error("Rate limiting error, using in-memory fallback:", error);
      const result = inMemoryFallback(key, requests, window);

      c.header("X-RateLimit-Limit", String(result.limit));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header("X-RateLimit-Reset", String(result.reset));

      if (!result.allowed) {
        const retryAfter = result.retryAfter ?? window;
        c.header("Retry-After", String(retryAfter));

        return c.json(
          {
            error: "rate_limit_exceeded",
            message: `Rate limit exceeded (fallback mode). Try again in ${retryAfter} seconds.`,
            retryAfter,
          },
          429
        );
      }

      await next();
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

/** Default rate limiter (auto-selects tier based on auth) */
export const defaultRateLimit = rateLimit({ tier: "default" });

/** Billing endpoint rate limiter (10 req/min) */
export const billingRateLimit = rateLimit({ tier: "billing" });

/**
 * No rate limiting (for webhook endpoints)
 *
 * SECURITY: Webhook endpoints using this MUST implement webhook signature
 * validation to prevent abuse. Stripe webhooks should verify the
 * `Stripe-Signature` header using the webhook secret. Without signature
 * validation, attackers can flood the endpoint with fake webhook payloads.
 */
export const noRateLimit = rateLimit({ skip: true });

/**
 * Create a custom rate limiter with specific limits
 */
export function customRateLimit(requests: number, windowSeconds: number): MiddlewareHandler {
  return rateLimit({
    tier: "custom",
    custom: { requests, window: windowSeconds },
  });
}

/**
 * Rate limiter specifically for authenticated users
 * Always uses the authenticated tier regardless of auto-detection
 */
export const authenticatedRateLimit = rateLimit({
  tier: "custom",
  custom: RATE_LIMITS.authenticated,
});

/**
 * Invite code rate limiter (5 req/min)
 * SECURITY: Prevents brute force attacks on team invite codes
 */
export const inviteCodeRateLimit = rateLimit({
  tier: "custom",
  custom: RATE_LIMITS.inviteCode,
});

/**
 * In-memory invite attempt tracker with lockout
 * SECURITY: Tracks failed invite code attempts per user for lockout
 */
interface InviteAttempt {
  failures: number;
  lastFailure: number;
  lockedUntil: number | null;
}

const inviteAttemptStore = new Map<string, InviteAttempt>();

/** Lockout duration in milliseconds (5 minutes) */
const INVITE_LOCKOUT_DURATION = 5 * 60 * 1000;
/** Maximum failed attempts before lockout */
const MAX_INVITE_FAILURES = 5;
/** Time window for counting failures (1 minute) */
const INVITE_FAILURE_WINDOW = 60 * 1000;

/**
 * Check if user is locked out from invite attempts
 * SECURITY: Prevents brute force attacks on invite codes
 *
 * @param userId - User ID to check
 * @returns Object with isLocked status and retry info
 */
export function checkInviteLockout(userId: string): {
  isLocked: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const attempt = inviteAttemptStore.get(userId);

  if (!attempt) {
    return { isLocked: false };
  }

  // Check if currently locked out
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    return {
      isLocked: true,
      retryAfter: Math.ceil((attempt.lockedUntil - now) / 1000),
    };
  }

  // Clear lockout if expired
  if (attempt.lockedUntil && now >= attempt.lockedUntil) {
    attempt.lockedUntil = null;
    attempt.failures = 0;
  }

  return { isLocked: false };
}

/**
 * Record a failed invite code attempt
 * SECURITY: Tracks failures to enable lockout after too many attempts
 *
 * @param userId - User ID that made the failed attempt
 * @returns Whether the user is now locked out
 */
export function recordInviteFailure(userId: string): {
  isLocked: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  let attempt = inviteAttemptStore.get(userId);

  if (!attempt) {
    attempt = { failures: 0, lastFailure: now, lockedUntil: null };
    inviteAttemptStore.set(userId, attempt);
  }

  // Reset failure count if outside window
  if (now - attempt.lastFailure > INVITE_FAILURE_WINDOW) {
    attempt.failures = 0;
  }

  attempt.failures++;
  attempt.lastFailure = now;

  // Lock out if too many failures
  if (attempt.failures >= MAX_INVITE_FAILURES) {
    attempt.lockedUntil = now + INVITE_LOCKOUT_DURATION;
    return {
      isLocked: true,
      retryAfter: Math.ceil(INVITE_LOCKOUT_DURATION / 1000),
    };
  }

  return { isLocked: false };
}

/**
 * Clear invite lockout for a user (e.g., on successful join)
 *
 * @param userId - User ID to clear
 */
export function clearInviteLockout(userId: string): void {
  inviteAttemptStore.delete(userId);
}
