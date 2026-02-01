/**
 * Data Synchronization Types
 *
 * Defines the types and interfaces for syncing session data
 * from local han instances to the hosted team platform.
 */

/**
 * Sync protocol version
 * Increment when making breaking changes to payload format
 */
export const SYNC_PROTOCOL_VERSION = "1.0";

/**
 * Cursor for tracking sync progress
 * Used for incremental syncing to avoid re-sending data
 */
export interface SyncCursor {
	/** Last session ID that was fully synced */
	lastSessionId: string | null;
	/** Last message line number synced for current session */
	lastMessageLineNumber: number;
	/** Timestamp of last successful sync */
	lastSyncTimestamp: string;
}

/**
 * Task data for sync payload
 */
export interface SyncTask {
	id: string;
	taskId: string;
	subject: string;
	description: string | null;
	status: "pending" | "in_progress" | "completed";
	createdAt: string;
	updatedAt: string;
}

/**
 * Message data for sync payload
 * Simplified structure focusing on essential fields
 */
export interface SyncMessage {
	id: string;
	lineNumber: number;
	messageType: string;
	timestamp: string;
	/** Content hash for deduplication (not full content for privacy) */
	contentHash: string;
	/** Full content - only included if privacy settings allow */
	content?: string;
	/** Token usage if available */
	inputTokens: number | null;
	outputTokens: number | null;
	cacheReadTokens: number | null;
	cacheCreationTokens: number | null;
}

/**
 * Session data for sync payload
 */
export interface SyncSession {
	id: string;
	projectSlug: string;
	repoRemote: string;
	status: string;
	slug: string | null;
	messages: SyncMessage[];
	tasks: SyncTask[];
	lastModified: string;
	/** Total message count for validation */
	totalMessageCount: number;
}

/**
 * Main sync payload sent to the server
 */
export interface SyncPayload {
	version: typeof SYNC_PROTOCOL_VERSION;
	clientId: string;
	userId: string;
	timestamp: string;
	cursor: SyncCursor;
	sessions: SyncSession[];
	/** SHA256 checksum of the payload for integrity verification */
	checksum: string;
}

/**
 * Error information from sync operation
 */
export interface SyncError {
	sessionId: string;
	code: string;
	message: string;
}

/**
 * Response from the sync endpoint
 */
export interface SyncResponse {
	status: "success" | "partial" | "error";
	cursor: SyncCursor;
	/** Number of sessions processed successfully */
	processed: number;
	/** Number of messages processed */
	messagesProcessed: number;
	errors: SyncError[];
	/** Server timestamp */
	serverTimestamp: string;
}

/**
 * Queue item for pending sync operations
 */
export interface SyncQueueItem {
	id: string;
	sessionId: string;
	priority: "high" | "normal" | "low";
	createdAt: string;
	attempts: number;
	lastAttempt: string | null;
	nextRetry: string | null;
	error: string | null;
	status: "pending" | "in_progress" | "completed" | "failed";
}

/**
 * Sync state persisted to disk
 */
export interface SyncState {
	/** Unique client identifier */
	clientId: string;
	/** Global sync cursor */
	cursor: SyncCursor;
	/** Per-session sync cursors for incremental sync */
	sessionCursors: Record<string, SyncCursor>;
	/** Last full sync timestamp */
	lastFullSync: string | null;
	/** Queue of pending sync items */
	queue: SyncQueueItem[];
	/** Statistics */
	stats: {
		totalSynced: number;
		lastSyncDuration: number | null;
		failedAttempts: number;
		successfulSyncs: number;
	};
}

/**
 * Result of a sync eligibility check
 */
export interface SyncEligibility {
	eligible: boolean;
	reason: string;
	repoType: "personal" | "organization" | "unknown";
	repoOwner: string | null;
}

/**
 * Configuration for sync operation
 * Extends the config from han-settings.ts
 */
export interface SyncConfig {
	/** Whether sync is enabled */
	enabled: boolean;
	/** Sync server endpoint */
	endpoint: string;
	/** API key for authentication */
	apiKey: string;
	/** Sync interval in seconds (default: 300) */
	interval: number;
	/** Maximum messages per batch (default: 1000) */
	batchSize: number;
	/** Include personal repos (default: false) */
	includePersonal: boolean;
	/** Force include specific repos by remote URL pattern */
	forceInclude: string[];
	/** Force exclude specific repos by remote URL pattern */
	forceExclude: string[];
	/** Include full message content (default: false for privacy) */
	includeContent: boolean;
	/** Compression enabled (default: true) */
	compression: boolean;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
	enabled: false,
	endpoint: "",
	apiKey: "",
	interval: 300,
	batchSize: 1000,
	includePersonal: false,
	forceInclude: [],
	forceExclude: [],
	includeContent: false,
	compression: true,
};

/**
 * Delta calculation result
 */
export interface SyncDelta {
	/** Sessions with new data to sync */
	sessions: SyncSession[];
	/** Updated cursor after processing */
	newCursor: SyncCursor;
	/** Number of new messages */
	newMessageCount: number;
	/** Whether there's more data to sync */
	hasMore: boolean;
}

/**
 * Sync operation result
 */
export interface SyncResult {
	success: boolean;
	sessionsProcessed: number;
	messagesProcessed: number;
	bytesTransferred: number;
	durationMs: number;
	error?: string;
	response?: SyncResponse;
}
