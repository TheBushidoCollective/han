/**
 * Hash Cycle Detection for Hook Recursion
 *
 * Detects when hooks are fighting by observing file hash cycles:
 * - Hook A modifies file to hash H1
 * - Hook B modifies file back to hash H0
 * - This is recursion - file returned to a previously seen state
 *
 * This is runtime detection, not configuration-based conflict prediction.
 */

import { buildManifest, findFilesWithGlob } from "./hook-cache.ts";

export interface CycleDetectionResult {
	hasCycle: boolean;
	cycles: Array<{
		filePath: string;
		currentHash: string;
		previouslySeenAt: number; // Index of when this hash was first seen
	}>;
}

/**
 * Tracks file hashes during hook validation to detect cycles.
 * A cycle occurs when a file returns to a hash it had before.
 */
export class HashCycleDetector {
	// Map of filePath -> array of hashes seen (in order)
	private hashHistory: Map<string, string[]> = new Map();

	// Track which hook modified each hash transition
	private hashSources: Map<
		string,
		Array<{ plugin: string; hook: string; directory: string }>
	> = new Map();

	/**
	 * Record current file hashes before/after a hook runs.
	 * Returns cycle detection result.
	 *
	 * @param directory - Directory being validated
	 * @param patterns - File patterns to check
	 * @param hookInfo - Info about the hook that just ran (null for initial capture)
	 */
	recordHashes(
		directory: string,
		patterns: string[],
		hookInfo: { plugin: string; hook: string; directory: string } | null,
	): CycleDetectionResult {
		// Get current file hashes
		const files = findFilesWithGlob(directory, patterns);
		const manifest = buildManifest(files, directory);

		const cycles: CycleDetectionResult["cycles"] = [];

		for (const [filePath, hash] of Object.entries(manifest)) {
			const history = this.hashHistory.get(filePath) ?? [];
			const sources = this.hashSources.get(filePath) ?? [];

			// Check if we've seen this hash before (not counting the immediately previous one)
			// A cycle is when we return to a hash that's NOT the most recent one
			const previousIndex = history.findIndex(
				(h, idx) => h === hash && idx < history.length - 1,
			);

			if (previousIndex !== -1 && history.length > 1) {
				// Cycle detected! File returned to a previous state
				cycles.push({
					filePath,
					currentHash: hash,
					previouslySeenAt: previousIndex,
				});
			}

			// Add current hash to history (only if different from the last one)
			if (history.length === 0 || history[history.length - 1] !== hash) {
				history.push(hash);
				this.hashHistory.set(filePath, history);

				sources.push(
					hookInfo ?? { plugin: "initial", hook: "capture", directory },
				);
				this.hashSources.set(filePath, sources);
			}
		}

		return {
			hasCycle: cycles.length > 0,
			cycles,
		};
	}

	/**
	 * Get the hooks that modified a file, in order.
	 */
	getModificationHistory(
		filePath: string,
	): Array<{ hash: string; hook: string; directory: string }> {
		const history = this.hashHistory.get(filePath) ?? [];
		const sources = this.hashSources.get(filePath) ?? [];

		return history.map((hash, idx) => ({
			hash: hash.substring(0, 8), // Truncate for display
			hook: sources[idx]
				? `${sources[idx].plugin}/${sources[idx].hook}`
				: "unknown",
			directory: sources[idx]?.directory ?? "unknown",
		}));
	}

	/**
	 * Format a cycle detection result for display.
	 */
	formatCycleReport(result: CycleDetectionResult): string {
		if (!result.hasCycle) {
			return "";
		}

		const lines: string[] = [
			"",
			"\x1b[31m\u26a0\ufe0f  RECURSION DETECTED\x1b[0m - File hash cycles found:",
			"",
		];

		for (const cycle of result.cycles) {
			lines.push(`  \x1b[1m${cycle.filePath}\x1b[0m`);
			lines.push(
				`    Current hash ${cycle.currentHash.substring(0, 8)} was previously seen.`,
			);
			lines.push("    Modification history:");

			const history = this.getModificationHistory(cycle.filePath);
			for (let i = 0; i < history.length; i++) {
				const entry = history[i];
				const marker =
					entry.hash === cycle.currentHash.substring(0, 8) ? " <-- cycle" : "";
				lines.push(`      ${i + 1}. ${entry.hash} by ${entry.hook}${marker}`);
			}
			lines.push("");
		}

		lines.push(
			"This usually means two hooks are modifying the same file in conflicting ways.",
		);
		lines.push("Check the hooks listed above and resolve the conflict by:");
		lines.push("  1. Disabling one of the conflicting hooks");
		lines.push("  2. Configuring the hooks to not modify the same files");
		lines.push(
			"  3. Ensuring both hooks agree on the file format (e.g., same prettier/biome config)",
		);

		return lines.join("\n");
	}

	/**
	 * Clear all tracked history.
	 */
	reset(): void {
		this.hashHistory.clear();
		this.hashSources.clear();
	}
}
