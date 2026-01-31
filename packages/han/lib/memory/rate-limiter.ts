/**
 * Rate Limiter for Team Memory
 *
 * Provides per-user rate limiting to prevent abuse and enumeration attacks.
 * Uses a sliding window algorithm for smooth rate limiting.
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	/** Maximum requests allowed in the window */
	maxRequests: number;
	/** Window size in milliseconds */
	windowMs: number;
}

/**
 * Default rate limits by operation type
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
	/** Team memory queries */
	query: {
		maxRequests: 60, // 60 queries per minute
		windowMs: 60 * 1000,
	},
	/** Org learnings requests */
	orgLearnings: {
		maxRequests: 10, // 10 requests per minute
		windowMs: 60 * 1000,
	},
	/** Search operations */
	search: {
		maxRequests: 120, // 120 searches per minute
		windowMs: 60 * 1000,
	},
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Requests remaining in current window */
	remaining: number;
	/** Time until rate limit resets (ms) */
	resetIn: number;
	/** Total limit for this operation */
	limit: number;
}

/**
 * Sliding window entry
 */
interface WindowEntry {
	timestamps: number[];
}

/**
 * In-memory rate limiter with sliding window
 */
class SlidingWindowRateLimiter {
	private windows = new Map<string, WindowEntry>();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor(cleanupIntervalMs = 60000) {
		// Periodic cleanup of old entries
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, cleanupIntervalMs);
	}

	/**
	 * Check if a request is allowed and record it if so
	 */
	check(key: string, config: RateLimitConfig): RateLimitResult {
		const now = Date.now();
		const windowStart = now - config.windowMs;

		// Get or create window entry
		let entry = this.windows.get(key);
		if (!entry) {
			entry = { timestamps: [] };
			this.windows.set(key, entry);
		}

		// Remove timestamps outside the current window
		entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

		// Check if under limit
		const currentCount = entry.timestamps.length;
		const allowed = currentCount < config.maxRequests;

		if (allowed) {
			// Record this request
			entry.timestamps.push(now);
		}

		// Calculate reset time (when oldest request in window expires)
		const oldestInWindow = entry.timestamps[0] ?? now;
		const resetIn = Math.max(0, oldestInWindow + config.windowMs - now);

		return {
			allowed,
			remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
			resetIn,
			limit: config.maxRequests,
		};
	}

	/**
	 * Get current status without recording a request
	 */
	status(key: string, config: RateLimitConfig): RateLimitResult {
		const now = Date.now();
		const windowStart = now - config.windowMs;

		const entry = this.windows.get(key);
		if (!entry) {
			return {
				allowed: true,
				remaining: config.maxRequests,
				resetIn: 0,
				limit: config.maxRequests,
			};
		}

		// Count timestamps in current window
		const validTimestamps = entry.timestamps.filter((ts) => ts > windowStart);
		const remaining = Math.max(0, config.maxRequests - validTimestamps.length);
		const oldestInWindow = validTimestamps[0] ?? now;
		const resetIn = Math.max(0, oldestInWindow + config.windowMs - now);

		return {
			allowed: remaining > 0,
			remaining,
			resetIn,
			limit: config.maxRequests,
		};
	}

	/**
	 * Reset rate limit for a specific key
	 */
	reset(key: string): void {
		this.windows.delete(key);
	}

	/**
	 * Clean up old entries
	 */
	private cleanup(): void {
		const now = Date.now();
		// Use longest window for cleanup check (10 minutes)
		const maxWindow = 10 * 60 * 1000;

		for (const [key, entry] of this.windows) {
			// Remove entries with no recent activity
			const latest = Math.max(...entry.timestamps, 0);
			if (now - latest > maxWindow) {
				this.windows.delete(key);
			}
		}
	}

	/**
	 * Destroy the rate limiter (for graceful shutdown)
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.windows.clear();
	}
}

/**
 * Global rate limiter instance
 */
const rateLimiter = new SlidingWindowRateLimiter();

/**
 * Generate rate limit key for a user and operation
 */
function rateLimitKey(userId: string, operation: string): string {
	return `${userId}:${operation}`;
}

/**
 * Check rate limit for a user's operation
 *
 * @param userId - User identifier
 * @param operation - Operation type (query, orgLearnings, search)
 * @param customConfig - Optional custom rate limit config
 * @returns Rate limit check result
 */
export function checkRateLimit(
	userId: string,
	operation: string,
	customConfig?: RateLimitConfig,
): RateLimitResult {
	const config = customConfig ?? DEFAULT_RATE_LIMITS[operation];
	if (!config) {
		// Unknown operation - allow with default limits
		return {
			allowed: true,
			remaining: 100,
			resetIn: 0,
			limit: 100,
		};
	}

	const key = rateLimitKey(userId, operation);
	return rateLimiter.check(key, config);
}

/**
 * Get rate limit status without recording a request
 */
export function getRateLimitStatus(
	userId: string,
	operation: string,
	customConfig?: RateLimitConfig,
): RateLimitResult {
	const config = customConfig ?? DEFAULT_RATE_LIMITS[operation];
	if (!config) {
		return {
			allowed: true,
			remaining: 100,
			resetIn: 0,
			limit: 100,
		};
	}

	const key = rateLimitKey(userId, operation);
	return rateLimiter.status(key, config);
}

/**
 * Reset rate limit for a user's operation
 */
export function resetRateLimit(userId: string, operation: string): void {
	const key = rateLimitKey(userId, operation);
	rateLimiter.reset(key);
}

/**
 * Destroy the rate limiter (for graceful shutdown)
 */
export function destroyRateLimiter(): void {
	rateLimiter.destroy();
}

/**
 * Rate limit error for throwing when limit exceeded
 */
export class RateLimitExceededError extends Error {
	constructor(
		public readonly result: RateLimitResult,
		public readonly operation: string,
	) {
		super(
			`Rate limit exceeded for ${operation}. ` +
				`Retry in ${Math.ceil(result.resetIn / 1000)} seconds.`,
		);
		this.name = "RateLimitExceededError";
	}
}

/**
 * Check rate limit and throw if exceeded
 */
export function enforceRateLimit(
	userId: string,
	operation: string,
	customConfig?: RateLimitConfig,
): void {
	const result = checkRateLimit(userId, operation, customConfig);
	if (!result.allowed) {
		throw new RateLimitExceededError(result, operation);
	}
}
