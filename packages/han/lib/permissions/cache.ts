/**
 * Permission Cache
 *
 * In-memory LRU cache for permission lookups with TTL support.
 * Reduces API calls to git providers by caching permission results.
 */

import type { AccessLevel, CachedPermission } from "./types.ts";

/**
 * Default cache TTL: 5 minutes
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Maximum cache entries to prevent memory bloat
 */
const MAX_CACHE_SIZE = 10000;

/**
 * Cache key format: "{userId}:{repoId}"
 */
function makeCacheKey(userId: string, repoId: string): string {
	return `${userId.toLowerCase()}:${repoId.toLowerCase()}`;
}

/**
 * LRU Permission Cache
 *
 * Uses a Map for O(1) lookups with LRU eviction based on access time.
 */
export class PermissionCache {
	private cache = new Map<string, CachedPermission>();
	private accessOrder: string[] = [];
	private ttlMs: number;
	private maxSize: number;

	constructor(ttlMs = DEFAULT_TTL_MS, maxSize = MAX_CACHE_SIZE) {
		this.ttlMs = ttlMs;
		this.maxSize = maxSize;
	}

	/**
	 * Get a cached permission entry
	 *
	 * @returns The cached permission if valid, undefined otherwise
	 */
	get(userId: string, repoId: string): CachedPermission | undefined {
		const key = makeCacheKey(userId, repoId);
		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.delete(userId, repoId);
			return undefined;
		}

		// Update access order for LRU
		this.touchKey(key);

		return entry;
	}

	/**
	 * Set a permission entry in the cache
	 */
	set(userId: string, repoId: string, accessLevel: AccessLevel): void {
		const key = makeCacheKey(userId, repoId);
		const now = Date.now();

		// Evict if at capacity (before adding)
		if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		const entry: CachedPermission = {
			userId: userId.toLowerCase(),
			repoId: repoId.toLowerCase(),
			accessLevel,
			cachedAt: now,
			expiresAt: now + this.ttlMs,
		};

		this.cache.set(key, entry);
		this.touchKey(key);
	}

	/**
	 * Delete a permission entry
	 */
	delete(userId: string, repoId: string): boolean {
		const key = makeCacheKey(userId, repoId);
		const deleted = this.cache.delete(key);

		if (deleted) {
			const index = this.accessOrder.indexOf(key);
			if (index > -1) {
				this.accessOrder.splice(index, 1);
			}
		}

		return deleted;
	}

	/**
	 * Invalidate all entries for a user
	 */
	invalidateUser(userId: string): number {
		const prefix = `${userId.toLowerCase()}:`;
		let count = 0;

		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
				count++;
			}
		}

		// Clean up access order
		this.accessOrder = this.accessOrder.filter((k) => !k.startsWith(prefix));

		return count;
	}

	/**
	 * Invalidate all entries for a repo
	 */
	invalidateRepo(repoId: string): number {
		const suffix = `:${repoId.toLowerCase()}`;
		let count = 0;

		for (const key of this.cache.keys()) {
			if (key.endsWith(suffix)) {
				this.cache.delete(key);
				count++;
			}
		}

		// Clean up access order
		this.accessOrder = this.accessOrder.filter((k) => !k.endsWith(suffix));

		return count;
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.cache.clear();
		this.accessOrder = [];
	}

	/**
	 * Get cache statistics
	 */
	stats(): {
		size: number;
		maxSize: number;
		ttlMs: number;
		validEntries: number;
		expiredEntries: number;
	} {
		const now = Date.now();
		let validEntries = 0;
		let expiredEntries = 0;

		for (const entry of this.cache.values()) {
			if (now > entry.expiresAt) {
				expiredEntries++;
			} else {
				validEntries++;
			}
		}

		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			ttlMs: this.ttlMs,
			validEntries,
			expiredEntries,
		};
	}

	/**
	 * Clean up expired entries
	 * Call periodically to prevent stale entries from consuming memory
	 */
	cleanup(): number {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			// Rebuild access order without expired keys
			const validKeys = new Set(this.cache.keys());
			this.accessOrder = this.accessOrder.filter((k) => validKeys.has(k));
		}

		return cleaned;
	}

	/**
	 * Update access order for LRU tracking
	 */
	private touchKey(key: string): void {
		const index = this.accessOrder.indexOf(key);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
		this.accessOrder.push(key);
	}

	/**
	 * Evict the least recently used entry
	 */
	private evictLRU(): void {
		// First try to evict expired entries
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				const index = this.accessOrder.indexOf(key);
				if (index > -1) {
					this.accessOrder.splice(index, 1);
				}
				return;
			}
		}

		// No expired entries, evict oldest by access time
		if (this.accessOrder.length > 0) {
			const oldestKey = this.accessOrder.shift();
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}
	}
}

/**
 * Global permission cache instance
 */
export const permissionCache = new PermissionCache();

/**
 * Start periodic cache cleanup (every minute)
 * Returns a function to stop the cleanup timer
 */
export function startCacheCleanup(intervalMs = 60000): () => void {
	const timer = setInterval(() => {
		permissionCache.cleanup();
	}, intervalMs);

	return () => clearInterval(timer);
}
