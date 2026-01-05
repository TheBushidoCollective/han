/**
 * Hooks Module
 *
 * Re-exports all hook-related functionality for cleaner imports.
 *
 * @example
 * import { testHooks, loadPluginConfig, checkForChanges } from './hooks';
 */

// Checkpoint management
export {
	type Checkpoint,
	type CheckpointInfo,
	captureCheckpoint,
	captureCheckpointAsync,
	cleanupOldCheckpoints,
	cleanupOrphanedBlobs,
	collectIfChangedPatterns,
	getBlobDir,
	getBlobPath,
	getCheckpointAsync,
	getCheckpointDir,
	getCheckpointPath,
	getProjectSlug,
	getProjectsBaseDir,
	hasChangedSinceCheckpoint,
	hasChangedSinceCheckpointAsync,
	listCheckpoints,
	listCheckpointsAsync,
	loadCheckpoint,
	readBlob,
	restoreFromCheckpointAsync,
	storeBlob,
} from "./checkpoint.ts";
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
	getHookConfigs,
	getHookDefinition,
	listAvailableHooks,
	loadPluginConfig,
	loadUserConfig,
	type PluginConfig,
	type PluginHookDefinition,
	type PluginMemoryConfig,
	type ResolvedHookConfig,
	type UserConfig,
	type UserHookOverride,
} from "./hook-config.ts";
// UI Components
export { HookExplainUI, type HookSource } from "./hook-explain-ui.tsx";
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
// Testing
export {
	type LiveOutputState,
	makeLiveOutputKey,
	type TestHooksOptions,
	testHooks,
} from "./hook-test.ts";
export { HookTestUI } from "./hook-test-ui.tsx";
// Transcript filtering
export {
	buildCommandWithFiles,
	clearTranscriptCache,
	commandUsesSessionFiles,
	getSessionFilteredFiles,
	getTranscriptModifiedFiles,
	HAN_FILES_TEMPLATE,
	hasSessionModifiedPatternFiles,
	type TranscriptModifiedFiles,
} from "./transcript-filter.ts";
