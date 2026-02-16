/**
 * gRPC-backed Data Access Layer
 *
 * Drop-in replacement for db/index.ts. All data access goes through
 * the coordinator's gRPC API instead of direct SQLite/NAPI calls.
 *
 * Functions that have no gRPC equivalent are stubbed — they're only used
 * by coordinator-internal code which now lives in the Rust binary.
 */

import { join } from "node:path";
import { getCoordinatorClients, isCoordinatorHealthy } from "./client.js";

// ============================================================================
// Type Definitions (previously from han-native)
// ============================================================================

export interface Repo {
	id: string;
	remote_url: string;
	provider: string | null;
	owner: string | null;
	name: string | null;
	created_at: string;
}

export interface RepoInput {
	remote_url: string;
	provider?: string | null;
	owner?: string | null;
	name?: string | null;
}

export interface Project {
	id: string;
	repo_id: string | null;
	path: string;
	slug: string;
	name: string | null;
	created_at: string;
}

export interface ProjectInput {
	repo_id?: string | null;
	path: string;
	slug: string;
	name?: string | null;
}

export interface Session {
	id: string;
	session_id: string;
	project_id: string | null;
	status: string | null;
	session_file_path: string | null;
	session_slug: string | null;
	started_at: string | null;
	ended_at: string | null;
	last_indexed_line: number | null;
}

export interface SessionInput {
	session_id: string;
	project_id?: string | null;
	status?: string | null;
	session_file_path?: string | null;
	session_slug?: string | null;
	started_at?: string | null;
}

export interface Message {
	id: string;
	session_id: string;
	line_number: number;
	timestamp: string | null;
	type: string;
	role: string | null;
	content: string | null;
	tool_call_id: string | null;
	tool_name: string | null;
	parent_id: string | null;
	uuid: string | null;
	raw_json: string | null;
}

export interface MessageInput {
	session_id: string;
	line_number: number;
	timestamp?: string | null;
	type: string;
	role?: string | null;
	content?: string | null;
	tool_call_id?: string | null;
	tool_name?: string | null;
	parent_id?: string | null;
	uuid?: string | null;
	raw_json?: string | null;
}

export interface MessageBatch {
	session_id: string;
	messages: MessageInput[];
}

export interface Task {
	id: string;
	session_id: string;
	name: string;
	status: string;
	started_at: string;
	completed_at: string | null;
	failed_at: string | null;
	error_message: string | null;
	duration_ms: number | null;
}

export interface TaskInput {
	session_id: string;
	name: string;
}

export interface TaskCompletion {
	session_id: string;
	task_name: string;
	duration_ms: number;
}

export interface TaskFailure {
	session_id: string;
	task_name: string;
	error: string;
	duration_ms: number;
}

export interface TaskMetrics {
	total_tasks: number;
	completed_tasks: number;
	failed_tasks: number;
	avg_duration_ms: number | null;
}

export interface NativeTask {
	id: string;
	session_id: string;
	task_id: string;
	subject: string | null;
	description: string | null;
	status: string;
	owner: string | null;
	created_at: string;
	updated_at: string;
}

export interface NativeTaskInput {
	session_id: string;
	task_id: string;
	subject?: string | null;
	description?: string | null;
	status: string;
	owner?: string | null;
}

export interface NativeTaskUpdate {
	session_id: string;
	task_id: string;
	subject?: string | null;
	description?: string | null;
	status?: string | null;
	owner?: string | null;
}

export interface HookExecution {
	id: string;
	session_id: string;
	hook_name: string;
	plugin_name: string | null;
	event_type: string;
	exit_code: number | null;
	duration_ms: number | null;
	cached: boolean;
	executed_at: string;
}

export interface HookExecutionInput {
	session_id: string;
	hook_name: string;
	plugin_name?: string | null;
	event_type: string;
	exit_code?: number | null;
	duration_ms?: number | null;
	cached?: boolean;
}

export interface HookStats {
	total_executions: number;
	cached_executions: number;
	avg_duration_ms: number | null;
	failure_count: number;
}

export interface HookAttemptInfo {
	id: string;
	session_id: string;
	hook_id: string;
	attempt_count: number;
	max_attempts: number;
	created_at: string;
	updated_at: string;
}

export interface FrustrationEvent {
	id: string;
	session_id: string;
	event_type: string;
	tool_name: string | null;
	details: string | null;
	recorded_at: string;
}

export interface FrustrationEventInput {
	session_id: string;
	event_type: string;
	tool_name?: string | null;
	details?: string | null;
}

export interface FrustrationMetrics {
	total_events: number;
	by_type: Record<string, number>;
}

export interface SessionFileChange {
	id: string;
	session_id: string;
	file_path: string;
	change_type: string;
	tool_name: string | null;
	timestamp: string;
}

export interface SessionFileChangeInput {
	session_id: string;
	file_path: string;
	change_type: string;
	tool_name?: string | null;
}

export interface SessionFileValidation {
	id: string;
	session_id: string;
	file_path: string;
	hook_command: string;
	file_hash: string;
	command_hash: string;
	validated_at: string;
	is_valid: boolean;
}

export interface SessionFileValidationInput {
	session_id: string;
	file_path: string;
	hook_command: string;
	file_hash: string;
	command_hash: string;
}

export interface SessionTodos {
	id: string;
	session_id: string;
	todos_json: string;
	updated_at: string;
}

export interface SessionTodosInput {
	session_id: string;
	todos_json: string;
}

export interface TodoItem {
	id: string;
	content: string;
	status: "pending" | "in_progress" | "completed";
}

export interface SessionTimestamps {
	session_id: string;
	first_message_at: string | null;
	last_message_at: string | null;
}

export interface CoordinatorStatus {
	is_locked: boolean;
	owner_pid: number | null;
	last_heartbeat: string | null;
	is_stale: boolean;
}

export interface LockInfo {
	owner_pid: number;
	acquired_at: string;
	last_heartbeat: string;
}

export interface FtsSearchResult {
	id: string;
	content: string;
	score: number;
	session_id?: string;
	source?: string;
}

export interface VectorSearchResult {
	id: string;
	content: string;
	score: number;
	session_id?: string;
	source?: string;
}

export interface ConfigDir {
	id: string;
	path: string;
	label: string | null;
	last_indexed_at: string | null;
	created_at: string;
}

export interface ConfigDirInput {
	path: string;
	label?: string | null;
}

export interface PendingHookInput {
	session_id: string;
	hook_name: string;
	plugin_name: string;
	event_type: string;
	payload?: string | null;
}

export interface DailyActivityRow {
	date: string;
	session_count: number;
	message_count: number;
}

export interface DailyCostRow {
	date: string;
	total_input_tokens: number;
	total_output_tokens: number;
	estimated_cost: number;
}

export interface HourlyActivityRow {
	hour: number;
	session_count: number;
	message_count: number;
}

export interface SessionStatsRow {
	session_id: string;
	message_count: number;
	duration_minutes: number;
	tool_use_count: number;
}

export interface SessionCompactionRow {
	session_id: string;
	compaction_count: number;
}

export interface SessionSentimentRow {
	session_id: string;
	sentiment: string;
	score: number;
}

export interface SubagentUsageRow {
	session_id: string;
	subagent_count: number;
}

export interface ToolUsageRow {
	tool_name: string;
	use_count: number;
}

export interface HookHealthRow {
	hook_name: string;
	total: number;
	failures: number;
	avg_duration_ms: number;
}

export interface ActivityAggregates {
	daily_activity: DailyActivityRow[];
	hourly_activity: HourlyActivityRow[];
	daily_costs: DailyCostRow[];
}

export interface DashboardAggregates {
	total_sessions: number;
	total_messages: number;
	total_tasks: number;
	total_hook_executions: number;
	session_stats: SessionStatsRow[];
	tool_usage: ToolUsageRow[];
	hook_health: HookHealthRow[];
	compactions: SessionCompactionRow[];
	sentiments: SessionSentimentRow[];
	subagent_usage: SubagentUsageRow[];
}

export interface HookCacheEntry {
	session_id: string;
	hook_key: string;
	file_hashes: string;
	result: string;
	cached_at: string;
}

export interface HookCacheInput {
	session_id: string;
	hook_key: string;
	file_hashes: string;
	result: string;
}

export interface SessionModifiedFiles {
	modifiedFiles: string[];
	modifiedSinceLastHook: string[];
}

export interface IndexResult {
	sessionId: string;
	messagesIndexed: number;
	totalMessages: number;
	isNewSession: boolean;
	error?: string;
}

// ============================================================================
// Database Path and Initialization
// ============================================================================

let _dbPath: string | null = null;

export function _resetDbState(): void {
	_dbPath = null;
}

export function getDbPath(): string {
	if (_dbPath) return _dbPath;
	try {
		const { getHanDataDir } = require("../config/claude-settings.ts");
		const dataDir = getHanDataDir();
		_dbPath = join(dataDir, "han.db");
	} catch {
		const homeDir =
			process.env.HOME || process.env.USERPROFILE || "/tmp";
		_dbPath = join(homeDir, ".han", "han.db");
	}
	return _dbPath;
}

export async function initDb(): Promise<void> {
	// No-op: coordinator handles DB initialization
}

// ============================================================================
// Coordinator Lifecycle (delegates to gRPC health check)
// ============================================================================

export async function isCoordinatorRunning(): Promise<boolean> {
	return isCoordinatorHealthy();
}

export async function startCoordinatorIfNeeded(
	_options?: { timeout?: number; quiet?: boolean },
): Promise<boolean> {
	// Coordinator lifecycle is managed by coordinator-service.ts
	// This just checks if it's already running
	return isCoordinatorHealthy();
}

export async function withFreshData<T>(fn: () => Promise<T>): Promise<T> {
	// With gRPC, data is always fresh from coordinator
	return fn();
}

export async function withCoordinator<T>(fn: () => Promise<T>): Promise<T> {
	return fn();
}

// ============================================================================
// Repos namespace
// ============================================================================

export const repos = {
	async upsert(_input: RepoInput): Promise<Repo> {
		throw new Error("repos.upsert: coordinator-internal operation");
	},
	async getByRemote(_remoteUrl: string): Promise<Repo | null> {
		throw new Error("repos.getByRemote: coordinator-internal operation");
	},
	async list(): Promise<Repo[]> {
		throw new Error("repos.list: coordinator-internal operation");
	},
};

// ============================================================================
// Projects namespace
// ============================================================================

export const projects = {
	async upsert(_input: ProjectInput): Promise<Project> {
		throw new Error("projects.upsert: coordinator-internal operation");
	},
	async getBySlug(_slug: string): Promise<Project | null> {
		throw new Error("projects.getBySlug: coordinator-internal operation");
	},
	async getByPath(_path: string): Promise<Project | null> {
		throw new Error("projects.getByPath: coordinator-internal operation");
	},
	async list(_repoId?: string): Promise<Project[]> {
		throw new Error("projects.list: coordinator-internal operation");
	},
};

// ============================================================================
// Sessions namespace (backed by gRPC SessionService)
// ============================================================================

export const sessions = {
	async upsert(_input: SessionInput): Promise<Session> {
		throw new Error("sessions.upsert: coordinator-internal operation");
	},
	async end(_sessionId: string): Promise<boolean> {
		throw new Error("sessions.end: coordinator-internal operation");
	},
	async get(sessionId: string): Promise<Session | null> {
		const clients = getCoordinatorClients();
		const resp = await clients.sessions.get({ sessionId });
		if (!resp.session) return null;
		return sessionDataToSession(resp.session);
	},
	async list(
		options?: {
			projectId?: string;
			status?: string;
			limit?: number;
			offset?: number;
		},
	): Promise<Session[]> {
		const clients = getCoordinatorClients();
		const resp = await clients.sessions.list({
			projectId: options?.projectId,
			status: options?.status,
			limit: options?.limit ?? 100,
			offset: options?.offset ?? 0,
		});
		return resp.sessions.map(sessionDataToSession);
	},
	async resetForReindex(_sessionId: string): Promise<boolean> {
		throw new Error(
			"sessions.resetForReindex: coordinator-internal operation",
		);
	},
};

// ============================================================================
// Messages namespace
// ============================================================================

export const messages = {
	async insertBatch(_batch: MessageBatch): Promise<number> {
		throw new Error(
			"messages.insertBatch: coordinator-internal operation",
		);
	},
	async get(_id: string): Promise<Message | null> {
		throw new Error("messages.get: use GraphQL query instead");
	},
	async list(_options: {
		sessionId: string;
		limit?: number;
		offset?: number;
		type?: string;
	}): Promise<Message[]> {
		throw new Error("messages.list: use GraphQL query instead");
	},
	async count(_sessionId: string): Promise<number> {
		throw new Error("messages.count: use GraphQL query instead");
	},
	async countBatch(_sessionIds: string[]): Promise<Map<string, number>> {
		throw new Error("messages.countBatch: use GraphQL query instead");
	},
	async getLastIndexedLine(_sessionId: string): Promise<number> {
		throw new Error(
			"messages.getLastIndexedLine: coordinator-internal operation",
		);
	},
	async timestampsBatch(
		_sessionIds: string[],
	): Promise<Map<string, SessionTimestamps>> {
		throw new Error(
			"messages.timestampsBatch: use GraphQL query instead",
		);
	},
	async search(
		options: {
			query: string;
			sessionId?: string;
			limit?: number;
		},
	): Promise<FtsSearchResult[]> {
		const clients = getCoordinatorClients();
		const resp = await clients.memory.search({
			query: options.query,
			sessionId: options.sessionId,
			limit: options.limit ?? 20,
		});
		return resp.results.map((r) => ({
			id: r.id,
			content: r.content,
			score: r.score,
			session_id: r.sessionId,
			source: r.source,
		}));
	},
};

// ============================================================================
// Tasks namespace
// ============================================================================

export const tasks = {
	async create(_input: TaskInput): Promise<Task> {
		throw new Error("tasks.create: coordinator-internal operation");
	},
	async complete(_completion: TaskCompletion): Promise<boolean> {
		throw new Error("tasks.complete: coordinator-internal operation");
	},
	async fail(_failure: TaskFailure): Promise<boolean> {
		throw new Error("tasks.fail: coordinator-internal operation");
	},
	async get(
		_sessionId: string,
		_taskName: string,
	): Promise<Task | null> {
		throw new Error("tasks.get: coordinator-internal operation");
	},
	async queryMetrics(
		_options?: { sessionId?: string },
	): Promise<TaskMetrics> {
		throw new Error("tasks.queryMetrics: coordinator-internal operation");
	},
};

// ============================================================================
// Hook Cache
// ============================================================================

export async function getHookCache(
	_sessionId: string,
	_hookKey: string,
): Promise<HookCacheEntry | null> {
	// Hook caching now handled by coordinator
	return null;
}

export async function setHookCache(_input: HookCacheInput): Promise<boolean> {
	// Hook caching now handled by coordinator
	return true;
}

// ============================================================================
// Hook Executions namespace
// ============================================================================

export const hookExecutions = {
	async record(_input: HookExecutionInput): Promise<HookExecution> {
		throw new Error(
			"hookExecutions.record: coordinator-internal operation",
		);
	},
	async queryStats(
		_options?: { sessionId?: string },
	): Promise<HookStats> {
		return {
			total_executions: 0,
			cached_executions: 0,
			avg_duration_ms: null,
			failure_count: 0,
		};
	},
};

// ============================================================================
// Hook Attempts namespace
// ============================================================================

export const hookAttempts = {
	async getOrCreate(
		_sessionId: string,
		_hookId: string,
	): Promise<HookAttemptInfo> {
		throw new Error(
			"hookAttempts.getOrCreate: coordinator-internal operation",
		);
	},
	async increment(
		_sessionId: string,
		_hookId: string,
	): Promise<HookAttemptInfo> {
		throw new Error(
			"hookAttempts.increment: coordinator-internal operation",
		);
	},
	async reset(
		_sessionId: string,
		_hookId: string,
	): Promise<HookAttemptInfo> {
		throw new Error(
			"hookAttempts.reset: coordinator-internal operation",
		);
	},
	async increaseMaxAttempts(
		_sessionId: string,
		_hookId: string,
		_newMax: number,
	): Promise<HookAttemptInfo> {
		throw new Error(
			"hookAttempts.increaseMaxAttempts: coordinator-internal operation",
		);
	},
};

// ============================================================================
// Deferred Hooks namespace
// ============================================================================

export const deferredHooks = {
	async queue(_input: PendingHookInput): Promise<void> {
		throw new Error(
			"deferredHooks.queue: coordinator-internal operation",
		);
	},
	async getAll(): Promise<PendingHookInput[]> {
		return [];
	},
	async getForSession(_sessionId: string): Promise<PendingHookInput[]> {
		return [];
	},
	async updateStatus(
		_id: string,
		_status: string,
	): Promise<boolean> {
		return true;
	},
	async complete(_id: string): Promise<boolean> {
		return true;
	},
	async fail(
		_id: string,
		_error: string,
	): Promise<boolean> {
		return true;
	},
};

// ============================================================================
// Frustrations namespace
// ============================================================================

export const frustrations = {
	async record(
		_input: FrustrationEventInput,
	): Promise<FrustrationEvent> {
		throw new Error(
			"frustrations.record: coordinator-internal operation",
		);
	},
	async queryMetrics(
		_options?: { sessionId?: string },
	): Promise<FrustrationMetrics> {
		return { total_events: 0, by_type: {} };
	},
};

// ============================================================================
// Session File Changes namespace
// ============================================================================

export const sessionFileChanges = {
	async record(
		_input: SessionFileChangeInput,
	): Promise<SessionFileChange> {
		throw new Error(
			"sessionFileChanges.record: coordinator-internal operation",
		);
	},
	async list(
		_sessionId: string,
	): Promise<SessionFileChange[]> {
		return [];
	},
	async hasChanges(_sessionId: string): Promise<boolean> {
		return false;
	},
};

// ============================================================================
// Session File Validations namespace
// ============================================================================

export const sessionFileValidations = {
	async record(
		_input: SessionFileValidationInput,
	): Promise<SessionFileValidation> {
		throw new Error(
			"sessionFileValidations.record: coordinator-internal operation",
		);
	},
	async get(
		_sessionId: string,
		_filePath: string,
		_hookCommand: string,
	): Promise<SessionFileValidation | null> {
		return null;
	},
	async list(_sessionId: string): Promise<SessionFileValidation[]> {
		return [];
	},
	async listAll(): Promise<SessionFileValidation[]> {
		return [];
	},
	async needsValidation(
		_sessionId: string,
		_filePath: string,
		_hookCommand: string,
		_fileHash: string,
		_commandHash: string,
	): Promise<boolean> {
		return true; // Always validate when coordinator manages cache
	},
	async getFilesForValidation(
		_sessionId: string,
		_hookCommand: string,
		_files: string[],
	): Promise<string[]> {
		return _files; // All files need validation without local cache
	},
	async checkFilesNeedValidation(
		_sessionId: string,
		_hookCommand: string,
		_files: Array<{ path: string; hash: string; commandHash: string }>,
	): Promise<string[]> {
		return _files.map((f) => f.path);
	},
	async deleteStale(
		_sessionId: string,
		_maxAge?: number,
	): Promise<number> {
		return 0;
	},
};

// ============================================================================
// Session Todos namespace
// ============================================================================

export const sessionTodos = {
	async get(_sessionId: string): Promise<SessionTodos | null> {
		return null;
	},
	async upsert(_input: SessionTodosInput): Promise<SessionTodos> {
		throw new Error(
			"sessionTodos.upsert: coordinator-internal operation",
		);
	},
};

// ============================================================================
// Native Tasks namespace
// ============================================================================

export const nativeTasks = {
	async getForSession(_sessionId: string): Promise<NativeTask[]> {
		return [];
	},
	async get(
		_sessionId: string,
		_taskId: string,
	): Promise<NativeTask | null> {
		return null;
	},
};

// ============================================================================
// Session Modified Files
// ============================================================================

export async function getSessionModifiedFiles(
	_sessionId: string,
	_projectPath: string,
): Promise<SessionModifiedFiles> {
	return { modifiedFiles: [], modifiedSinceLastHook: [] };
}

export async function ensureSessionIndexed(
	_sessionId: string,
): Promise<void> {
	// Coordinator handles indexing automatically
}

// ============================================================================
// FTS namespace (backed by gRPC MemoryService)
// ============================================================================

export const fts = {
	async index(
		_id: string,
		_content: string,
		_sessionId?: string,
		_source?: string,
	): Promise<void> {
		const clients = getCoordinatorClients();
		await clients.memory.indexDocument({
			content: _content,
			sessionId: _sessionId,
			source: _source,
		});
	},
	async search(
		query: string,
		options?: { sessionId?: string; limit?: number },
	): Promise<FtsSearchResult[]> {
		const clients = getCoordinatorClients();
		const resp = await clients.memory.search({
			query,
			sessionId: options?.sessionId,
			limit: options?.limit ?? 20,
		});
		return resp.results.map((r) => ({
			id: r.id,
			content: r.content,
			score: r.score,
			session_id: r.sessionId,
			source: r.source,
		}));
	},
	async delete(_id: string): Promise<boolean> {
		// Coordinator handles cleanup
		return true;
	},
};

// ============================================================================
// Vectors namespace (backed by gRPC MemoryService)
// ============================================================================

export const vectors = {
	async index(
		_id: string,
		_content: string,
		_sessionId?: string,
		_source?: string,
	): Promise<void> {
		const clients = getCoordinatorClients();
		await clients.memory.indexDocument({
			content: _content,
			sessionId: _sessionId,
			source: _source,
		});
	},
	async search(
		query: string,
		options?: { sessionId?: string; limit?: number },
	): Promise<VectorSearchResult[]> {
		const clients = getCoordinatorClients();
		const resp = await clients.memory.search({
			query,
			sessionId: options?.sessionId,
			limit: options?.limit ?? 20,
		});
		return resp.results.map((r) => ({
			id: r.id,
			content: r.content,
			score: r.score,
			session_id: r.sessionId,
			source: r.source,
		}));
	},
};

// ============================================================================
// Coordinator namespace (for lifecycle management only)
// ============================================================================

export const coordinator = {
	tryAcquire(): boolean {
		throw new Error(
			"coordinator.tryAcquire: managed by Rust coordinator",
		);
	},
	release(): boolean {
		throw new Error("coordinator.release: managed by Rust coordinator");
	},
	updateHeartbeat(): boolean {
		throw new Error(
			"coordinator.updateHeartbeat: managed by Rust coordinator",
		);
	},
	getStatus(): CoordinatorStatus {
		throw new Error(
			"coordinator.getStatus: use gRPC CoordinatorService.Status",
		);
	},
	isCoordinator(): boolean {
		return false; // CLI is never the coordinator; Rust binary is
	},
	getHeartbeatInterval(): number {
		return 5000;
	},
	getStaleLockTimeout(): number {
		return 30000;
	},
};

// ============================================================================
// Watcher namespace (coordinator-internal)
// ============================================================================

export const watcher = {
	async start(_watchPath?: string): Promise<boolean> {
		throw new Error("watcher.start: managed by Rust coordinator");
	},
	stop(): boolean {
		throw new Error("watcher.stop: managed by Rust coordinator");
	},
	isRunning(): boolean {
		return false;
	},
	getDefaultPath(): string {
		const home =
			process.env.HOME || process.env.USERPROFILE || "/tmp";
		return join(home, ".claude", "projects");
	},
	setCallback(_cb: (event: string, path: string) => void): void {
		// No-op: coordinator handles file watching
	},
	clearCallback(): void {
		// No-op
	},
	addWatchPath(_path: string): boolean {
		return false;
	},
	removeWatchPath(_path: string): boolean {
		return false;
	},
	getWatchedPaths(): string[] {
		return [];
	},
};

// ============================================================================
// Indexer namespace (backed by gRPC IndexerService)
// ============================================================================

export const indexer = {
	async indexSessionFile(
		filePath: string,
		configDir?: string,
	): Promise<IndexResult> {
		const clients = getCoordinatorClients();
		const resp = await clients.indexer.indexFile({
			filePath,
			configDir,
		});
		return {
			sessionId: resp.sessionId,
			messagesIndexed: resp.messagesIndexed,
			totalMessages: resp.totalMessages,
			isNewSession: resp.isNewSession,
			error: resp.error,
		};
	},
	async indexProjectDirectory(
		_dirPath: string,
	): Promise<IndexResult[]> {
		throw new Error(
			"indexer.indexProjectDirectory: coordinator-internal operation",
		);
	},
	async handleFileEvent(
		_event: string,
		_path: string,
	): Promise<IndexResult | null> {
		throw new Error(
			"indexer.handleFileEvent: coordinator-internal operation",
		);
	},
	async fullScanAndIndex(
		configDir?: string,
	): Promise<IndexResult[]> {
		const clients = getCoordinatorClients();
		const resp = await clients.indexer.triggerScan({
			configDir,
		});
		// Scan response doesn't return per-session results
		return [];
	},
	async needsReindex(_sessionId: string): Promise<boolean> {
		return false;
	},
	async clearReindexFlag(_sessionId: string): Promise<void> {
		// No-op
	},
};

// ============================================================================
// Aggregation queries (coordinator-internal, used by GraphQL)
// ============================================================================

export async function queryDashboardAggregates(
	_options?: { projectId?: string },
): Promise<DashboardAggregates> {
	return {
		total_sessions: 0,
		total_messages: 0,
		total_tasks: 0,
		total_hook_executions: 0,
		session_stats: [],
		tool_usage: [],
		hook_health: [],
		compactions: [],
		sentiments: [],
		subagent_usage: [],
	};
}

export async function queryActivityAggregates(
	_options?: { projectId?: string; days?: number },
): Promise<ActivityAggregates> {
	return {
		daily_activity: [],
		hourly_activity: [],
		daily_costs: [],
	};
}

// ============================================================================
// Legacy convenience functions
// ============================================================================

export async function upsertRepo(input: RepoInput): Promise<Repo> {
	return repos.upsert(input);
}

export async function getRepoByRemote(
	remoteUrl: string,
): Promise<Repo | null> {
	return repos.getByRemote(remoteUrl);
}

export async function listRepos(): Promise<Repo[]> {
	return repos.list();
}

export async function upsertProject(input: ProjectInput): Promise<Project> {
	return projects.upsert(input);
}

export async function getProjectBySlug(
	slug: string,
): Promise<Project | null> {
	return projects.getBySlug(slug);
}

export async function getProjectByPath(
	path: string,
): Promise<Project | null> {
	return projects.getByPath(path);
}

export async function listProjects(
	repoId?: string,
): Promise<Project[]> {
	return projects.list(repoId);
}

export async function upsertSession(
	input: SessionInput,
): Promise<Session> {
	return sessions.upsert(input);
}

export async function endSession(sessionId: string): Promise<boolean> {
	return sessions.end(sessionId);
}

export async function getSession(
	sessionId: string,
): Promise<Session | null> {
	return sessions.get(sessionId);
}

export async function listSessions(
	options?: {
		projectId?: string;
		status?: string;
		limit?: number;
		offset?: number;
	},
): Promise<Session[]> {
	return sessions.list(options);
}

export async function registerConfigDir(
	_input: ConfigDirInput,
): Promise<ConfigDir> {
	throw new Error("registerConfigDir: coordinator-internal operation");
}

export async function getConfigDirByPath(
	_path: string,
): Promise<ConfigDir | null> {
	return null;
}

export async function listConfigDirs(): Promise<ConfigDir[]> {
	return [];
}

export async function updateConfigDirLastIndexed(
	_path: string,
): Promise<boolean> {
	return true;
}

export async function unregisterConfigDir(_path: string): Promise<boolean> {
	return true;
}

export async function getDefaultConfigDir(): Promise<ConfigDir | null> {
	return null;
}

export function getActiveSessionForProject(
	_projectPath: string,
): Session | null {
	// This was a synchronous DB call; with gRPC it would be async.
	// Return null since callers should use sessions.get() with await.
	return null;
}

export async function insertMessagesBatch(
	batch: MessageBatch,
): Promise<number> {
	return messages.insertBatch(batch);
}

export async function getMessage(id: string): Promise<Message | null> {
	return messages.get(id);
}

export async function listSessionMessages(
	options: {
		sessionId: string;
		limit?: number;
		offset?: number;
		type?: string;
	},
): Promise<Message[]> {
	return messages.list(options);
}

export async function getMessageCount(sessionId: string): Promise<number> {
	return messages.count(sessionId);
}

export async function getLastIndexedLine(
	sessionId: string,
): Promise<number> {
	return messages.getLastIndexedLine(sessionId);
}

export async function searchMessages(
	options: {
		query: string;
		sessionId?: string;
		limit?: number;
	},
): Promise<FtsSearchResult[]> {
	return messages.search(options);
}

export async function createTask(input: TaskInput): Promise<Task> {
	return tasks.create(input);
}

export async function completeTask(
	completion: TaskCompletion,
): Promise<boolean> {
	return tasks.complete(completion);
}

export async function failTask(failure: TaskFailure): Promise<boolean> {
	return tasks.fail(failure);
}

export async function getTask(
	sessionId: string,
	taskName: string,
): Promise<Task | null> {
	return tasks.get(sessionId, taskName);
}

export async function queryTaskMetrics(
	options?: { sessionId?: string },
): Promise<TaskMetrics> {
	return tasks.queryMetrics(options);
}

export function truncateDerivedTables(): number {
	throw new Error("truncateDerivedTables: coordinator-internal operation");
}

export function tryAcquireCoordinatorLock(): boolean {
	return coordinator.tryAcquire();
}

export function releaseCoordinatorLock(): boolean {
	return coordinator.release();
}

export function updateCoordinatorHeartbeat(): boolean {
	return coordinator.updateHeartbeat();
}

export function getCoordinatorStatus(): CoordinatorStatus {
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

export async function startFileWatcher(
	watchPath?: string,
): Promise<boolean> {
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

// Re-exports that previously came from native.ts
export { FileEventType } from "../bun-utils.js";

// ============================================================================
// Helpers
// ============================================================================

function sessionDataToSession(
	data: import("./generated/coordinator_pb.js").SessionData,
): Session {
	return {
		id: data.id,
		session_id: data.sessionId,
		project_id: data.projectId ?? null,
		status: data.status ?? null,
		session_file_path: data.sessionFilePath ?? null,
		session_slug: data.sessionSlug ?? null,
		started_at: data.startedAt ?? null,
		ended_at: data.endedAt ?? null,
		last_indexed_line: data.lastIndexedLine ?? null,
	};
}
