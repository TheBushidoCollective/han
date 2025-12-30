/**
 * Unified Data Store - Single Source of Truth
 *
 * This module is the ONLY interface for all data access in Han.
 * All systems (MCP, Browse, Hooks, etc.) MUST use this interface.
 *
 * Architecture:
 * - SQLite backend via han-native for persistence (WAL mode for concurrent reads)
 * - FTS5 for full-text search, sqlite-vec for vector similarity
 * - Coordinator pattern: one process indexes JSONL → SQLite
 * - All reads go through this interface (never direct file access)
 * - All writes go through this interface
 *
 * Storage location: ~/.claude/han/han.db
 *
 * Lazy Start Pattern:
 * - SQLite operations work directly without coordinator
 * - Operations needing fresh indexed data use withFreshData()
 * - Coordinator starts automatically when needed
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getClaudeConfigDir } from "../config/index.ts";
import { getNativeModule } from "../native.ts";

// ============================================================================
// Type Exports - All types come from native module
// ============================================================================

export type {
	// Checkpoints
	Checkpoint,
	CheckpointInput,
	// Coordinator
	CoordinatorStatus,
	// Frustration tracking
	FrustrationEvent,
	FrustrationEventInput,
	FrustrationMetrics,
	// Search
	FtsSearchResult,
	// Hook cache
	HookCacheEntry,
	HookCacheInput,
	// Hook execution tracking
	HookExecution,
	HookExecutionInput,
	HookStats,
	LockInfo,
	// Marketplace
	MarketplacePlugin,
	MarketplacePluginInput,
	Message,
	MessageBatch,
	MessageInput,
	Project,
	ProjectInput,
	// Core entities
	Repo,
	RepoInput,
	Session,
	// Session file changes
	SessionFileChange,
	SessionFileChangeInput,
	SessionInput,
	// Session timestamps
	SessionTimestamps,
	// Task/Metrics
	Task,
	TaskCompletion,
	TaskFailure,
	TaskInput,
	TaskMetrics,
	VectorSearchResult,
} from "../../../han-native";

// ============================================================================
// Database Initialization
// ============================================================================

let _dbPath: string | null = null;
let _initialized = false;

/**
 * Get the SQLite database file path
 * Stored in CLAUDE_CONFIG_DIR/han/han.db
 */
export function getDbPath(): string {
	if (_dbPath) return _dbPath;

	const configDir = getClaudeConfigDir();
	if (!configDir) {
		throw new Error(
			"Could not determine Claude config directory. Set CLAUDE_CONFIG_DIR or HOME environment variable.",
		);
	}

	const hanDir = join(configDir, "han");
	if (!existsSync(hanDir)) {
		mkdirSync(hanDir, { recursive: true });
	}

	_dbPath = join(hanDir, "han.db");
	return _dbPath;
}

/**
 * Initialize the database and schema
 * Call this once at startup to ensure tables and indexes exist
 * Note: Schema is auto-applied when database is opened (SQLite)
 */
export async function initDb(): Promise<void> {
	if (_initialized) return;

	const dbPath = getDbPath();
	const native = getNativeModule();

	// dbInit auto-applies schema on first access
	native.dbInit(dbPath);

	_initialized = true;
}

/**
 * Ensure database is initialized before operations
 */
async function ensureInitialized(): Promise<string> {
	await initDb();
	return getDbPath();
}

// ============================================================================
// Coordinator Lazy Start
// ============================================================================

let _coordinatorStarting = false;
let _coordinatorStartPromise: Promise<void> | null = null;

/**
 * Check if coordinator daemon is running
 * Uses health check to verify the coordinator is responsive
 */
export async function isCoordinatorRunning(): Promise<boolean> {
	try {
		// Dynamic import to avoid circular dependencies
		const { checkHealth } = await import("../commands/coordinator/health.ts");
		const health = await checkHealth();
		return health?.status === "ok";
	} catch {
		return false;
	}
}

/**
 * Start the coordinator daemon if not already running
 * Returns immediately if coordinator is already starting or running
 *
 * @param timeout Maximum time to wait for coordinator to start (default: 5000ms)
 */
export async function startCoordinatorIfNeeded(
	timeout = 5000,
): Promise<boolean> {
	// Quick check if already running
	if (await isCoordinatorRunning()) {
		return true;
	}

	// Prevent multiple concurrent start attempts
	if (_coordinatorStarting && _coordinatorStartPromise) {
		await _coordinatorStartPromise;
		return isCoordinatorRunning();
	}

	_coordinatorStarting = true;
	_coordinatorStartPromise = (async () => {
		try {
			// Dynamic import to avoid circular dependencies
			const { ensureCoordinator } = await import(
				"../commands/coordinator/daemon.ts"
			);

			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Coordinator start timeout")),
					timeout,
				);
			});

			// Race between coordinator start and timeout
			await Promise.race([ensureCoordinator(), timeoutPromise]);
		} catch (error) {
			// Log but don't throw - operations can continue without coordinator
			console.warn(
				`[db] Coordinator start failed: ${error instanceof Error ? error.message : error}`,
			);
		} finally {
			_coordinatorStarting = false;
			_coordinatorStartPromise = null;
		}
	})();

	await _coordinatorStartPromise;
	return isCoordinatorRunning();
}

/**
 * Execute an operation with fresh data from the coordinator
 *
 * This wrapper ensures the coordinator is running before executing the operation.
 * If the coordinator fails to start, the operation runs anyway using existing SQLite data.
 *
 * Use this for operations that benefit from up-to-date indexed data:
 * - Session listings (may have new sessions from JSONL)
 * - Message searches (may have new messages)
 *
 * @param fn The async operation to execute
 * @returns The result of the operation
 */
export async function withFreshData<T>(fn: () => Promise<T>): Promise<T> {
	// Try to ensure coordinator is running (non-blocking)
	await startCoordinatorIfNeeded();

	// Execute the operation regardless of coordinator status
	return fn();
}

/**
 * Execute an operation and retry if coordinator was down
 *
 * This wrapper attempts the operation, and if it fails with a coordinator-related
 * error, starts the coordinator and retries once.
 *
 * @param fn The async operation to execute
 * @returns The result of the operation
 */
export async function withCoordinator<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		// Check if this is a coordinator-related error
		if (isCoordinatorError(error)) {
			// Try to start coordinator
			const started = await startCoordinatorIfNeeded();
			if (started) {
				// Retry the operation once
				return fn();
			}
		}
		throw error;
	}
}

/**
 * Check if an error is coordinator-related
 * Used by withCoordinator to determine if retry is appropriate
 */
function isCoordinatorError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();
	return (
		message.includes("coordinator") ||
		message.includes("econnrefused") ||
		message.includes("connection refused") ||
		message.includes("fetch failed") ||
		message.includes("socket hang up")
	);
}

// ============================================================================
// Repo Operations
// ============================================================================

export const repos = {
	/**
	 * Create or update a repository record
	 */
	async upsert(
		input: import("../../../han-native").RepoInput,
	): Promise<import("../../../han-native").Repo> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.upsertRepo(dbPath, input);
	},

	/**
	 * Get a repository by its remote URL
	 */
	async getByRemote(
		remote: string,
	): Promise<import("../../../han-native").Repo | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getRepoByRemote(dbPath, remote);
	},

	/**
	 * List all repositories
	 */
	async list(): Promise<import("../../../han-native").Repo[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listRepos(dbPath);
	},
};

// ============================================================================
// Project Operations
// ============================================================================

export const projects = {
	/**
	 * Create or update a project record
	 */
	async upsert(
		input: import("../../../han-native").ProjectInput,
	): Promise<import("../../../han-native").Project> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.upsertProject(dbPath, input);
	},

	/**
	 * Get a project by its slug (Claude Code normalized path)
	 */
	async getBySlug(
		slug: string,
	): Promise<import("../../../han-native").Project | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getProjectBySlug(dbPath, slug);
	},

	/**
	 * Get a project by its absolute path
	 */
	async getByPath(
		path: string,
	): Promise<import("../../../han-native").Project | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getProjectByPath(dbPath, path);
	},

	/**
	 * List projects, optionally filtered by repo
	 */
	async list(
		repoId?: string,
	): Promise<import("../../../han-native").Project[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listProjects(dbPath, repoId ?? null);
	},
};

// ============================================================================
// Session Operations
// ============================================================================

export const sessions = {
	/**
	 * Create or update a session record
	 */
	async upsert(
		input: import("../../../han-native").SessionInput,
	): Promise<import("../../../han-native").Session> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.upsertSession(dbPath, input);
	},

	/**
	 * Mark a session as completed
	 */
	async end(sessionId: string): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.endSession(dbPath, sessionId);
	},

	/**
	 * Get a session by ID
	 */
	async get(
		sessionId: string,
	): Promise<import("../../../han-native").Session | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getSession(dbPath, sessionId);
	},

	/**
	 * List sessions with optional filters
	 */
	async list(options?: {
		projectId?: string;
		status?: string;
		limit?: number;
	}): Promise<import("../../../han-native").Session[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listSessions(
			dbPath,
			options?.projectId ?? null,
			options?.status ?? null,
			options?.limit ?? null,
		);
	},

	/**
	 * Reset all sessions for re-indexing
	 * Use this to backfill raw_json or other fields for existing messages
	 */
	async resetForReindex(): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.resetAllSessionsForReindex(dbPath);
	},
};

// ============================================================================
// Message Operations
// ============================================================================

export const messages = {
	/**
	 * Insert a batch of messages for a session
	 */
	async insertBatch(
		sessionId: string,
		msgs: import("../../../han-native").MessageInput[],
	): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.insertMessagesBatch(dbPath, sessionId, msgs);
	},

	/**
	 * Get a message by ID
	 */
	async get(
		messageId: string,
	): Promise<import("../../../han-native").Message | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getMessage(dbPath, messageId);
	},

	/**
	 * List messages for a session with optional filters and pagination
	 */
	async list(options: {
		sessionId: string;
		messageType?: string;
		limit?: number;
		offset?: number;
	}): Promise<import("../../../han-native").Message[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listSessionMessages(
			dbPath,
			options.sessionId,
			options.messageType ?? null,
			options.limit ?? null,
			options.offset ?? null,
		);
	},

	/**
	 * Get the count of messages for a session
	 */
	async count(sessionId: string): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getMessageCount(dbPath, sessionId);
	},

	/**
	 * Get message counts for multiple sessions in a single query
	 * Returns a map of session_id -> count
	 */
	async countBatch(sessionIds: string[]): Promise<Record<string, number>> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getMessageCountsBatch(dbPath, sessionIds);
	},

	/**
	 * Get the last indexed line number for a session
	 * Used for incremental indexing
	 */
	async getLastIndexedLine(sessionId: string): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getLastIndexedLine(dbPath, sessionId);
	},

	/**
	 * Get first/last message timestamps for multiple sessions in a single query
	 * Returns a map of session_id -> { startedAt, endedAt }
	 */
	async timestampsBatch(
		sessionIds: string[],
	): Promise<Record<string, import("../../../han-native").SessionTimestamps>> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getSessionTimestampsBatch(dbPath, sessionIds);
	},

	/**
	 * Search messages using full-text search
	 */
	async search(options: {
		query: string;
		sessionId?: string;
		limit?: number;
	}): Promise<import("../../../han-native").Message[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.searchMessages(
			dbPath,
			options.query,
			options.sessionId ?? null,
			options.limit ?? null,
		);
	},
};

// ============================================================================
// Task/Metrics Operations
// ============================================================================

export const tasks = {
	/**
	 * Create a new task record
	 */
	async create(
		input: import("../../../han-native").TaskInput,
	): Promise<import("../../../han-native").Task> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.createTask(dbPath, input);
	},

	/**
	 * Mark a task as completed with outcome
	 */
	async complete(
		completion: import("../../../han-native").TaskCompletion,
	): Promise<import("../../../han-native").Task> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.completeTask(dbPath, completion);
	},

	/**
	 * Mark a task as failed
	 */
	async fail(
		failure: import("../../../han-native").TaskFailure,
	): Promise<import("../../../han-native").Task> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.failTask(dbPath, failure);
	},

	/**
	 * Get a task by ID
	 */
	async get(
		taskId: string,
	): Promise<import("../../../han-native").Task | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getTask(dbPath, taskId);
	},

	/**
	 * Query task metrics with optional filters
	 */
	async queryMetrics(options?: {
		taskType?: string;
		outcome?: string;
		period?: "day" | "week" | "month";
	}): Promise<import("../../../han-native").TaskMetrics> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.queryTaskMetrics(
			dbPath,
			options?.taskType ?? null,
			options?.outcome ?? null,
			options?.period ?? null,
		);
	},
};

// ============================================================================
// Hook Cache Operations
// ============================================================================

export const hookCache = {
	/**
	 * Set a hook cache entry
	 */
	async set(
		input: import("../../../han-native").HookCacheInput,
	): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.setHookCache(dbPath, input);
	},

	/**
	 * Get a hook cache entry by key
	 */
	async get(
		cacheKey: string,
	): Promise<import("../../../han-native").HookCacheEntry | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getHookCache(dbPath, cacheKey);
	},

	/**
	 * Invalidate a hook cache entry
	 */
	async invalidate(cacheKey: string): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.invalidateHookCache(dbPath, cacheKey);
	},

	/**
	 * Clean up expired cache entries
	 */
	async cleanupExpired(): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.cleanupExpiredCache(dbPath);
	},
};

// ============================================================================
// Marketplace Cache Operations
// ============================================================================

export const marketplace = {
	/**
	 * Upsert a marketplace plugin entry
	 */
	async upsertPlugin(
		input: import("../../../han-native").MarketplacePluginInput,
	): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.upsertMarketplacePlugin(dbPath, input);
	},

	/**
	 * Get a marketplace plugin by ID
	 */
	async getPlugin(
		pluginId: string,
	): Promise<import("../../../han-native").MarketplacePlugin | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getMarketplacePlugin(dbPath, pluginId);
	},

	/**
	 * List marketplace plugins with optional category filter
	 */
	async listPlugins(
		category?: string,
	): Promise<import("../../../han-native").MarketplacePlugin[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listMarketplacePlugins(dbPath, category ?? null);
	},
};

// ============================================================================
// Hook Execution Operations
// ============================================================================

export const hookExecutions = {
	/**
	 * Record a hook execution
	 */
	async record(
		input: import("../../../han-native").HookExecutionInput,
	): Promise<import("../../../han-native").HookExecution> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.recordHookExecution(dbPath, input);
	},

	/**
	 * Query hook statistics
	 */
	async queryStats(
		period?: "day" | "week" | "month",
	): Promise<import("../../../han-native").HookStats> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.queryHookStats(dbPath, period ?? null);
	},
};

// ============================================================================
// Frustration Event Operations
// ============================================================================

export const frustrations = {
	/**
	 * Record a frustration event
	 */
	async record(
		input: import("../../../han-native").FrustrationEventInput,
	): Promise<import("../../../han-native").FrustrationEvent> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.recordFrustration(dbPath, input);
	},

	/**
	 * Query frustration metrics
	 * @param totalTasks Total number of tasks for calculating rates
	 */
	async queryMetrics(
		totalTasks: number,
		period?: "day" | "week" | "month",
	): Promise<import("../../../han-native").FrustrationMetrics> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.queryFrustrationMetrics(dbPath, period ?? null, totalTasks);
	},
};

// ============================================================================
// Checkpoint Operations
// ============================================================================

export const checkpoints = {
	/**
	 * Create a checkpoint for a file
	 */
	async create(
		input: import("../../../han-native").CheckpointInput,
	): Promise<import("../../../han-native").Checkpoint> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.createCheckpoint(dbPath, input);
	},

	/**
	 * Get a checkpoint by session and file path
	 */
	async get(
		sessionId: string,
		filePath: string,
	): Promise<import("../../../han-native").Checkpoint | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getCheckpoint(dbPath, sessionId, filePath);
	},

	/**
	 * List all checkpoints for a session
	 */
	async list(
		sessionId: string,
	): Promise<import("../../../han-native").Checkpoint[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listCheckpoints(dbPath, sessionId);
	},
};

// ============================================================================
// Session File Change Operations
// ============================================================================

export const sessionFileChanges = {
	/**
	 * Record a file change in a session
	 */
	async record(
		input: import("../../../han-native").SessionFileChangeInput,
	): Promise<import("../../../han-native").SessionFileChange> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.recordFileChange(dbPath, input);
	},

	/**
	 * List all file changes for a session
	 */
	async list(
		sessionId: string,
	): Promise<import("../../../han-native").SessionFileChange[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getSessionFileChanges(dbPath, sessionId);
	},

	/**
	 * Check if a session has any file changes
	 * Useful for determining if hooks need to run
	 */
	async hasChanges(sessionId: string): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.hasSessionChanges(dbPath, sessionId);
	},
};

// ============================================================================
// FTS Operations
// ============================================================================

export const fts = {
	/**
	 * Index documents for full-text search
	 */
	async index(
		tableName: string,
		documents: import("../../../han-native").FtsDocument[],
	): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.ftsIndex(dbPath, tableName, documents);
	},

	/**
	 * Search documents using BM25
	 */
	async search(
		tableName: string,
		query: string,
		limit?: number,
	): Promise<import("../../../han-native").FtsSearchResult[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.ftsSearch(dbPath, tableName, query, limit ?? null);
	},

	/**
	 * Delete documents by ID
	 */
	async delete(tableName: string, ids: string[]): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.ftsDelete(dbPath, tableName, ids);
	},
};

// ============================================================================
// Vector Operations
// ============================================================================

export const vectors = {
	/**
	 * Index documents with vectors
	 */
	async index(
		tableName: string,
		documents: import("../../../han-native").VectorDocumentInput[],
	): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.vectorIndex(dbPath, tableName, documents);
	},

	/**
	 * Search documents using vector similarity
	 */
	async search(
		tableName: string,
		queryVector: number[],
		limit?: number,
	): Promise<import("../../../han-native").VectorSearchResult[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.vectorSearch(dbPath, tableName, queryVector, limit ?? null);
	},
};

// ============================================================================
// Coordinator Operations (Single-Instance Pattern)
// ============================================================================

export const coordinator = {
	/**
	 * Try to acquire the coordinator lock
	 * Returns true if this process became the coordinator
	 */
	tryAcquire(): boolean {
		const native = getNativeModule();
		return native.tryAcquireCoordinatorLock();
	},

	/**
	 * Release the coordinator lock
	 */
	release(): boolean {
		const native = getNativeModule();
		return native.releaseCoordinatorLock();
	},

	/**
	 * Update coordinator heartbeat (call periodically while coordinating)
	 */
	updateHeartbeat(): boolean {
		const native = getNativeModule();
		return native.updateCoordinatorHeartbeat();
	},

	/**
	 * Get current coordinator status
	 */
	getStatus(): import("../../../han-native").CoordinatorStatus {
		const native = getNativeModule();
		return native.getCoordinatorStatus();
	},

	/**
	 * Check if this process is the coordinator
	 */
	isCoordinator(): boolean {
		const native = getNativeModule();
		return native.isCoordinator();
	},

	/**
	 * Get the heartbeat interval in seconds
	 */
	getHeartbeatInterval(): number {
		const native = getNativeModule();
		return native.getHeartbeatInterval();
	},

	/**
	 * Get the stale lock timeout in seconds
	 */
	getStaleLockTimeout(): number {
		const native = getNativeModule();
		return native.getStaleLockTimeout();
	},
};

// ============================================================================
// File Watcher Operations
// ============================================================================

export const watcher = {
	/**
	 * Start watching the Claude projects directory for JSONL changes
	 */
	async start(watchPath?: string): Promise<boolean> {
		const native = getNativeModule();
		return native.startFileWatcher(watchPath ?? null);
	},

	/**
	 * Stop the file watcher
	 */
	stop(): boolean {
		const native = getNativeModule();
		return native.stopFileWatcher();
	},

	/**
	 * Check if the file watcher is running
	 */
	isRunning(): boolean {
		const native = getNativeModule();
		return native.isWatcherRunning();
	},

	/**
	 * Get the default watch path (~/.claude/projects)
	 */
	getDefaultPath(): string {
		const native = getNativeModule();
		return native.getDefaultWatchPath();
	},

	/**
	 * Poll for index results from background watcher
	 * Returns results and clears the queue
	 * @deprecated Use setCallback for event-driven updates instead
	 */
	pollResults(): IndexResult[] {
		const native = getNativeModule();
		return native.pollIndexResults();
	},

	/**
	 * Set a callback to be notified of new index results instantly
	 * This replaces polling with event-driven updates
	 */
	setCallback(callback: (result: IndexResult) => void): void {
		const native = getNativeModule();
		native.setIndexCallback(callback);
	},

	/**
	 * Clear the callback (revert to polling mode)
	 */
	clearCallback(): void {
		const native = getNativeModule();
		native.clearIndexCallback();
	},
};

// ============================================================================
// Legacy Function Exports (for backward compatibility)
// These will be deprecated in favor of the namespaced API above
// ============================================================================

// Repo operations
export async function upsertRepo(
	input: import("../../../han-native").RepoInput,
): Promise<import("../../../han-native").Repo> {
	return repos.upsert(input);
}

export async function getRepoByRemote(
	remote: string,
): Promise<import("../../../han-native").Repo | null> {
	return repos.getByRemote(remote);
}

export async function listRepos(): Promise<
	import("../../../han-native").Repo[]
> {
	return repos.list();
}

// Project operations
export async function upsertProject(
	input: import("../../../han-native").ProjectInput,
): Promise<import("../../../han-native").Project> {
	return projects.upsert(input);
}

export async function getProjectBySlug(
	slug: string,
): Promise<import("../../../han-native").Project | null> {
	return projects.getBySlug(slug);
}

export async function getProjectByPath(
	path: string,
): Promise<import("../../../han-native").Project | null> {
	return projects.getByPath(path);
}

export async function listProjects(
	repoId?: string,
): Promise<import("../../../han-native").Project[]> {
	return projects.list(repoId);
}

// Session operations
export async function upsertSession(
	input: import("../../../han-native").SessionInput,
): Promise<import("../../../han-native").Session> {
	return sessions.upsert(input);
}

export async function endSession(sessionId: string): Promise<boolean> {
	return sessions.end(sessionId);
}

export async function getSession(
	sessionId: string,
): Promise<import("../../../han-native").Session | null> {
	return sessions.get(sessionId);
}

export async function listSessions(options?: {
	projectId?: string;
	status?: string;
	limit?: number;
}): Promise<import("../../../han-native").Session[]> {
	return sessions.list(options);
}

// Message operations
export async function insertMessagesBatch(
	sessionId: string,
	msgs: import("../../../han-native").MessageInput[],
): Promise<number> {
	return messages.insertBatch(sessionId, msgs);
}

export async function getMessage(
	messageId: string,
): Promise<import("../../../han-native").Message | null> {
	return messages.get(messageId);
}

export async function listSessionMessages(options: {
	sessionId: string;
	messageType?: string;
	limit?: number;
	offset?: number;
}): Promise<import("../../../han-native").Message[]> {
	return messages.list(options);
}

export async function getMessageCount(sessionId: string): Promise<number> {
	return messages.count(sessionId);
}

export async function getLastIndexedLine(sessionId: string): Promise<number> {
	return messages.getLastIndexedLine(sessionId);
}

export async function searchMessages(options: {
	query: string;
	sessionId?: string;
	limit?: number;
}): Promise<import("../../../han-native").Message[]> {
	return messages.search(options);
}

// Task operations
export async function createTask(
	input: import("../../../han-native").TaskInput,
): Promise<import("../../../han-native").Task> {
	return tasks.create(input);
}

export async function completeTask(
	completion: import("../../../han-native").TaskCompletion,
): Promise<import("../../../han-native").Task> {
	return tasks.complete(completion);
}

export async function failTask(
	failure: import("../../../han-native").TaskFailure,
): Promise<import("../../../han-native").Task> {
	return tasks.fail(failure);
}

export async function getTask(
	taskId: string,
): Promise<import("../../../han-native").Task | null> {
	return tasks.get(taskId);
}

export async function queryTaskMetrics(options?: {
	taskType?: string;
	outcome?: string;
	period?: "day" | "week" | "month";
}): Promise<import("../../../han-native").TaskMetrics> {
	return tasks.queryMetrics(options);
}

// Hook cache operations
export async function setHookCache(
	input: import("../../../han-native").HookCacheInput,
): Promise<boolean> {
	return hookCache.set(input);
}

export async function getHookCache(
	cacheKey: string,
): Promise<import("../../../han-native").HookCacheEntry | null> {
	return hookCache.get(cacheKey);
}

export async function invalidateHookCache(cacheKey: string): Promise<boolean> {
	return hookCache.invalidate(cacheKey);
}

export async function cleanupExpiredCache(): Promise<number> {
	return hookCache.cleanupExpired();
}

// Marketplace operations
export async function upsertMarketplacePlugin(
	input: import("../../../han-native").MarketplacePluginInput,
): Promise<boolean> {
	return marketplace.upsertPlugin(input);
}

export async function getMarketplacePlugin(
	pluginId: string,
): Promise<import("../../../han-native").MarketplacePlugin | null> {
	return marketplace.getPlugin(pluginId);
}

export async function listMarketplacePlugins(
	category?: string,
): Promise<import("../../../han-native").MarketplacePlugin[]> {
	return marketplace.listPlugins(category);
}

// Coordinator operations
export function tryAcquireCoordinatorLock(): boolean {
	return coordinator.tryAcquire();
}

export function releaseCoordinatorLock(): boolean {
	return coordinator.release();
}

export function updateCoordinatorHeartbeat(): boolean {
	return coordinator.updateHeartbeat();
}

export function getCoordinatorStatus(): import("../../../han-native").CoordinatorStatus {
	return coordinator.getStatus();
}

export function isCoordinator(): boolean {
	return coordinator.isCoordinator();
}

export function getHeartbeatInterval(): number {
	return coordinator.getHeartbeatInterval();
}

export function getStaleLockTimeout(): number {
	return coordinator.getStaleLockTimeout();
}

// Watcher operations
export async function startFileWatcher(watchPath?: string): Promise<boolean> {
	return watcher.start(watchPath);
}

export function stopFileWatcher(): boolean {
	return watcher.stop();
}

export function isWatcherRunning(): boolean {
	return watcher.isRunning();
}

export function getDefaultWatchPath(): string {
	return watcher.getDefaultPath();
}

// FTS/Vector pass-through (for existing code)
export {
	ftsDelete,
	ftsIndex,
	ftsSearch,
	vectorIndex,
	vectorSearch,
} from "../../../han-native";

// ============================================================================
// Indexer Operations (Coordinator Only)
// ============================================================================
//
// These operations are used by the coordinator to index JSONL files into the database.
// The JSONL parsing happens entirely in Rust - TypeScript only triggers the indexing.
//

export interface IndexResult {
	sessionId: string;
	messagesIndexed: number;
	totalMessages: number;
	isNewSession: boolean;
	error?: string;
}

export const indexer = {
	/**
	 * Index a single JSONL session file incrementally
	 * Only processes lines after the last indexed line
	 * Task association for sentiment events is loaded from SQLite automatically
	 * COORDINATOR USE ONLY
	 */
	async indexSessionFile(filePath: string): Promise<IndexResult> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.indexSessionFile(dbPath, filePath);
	},

	/**
	 * Index all JSONL files in a project directory
	 * COORDINATOR USE ONLY
	 */
	async indexProjectDirectory(projectDir: string): Promise<IndexResult[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.indexProjectDirectory(dbPath, projectDir);
	},

	/**
	 * Handle a file event from the watcher
	 * COORDINATOR USE ONLY
	 */
	async handleFileEvent(
		eventType: import("../../../han-native").FileEventType,
		filePath: string,
		sessionId?: string,
		projectPath?: string,
	): Promise<IndexResult | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.handleFileEvent(
			dbPath,
			eventType,
			filePath,
			sessionId ?? null,
			projectPath ?? null,
		);
	},

	/**
	 * Perform a full scan and index of all Claude Code sessions
	 * Should be called on coordinator startup
	 * COORDINATOR USE ONLY
	 */
	async fullScanAndIndex(): Promise<IndexResult[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.fullScanAndIndex(dbPath);
	},
};

// Export FileEventType for use with handleFileEvent
export { FileEventType } from "../../../han-native";

// ============================================================================
// Note on JSONL Access
// ============================================================================
//
// JSONL file operations are intentionally NOT exported here.
// They are internal to the han-native Rust package where the coordinator
// indexes JSONL files into SQLite.
//
// All session/message access from TypeScript should go through:
// - sessions.list(), sessions.get()
// - messages.list(), messages.get(), messages.search()
//
// The coordinator (Rust) handles: JSONL watching → parsing → indexing to SQLite
// The browse UI (TypeScript) reads from: SQLite only
//
