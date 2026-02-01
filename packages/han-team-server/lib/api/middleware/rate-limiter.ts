/**
 * Rate Limiter Middleware for Han Team Platform
 *
 * Simple token bucket rate limiter to protect CPU-intensive endpoints
 * like encryption/decryption operations.
 *
 * TODO(security): This in-memory rate limiter has potential race conditions
 * between the token check and decrement operations. Under high concurrency,
 * more requests than the limit may be allowed. For production-critical
 * endpoints, consider:
 * 1. Using Redis-based rate limiting from middleware/rate-limit.ts
 * 2. Implementing atomic check-and-decrement using Atomics or mutex
 * 3. Using a proper rate limiting library with atomic operations
 */

import type { Context, Next } from "hono";

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key generator function (default: uses auth userId) */
  keyGenerator?: (c: Context) => string;
  /** Message to return when rate limited */
  message?: string;
}

/**
 * Token bucket entry
 */
interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory token bucket store
 * Key -> BucketEntry
 */
const buckets = new Map<string, BucketEntry>();

/**
 * Cleanup old buckets periodically (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldBuckets(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const cutoff = now - windowMs * 2;

  for (const [key, entry] of buckets.entries()) {
    if (entry.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}

/**
 * Get or create a token bucket for a key
 */
function getOrCreateBucket(key: string, maxTokens: number): BucketEntry {
  const existing = buckets.get(key);
  if (existing) return existing;

  const entry: BucketEntry = {
    tokens: maxTokens,
    lastRefill: Date.now(),
  };
  buckets.set(key, entry);
  return entry;
}

/**
 * Refill tokens based on time elapsed
 */
function refillBucket(
  entry: BucketEntry,
  maxTokens: number,
  windowMs: number
): void {
  const now = Date.now();
  const elapsed = now - entry.lastRefill;

  // Calculate tokens to add based on time elapsed
  const tokensToAdd = Math.floor((elapsed / windowMs) * maxTokens);

  if (tokensToAdd > 0) {
    entry.tokens = Math.min(maxTokens, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
  }
}

/**
 * Create a rate limiter middleware
 *
 * @param config - Rate limit configuration
 * @returns Hono middleware function
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    message = "Too many requests, please try again later",
  } = config;

  // Create unique namespace for this rate limiter to avoid bucket collision
  // Different endpoints with different limits need separate buckets
  const namespace = `${maxRequests}:${windowMs}`;

  return async (c: Context, next: Next): Promise<Response | void> => {
    // Cleanup old buckets periodically
    cleanupOldBuckets(windowMs);

    // Generate rate limit key with namespace
    const baseKey = keyGenerator(c);
    const key = `${namespace}:${baseKey}`;

    // Get or create bucket
    const bucket = getOrCreateBucket(key, maxRequests);

    // Refill tokens
    refillBucket(bucket, maxRequests, windowMs);

    // Check if we have tokens available
    if (bucket.tokens <= 0) {
      // Calculate retry-after in seconds
      const retryAfter = Math.ceil(windowMs / 1000);

      return c.json(
        {
          error: "rate_limited",
          message,
          retryAfter,
        },
        429,
        {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(
            Math.ceil((bucket.lastRefill + windowMs) / 1000)
          ),
        }
      );
    }

    // Consume a token
    bucket.tokens -= 1;

    // Add rate limit headers to response
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, bucket.tokens)));
    c.header(
      "X-RateLimit-Reset",
      String(Math.ceil((bucket.lastRefill + windowMs) / 1000))
    );

    await next();
  };
}

/**
 * Default key generator - uses authenticated user ID or IP
 */
function defaultKeyGenerator(c: Context): string {
  const auth = c.get("auth");
  if (auth?.userId) {
    return `user:${auth.userId}`;
  }

  // Fall back to IP (though this should rarely happen since routes require auth)
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    "unknown";
  return `ip:${ip}`;
}

/**
 * Pre-configured rate limiters for common scenarios
 */

/**
 * Standard API rate limiter
 * 100 requests per minute per user
 */
export const standardRateLimit = rateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Strict rate limiter for CPU-intensive operations
 * 10 requests per minute per user (e.g., encryption, export)
 */
export const strictRateLimit = rateLimit({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  message: "Too many encryption operations, please wait before trying again",
});

/**
 * Export rate limiter
 * 5 exports per 10 minutes per user
 */
export const exportRateLimit = rateLimit({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000, // 10 minutes
  message: "Export rate limit exceeded, please wait before exporting again",
});

/**
 * Sync rate limiter
 * 30 syncs per minute per user
 */
export const syncRateLimit = rateLimit({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  message: "Sync rate limit exceeded, please slow down sync operations",
});

/**
 * Auth rate limiter for token refresh
 * 5 requests per minute per IP to prevent brute-force attacks
 * Uses IP-based limiting since refresh requests may not have auth context
 */
export const authRateLimit = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  message: "Too many authentication attempts, please try again later",
  keyGenerator: (c) => {
    // Always use IP for auth endpoints to prevent brute-force attacks
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    return `ip:${ip}`;
  },
});

/**
 * Reset rate limiter state (for testing)
 */
export function resetRateLimiter(): void {
  buckets.clear();
  lastCleanup = Date.now();
}
