/**
 * Cache API
 *
 * Reads cached hook run information from the han cache directory.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { type CacheManifest, getCacheDir } from "../../../hooks/index.ts";

export interface CacheEntry {
	pluginName: string;
	hookName: string;
	fileCount: number;
	lastModified: string;
	path: string;
}

/**
 * List all cached hook runs for the current project
 */
export function listCacheEntries(): CacheEntry[] {
	const cacheDir = getCacheDir();

	if (!existsSync(cacheDir)) {
		return [];
	}

	const entries: CacheEntry[] = [];

	try {
		const files = readdirSync(cacheDir);

		for (const file of files) {
			// Skip checkpoint directory and non-json files
			if (file === "checkpoints" || !file.endsWith(".json")) {
				continue;
			}

			const filePath = `${cacheDir}/${file}`;
			const stats = statSync(filePath);

			// Parse plugin and hook name from filename
			// Format: {plugin_name}_{hook_name}.json
			const baseName = file.replace(".json", "");
			const lastUnderscore = baseName.lastIndexOf("_");

			if (lastUnderscore === -1) {
				continue;
			}

			const pluginName = baseName.slice(0, lastUnderscore).replace(/_/g, "/");
			const hookName = baseName.slice(lastUnderscore + 1);

			// Read the manifest to get file count
			try {
				const content = readFileSync(filePath, "utf-8");
				const manifest: CacheManifest = JSON.parse(content);
				const fileCount = Object.keys(manifest).length;

				entries.push({
					pluginName,
					hookName,
					fileCount,
					lastModified: stats.mtime.toISOString(),
					path: filePath,
				});
			} catch {
				// Skip invalid cache files
			}
		}
	} catch {
		// Return empty if can't read directory
	}

	// Sort by last modified (newest first)
	entries.sort(
		(a, b) =>
			new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
	);

	return entries;
}

/**
 * Get total cache stats
 */
export function getCacheStats(): {
	totalEntries: number;
	totalFiles: number;
	oldestEntry: string | null;
	newestEntry: string | null;
} {
	const entries = listCacheEntries();

	if (entries.length === 0) {
		return {
			totalEntries: 0,
			totalFiles: 0,
			oldestEntry: null,
			newestEntry: null,
		};
	}

	const totalFiles = entries.reduce((sum, e) => sum + e.fileCount, 0);

	return {
		totalEntries: entries.length,
		totalFiles,
		oldestEntry: entries[entries.length - 1].lastModified,
		newestEntry: entries[0].lastModified,
	};
}
