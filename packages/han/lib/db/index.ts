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
// Import directly from claude-settings to avoid circular dependency
// (config/index.ts -> validation/index.ts -> db/index.ts)
import { getClaudeConfigDir } from "../config/claude-settings.ts";
import { getNativeModule } from "../native.ts";

// ============================================================================
// Type Exports - All types come from native module
// ============================================================================

export type {
	// Coordinator
	CoordinatorStatus,
	// Frustration tracking
	FrustrationEvent,
	FrustrationEventInput,
	FrustrationMetrics,
	// Search
	FtsSearchResult,
	// Hook execution tracking
	HookAttemptInfo,
	HookExecution,
	HookExecutionInput,
	HookStats,
	LockInfo,
	Message,
	MessageBatch,
	MessageInput,
	// Pending hook operations
	PendingHookInput,
	Project,
	ProjectInput,
	// Core entities
	Repo,
	RepoInput,
	Session,
	// Session file changes
	SessionFileChange,
	SessionFileChangeInput,
	// Session file validations
	SessionFileValidation,
	SessionFileValidationInput,
	SessionInput,
	// Session timestamps
	SessionTimestamps,
	// Session todos
	SessionTodos,
	SessionTodosInput,
	// Task/Metrics
	Task,
	TaskCompletion,
	TaskFailure,
	TaskInput,
	TaskMetrics,
	TodoItem,
	VectorSearchResult,
} from "../../../han-native";

// ============================================================================
// Database Initialization
// ============================================================================

let _dbPath: string | null = null;
let _initialized = false;

/**
 * Reset the cached database state
 * TESTING ONLY - do not use in production code
 * @internal
 */
export function _resetDbState(): void {
	_dbPath = null;
	_initialized = false;
}

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
	// Try to ensure coordinator is running (2s timeout to prevent slow startups)
	await startCoordinatorIfNeeded(2000);

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
	 *
	 * @param options.agentIdFilter - Filter by agent:
	 *   - undefined/null: All messages (no agent filtering)
	 *   - "": Main conversation only (messages with no agent_id)
	 *   - "abc12345": Specific agent's messages only
	 */
	async list(options: {
		sessionId: string;
		messageType?: string;
		agentIdFilter?: string | null;
		limit?: number;
		offset?: number;
	}): Promise<import("../../../han-native").Message[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.listSessionMessages(
			dbPath,
			options.sessionId,
			options.messageType ?? null,
			options.agentIdFilter ?? null,
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
// Hook Cache Operations (Legacy - for backward compatibility with hook-cache.ts)
// These are stubs that always return cache miss - real caching uses sessionFileValidations
// ============================================================================

export interface HookCacheEntry {
	cacheKey: string;
	fileHash: string;
	result: string;
}

export interface HookCacheInput {
	cacheKey: string;
	fileHash: string;
	result: string;
	ttlSeconds: number;
}

/**
 * Get hook cache entry by key
 * @deprecated Use sessionFileValidations for caching - this always returns null
 */
export async function getHookCache(
	_cacheKey: string,
): Promise<HookCacheEntry | null> {
	// Stub - always returns cache miss, caching handled by sessionFileValidations
	return null;
}

/**
 * Set hook cache entry
 * @deprecated Use sessionFileValidations for caching - this is a no-op
 */
export async function setHookCache(_input: HookCacheInput): Promise<boolean> {
	// Stub - no-op, caching handled by sessionFileValidations
	return false;
}

// ============================================================================
// NOTE: Marketplace Cache Operations removed - not used
// ============================================================================

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
// Hook Attempt Tracking Operations (for deferred execution)
// ============================================================================

export const hookAttempts = {
	/**
	 * Get or create hook attempt info for tracking consecutive failures
	 * Uses (session_id, plugin, hook_name, directory) as the unique key
	 */
	getOrCreate(
		sessionId: string,
		plugin: string,
		hookName: string,
		directory: string,
	): import("../../../han-native").HookAttemptInfo {
		const native = getNativeModule();
		return native.getOrCreateHookAttempt(
			sessionId,
			plugin,
			hookName,
			directory,
		);
	},

	/**
	 * Increment consecutive_failures for a hook, returns updated info with is_stuck flag
	 */
	increment(
		sessionId: string,
		plugin: string,
		hookName: string,
		directory: string,
	): import("../../../han-native").HookAttemptInfo {
		const native = getNativeModule();
		return native.incrementHookFailures(sessionId, plugin, hookName, directory);
	},

	/**
	 * Reset consecutive_failures to 0 (on success)
	 */
	reset(
		sessionId: string,
		plugin: string,
		hookName: string,
		directory: string,
	): void {
		const native = getNativeModule();
		native.resetHookFailures(sessionId, plugin, hookName, directory);
	},

	/**
	 * Increase max_attempts for a hook (user override via MCP tool)
	 */
	increaseMaxAttempts(
		sessionId: string,
		plugin: string,
		hookName: string,
		directory: string,
		increase: number,
	): void {
		const native = getNativeModule();
		native.increaseHookMaxAttempts(
			sessionId,
			plugin,
			hookName,
			directory,
			increase,
		);
	},
};

// ============================================================================
// Orchestration Operations (group hook executions by orchestrate run)
// ============================================================================

export const orchestrations = {
	/**
	 * Create a new orchestration, cancelling any existing running orchestration for the same session
	 */
	create(
		input: import("../../../han-native").OrchestrationInput,
	): import("../../../han-native").Orchestration {
		const native = getNativeModule();
		return native.createOrchestration(input);
	},

	/**
	 * Get an orchestration by ID
	 */
	get(id: string): import("../../../han-native").Orchestration | null {
		const native = getNativeModule();
		return native.getOrchestration(id) ?? null;
	},

	/**
	 * Update an orchestration's counters and status
	 */
	update(update: import("../../../han-native").OrchestrationUpdate): void {
		const native = getNativeModule();
		native.updateOrchestration(update);
	},

	/**
	 * Cancel an orchestration and all its pending/running hooks
	 */
	cancel(id: string): void {
		const native = getNativeModule();
		native.cancelOrchestration(id);
	},

	/**
	 * Get all hooks for an orchestration
	 */
	getHooks(
		orchestrationId: string,
	): import("../../../han-native").HookExecution[] {
		const native = getNativeModule();
		return native.getOrchestrationHooks(orchestrationId);
	},
};

// ============================================================================
// Pending Hooks Queue (for --check mode orchestrations)
// ============================================================================

export const pendingHooks = {
	/**
	 * Queue a hook for later execution during --wait
	 */
	queue(input: import("../../../han-native").QueuedHookInput): string {
		const native = getNativeModule();
		return native.queueHook(input);
	},

	/**
	 * Get all queued hooks for an orchestration
	 */
	list(orchestrationId: string): import("../../../han-native").QueuedHook[] {
		const native = getNativeModule();
		return native.getQueuedHooks(orchestrationId);
	},

	/**
	 * Delete queued hooks after they've been executed
	 */
	delete(orchestrationId: string): number {
		const native = getNativeModule();
		return native.deleteQueuedHooks(orchestrationId);
	},
};

// ============================================================================
// Deferred Hook Operations (for background execution)
// ============================================================================

export const deferredHooks = {
	/**
	 * Queue a pending hook for background execution
	 * Returns the new hook execution ID
	 */
	queue(input: import("../../../han-native").PendingHookInput): string {
		const native = getNativeModule();
		return native.queuePendingHook(input);
	},

	/**
	 * Get all pending hooks ready to run (coordinator picks these up)
	 */
	getAll(): import("../../../han-native").HookExecution[] {
		const native = getNativeModule();
		return native.getPendingHooks();
	},

	/**
	 * Get pending/running/failed hooks for a specific session (legacy)
	 */
	getForSession(
		sessionId: string,
	): import("../../../han-native").HookExecution[] {
		const native = getNativeModule();
		return native.getSessionPendingHooks(sessionId);
	},

	/**
	 * Update hook execution status
	 */
	updateStatus(
		id: string,
		status: "pending" | "running" | "completed" | "failed" | "cancelled",
	): void {
		const native = getNativeModule();
		native.updateHookStatus(id, status);
	},

	/**
	 * Complete a hook execution (update status, output, error, duration)
	 */
	complete(
		id: string,
		success: boolean,
		output: string | null,
		error: string | null,
		durationMs: number,
	): void {
		const native = getNativeModule();
		// Convert null to undefined for Rust Option<String>
		native.completeHookExecution(
			id,
			success,
			output ?? undefined,
			error ?? undefined,
			durationMs,
		);
	},

	/**
	 * Mark a hook as failed with an error message
	 * Used for stale hook detection when the owning process is no longer running
	 */
	fail(id: string, errorMessage: string): void {
		const native = getNativeModule();
		native.failHookExecution(id, errorMessage);
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
// NOTE: Checkpoint Operations removed - not used
// ============================================================================

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
// Session File Validation Operations
// ============================================================================

export const sessionFileValidations = {
	/**
	 * Record a file validation (upserts based on session/file/plugin/hook/directory)
	 * Call this after a successful hook run to track which files have been validated
	 */
	async record(
		input: import("../../../han-native").SessionFileValidationInput,
	): Promise<import("../../../han-native").SessionFileValidation> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.recordFileValidation(dbPath, input);
	},

	/**
	 * Get a specific file validation
	 */
	async get(
		sessionId: string,
		filePath: string,
		pluginName: string,
		hookName: string,
		directory: string,
	): Promise<import("../../../han-native").SessionFileValidation | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getFileValidation(
			dbPath,
			sessionId,
			filePath,
			pluginName,
			hookName,
			directory,
		);
	},

	/**
	 * Get all validations for a session and plugin/hook/directory combo
	 */
	async list(
		sessionId: string,
		pluginName: string,
		hookName: string,
		directory: string,
	): Promise<import("../../../han-native").SessionFileValidation[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getSessionValidations(
			dbPath,
			sessionId,
			pluginName,
			hookName,
			directory,
		);
	},

	/**
	 * Check if files need validation (any changed since last validation or command changed)
	 * Use this to skip re-running hooks when files haven't changed
	 */
	async needsValidation(
		sessionId: string,
		pluginName: string,
		hookName: string,
		directory: string,
		commandHash: string,
	): Promise<boolean> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.needsValidation(
			dbPath,
			sessionId,
			pluginName,
			hookName,
			directory,
			commandHash,
		);
	},

	/**
	 * Get ALL validations for a session (not filtered by plugin/hook)
	 * Useful for showing validation status across all hooks for file changes
	 */
	async listAll(
		sessionId: string,
	): Promise<import("../../../han-native").SessionFileValidation[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getAllSessionValidations(dbPath, sessionId);
	},

	/**
	 * Get files this session modified along with their validation status.
	 * Used for stale detection in checkFilesNeedValidation.
	 */
	async getFilesForValidation(
		sessionId: string,
		pluginName: string,
		hookName: string,
		directory: string,
	): Promise<import("../../../han-native").FileValidationStatus[]> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getFilesForValidation(
			dbPath,
			sessionId,
			pluginName,
			hookName,
			directory,
		);
	},

	/**
	 * Check which files need validation using stale detection.
	 * Returns list of files that need validation, filtering out:
	 * 1. Files that are stale (modified by another session)
	 * 2. Files that have already been validated in current state
	 *
	 * @param sessionId - The current session ID
	 * @param pluginName - Plugin name
	 * @param hookName - Hook name
	 * @param directory - Directory being validated
	 * @param commandHash - Hash of the command being run
	 * @param computeHash - Function to compute current file hash from disk
	 * @returns Array of file paths that need validation
	 */
	async checkFilesNeedValidation(
		sessionId: string,
		pluginName: string,
		hookName: string,
		directory: string,
		commandHash: string,
		computeHash: (filePath: string) => string,
	): Promise<{
		needsValidation: boolean;
		files: string[];
		staleFiles: string[];
	}> {
		const files = await this.getFilesForValidation(
			sessionId,
			pluginName,
			hookName,
			directory,
		);

		const filesNeedingValidation: string[] = [];
		const staleFiles: string[] = [];

		for (const file of files) {
			const currentHash = computeHash(file.filePath);

			// Skip files that no longer exist (empty hash)
			if (!currentHash) {
				continue;
			}

			// Check if file is stale (modified by another session)
			// Stale = current hash doesn't match our modification AND doesn't match our validation
			const matchesModification = currentHash === file.modificationHash;
			const matchesValidation =
				file.validationHash && currentHash === file.validationHash;

			if (!matchesModification && !matchesValidation) {
				// File was modified by another session - not our responsibility
				staleFiles.push(file.filePath);
				continue;
			}

			// Check if validation is needed
			// Needs validation if:
			// 1. No validation exists (validationHash is null)
			// 2. Current hash doesn't match validation hash
			// 3. Command changed (different command hash)
			const needsValidation =
				!file.validationHash ||
				currentHash !== file.validationHash ||
				file.validationCommandHash !== commandHash;

			if (needsValidation) {
				filesNeedingValidation.push(file.filePath);
			}
		}

		return {
			needsValidation: filesNeedingValidation.length > 0,
			files: filesNeedingValidation,
			staleFiles,
		};
	},

	/**
	 * Delete stale validation records for files that no longer exist.
	 * This prevents "ghost" validations from causing infinite re-validation loops.
	 *
	 * @param sessionId - Session ID
	 * @param pluginName - Plugin name
	 * @param hookName - Hook name
	 * @param directory - Directory being validated
	 * @param currentFilePaths - List of file paths that currently exist
	 * @returns Number of stale records deleted
	 */
	async deleteStale(
		sessionId: string,
		pluginName: string,
		hookName: string,
		directory: string,
		currentFilePaths: string[],
	): Promise<number> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.deleteStaleValidations(
			dbPath,
			sessionId,
			pluginName,
			hookName,
			directory,
			currentFilePaths,
		);
	},
};

// ============================================================================
// Session Todos Operations
// ============================================================================

export const sessionTodos = {
	/**
	 * Get the current todos for a session
	 * Returns the most recent TodoWrite state
	 */
	async get(
		sessionId: string,
	): Promise<import("../../../han-native").SessionTodos | null> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.getSessionTodos(dbPath, sessionId);
	},

	/**
	 * Upsert session todos (used by indexer)
	 */
	async upsert(
		input: import("../../../han-native").SessionTodosInput,
	): Promise<import("../../../han-native").SessionTodos> {
		const dbPath = await ensureInitialized();
		const native = getNativeModule();
		return native.upsertSessionTodos(dbPath, input);
	},
};

// ============================================================================
// Session Modified Files (replaces transcript-filter.ts)
// ============================================================================

/**
 * Result of getting modified files from session_file_changes
 * Mirrors TranscriptModifiedFiles interface for easy migration
 */
export interface SessionModifiedFiles {
	/** Files that were created */
	created: string[];
	/** Files that were modified */
	modified: string[];
	/** Files that were deleted */
	deleted: string[];
	/** Combined set of all modified files (created + modified, excludes deleted) */
	allModified: string[];
	/** Session ID */
	sessionId: string;
	/** Whether query was successful */
	success: boolean;
}

/**
 * Get files modified by a session from session_file_changes table.
 *
 * This replaces getTranscriptModifiedFiles() - queries SQLite instead of parsing JSONL.
 *
 * @param sessionId - Session ID to query
 * @returns Modified files grouped by action type
 */
export async function getSessionModifiedFiles(
	sessionId: string,
): Promise<SessionModifiedFiles> {
	try {
		const changes = await sessionFileChanges.list(sessionId);

		const created: string[] = [];
		const modified: string[] = [];
		const deleted: string[] = [];

		for (const change of changes) {
			switch (change.action) {
				case "created":
					created.push(change.filePath);
					break;
				case "modified":
					modified.push(change.filePath);
					break;
				case "deleted":
					deleted.push(change.filePath);
					break;
			}
		}

		// allModified includes created and modified, but not deleted
		const allModified = [...new Set([...created, ...modified])];

		return {
			created,
			modified,
			deleted,
			allModified,
			sessionId,
			success: true,
		};
	} catch (_err) {
		// Graceful fallback: query error, treat as no data
		return {
			created: [],
			modified: [],
			deleted: [],
			allModified: [],
			sessionId,
			success: false,
		};
	}
}

/**
 * Force-index the current session to ensure session_file_changes is up to date.
 *
 * Call this before checking session file changes to ensure SQLite has the latest data.
 *
 * @param sessionId - Session ID to index
 * @param projectPath - Project path to find the transcript
 */
export async function ensureSessionIndexed(
	sessionId: string,
	projectPath: string,
): Promise<void> {
	const { join } = await import("node:path");
	const { existsSync, readdirSync } = await import("node:fs");

	// Find the transcript file for this session
	const configDir = getClaudeConfigDir();
	if (!configDir) return;

	// Convert project path to slug (matches Claude Code's format)
	const projectSlug = projectPath
		.replace(/^\//, "")
		.replace(/\//g, "-")
		.replace(/\s+/g, "-");

	const projectDir = join(configDir, "projects", projectSlug);

	if (!existsSync(projectDir)) return;

	// Find session file (main transcript)
	const exactPath = join(projectDir, `${sessionId}.jsonl`);
	let transcriptPath: string | null = null;

	if (existsSync(exactPath)) {
		transcriptPath = exactPath;
	} else {
		// Fall back to searching for partial match
		try {
			const files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
			const match = files.find((f) => f.includes(sessionId));
			if (match) {
				transcriptPath = join(projectDir, match);
			}
		} catch {
			// Ignore read errors
		}
	}

	if (!transcriptPath) return;

	// Index the session file to ensure session_file_changes is current
	try {
		await indexer.indexSessionFile(transcriptPath);
	} catch {
		// Ignore indexing errors - best effort
	}
}

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

/**
 * Get the active session for a project by its path.
 * Returns null if no active session exists.
 */
export function getActiveSessionForProject(
	projectPath: string,
): import("../../../han-native").Session | null {
	try {
		// Ensure database is initialized
		if (!_initialized) {
			getDbPath();
		}

		const native = getNativeModule();
		const dbPath = getDbPath();

		// Query for project by path
		// Slug replaces both / and . with - (e.g., "/path/to/dir.name" -> "-path-to-dir-name")
		const projectSlug = projectPath.replace(/[/.]/g, "-");
		const projects = native.listProjects(dbPath);
		const project = projects.find((p) => p.slug === projectSlug);

		if (!project) {
			return null;
		}

		// Query for active session in this project
		const sessions = native.listSessions(dbPath, project.id, "active", 1);
		return sessions[0] || null;
	} catch (error) {
		console.error(`Failed to get active session for project: ${error}`);
		return null;
	}
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
	agentIdFilter?: string | null;
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

// NOTE: Hook cache operations removed - replaced by session_file_validations

/**
 * Truncate all derived tables (those populated from JSONL logs).
 * This is used during reindex to rebuild the database from scratch.
 * Preserves: repos, projects (discovered from disk/git, not from logs)
 * Returns: Number of rows deleted across all tables
 */
export function truncateDerivedTables(): number {
	const native = getNativeModule();
	return native.truncateDerivedTables(getDbPath());
}

// NOTE: Marketplace operations removed - not used

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
