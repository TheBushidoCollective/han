/**
 * GraphQL CacheEntry type
 *
 * Represents a cached hook run entry.
 */

import { type CacheEntry, listCacheEntries } from "../../api/cache.ts";
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
 * Get all cache entries
 */
export function getAllCacheEntries(): CacheEntry[] {
	return listCacheEntries();
}
