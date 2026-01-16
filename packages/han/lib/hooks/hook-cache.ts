import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getGitRemoteUrl } from "../../../han-native";
import { getClaudeConfigDir } from "../config/claude-settings.ts";
import {
	getHookCache,
	sessionFileValidations,
	setHookCache,
} from "../db/index.ts";
import type { EventLogger } from "../events/logger.ts";
import { getNativeModule } from "../native.ts";

/**
 * Cache manifest structure stored per plugin/hook combination
 * Now stored in SurrealKV with fallback to filesystem for backwards compatibility
 */
export interface CacheManifest {
	[filePath: string]: string; // relative path -> file content hash
}

/**
 * Get the project root directory
 * Canonicalizes the path to match native module paths (which use fs::canonicalize)
 * This ensures path comparison works correctly on macOS where /var -> /private/var
 */
export function getProjectRoot(): string {
	const rawProjectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	return existsSync(rawProjectRoot)
		? realpathSync(rawProjectRoot)
		: rawProjectRoot;
}

/**
 * Get git remote URL for a directory
 * Returns null if not in a git repo or no remote configured
 */
function getGitRemote(cwd?: string): string | null {
	return getGitRemoteUrl(cwd ?? process.cwd()) ?? null;
}

/**
 * Normalize git remote URL to filesystem-safe path
 *
 * @example
 * normalizeGitRemote("git@github.com:org/repo.git") // "github-com-org-repo"
 * normalizeGitRemote("https://github.com/org/repo") // "github-com-org-repo"
 */
function normalizeGitRemote(gitRemote: string): string {
	return gitRemote
		.replace(/^(git@|https?:\/\/)/, "")
		.replace(/\.git$/, "")
		.replace(/[/:.]/g, "-");
}

/**
 * Get the cache directory for the current repo
 * Located at {claude-config}/han/repos/{normalized-git-remote}/cache/
 * Falls back to path-based slug if not in a git repo
 */
export function getCacheDir(): string {
	const projectRoot = getProjectRoot();
	const gitRemote = getGitRemote(projectRoot);
	const configDir = getClaudeConfigDir();

	if (gitRemote) {
		const repoSlug = normalizeGitRemote(gitRemote);
		return join(configDir, "han", "repos", repoSlug, "cache");
	}

	// Fallback for non-git directories: use path-based slug
	const pathSlug = projectRoot.replace(/[/.]/g, "-");
	return join(configDir, "han", "repos", pathSlug, "cache");
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
 * Generate cache key for SurrealKV storage
 */
function generateCacheKey(pluginName: string, hookName: string): string {
	const sanitizedPluginName = pluginName.replace(/\//g, "_");
	return `${sanitizedPluginName}_${hookName}`;
}

/**
 * Compute a combined hash of all file hashes in the manifest
 * This serves as a quick comparison key
 */
function computeManifestHash(manifest: CacheManifest): string {
	const sortedEntries = Object.entries(manifest).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const combined = sortedEntries.map(([k, v]) => `${k}:${v}`).join("|");
	return createHash("sha256").update(combined).digest("hex");
}

/**
 * Load cache manifest from SQLite database
 */
export async function loadCacheManifestAsync(
	pluginName: string,
	hookName: string,
): Promise<CacheManifest | null> {
	const cacheKey = generateCacheKey(pluginName, hookName);

	try {
		const entry = await getHookCache(cacheKey);
		if (entry?.result) {
			return JSON.parse(entry.result) as CacheManifest;
		}
		return null;
	} catch (error) {
		// Log error but don't fail - treat as cache miss
		console.debug(`Failed to load hook cache: ${error}`);
		return null;
	}
}

/**
 * Load cache manifest from disk (sync)
 * @deprecated Use loadCacheManifestAsync for database-backed storage
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
 * Save cache manifest to SQLite database
 */
export async function saveCacheManifestAsync(
	pluginName: string,
	hookName: string,
	manifest: CacheManifest,
): Promise<boolean> {
	const cacheKey = generateCacheKey(pluginName, hookName);
	const manifestJson = JSON.stringify(manifest);
	const manifestHash = computeManifestHash(manifest);

	try {
		return await setHookCache({
			cacheKey: cacheKey,
			fileHash: manifestHash,
			result: manifestJson,
			ttlSeconds: 7 * 24 * 60 * 60, // 7 days TTL
		});
	} catch (error) {
		console.debug(`Failed to save hook cache: ${error}`);
		return false;
	}
}

/**
 * Save cache manifest to disk (sync)
 * @deprecated Use saveCacheManifestAsync for database-backed storage
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
 * @deprecated Use trackFilesAsync for database-backed storage
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
 * @deprecated Use checkForChangesAsync for database-backed storage
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
 * Track files and update the cache manifest (async database-backed version)
 * This is called after a successful hook execution
 *
 * @param pluginName - Plugin name for cache key
 * @param hookName - Hook name for cache key
 * @param rootDir - Project directory to track
 * @param patterns - Glob patterns for project files
 * @param pluginRoot - Optional plugin directory to also track
 * @param options - Optional settings including logger for event logging
 */
export async function trackFilesAsync(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
	_pluginRoot?: string,
	options?: {
		logger?: EventLogger;
		directory?: string;
		commandHash?: string;
		sessionId?: string;
		trackSessionChangesOnly?: boolean;
	},
): Promise<boolean> {
	// Require sessionId and commandHash for sessionFileValidations
	if (!options?.sessionId || !options?.commandHash) {
		console.debug(
			"trackFilesAsync: sessionId and commandHash required for caching",
		);
		return false;
	}

	let manifest: CacheManifest;

	if (options.trackSessionChangesOnly) {
		// Only track files that the session has changed
		const { getSessionFileChanges } = await import("../../../han-native");
		const { getDbPath } = await import("../db/index.ts");
		const dbPath = getDbPath();

		const sessionChanges = getSessionFileChanges(dbPath, options.sessionId);

		// If no session changes, nothing to track
		if (sessionChanges.length === 0) {
			return true;
		}

		// Build manifest only for session-changed files
		const changedFiles = sessionChanges.map((change) => change.filePath);
		manifest = buildManifest(changedFiles, rootDir);
	} else {
		// Always include han-config.yml (can override command or disable hook)
		const patternsWithConfig = [...patterns, "han-config.yml"];

		// Track all files matching patterns
		const files = findFilesWithGlob(rootDir, patternsWithConfig);
		manifest = buildManifest(files, rootDir);
	}

	// Record each file validation in the database
	try {
		for (const [filePath, fileHash] of Object.entries(manifest)) {
			await sessionFileValidations.record({
				sessionId: options.sessionId,
				filePath,
				fileHash,
				pluginName,
				hookName,
				directory: options.directory ?? rootDir,
				commandHash: options.commandHash,
			});
		}

		// Log validation cache event if logger is provided
		if (options?.logger) {
			options.logger.logHookValidationCache(
				pluginName,
				hookName,
				options.directory ?? rootDir,
				options.commandHash,
				manifest,
			);
		}

		return true;
	} catch (error) {
		console.debug(`Failed to record file validations: ${error}`);
		return false;
	}
}

/**
 * Check if files have changed since last tracked state (async database-backed version)
 * Returns true if changes detected (hook should run), false if no changes (skip hook)
 *
 * @param pluginName - Plugin name for cache key
 * @param hookName - Hook name for cache key
 * @param rootDir - Project directory to check for changes
 * @param patterns - Glob patterns for project files
 * @param pluginRoot - Optional plugin directory to also check for changes
 */
export async function checkForChangesAsync(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
	_pluginRoot?: string,
	options?: {
		sessionId?: string;
		directory?: string;
		checkSessionChangesOnly?: boolean;
	},
): Promise<boolean> {
	// Without sessionId, we can't check validations - assume changes
	if (!options?.sessionId) {
		return true;
	}

	// Always include han-config.yml (can override command or disable hook)
	const patternsWithConfig = [...patterns, "han-config.yml"];

	let currentManifest: CacheManifest;

	if (options.checkSessionChangesOnly) {
		// Only check files that the session has changed
		const { getSessionFileChanges } = await import("../../../han-native");
		const { getDbPath } = await import("../db/index.ts");
		const dbPath = getDbPath();

		const sessionChanges = getSessionFileChanges(dbPath, options.sessionId);

		// If no session changes, nothing to validate
		if (sessionChanges.length === 0) {
			return false;
		}

		// Build manifest only for session-changed files
		const changedFiles = sessionChanges.map((change) => change.filePath);
		currentManifest = buildManifest(changedFiles, rootDir);
	} else {
		// Check all files matching patterns
		const files = findFilesWithGlob(rootDir, patternsWithConfig);
		currentManifest = buildManifest(files, rootDir);
	}

	// Get cached validations from database
	try {
		const validations = await sessionFileValidations.list(
			options.sessionId,
			pluginName,
			hookName,
			options.directory ?? rootDir,
		);

		// If no validations exist yet, this is the first validation run
		// Establish baseline without reporting "files changed"
		if (validations.length === 0) {
			return false;
		}

		// Build map of validated file paths to their hashes
		const validatedFiles = new Map<string, string>();
		for (const validation of validations) {
			validatedFiles.set(validation.filePath, validation.fileHash);
		}

		// Check if any current files differ from validated files
		for (const [filePath, currentHash] of Object.entries(currentManifest)) {
			const validatedHash = validatedFiles.get(filePath);
			if (!validatedHash || validatedHash !== currentHash) {
				return true; // File changed or never validated
			}
		}

		// Check if any validated files were deleted
		for (const filePath of validatedFiles.keys()) {
			if (!(filePath in currentManifest)) {
				return true; // File was deleted
			}
		}

		return false; // No changes detected
	} catch (error) {
		console.debug(`Failed to check file validations: ${error}`);
		return true; // On error, assume changes to be safe
	}
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
