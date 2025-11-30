import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { globby } from "globby";

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
	try {
		const content = readFileSync(filePath);
		return createHash("sha256").update(content).digest("hex");
	} catch {
		// If file can't be read, return empty hash
		return "";
	}
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
export async function findFilesWithGlob(
	rootDir: string,
	patterns: string[],
): Promise<string[]> {
	const matches = await globby(patterns, {
		cwd: rootDir,
		gitignore: true,
		ignore: [".git/**"],
		absolute: true,
		onlyFiles: true,
	});
	return matches;
}

/**
 * Build a manifest of file hashes for given files
 */
export function buildManifest(files: string[], rootDir: string): CacheManifest {
	const manifest: CacheManifest = {};
	for (const file of files) {
		const relativePath = relative(rootDir, file);
		manifest[relativePath] = computeFileHash(file);
	}
	return manifest;
}

/**
 * Check if any files have changed compared to the cached manifest
 * Returns true if changes detected, false if no changes
 */
export function hasChanges(
	currentFiles: string[],
	rootDir: string,
	cachedManifest: CacheManifest | null,
): boolean {
	if (!cachedManifest) {
		// No cache exists, consider everything changed
		return true;
	}

	// Check for new or modified files
	for (const file of currentFiles) {
		const relativePath = relative(rootDir, file);
		const currentHash = computeFileHash(file);
		const cachedHash = cachedManifest[relativePath];

		// File is new or modified
		if (cachedHash !== currentHash) {
			return true;
		}
	}

	// Check for deleted files (files in cache but not in current)
	const currentRelativePaths = new Set(
		currentFiles.map((f) => relative(rootDir, f)),
	);
	for (const cachedPath of Object.keys(cachedManifest)) {
		if (!currentRelativePaths.has(cachedPath)) {
			// File was deleted
			return true;
		}
	}

	return false;
}

/**
 * Track files and update the cache manifest
 * This is called after a successful hook execution
 */
export async function trackFiles(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
): Promise<boolean> {
	const files = await findFilesWithGlob(rootDir, patterns);
	const manifest = buildManifest(files, rootDir);
	return saveCacheManifest(pluginName, hookName, manifest);
}

/**
 * Check if files have changed since last tracked state
 * Returns true if changes detected (hook should run), false if no changes (skip hook)
 */
export async function checkForChanges(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
): Promise<boolean> {
	const cachedManifest = loadCacheManifest(pluginName, hookName);
	const currentFiles = await findFilesWithGlob(rootDir, patterns);
	return hasChanges(currentFiles, rootDir, cachedManifest);
}
