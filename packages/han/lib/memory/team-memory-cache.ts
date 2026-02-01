/**
 * Team Memory Cache
 *
 * Provides caching for team memory operations to improve performance:
 * - Permitted session IDs cache (5 min TTL)
 * - Common query results cache (1 hour TTL)
 *
 * Uses in-memory caching with TTL expiration.
 */

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

/**
 * TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
	/** Permitted session IDs - refresh every 5 minutes */
	PERMITTED_SESSIONS: 5 * 60 * 1000,
	/** Common query results - cache for 1 hour */
	QUERY_RESULTS: 60 * 60 * 1000,
	/** Org learnings aggregation - cache for 15 minutes */
	ORG_LEARNINGS: 15 * 60 * 1000,
} as const;

/**
 * Generic TTL cache implementation
 */
class TtlCache<K, V> {
	private cache = new Map<K, CacheEntry<V>>();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor(
		private defaultTtl: number,
		cleanupIntervalMs = 60000,
	) {
		// Periodic cleanup of expired entries
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, cleanupIntervalMs);
	}

	/**
	 * Get a cached value (returns undefined if expired or not found)
	 */
	get(key: K): V | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return undefined;
		}

		return entry.value;
	}

	/**
	 * Set a cached value with optional custom TTL
	 */
	set(key: K, value: V, ttl?: number): void {
		this.cache.set(key, {
			value,
			expiresAt: Date.now() + (ttl ?? this.defaultTtl),
		});
	}

	/**
	 * Check if a key exists and is not expired
	 */
	has(key: K): boolean {
		return this.get(key) !== undefined;
	}

	/**
	 * Delete a specific key
	 */
	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache size
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Clean up expired entries
	 */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Stop the cleanup interval (for graceful shutdown)
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.cache.clear();
	}
}

/**
 * Permitted sessions cache key format
 */
function permittedSessionsKey(userId: string, orgId?: string): string {
	return `permitted:${userId}:${orgId ?? "none"}`;
}

/**
 * Query results cache key format
 */
function queryKey(
	userId: string,
	query: string,
	scope: string,
	orgId?: string,
): string {
	// Simple hash for the query to keep key size reasonable
	const queryHash = simpleHash(query);
	return `query:${userId}:${orgId ?? "none"}:${scope}:${queryHash}`;
}

/**
 * Simple string hash for cache keys
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Cache for permitted session IDs
 */
const permittedSessionsCache = new TtlCache<string, string[]>(
	CACHE_TTL.PERMITTED_SESSIONS,
);

/**
 * Cache for query results
 */
const queryResultsCache = new TtlCache<string, TeamMemoryCacheEntry>(
	CACHE_TTL.QUERY_RESULTS,
);

/**
 * Cache for org learnings
 */
const orgLearningsCache = new TtlCache<string, OrgLearningsCacheEntry>(
	CACHE_TTL.ORG_LEARNINGS,
);

/**
 * Cached team memory query result
 */
export interface TeamMemoryCacheEntry {
	answer: string;
	confidence: "high" | "medium" | "low";
	citations: Array<{
		source: string;
		excerpt: string;
		sessionId?: string;
		visibility: "public" | "team" | "private";
	}>;
	sessionsSearched: number;
	cachedAt: number;
}

/**
 * Cached org learnings result
 */
export interface OrgLearningsCacheEntry {
	learnings: Array<{
		pattern: string;
		frequency: number;
		domain: string;
		lastSeen: number;
	}>;
	totalSessions: number;
	cachedAt: number;
}

/**
 * Get cached permitted session IDs for a user
 */
export function getCachedPermittedSessions(
	userId: string,
	orgId?: string,
): string[] | undefined {
	const key = permittedSessionsKey(userId, orgId);
	return permittedSessionsCache.get(key);
}

/**
 * Cache permitted session IDs for a user
 */
export function cachePermittedSessions(
	userId: string,
	sessionIds: string[],
	orgId?: string,
): void {
	const key = permittedSessionsKey(userId, orgId);
	permittedSessionsCache.set(key, sessionIds);
}

/**
 * Invalidate permitted sessions cache for a user
 */
export function invalidatePermittedSessions(
	userId: string,
	orgId?: string,
): void {
	const key = permittedSessionsKey(userId, orgId);
	permittedSessionsCache.delete(key);
}

/**
 * Get cached query result
 */
export function getCachedQueryResult(
	userId: string,
	query: string,
	scope: string,
	orgId?: string,
): TeamMemoryCacheEntry | undefined {
	const key = queryKey(userId, query, scope, orgId);
	return queryResultsCache.get(key);
}

/**
 * Cache a query result
 */
export function cacheQueryResult(
	userId: string,
	query: string,
	scope: string,
	result: TeamMemoryCacheEntry,
	orgId?: string,
): void {
	const key = queryKey(userId, query, scope, orgId);
	queryResultsCache.set(key, result);
}

/**
 * Get cached org learnings
 */
export function getCachedOrgLearnings(
	orgId: string,
): OrgLearningsCacheEntry | undefined {
	return orgLearningsCache.get(orgId);
}

/**
 * Cache org learnings
 */
export function cacheOrgLearnings(
	orgId: string,
	learnings: OrgLearningsCacheEntry,
): void {
	orgLearningsCache.set(orgId, learnings);
}

/**
 * Invalidate org learnings cache
 */
export function invalidateOrgLearnings(orgId: string): void {
	orgLearningsCache.delete(orgId);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
	permittedSessions: number;
	queryResults: number;
	orgLearnings: number;
} {
	return {
		permittedSessions: permittedSessionsCache.size(),
		queryResults: queryResultsCache.size(),
		orgLearnings: orgLearningsCache.size(),
	};
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
	permittedSessionsCache.clear();
	queryResultsCache.clear();
	orgLearningsCache.clear();
}

/**
 * Destroy all caches (for graceful shutdown)
 */
export function destroyCaches(): void {
	permittedSessionsCache.destroy();
	queryResultsCache.destroy();
	orgLearningsCache.destroy();
}
