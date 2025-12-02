import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Create require function for ESM context (used for dynamic paths in Node.js)
const dynamicRequire = createRequire(import.meta.url);

/**
 * Native module type definition
 */
type NativeModule = typeof import("../../han-native");

/**
 * Cached native module instance
 */
let cachedNativeModule: NativeModule | null = null;

/**
 * Load the native module.
 * Order of attempts:
 * 1. npm package (for npm installs)
 * 2. Monorepo path (for development)
 * 3. Embedded path (for Bun compiled binaries - static require for Bun to detect)
 * 4. Next to executable (legacy fallback)
 *
 * @throws Error if native module cannot be loaded
 */
function loadNativeModule(): NativeModule {
	if (cachedNativeModule) {
		return cachedNativeModule;
	}

	const errors: string[] = [];

	// For npm installs: try the package first (most common case)
	try {
		cachedNativeModule = dynamicRequire(
			"@thebushidocollective/han-native",
		) as NativeModule;
		return cachedNativeModule;
	} catch (e) {
		errors.push(
			`@thebushidocollective/han-native: ${e instanceof Error ? e.message : String(e)}`,
		);
	}

	// For monorepo development: try relative path
	const currentDir = dirname(new URL(import.meta.url).pathname);
	const isInDist = currentDir.includes("/dist/");
	const relativeToHanNative = isInDist
		? "../../../han-native"
		: "../../han-native";
	const monorepoPath = join(currentDir, relativeToHanNative);
	try {
		cachedNativeModule = dynamicRequire(monorepoPath) as NativeModule;
		return cachedNativeModule;
	} catch (e) {
		errors.push(
			`${monorepoPath}: ${e instanceof Error ? e.message : String(e)}`,
		);
	}

	// For Bun compiled binaries: embedded native module
	// This MUST be a bare require with a static string literal for Bun to detect and embed
	try {
		cachedNativeModule =
			require("../native/han-native.darwin-arm64.node") as NativeModule;
		return cachedNativeModule;
	} catch (e) {
		errors.push(`embedded: ${e instanceof Error ? e.message : String(e)}`);
	}

	// Legacy fallback: look for .node file next to the executable
	const executableDir = dirname(process.execPath);
	const nodeFilePath = join(executableDir, "han-native.node");
	if (existsSync(nodeFilePath)) {
		try {
			cachedNativeModule = dynamicRequire(nodeFilePath) as NativeModule;
			return cachedNativeModule;
		} catch (e) {
			errors.push(
				`${nodeFilePath}: ${e instanceof Error ? e.message : String(e)}`,
			);
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

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
export function findDirectoriesWithMarkers(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	return nativeModule.findDirectoriesWithMarkers(rootDir, markerPatterns);
}
