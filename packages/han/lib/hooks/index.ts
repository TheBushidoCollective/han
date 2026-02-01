/**
 * Hooks Module
 *
 * Re-exports all hook-related functionality for cleaner imports.
 *
 * @example
 * import { testHooks, loadPluginConfig, checkForChanges } from './hooks';
 *
 * NOTE: UI components (HookExplainUI, HookTestUI) that use ink are NOT exported here
 * because ink can hang during import in non-TTY environments.
 * Import these directly from their respective files when needed:
 * - HookExplainUI: import from '../hook-explain-ui.tsx'
 * - HookTestUI: import from './hook-test-ui.tsx'
 */

// HookSource type is exported separately (type-only, no runtime impact)
export type { HookSource } from "../hook-explain-ui.tsx";

// Hash cycle detection for recursion
export {
	type CycleDetectionResult,
	HashCycleDetector,
} from "./hash-cycle-detector.ts";
// Cache management
export {
	buildManifest,
	type CacheManifest,
	checkForChanges,
	checkForChangesAsync,
	computeFileHash,
	findDirectoriesWithMarkers,
	findFilesWithGlob,
	getCacheDir,
	getCacheFilePath,
	getProjectRoot,
	loadCacheManifest,
	loadCacheManifestAsync,
	saveCacheManifest,
	saveCacheManifestAsync,
	trackFiles,
	trackFilesAsync,
} from "./hook-cache.ts";
// Hook configuration
export {
	DEFAULT_HOOK_CATEGORY,
	DEFAULT_HOOK_EVENTS,
	getHookConfigs,
	getHookDefinition,
	getHookEvents,
	type HookCategory,
	type HookDependency,
	type HookEventType,
	hookMatchesEvent,
	inferCategoryFromHookName,
	listAvailableHooks,
	loadPluginConfig,
	loadUserConfig,
	PHASE_ORDER,
	type PluginConfig,
	type PluginHookDefinition,
	type PluginMcpConfig,
	type PluginMemoryConfig,
	type ResolvedHookConfig,
	type UserConfig,
	type UserHookOverride,
} from "./hook-config.ts";
// Locking
export {
	acquireSlot,
	checkFailureSignal,
	cleanupOwnedSlots,
	clearFailureSignal,
	createLockManager,
	isLockingEnabled,
	releaseSlot,
	signalFailure,
	withGlobalSlot,
	withSlot,
} from "./hook-lock.ts";
// Testing - NOTE: testHooks, HookTestUI use ink and are NOT exported here
// because ink can hang during import in non-TTY environments.
// Import these directly from './hook-test.ts' or './hook-test-ui.tsx' when needed.
// Transcript filtering
export {
	buildCommandWithFiles,
	clearTranscriptCache,
	commandUsesSessionFiles,
	getProjectsBaseDir,
	getSessionFilteredFiles,
	getTranscriptModifiedFiles,
	HAN_FILES_TEMPLATE,
	hasSessionModifiedPatternFiles,
	type TranscriptModifiedFiles,
} from "./transcript-filter.ts";
