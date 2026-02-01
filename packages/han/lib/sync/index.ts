/**
 * Data Synchronization Module
 *
 * Provides functionality for syncing session data from local han instances
 * to the hosted team platform.
 *
 * @example
 * import { sync, getStatus, enqueueSyncSession } from './sync';
 *
 * // Check sync status
 * const status = await getStatus();
 * console.log(`Pending: ${status.pendingSessions} sessions`);
 *
 * // Trigger sync for a session
 * enqueueSyncSession('session-123');
 *
 * // Manually sync all pending data
 * const result = await sync();
 * console.log(`Synced ${result.messagesProcessed} messages`);
 */

// Types
export type {
	SyncConfig,
	SyncCursor,
	SyncDelta,
	SyncEligibility,
	SyncError,
	SyncMessage,
	SyncPayload,
	SyncQueueItem,
	SyncResponse,
	SyncResult,
	SyncSession,
	SyncState,
	SyncTask,
} from "./types.ts";

export { SYNC_PROTOCOL_VERSION, DEFAULT_SYNC_CONFIG } from "./types.ts";

// Privacy filtering
export {
	checkSyncEligibility,
	checkBatchEligibility,
	getEligibilitySummary,
	isPersonalRepo,
	matchesPattern,
	parseGitRemote,
} from "./privacy-filter.ts";

// Queue management
export {
	calculateBackoff,
	getQueueManager,
	getSyncStatePath,
	loadSyncState,
	saveSyncState,
	SyncQueueManager,
} from "./queue.ts";

// Delta calculation
export {
	calculateDelta,
	calculateSessionOnlyDelta,
	getSyncStatus,
	hashContent,
	messageToSyncFormat,
} from "./delta.ts";

// Client operations
export {
	buildSyncPayload,
	compressPayload,
	decompressResponse,
	enqueuePendingSessions,
	enqueueSyncSession,
	getStatus,
	processQueue,
	sync,
} from "./client.ts";
