/**
 * Centralized native module loader with retry logic.
 *
 * When running as a compiled Bun binary, the native module is extracted
 * from the embedded assets at runtime. If multiple han processes start
 * simultaneously, they may race to extract the file, causing one process
 * to try loading a partially-written .node file.
 *
 * This module handles that race condition with retry logic and exponential
 * backoff.
 */

export type NativeModule = typeof import("../../han-native");

let _nativeModule: NativeModule | null = null;
let _loadError: Error | null = null;

/**
 * Internal loader with retry logic.
 * Returns the module or null if loading fails after all retries.
 */
function loadNativeModule(): NativeModule | null {
	// Return cached module if already loaded
	if (_nativeModule) return _nativeModule;

	// If we've already tried and failed permanently, return null
	if (_loadError) return null;

	const maxRetries = 5;
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			// Static require path tells Bun to embed the file in compiled binaries
			_nativeModule = require("../native/han-native.node") as NativeModule;
			return _nativeModule;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on the last attempt
			if (attempt < maxRetries - 1) {
				// Exponential backoff: 50ms, 100ms, 200ms, 400ms
				const delay = 50 * Math.pow(2, attempt);
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
