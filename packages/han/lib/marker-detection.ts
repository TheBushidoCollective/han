/**
 * Fast marker-based plugin detection using dirsWith and dirTest criteria
 *
 * This module provides deterministic plugin detection based on file markers
 * without requiring AI analysis. It complements the AI-based detection for
 * faster and more predictable results.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { MarketplacePlugin } from "./shared.ts";

/**
 * HanConfig structure for reading han-config.json files (legacy)
 */
interface HanConfigHook {
	dirsWith?: string[];
	dirTest?: string;
}

interface HanConfig {
	hooks?: Record<string, HanConfigHook>;
}

/**
 * YAML plugin config structure for han-plugin.yml (new format)
 */
interface YamlPluginHook {
	dirs_with?: string[];
	dir_test?: string;
}

interface YamlPluginConfig {
	hooks?: Record<string, YamlPluginHook>;
}

/**
 * Get the path to Claude's cached plugins directory
 * Plugins are cached at ~/.claude/plugins/marketplaces/han/
 */
function getCachedPluginsDir(): string {
	const configDir =
		process.env.CLAUDE_CONFIG_DIR ||
		join(process.env.HOME || process.env.USERPROFILE || "", ".claude");
	return join(configDir, "plugins", "marketplaces", "han");
}

/**
 * Recursively find all plugin config files (han-plugin.yml or han-config.json) in a directory
 * Returns a map of plugin name -> config path (prefers YAML over JSON)
 */
function findAllHanConfigs(rootDir: string, maxDepth = 4): Map<string, string> {
	const configMap = new Map<string, string>();

	function scan(dir: string, depth: number): void {
		if (depth > maxDepth) return;

		try {
			const entries = readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dir, entry.name);

				// Check for YAML config first (preferred)
				if (entry.isFile() && entry.name === "han-plugin.yml") {
					const pluginJsonPath = join(dir, ".claude-plugin", "plugin.json");
					if (existsSync(pluginJsonPath)) {
						try {
							const pluginJson = JSON.parse(
								readFileSync(pluginJsonPath, "utf-8"),
							);
							if (pluginJson.name) {
								configMap.set(pluginJson.name, fullPath);
							}
						} catch {
							// Skip if plugin.json is invalid
						}
					}
				}
				// Fall back to JSON config (legacy) only if YAML not already found
				else if (entry.isFile() && entry.name === "han-config.json") {
					const pluginJsonPath = join(dir, ".claude-plugin", "plugin.json");
					if (existsSync(pluginJsonPath)) {
						try {
							const pluginJson = JSON.parse(
								readFileSync(pluginJsonPath, "utf-8"),
							);
							if (pluginJson.name && !configMap.has(pluginJson.name)) {
								configMap.set(pluginJson.name, fullPath);
							}
						} catch {
							// Skip if plugin.json is invalid
						}
					}
				} else if (entry.isDirectory() && !entry.name.startsWith(".")) {
					scan(fullPath, depth + 1);
				}
			}
		} catch {
			// Ignore permission errors
		}
	}

	scan(rootDir, 0);
	return configMap;
}

/**
 * Extract detection patterns from a plugin config file (YAML or JSON)
 */
function extractDetectionPatterns(
	configPath: string,
): { dirsWith: string[]; dirTest: string[] } | null {
	try {
		const content = readFileSync(configPath, "utf-8");
		const isYaml = configPath.endsWith(".yml") || configPath.endsWith(".yaml");

		// Collect unique dirsWith patterns from all hooks
		const dirsWithSet = new Set<string>();
		const dirTestSet = new Set<string>();

		if (isYaml) {
			const config = YAML.parse(content) as YamlPluginConfig;
			if (!config.hooks) {
				return null;
			}

			for (const hook of Object.values(config.hooks)) {
				if (hook.dirs_with) {
					for (const pattern of hook.dirs_with) {
						dirsWithSet.add(pattern);
					}
				}
				if (hook.dir_test) {
					dirTestSet.add(hook.dir_test);
				}
			}
		} else {
			const config = JSON.parse(content) as HanConfig;
			if (!config.hooks) {
				return null;
			}

			for (const hook of Object.values(config.hooks)) {
				if (hook.dirsWith) {
					for (const pattern of hook.dirsWith) {
						dirsWithSet.add(pattern);
					}
				}
				if (hook.dirTest) {
					dirTestSet.add(hook.dirTest);
				}
			}
		}

		if (dirsWithSet.size === 0 && dirTestSet.size === 0) {
			return null;
		}

		return {
			dirsWith: Array.from(dirsWithSet),
			dirTest: Array.from(dirTestSet),
		};
	} catch {
		return null;
	}
}

/**
 * Load detection criteria from cached plugins' config files (han-plugin.yml or han-config.json)
 * Scans for config files and builds a map by plugin name
 * Returns plugins enriched with detection data
 */
export function loadPluginDetection(
	plugins: MarketplacePlugin[],
): PluginWithDetection[] {
	const cachedDir = getCachedPluginsDir();

	if (!existsSync(cachedDir)) {
		return plugins.map((p) => ({ ...p }));
	}

	// Find all han-config.json files and map them by plugin name
	const configMap = findAllHanConfigs(cachedDir);

	return plugins.map((plugin) => {
		const configPath = configMap.get(plugin.name);
		if (configPath) {
			const detection = extractDetectionPatterns(configPath);
			if (detection) {
				return { ...plugin, detection };
			}
		}
		return { ...plugin };
	});
}

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
