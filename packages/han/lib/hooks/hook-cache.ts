import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { getClaudeConfigDir } from "../config/claude-settings.ts";
import {
	getHookCache,
	sessionFileValidations,
	setHookCache,
} from "../db/index.ts";
import type { EventLogger } from "../events/logger.ts";
import { getGitRemoteUrl, tryGetNativeModule } from "../native.ts";

/**
 * JS fallback for computeFileHash when native module unavailable
 */
function computeFileHashJS(filePath: string): string {
	try {
		const content = readFileSync(filePath);
		return createHash("sha256").update(content).digest("hex");
	} catch {
		return "";
	}
}

/**
 * JS fallback for findFilesWithGlob when native module unavailable
 * Simple implementation that doesn't respect gitignore for fallback purposes
 */
function findFilesWithGlobJS(rootDir: string, patterns: string[]): string[] {
	const results: string[] = [];

	function walkDir(dir: string) {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					// Skip hidden directories and node_modules
					if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
						walkDir(fullPath);
					}
				} else if (entry.isFile()) {
					// Simple pattern matching - check if file matches any pattern
					const relPath = relative(rootDir, fullPath);
					for (const pattern of patterns) {
						if (matchSimpleGlob(relPath, pattern)) {
							results.push(fullPath);
							break;
						}
					}
				}
			}
		} catch {
			// Ignore directories we can't read
		}
	}

	walkDir(rootDir);
	return results;
}

/**
 * Simple glob pattern matching for fallback
 * Supports: *, **, ?, and basic extension matching
 */
function matchSimpleGlob(path: string, pattern: string): boolean {
	// Handle ** (match any path segment)
	if (pattern === "**/*") return true;
	if (pattern.startsWith("**/")) {
		const rest = pattern.slice(3);
		// Check if the filename matches
		const fileName = path.split("/").pop() || path;
		return matchSimpleGlob(fileName, rest) || matchSimpleGlob(path, rest);
	}

	// Handle file extensions like *.ts
	if (pattern.startsWith("*.")) {
		const ext = pattern.slice(1);
		return path.endsWith(ext);
	}

	// Exact match
	if (pattern === path) return true;

	// Basic * wildcard
	if (pattern.includes("*")) {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
		return regex.test(path);
	}

	return false;
}

/**
 * JS fallback for buildManifest when native module unavailable
 */
function buildManifestJS(files: string[], rootDir: string): CacheManifest {
	const manifest: CacheManifest = {};
	for (const file of files) {
		const relPath = relative(rootDir, file);
		const hash = computeFileHashJS(file);
		if (hash) {
			manifest[relPath] = hash;
		}
	}
	return manifest;
}

/**
 * JS fallback for hasChanges when native module unavailable
 */
function hasChangesJS(
	rootDir: string,
	patterns: string[],
	cachedManifest: CacheManifest | null,
): boolean {
	if (!cachedManifest) {
		return true;
	}

	const currentFiles = findFilesWithGlobJS(rootDir, patterns);
	const currentManifest = buildManifestJS(currentFiles, rootDir);

	// Check for added or changed files
	for (const [path, hash] of Object.entries(currentManifest)) {
		if (cachedManifest[path] !== hash) {
			return true;
		}
	}

	// Check for deleted files
	for (const path of Object.keys(cachedManifest)) {
		if (!(path in currentManifest)) {
			return true;
		}
	}

	return false;
}

/**
 * JS fallback for findDirectoriesWithMarkers when native module unavailable
 */
function findDirectoriesWithMarkersJS(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	const results: string[] = [];

	function walkDir(dir: string) {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			let hasMarker = false;

			for (const entry of entries) {
				if (entry.isFile()) {
					for (const pattern of markerPatterns) {
						if (matchSimpleGlob(entry.name, pattern)) {
							hasMarker = true;
							break;
						}
					}
				}
			}

			if (hasMarker) {
				results.push(dir);
			}

			// Continue to subdirectories
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
					walkDir(join(dir, entry.name));
				}
			}
		} catch {
			// Ignore directories we can't read
		}
	}

	walkDir(rootDir);
	return results;
}

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
	const native = tryGetNativeModule();
	return native ? native.computeFileHash(filePath) : computeFileHashJS(filePath);
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
	const native = tryGetNativeModule();
	return native ? native.findFilesWithGlob(rootDir, patterns) : findFilesWithGlobJS(rootDir, patterns);
}

/**
 * Build a manifest of file hashes for given files
 */
export function buildManifest(files: string[], rootDir: string): CacheManifest {
	const native = tryGetNativeModule();
	return native ? native.buildManifest(files, rootDir) : buildManifestJS(files, rootDir);
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
	const native = tryGetNativeModule();
	return native ? native.hasChanges(rootDir, patterns, cachedManifest) : hasChangesJS(rootDir, patterns, cachedManifest);
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
		const { getSessionFileChanges } = await import("../native.ts");
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
		// Canonicalize directory for consistent lookups
		// (e.g., /Volumes/dev vs /Users/name/dev pointing to same location)
		let canonicalDirectory: string;
		try {
			canonicalDirectory = realpathSync(options.directory ?? rootDir);
		} catch {
			canonicalDirectory = options.directory ?? rootDir;
		}

		for (const [filePath, fileHash] of Object.entries(manifest)) {
			await sessionFileValidations.record({
				sessionId: options.sessionId,
				filePath,
				fileHash,
				pluginName,
				hookName,
				directory: canonicalDirectory,
				commandHash: options.commandHash,
			});
		}

		// Delete stale validation records for files that no longer exist
		// This prevents "ghost" validations from causing infinite re-validation loops
		const currentFilePaths = Object.keys(manifest);
		const directory = canonicalDirectory;
		const deletedCount = await sessionFileValidations.deleteStale(
			options.sessionId,
			pluginName,
			hookName,
			directory,
			currentFilePaths,
		);
		if (deletedCount > 0) {
			console.debug(
				`Deleted ${deletedCount} stale validation records for ${pluginName}/${hookName} in ${directory}`,
			);
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
		// Only check files that the session has changed AND are within this directory
		const { getSessionFileChanges } = await import("../native.ts");
		const { getDbPath } = await import("../db/index.ts");
		const dbPath = getDbPath();

		const allSessionChanges = getSessionFileChanges(dbPath, options.sessionId);

		// Canonicalize rootDir to match canonicalized paths in session changes
		// (e.g., /Volumes/dev vs /Users/name/dev pointing to same location)
		let canonicalRootDir: string;
		try {
			canonicalRootDir = realpathSync(rootDir);
		} catch {
			canonicalRootDir = rootDir;
		}

		// Filter to only changes within this hook's directory
		const sessionChanges = allSessionChanges.filter(
			(change) =>
				change.filePath.startsWith(`${canonicalRootDir}/`) ||
				change.filePath === canonicalRootDir,
		);

		// If no session changes in this directory, nothing to validate
		if (sessionChanges.length === 0) {
			return false;
		}

		// Build manifest only for session-changed files in this directory
		const changedFiles = sessionChanges.map((change) => change.filePath);
		currentManifest = buildManifest(changedFiles, rootDir);
	} else {
		// Check all files matching patterns
		const files = findFilesWithGlob(rootDir, patternsWithConfig);
		currentManifest = buildManifest(files, rootDir);
	}

	// Get cached validations from database
	try {
		// Canonicalize directory for consistent lookups
		// (e.g., /Volumes/dev vs /Users/name/dev pointing to same location)
		let canonicalDirectory: string;
		try {
			canonicalDirectory = realpathSync(options.directory ?? rootDir);
		} catch {
			canonicalDirectory = options.directory ?? rootDir;
		}

		const validations = await sessionFileValidations.list(
			options.sessionId,
			pluginName,
			hookName,
			canonicalDirectory,
		);

		// If no validations exist yet, we need to check if any files in the manifest
		// were actually changed by the session. If checkSessionChangesOnly was true,
		// currentManifest already contains only session-changed files. Otherwise,
		// we need to cross-reference with session file changes.
		if (validations.length === 0) {
			if (options.checkSessionChangesOnly) {
				// currentManifest contains only session-changed files, so if it has files, need validation
				return Object.keys(currentManifest).length > 0;
			}

			// For pattern-based checks, see if any manifest files were changed in the session
			const { getSessionFileChanges } = await import("../native.ts");
			const { getDbPath } = await import("../db/index.ts");
			const dbPath = getDbPath();
			const sessionChanges = getSessionFileChanges(dbPath, options.sessionId);
			const sessionChangedPaths = new Set(
				sessionChanges.map((c) => c.filePath),
			);

			// Check if any files in the manifest were changed by the session
			for (const filePath of Object.keys(currentManifest)) {
				const absolutePath = filePath.startsWith("/")
					? filePath
					: `${rootDir}/${filePath}`;
				if (sessionChangedPaths.has(absolutePath)) {
					return true; // A session-changed file matches this hook's patterns
				}
			}

			// No session-changed files match this hook's patterns - skip validation
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
	const native = tryGetNativeModule();
	return native ? native.findDirectoriesWithMarkers(rootDir, markerPatterns) : findDirectoriesWithMarkersJS(rootDir, markerPatterns);
}
