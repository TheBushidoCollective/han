import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Load the native module from various locations:
 * 1. Same directory as the executable (for platform packages)
 * 2. Relative path from source (for development)
 * @throws Error if native module cannot be loaded
 */
function loadNativeModule(): typeof import("../../han-native") {
	const currentDir = dirname(new URL(import.meta.url).pathname);
	// Determine if we're in dist/lib or lib
	const isInDist = currentDir.includes("/dist/");
	const relativeToHanNative = isInDist ? "../../../han-native" : "../../han-native";

	const possiblePaths = [
		// For compiled binary: .node file next to executable
		join(dirname(process.execPath), "han-native.node"),
		// For development: relative path to han-native package
		join(currentDir, relativeToHanNative),
	];

	const errors: string[] = [];

	for (const modulePath of possiblePaths) {
		try {
			if (modulePath.endsWith(".node")) {
				// Direct .node file loading
				if (existsSync(modulePath)) {
					return require(modulePath) as typeof import("../../han-native");
				}
			} else {
				// Package directory loading
				return require(modulePath) as typeof import("../../han-native");
			}
		} catch (e) {
			errors.push(`${modulePath}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	throw new Error(
		`Failed to load han-native module. Tried:\n${errors.join("\n")}\n\n` +
			"This is a required dependency. Please ensure han is installed correctly.",
	);
}

const nativeModule = loadNativeModule();

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
	return nativeModule.computeFileHash(filePath);
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
	return nativeModule.findFilesWithGlob(rootDir, patterns);
}

/**
 * Build a manifest of file hashes for given files
 */
export function buildManifest(files: string[], rootDir: string): CacheManifest {
	return nativeModule.buildManifest(files, rootDir);
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
	return nativeModule.hasChanges(rootDir, patterns, cachedManifest);
}

/**
 * Track files and update the cache manifest
 * This is called after a successful hook execution
 */
export function trackFiles(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
): boolean {
	const files = findFilesWithGlob(rootDir, patterns);
	const manifest = buildManifest(files, rootDir);
	return saveCacheManifest(pluginName, hookName, manifest);
}

/**
 * Check if files have changed since last tracked state.
 * Returns true if changes detected (hook should run), false if no changes (skip hook)
 */
export function checkForChanges(
	pluginName: string,
	hookName: string,
	rootDir: string,
	patterns: string[],
): boolean {
	const cachedManifest = loadCacheManifest(pluginName, hookName);
	return hasChanges(rootDir, patterns, cachedManifest);
}
