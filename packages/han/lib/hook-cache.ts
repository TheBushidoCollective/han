import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getNativeModule } from "./native.ts";

/**
 * Cache manifest structure stored per plugin/hook combination
 * Path: ~/.claude/projects/{project-slug}/han/{plugin_name}_{hook_name}.json
 */
export interface CacheManifest {
	[filePath: string]: string; // relative path -> file content hash
}

/**
 * Get the Claude config directory
 */
export function getClaudeConfigDir(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return process.env.CLAUDE_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		throw new Error("Could not determine home directory");
	}
	return join(homeDir, ".claude");
}

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
	return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Convert a project path to the Claude project slug format
 * e.g., /Users/jwaldrip/dev/src/github.com/foo -> -Users-jwaldrip-dev-src-github-com-foo
 */
export function getProjectSlug(projectPath: string): string {
	return projectPath.replace(/[/.]/g, "-");
}

/**
 * Get the cache directory for the current project
 * Located at ~/.claude/projects/{project-slug}/han/
 */
export function getCacheDir(): string {
	const configDir = getClaudeConfigDir();
	const projectRoot = getProjectRoot();
	const projectSlug = getProjectSlug(projectRoot);
	return join(configDir, "projects", projectSlug, "han");
}

/**
 * Get the cache file path for a plugin/hook combination
 */
export function getCacheFilePath(pluginName: string, hookName: string): string {
	const cacheDir = getCacheDir();
	// Sanitize plugin name for filename (replace / with _)
	const sanitizedPluginName = pluginName.replace(/\//g, "_");
	return join(cacheDir, `${sanitizedPluginName}_${hookName}.json`);
}

/**
 * Compute SHA256 hash of file contents
 */
export function computeFileHash(filePath: string): string {
	return getNativeModule().computeFileHash(filePath);
}

/**
 * Load cache manifest from disk
 */
export function loadCacheManifest(
	pluginName: string,
	hookName: string,
): CacheManifest | null {
	const cachePath = getCacheFilePath(pluginName, hookName);
	if (!existsSync(cachePath)) {
		return null;
	}
	try {
		const content = readFileSync(cachePath, "utf-8");
		return JSON.parse(content) as CacheManifest;
	} catch {
		return null;
	}
}

/**
 * Save cache manifest to disk
 */
export function saveCacheManifest(
	pluginName: string,
	hookName: string,
	manifest: CacheManifest,
): boolean {
	const cachePath = getCacheFilePath(pluginName, hookName);
	try {
		const cacheDir = dirname(cachePath);
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true });
		}
		writeFileSync(cachePath, JSON.stringify(manifest, null, 2));
		return true;
	} catch {
		return false;
	}
}

/**
 * Find files matching glob patterns in a directory (respects gitignore)
 */
export function findFilesWithGlob(
	rootDir: string,
	patterns: string[],
): string[] {
	return getNativeModule().findFilesWithGlob(rootDir, patterns);
}

/**
 * Build a manifest of file hashes for given files
 */
export function buildManifest(files: string[], rootDir: string): CacheManifest {
	return getNativeModule().buildManifest(files, rootDir);
}

/**
 * Check if any files have changed compared to the cached manifest
 * Returns true if changes detected, false if no changes
 */
function hasChanges(
	rootDir: string,
	patterns: string[],
	cachedManifest: CacheManifest | null,
): boolean {
	if (!cachedManifest) {
		return true;
	}
	return getNativeModule().hasChanges(rootDir, patterns, cachedManifest);
}

/**
 * Track files and update the cache manifest
 * This is called after a successful hook execution
 *
 * @param pluginName - Plugin name for cache key
 * @param hookName - Hook name for cache key
 * @param rootDir - Project directory to track
 * @param patterns - Glob patterns for project files
 * @param pluginRoot - Optional plugin directory to also track
 */
export function trackFiles(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
	pluginRoot?: string,
): boolean {
	// Always include han-config.yml (can override command or disable hook)
	const patternsWithConfig = [...patterns, "han-config.yml"];

	// Track project files
	const files = findFilesWithGlob(rootDir, patternsWithConfig);
	const manifest = buildManifest(files, rootDir);
	const projectSaved = saveCacheManifest(pluginName, hookName, manifest);

	// Track plugin files if pluginRoot provided
	let pluginSaved = true;
	if (pluginRoot) {
		const pluginCacheKey = `__plugin__`;
		const pluginFiles = findFilesWithGlob(pluginRoot, ["**/*"]);
		const pluginManifest = buildManifest(pluginFiles, pluginRoot);
		pluginSaved = saveCacheManifest(pluginName, pluginCacheKey, pluginManifest);
	}

	return projectSaved && pluginSaved;
}

/**
 * Check if files have changed since last tracked state.
 * Returns true if changes detected (hook should run), false if no changes (skip hook)
 *
 * @param pluginName - Plugin name for cache key
 * @param hookName - Hook name for cache key
 * @param rootDir - Project directory to check for changes
 * @param patterns - Glob patterns for project files
 * @param pluginRoot - Optional plugin directory to also check for changes
 */
export function checkForChanges(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
	pluginRoot?: string,
): boolean {
	// Always include han-config.yml (can override command or disable hook)
	const patternsWithConfig = [...patterns, "han-config.yml"];

	// Check project files
	const cachedManifest = loadCacheManifest(pluginName, hookName);
	if (hasChanges(rootDir, patternsWithConfig, cachedManifest)) {
		return true;
	}

	// Check plugin files if pluginRoot provided
	if (pluginRoot) {
		const pluginCacheKey = `__plugin__`;
		const cachedPluginManifest = loadCacheManifest(pluginName, pluginCacheKey);
		if (hasChanges(pluginRoot, ["**/*"], cachedPluginManifest)) {
			return true;
		}
	}

	return false;
}

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
export function findDirectoriesWithMarkers(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	return getNativeModule().findDirectoriesWithMarkers(rootDir, markerPatterns);
}
