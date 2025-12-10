/**
 * Fast marker-based plugin detection using dirsWith and dirTest criteria
 *
 * This module provides deterministic plugin detection based on file markers
 * without requiring AI analysis. It complements the AI-based detection for
 * faster and more predictable results.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MarketplacePlugin } from "./shared.ts";

/**
 * Extended marketplace plugin with detection criteria
 */
export interface PluginWithDetection extends MarketplacePlugin {
	detection?: {
		dirsWith?: string[];
		dirTest?: string[];
	};
}

/**
 * Result of marker-based detection
 */
export interface MarkerDetectionResult {
	detected: string[];
	confident: string[];
	possible: string[];
	details: Map<string, string[]>;
}

/**
 * Check if a file/directory pattern exists in a directory
 * Handles glob patterns like "*.ts", "*.json", etc.
 */
function patternExists(dir: string, pattern: string): boolean {
	// Handle directory patterns (ending with /)
	if (pattern.endsWith("/")) {
		const dirPath = join(dir, pattern.slice(0, -1));
		return existsSync(dirPath) && statSync(dirPath).isDirectory();
	}

	// Handle glob patterns with wildcards
	if (pattern.includes("*")) {
		try {
			const entries = readdirSync(dir);
			const regex = new RegExp(
				`^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
			);
			return entries.some((entry) => regex.test(entry));
		} catch {
			return false;
		}
	}

	// Handle comma-separated patterns (legacy format from some plugins)
	if (pattern.includes(",")) {
		const patterns = pattern.split(",").map((p) => p.trim());
		return patterns.some((p) => patternExists(dir, p));
	}

	// Handle exact file/directory match
	const fullPath = join(dir, pattern);
	return existsSync(fullPath);
}

/**
 * Run a dirTest command and check if it succeeds
 */
function runDirTest(dir: string, command: string): boolean {
	try {
		execSync(command, {
			cwd: dir,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Recursively find directories that match marker patterns
 * Limits depth for performance
 */
function findMatchingDirectories(
	rootDir: string,
	patterns: string[],
	maxDepth = 3,
): string[] {
	const matches: string[] = [];

	function scan(dir: string, depth: number): void {
		if (depth > maxDepth) return;

		// Skip common non-project directories
		const skipDirs = [
			"node_modules",
			".git",
			".svn",
			"vendor",
			"venv",
			".venv",
			"__pycache__",
			"dist",
			"build",
			"target",
			".next",
			".nuxt",
			"coverage",
		];

		// Check if any pattern matches in this directory
		if (patterns.some((pattern) => patternExists(dir, pattern))) {
			matches.push(dir);
		}

		// Recurse into subdirectories
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (
					entry.isDirectory() &&
					!skipDirs.includes(entry.name) &&
					!entry.name.startsWith(".")
				) {
					scan(join(dir, entry.name), depth + 1);
				}
			}
		} catch {
			// Ignore permission errors
		}
	}

	scan(rootDir, 0);
	return matches;
}

/**
 * Detect plugins by scanning codebase for marker files
 *
 * Returns plugins categorized by confidence:
 * - confident: Plugin has dirsWith match AND (no dirTest OR dirTest passes)
 * - possible: Plugin has dirsWith match but dirTest failed (might still be useful)
 */
export function detectPluginsByMarkers(
	plugins: PluginWithDetection[],
	rootDir: string = process.cwd(),
): MarkerDetectionResult {
	const detected: string[] = [];
	const confident: string[] = [];
	const possible: string[] = [];
	const details = new Map<string, string[]>();

	for (const plugin of plugins) {
		const detection = plugin.detection;
		if (!detection) continue;

		const { dirsWith, dirTest } = detection;

		// Skip plugins without dirsWith patterns
		if (!dirsWith || dirsWith.length === 0) {
			// If only dirTest, run it at root
			if (dirTest && dirTest.length > 0) {
				const allTestsPass = dirTest.every((test) => runDirTest(rootDir, test));
				if (allTestsPass) {
					detected.push(plugin.name);
					confident.push(plugin.name);
					details.set(plugin.name, ["dirTest passed at root"]);
				}
			}
			continue;
		}

		// Find directories matching the marker patterns
		const matchingDirs = findMatchingDirectories(rootDir, dirsWith);

		if (matchingDirs.length === 0) {
			continue;
		}

		detected.push(plugin.name);
		details.set(
			plugin.name,
			matchingDirs.map((d) => d.replace(rootDir, ".") || "."),
		);

		// If dirTest is specified, run it in the first matching directory
		if (dirTest && dirTest.length > 0) {
			const testDir = matchingDirs[0];
			const allTestsPass = dirTest.every((test) => runDirTest(testDir, test));

			if (allTestsPass) {
				confident.push(plugin.name);
			} else {
				possible.push(plugin.name);
			}
		} else {
			// No dirTest, consider it confident
			confident.push(plugin.name);
		}
	}

	return { detected, confident, possible, details };
}

/**
 * Get a summary of detection results for display
 */
export function formatDetectionSummary(
	result: MarkerDetectionResult,
): string[] {
	const lines: string[] = [];

	if (result.confident.length > 0) {
		lines.push(`Detected: ${result.confident.join(", ")}`);
	}

	if (result.possible.length > 0) {
		lines.push(`Possible matches: ${result.possible.join(", ")}`);
	}

	return lines;
}
