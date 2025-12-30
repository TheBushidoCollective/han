/**
 * GraphQL Cache types
 *
 * Represents cached hook run data.
 */

import {
	type CacheEntry,
	getCacheStats,
	listCacheEntries,
} from "../../api/cache.ts";
import { builder } from "../builder.ts";

/**
 * Cache entry type ref
 */
const CacheEntryRef = builder.objectRef<CacheEntry>("CacheEntry");

/**
 * Cache entry type implementation
 */
export const CacheEntryType = CacheEntryRef.implement({
	description: "A cached hook run entry",
	fields: (t) => ({
		id: t.id({
			description: "Cache entry ID",
			resolve: (entry) =>
				Buffer.from(
					`CacheEntry:${entry.pluginName}_${entry.hookName}`,
				).toString("base64"),
		}),
		pluginName: t.exposeString("pluginName", {
			description: "Plugin name",
		}),
		hookName: t.exposeString("hookName", {
			description: "Hook name",
		}),
		fileCount: t.exposeInt("fileCount", {
			description: "Number of files tracked",
		}),
		lastModified: t.field({
			type: "DateTime",
			description: "When the cache was last updated",
			resolve: (entry) => entry.lastModified,
		}),
		path: t.exposeString("path", {
			description: "Path to cache file",
		}),
	}),
});

/**
 * Cache stats type
 */
interface CacheStatsData {
	totalEntries: number;
	totalFiles: number;
	oldestEntry: string | null;
	newestEntry: string | null;
}

const CacheStatsRef = builder.objectRef<CacheStatsData>("CacheStats");

export const CacheStatsType = CacheStatsRef.implement({
	description: "Aggregate cache statistics",
	fields: (t) => ({
		totalEntries: t.exposeInt("totalEntries", {
			description: "Total number of cache entries",
		}),
		totalFiles: t.exposeInt("totalFiles", {
			description: "Total number of tracked files",
		}),
		oldestEntry: t.field({
			type: "DateTime",
			nullable: true,
			description: "Oldest cache entry timestamp",
			resolve: (stats) => stats.oldestEntry,
		}),
		newestEntry: t.field({
			type: "DateTime",
			nullable: true,
			description: "Newest cache entry timestamp",
			resolve: (stats) => stats.newestEntry,
		}),
	}),
});

/**
 * Get all cache entries
 */
export function getAllCacheEntries(): CacheEntry[] {
	return listCacheEntries();
}

/**
 * Get cache statistics
 */
export function queryCacheStats(): CacheStatsData {
	return getCacheStats();
}
