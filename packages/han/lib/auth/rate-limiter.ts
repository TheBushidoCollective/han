/**
 * Rate Limiter
 *
 * Protects authentication endpoints from brute force attacks.
 * Implements sliding window rate limiting with exponential backoff.
 *
 * PRODUCTION NOTE: This implementation uses in-memory storage which:
 * - Resets on process restart
 * - Does not work across multiple instances
 *
 * For production multi-instance deployments, Redis-based rate limiting
 * should be implemented. Set REDIS_URL to enable when available.
 */

import type { AuthRateLimit } from './types.ts';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum attempts before blocking */
  maxAttempts: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Block duration in milliseconds (doubles on each subsequent block) */
  blockDurationMs: number;
  /** Maximum block duration in milliseconds */
  maxBlockDurationMs: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  /** Magic link requests: 5 per email per hour */
  magicLink: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 60 * 60 * 1000,
    maxBlockDurationMs: 24 * 60 * 60 * 1000,
  } satisfies RateLimitConfig,

  /** OAuth initiates: 10 per IP per minute */
  oauthInitiate: {
    maxAttempts: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
    maxBlockDurationMs: 60 * 60 * 1000,
  } satisfies RateLimitConfig,

  /** Failed logins: 5 attempts then 15-minute lockout */
  loginAttempt: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
    maxBlockDurationMs: 24 * 60 * 60 * 1000,
  } satisfies RateLimitConfig,

  /** Session refresh: 60 per session per hour */
  sessionRefresh: {
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
    maxBlockDurationMs: 60 * 60 * 1000,
  } satisfies RateLimitConfig,
};

/**
 * Rate limit key prefixes
 */
export const RATE_LIMIT_KEYS = {
  magicLink: (email: string) => `magic:${email.toLowerCase()}`,
  oauthInitiate: (ip: string) => `oauth:${ip}`,
  loginAttempt: (identifier: string) => `login:${identifier}`,
  sessionRefresh: (sessionId: string) => `refresh:${sessionId}`,
};

/**
 * In-memory rate limit store
 *
 * WARNING: This store is not suitable for production multi-instance deployments.
 * Rate limits will not be shared across instances and will reset on restart.
 *
 * For production, implement a Redis-based store using the RateLimitStore interface.
 */
const rateLimitStore = new Map<string, AuthRateLimit>();

/**
 * Track attempt history for sliding window
 */
const attemptHistory = new Map<string, number[]>();

/**
 * Track consecutive blocks for exponential backoff
 */
const consecutiveBlocks = new Map<string, number>();

// Log warning on first use in production
let _warnedAboutInMemory = false;
function warnIfProduction(): void {
  if (!_warnedAboutInMemory && process.env.NODE_ENV === 'production') {
    console.warn(
      '[rate-limiter] WARNING: Using in-memory rate limiting. ' +
        'Rate limits will reset on restart and not work across multiple instances. ' +
        'For production, implement Redis-based rate limiting.'
    );
    _warnedAboutInMemory = true;
  }
}

/**
 * Check if a key is rate limited
 *
 * @param key - Rate limit key
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry-after time
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  warnIfProduction();
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Check if currently blocked
  if (record?.blockedUntil && record.blockedUntil > new Date(now)) {
    return {
      allowed: false,
      retryAfterMs: record.blockedUntil.getTime() - now,
    };
  }

  // Get attempt history and clean old entries
  const history = attemptHistory.get(key) || [];
  const windowStart = now - config.windowMs;
  const recentAttempts = history.filter((ts) => ts > windowStart);

  // Calculate remaining attempts
  const remaining = Math.max(0, config.maxAttempts - recentAttempts.length);

  return {
    allowed: recentAttempts.length < config.maxAttempts,
    remaining,
  };
}

/**
 * Record an attempt (successful or failed)
 *
 * @param key - Rate limit key
 * @param config - Rate limit configuration
 * @param success - Whether the attempt succeeded
 * @returns Updated rate limit status
 */
export function recordAttempt(
  key: string,
  config: RateLimitConfig,
  success: boolean
): { blocked: boolean; retryAfterMs?: number } {
  warnIfProduction();
  const now = Date.now();

  // Get or create history
  let history = attemptHistory.get(key) || [];

  // Clean old entries
  const windowStart = now - config.windowMs;
  history = history.filter((ts) => ts > windowStart);

  // Add new attempt
  history.push(now);
  attemptHistory.set(key, history);

  // Update record
  let record = rateLimitStore.get(key);
  if (!record) {
    record = {
      key,
      attempts: 0,
      blockedUntil: null,
      updatedAt: new Date(now),
    };
    rateLimitStore.set(key, record);
  }

  record.attempts = history.length;
  record.updatedAt = new Date(now);

  // If successful, reset consecutive blocks
  if (success) {
    consecutiveBlocks.delete(key);
    return { blocked: false };
  }

  // Check if we should block
  if (history.length >= config.maxAttempts) {
    // Calculate block duration with exponential backoff
    const blocks = (consecutiveBlocks.get(key) || 0) + 1;
    consecutiveBlocks.set(key, blocks);

    const blockDuration = Math.min(
      config.blockDurationMs * 2 ** (blocks - 1),
      config.maxBlockDurationMs
    );

    record.blockedUntil = new Date(now + blockDuration);

    return {
      blocked: true,
      retryAfterMs: blockDuration,
    };
  }

  return { blocked: false };
}

/**
 * Reset rate limit for a key
 *
 * @param key - Rate limit key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
  attemptHistory.delete(key);
  consecutiveBlocks.delete(key);
}

/**
 * Clear a block early (e.g., after successful verification)
 *
 * @param key - Rate limit key
 */
export function clearBlock(key: string): void {
  const record = rateLimitStore.get(key);
  if (record) {
    record.blockedUntil = null;
    record.attempts = 0;
  }
  attemptHistory.delete(key);
  consecutiveBlocks.delete(key);
}

/**
 * Clean up expired rate limit entries
 *
 * @returns Number of entries cleaned
 */
export function cleanupRateLimits(): number {
  const now = Date.now();
  let cleaned = 0;

  // Clean rate limit records
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove entries that haven't been updated in 24 hours
    if (record.updatedAt.getTime() < now - 24 * 60 * 60 * 1000) {
      rateLimitStore.delete(key);
      attemptHistory.delete(key);
      consecutiveBlocks.delete(key);
      cleaned++;
    }
  }

  // Clean orphaned history entries
  for (const key of attemptHistory.keys()) {
    if (!rateLimitStore.has(key)) {
      attemptHistory.delete(key);
    }
  }

  return cleaned;
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats(): {
  totalKeys: number;
  blockedKeys: number;
  totalAttempts: number;
} {
  const now = Date.now();
  let blocked = 0;
  let attempts = 0;

  for (const record of rateLimitStore.values()) {
    attempts += record.attempts;
    if (record.blockedUntil && record.blockedUntil.getTime() > now) {
      blocked++;
    }
  }

  return {
    totalKeys: rateLimitStore.size,
    blockedKeys: blocked,
    totalAttempts: attempts,
  };
}

/**
 * Rate limiter middleware factory
 *
 * @param keyFn - Function to extract rate limit key from request
 * @param config - Rate limit configuration
 * @returns Middleware check function
 */
export function createRateLimiter(
  keyFn: (request: Request) => string,
  config: RateLimitConfig
): (request: Request) => { allowed: boolean; retryAfterMs?: number } {
  return (request: Request) => {
    const key = keyFn(request);
    return checkRateLimit(key, config);
  };
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}
