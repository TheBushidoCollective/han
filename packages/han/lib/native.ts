/**
 * Centralized native module loader with retry logic and smart rebuild.
 *
 * When running as a compiled Bun binary, the native module is extracted
 * from the embedded assets at runtime. If multiple han processes start
 * simultaneously, they may race to extract the file, causing one process
 * to try loading a partially-written .node file.
 *
 * This module handles that race condition with retry logic and exponential
 * backoff.
 *
 * When running from source (development), it also checks if the native
 * module needs rebuilding based on source file timestamps.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export type NativeModule = typeof import("../../han-native");

let _nativeModule: NativeModule | null = null;
let _loadError: Error | null = null;
let _rebuildChecked = false;

/**
 * Check if we're running from source (development mode).
 * Returns the han-native directory path if running from source, null otherwise.
 */
function getDevNativeDir(): string | null {
	// Check if we're running via bun run on the source file
	const mainScript = process.argv[1] || "";
	if (!mainScript.includes("lib/main.ts")) {
		return null;
	}

	// Navigate from lib/native.ts to packages/han-native
	const hanDir = resolve(import.meta.dir, "../..");
	const nativeDir = resolve(hanDir, "han-native");

	if (existsSync(nativeDir)) {
		return nativeDir;
	}

	return null;
}

/**
 * Get the mtime of a file, or 0 if it doesn't exist.
 */
function getMtime(path: string): number {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}

/**
 * Recursively get all files in a directory.
 */
function getAllFiles(dir: string): string[] {
	const files: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...getAllFiles(fullPath));
			} else {
				files.push(fullPath);
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}
	return files;
}

/**
 * Check if the native module needs rebuilding.
 * Compares source file timestamps against the .node file.
 */
function needsRebuild(nativeDir: string): boolean {
	// Find the .node file
	const nodeFile = readdirSync(nativeDir).find((f) => f.endsWith(".node"));
	if (!nodeFile) {
		return true; // No .node file, need to build
	}

	const nodeFilePath = join(nativeDir, nodeFile);
	const nodeFileMtime = getMtime(nodeFilePath);

	// Source files that affect the build
	const sourcePatterns = [
		join(nativeDir, "src"),
		join(nativeDir, "Cargo.toml"),
		join(nativeDir, "Cargo.lock"),
		join(nativeDir, "build.rs"),
	];

	// Check Cargo files
	for (const pattern of sourcePatterns.slice(1)) {
		if (getMtime(pattern) > nodeFileMtime) {
			return true;
		}
	}

	// Check all files in src/
	const srcDir = join(nativeDir, "src");
	for (const file of getAllFiles(srcDir)) {
		if (getMtime(file) > nodeFileMtime) {
			return true;
		}
	}

	return false;
}

/**
 * Rebuild the native module if needed.
 * Only runs when in development mode and source files have changed.
 */
function ensureNativeBuilt(): void {
	if (_rebuildChecked) return;
	_rebuildChecked = true;

	const nativeDir = getDevNativeDir();
	if (!nativeDir) return; // Not running from source

	if (!needsRebuild(nativeDir)) return; // Already up to date

	console.error("[han] Native extension out of date, rebuilding...");

	try {
		execSync("npm run build", {
			cwd: nativeDir,
			stdio: "inherit",
		});
		console.error("[han] Native extension rebuilt successfully");
	} catch (error) {
		console.error("[han] Failed to rebuild native extension:", error);
		// Don't fail - let the normal loading try and give a better error
	}
}

/**
 * Internal loader with retry logic.
 * Returns the module or null if loading fails after all retries.
 *
 * When running as a compiled Bun binary, multiple han processes may
 * start simultaneously (e.g., during hooks), causing a race condition
 * where one process extracts the native module while another tries to
 * load a partially-written file. We use longer delays and more retries
 * to handle this.
 */
function loadNativeModule(): NativeModule | null {
	// Return cached module if already loaded
	if (_nativeModule) return _nativeModule;

	// If we've already tried and failed permanently, return null
	if (_loadError) return null;

	// Skip native module loading in CI when not built
	if (process.env.SKIP_NATIVE === "true") {
		_loadError = new Error("Native module skipped (SKIP_NATIVE=true)");
		return null;
	}

	// In dev mode, check if rebuild is needed
	ensureNativeBuilt();

	// More retries with longer delays to handle race conditions
	// when multiple hook processes start simultaneously
	const maxRetries = 8;
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			// Always use the .node file directly (copied by han-native's copy-to-han script)
			// This works in both dev and production:
			// - Dev: han-native's build script copies the .node file to ../han/native/
			// - Production: build-bundle.js copies the platform-specific .node file
			// Static require path tells Bun to embed the file in compiled binaries
			_nativeModule = require("../native/han-native.node") as NativeModule;
			return _nativeModule;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if this is a dlopen error (file might still be extracting)
			const isDlopenError =
				lastError.message.includes("dlopen") ||
				lastError.message.includes("ERR_DLOPEN_FAILED") ||
				lastError.message.includes("no such file");

			// Don't retry on the last attempt
			if (attempt < maxRetries - 1) {
				// Longer exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, 6400ms
				// For dlopen errors, wait even longer as the file might still be extracting
				const baseDelay = isDlopenError ? 200 : 100;
				const delay = baseDelay * 2 ** attempt;
				Bun.sleepSync(delay);
			}
		}
	}

	// Cache the error so subsequent calls fail fast
	_loadError =
		lastError ?? new Error("Failed to load native module after retries");
	return null;
}

/**
 * Get the native module, loading it lazily with retry logic.
 * Throws if the module cannot be loaded.
 *
 * The retry mechanism handles the case where multiple processes
 * simultaneously extract the embedded native module, causing
 * temporary load failures.
 */
export function getNativeModule(): NativeModule {
	const module = loadNativeModule();
	if (!module) {
		throw _loadError ?? new Error("Failed to load native module");
	}
	return module;
}

/**
 * Try to get the native module with graceful degradation.
 * Returns null if the module cannot be loaded (useful for optional features).
 */
export function tryGetNativeModule(): NativeModule | null {
	return loadNativeModule();
}

// ============================================================================
// Re-exported functions from han-native
// These wrappers ensure all code goes through the centralized loader
// instead of importing from han-native directly (which bundles the napi-rs loader)
// ============================================================================

/**
 * Get the git remote URL for a directory
 */
export function getGitRemoteUrl(dir: string): string | null {
	return getNativeModule().getGitRemoteUrl(dir);
}

/**
 * Get the current git branch for a directory
 */
export function getGitBranch(dir: string): string | null {
	return getNativeModule().getGitBranch(dir);
}

/**
 * Get the git root directory
 */
export function getGitRoot(dir: string): string | null {
	return getNativeModule().getGitRoot(dir);
}

/**
 * Get the git common directory (for worktrees)
 */
export function getGitCommonDir(dir: string): string | null {
	return getNativeModule().getGitCommonDir(dir);
}

/**
 * List files tracked by git in a directory
 */
export function gitLsFiles(dir: string): string[] {
	return getNativeModule().gitLsFiles(dir);
}

/**
 * List git worktrees for a repository
 */
export function gitWorktreeList(
	dir: string,
): ReturnType<NativeModule["gitWorktreeList"]> {
	return getNativeModule().gitWorktreeList(dir);
}

/**
 * Get session file changes
 */
export function getSessionFileChanges(
	dbPath: string,
	sessionId: string,
): ReturnType<NativeModule["getSessionFileChanges"]> {
	return getNativeModule().getSessionFileChanges(dbPath, sessionId);
}

// ============================================================================
// FTS/Vector search functions
// ============================================================================

export function ftsIndex(
	...args: Parameters<NativeModule["ftsIndex"]>
): ReturnType<NativeModule["ftsIndex"]> {
	return getNativeModule().ftsIndex(...args);
}

export function ftsSearch(
	...args: Parameters<NativeModule["ftsSearch"]>
): ReturnType<NativeModule["ftsSearch"]> {
	return getNativeModule().ftsSearch(...args);
}

export function ftsDelete(
	...args: Parameters<NativeModule["ftsDelete"]>
): ReturnType<NativeModule["ftsDelete"]> {
	return getNativeModule().ftsDelete(...args);
}

export function vectorIndex(
	...args: Parameters<NativeModule["vectorIndex"]>
): ReturnType<NativeModule["vectorIndex"]> {
	return getNativeModule().vectorIndex(...args);
}

export function vectorSearch(
	...args: Parameters<NativeModule["vectorSearch"]>
): ReturnType<NativeModule["vectorSearch"]> {
	return getNativeModule().vectorSearch(...args);
}

// ============================================================================
// FileEventType enum - re-export from the native module
// ============================================================================

/**
 * File event types for the indexer
 * This mirrors the native const enum with the same values.
 */
export const enum FileEventType {
	Created = "Created",
	Modified = "Modified",
	Removed = "Removed",
}
