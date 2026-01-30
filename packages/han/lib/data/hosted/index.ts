/**
 * HostedDataSource Implementation
 *
 * Implements the DataSource interface using Drizzle ORM with PostgreSQL.
 * All queries are scoped to the current tenant (organization).
 *
 * Used when running in hosted mode (multi-tenant cloud platform).
 */

import { and, count, desc, eq, sql } from "drizzle-orm";
import type {
	Connection,
	ConnectionArgs,
	DataSource,
	HookStatsOptions,
	MessageListOptions,
	MessageSearchOptions,
	SessionListOptions,
	TaskMetricsOptions,
} from "../interfaces.ts";

// Import native types for return type compatibility
import type {
	HookExecution as NativeHookExecution,
	HookStats as NativeHookStats,
	Message as NativeMessage,
	NativeTask as NativeNativeTask,
	Project as NativeProject,
	Repo as NativeRepo,
	Session as NativeSession,
	SessionFileChange as NativeSessionFileChange,
	SessionFileValidation as NativeSessionFileValidation,
	SessionTimestamps,
	SessionTodos as NativeSessionTodos,
	TaskMetrics as NativeTaskMetrics,
} from "../../db/index.ts";

import {
	type DrizzleDb,
	type TenantContext,
	getDb,
	getTenantContext,
} from "./client.ts";
import * as schema from "./schema/index.ts";

// =============================================================================
// Type Converters
// =============================================================================

/**
 * Convert hosted Session to native Session format
 * Native types use camelCase (from NAPI-RS)
 */
function toNativeSession(session: schema.Session): NativeSession {
	return {
		id: session.localSessionId,
		projectId: session.projectId ?? undefined,
		status: session.status,
		transcriptPath: session.transcriptPath ?? undefined,
		slug: session.slug ?? undefined,
		lastIndexedLine: session.lastIndexedLine ?? undefined,
	};
}

/**
 * Convert hosted Message to native Message format
 */
function toNativeMessage(message: schema.Message): NativeMessage {
	return {
		id: message.localMessageId,
		sessionId: "", // Will be set from context
		agentId: message.agentId ?? undefined,
		parentId: message.parentId ?? undefined,
		messageType: message.messageType,
		role: message.role ?? undefined,
		content: message.content ?? undefined,
		toolName: message.toolName ?? undefined,
		toolInput: message.toolInput ?? undefined,
		toolResult: message.toolResult ?? undefined,
		rawJson: message.rawJson ?? undefined,
		timestamp: message.timestamp.toISOString(),
		lineNumber: message.lineNumber,
		sourceFileName: message.sourceFileName ?? undefined,
		sourceFileType: message.sourceFileType ?? undefined,
		sentimentScore: message.sentimentScore ?? undefined,
		sentimentLevel: message.sentimentLevel ?? undefined,
		frustrationScore: message.frustrationScore ?? undefined,
		frustrationLevel: message.frustrationLevel ?? undefined,
		indexedAt: message.indexedAt?.toISOString() ?? undefined,
	};
}

/**
 * Convert hosted Project to native Project format
 */
function toNativeProject(project: schema.Project): NativeProject {
	return {
		id: project.id ?? undefined,
		repoId: project.repositoryId ?? undefined,
		slug: project.slug,
		path: project.path ?? "",
		relativePath: project.relativePath ?? undefined,
		name: project.name,
		isWorktree: project.isWorktree ?? false,
		createdAt: project.createdAt?.toISOString() ?? undefined,
		updatedAt: project.updatedAt?.toISOString() ?? undefined,
	};
}

/**
 * Convert hosted Repository to native Repo format
 */
function toNativeRepo(repo: schema.Repository): NativeRepo {
	return {
		id: repo.id ?? undefined,
		remote: repo.remote,
		name: repo.name,
		defaultBranch: repo.defaultBranch ?? undefined,
		createdAt: repo.createdAt?.toISOString() ?? undefined,
		updatedAt: repo.updatedAt?.toISOString() ?? undefined,
	};
}

/**
 * Convert hosted HookExecution to native HookExecution format
 */
function toNativeHookExecution(
	hook: schema.HookExecution,
): NativeHookExecution {
	return {
		id: hook.id ?? undefined,
		orchestrationId: hook.orchestrationId ?? undefined,
		sessionId: hook.sessionId ?? undefined,
		taskId: hook.taskId ?? undefined,
		hookType: hook.hookType,
		hookName: hook.hookName,
		hookSource: hook.hookSource ?? undefined,
		directory: hook.directory ?? undefined,
		durationMs: hook.durationMs,
		exitCode: hook.exitCode,
		passed: hook.passed,
		output: hook.output ?? undefined,
		error: hook.error ?? undefined,
		ifChanged: hook.ifChanged ?? undefined,
		command: hook.command ?? undefined,
		executedAt: hook.executedAt?.toISOString() ?? undefined,
		status: hook.status ?? undefined,
		consecutiveFailures: hook.consecutiveFailures ?? undefined,
		maxAttempts: hook.maxAttempts ?? undefined,
		pid: hook.pid ?? undefined,
		pluginRoot: hook.pluginRoot ?? undefined,
	};
}

/**
 * Convert hosted SessionFileChange to native format
 */
function toNativeFileChange(
	change: schema.SessionFileChange,
): NativeSessionFileChange {
	return {
		id: change.id ?? undefined,
		sessionId: "", // Will be set from context
		filePath: change.filePath,
		action: change.action,
		fileHashBefore: change.fileHashBefore ?? undefined,
		fileHashAfter: change.fileHashAfter ?? undefined,
		toolName: change.toolName ?? undefined,
		recordedAt: change.recordedAt?.toISOString() ?? undefined,
	};
}

/**
 * Convert hosted SessionFileValidation to native format
 */
function toNativeFileValidation(
	validation: schema.SessionFileValidation,
): NativeSessionFileValidation {
	return {
		id: validation.id ?? undefined,
		sessionId: "", // Will be set from context
		filePath: validation.filePath,
		fileHash: validation.fileHash,
		pluginName: validation.pluginName,
		hookName: validation.hookName,
		directory: validation.directory,
		commandHash: validation.commandHash,
		validatedAt: validation.validatedAt?.toISOString() ?? undefined,
	};
}

/**
 * Convert hosted NativeTask to native NativeTask format
 */
function toNativeNativeTask(task: schema.NativeTask): NativeNativeTask {
	return {
		id: task.localTaskId,
		sessionId: "", // Will be set from context
		messageId: task.messageId ?? "",
		subject: task.subject,
		description: task.description ?? undefined,
		status: task.status,
		activeForm: task.activeForm ?? undefined,
		owner: task.owner ?? undefined,
		blocks: task.blocks ?? undefined,
		blockedBy: task.blockedBy ?? undefined,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString(),
		completedAt: task.completedAt?.toISOString() ?? undefined,
		lineNumber: task.lineNumber,
	};
}

// =============================================================================
// HostedDataSource Implementation
// =============================================================================

/**
 * HostedDataSource class
 *
 * Implements DataSource interface using Drizzle ORM with PostgreSQL.
 * All queries are automatically scoped to the current organization.
 */
export class HostedDataSource implements DataSource {
	private db: DrizzleDb;
	private tenant: TenantContext;

	constructor(db?: DrizzleDb, tenant?: TenantContext) {
		this.db = db ?? getDb();
		this.tenant = tenant ?? getTenantContext();
	}

	// =========================================================================
	// Session Operations
	// =========================================================================
	sessions = {
		get: async (sessionId: string): Promise<NativeSession | null> => {
			const result = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			return result[0] ? toNativeSession(result[0]) : null;
		},

		list: async (options?: SessionListOptions): Promise<NativeSession[]> => {
			const conditions = [
				eq(schema.sessions.organizationId, this.tenant.organizationId),
			];

			if (options?.projectId) {
				conditions.push(eq(schema.sessions.projectId, options.projectId));
			}
			if (options?.status) {
				conditions.push(eq(schema.sessions.status, options.status));
			}

			const query = this.db
				.select()
				.from(schema.sessions)
				.where(and(...conditions))
				.orderBy(desc(schema.sessions.createdAt))
				.$dynamic();

			const results = await (options?.limit
				? query.limit(options.limit)
				: query);
			return results.map(toNativeSession);
		},

		getConnection: async (
			args: ConnectionArgs & { projectId?: string | null },
		): Promise<Connection<NativeSession>> => {
			// Get total count
			const countResult = await this.db
				.select({ count: count() })
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						args.projectId
							? eq(schema.sessions.projectId, args.projectId)
							: undefined,
					),
				);

			const totalCount = countResult[0]?.count ?? 0;

			// Get sessions with pagination
			const limit = args.first ?? args.last ?? 50;
			const sessions = await this.sessions.list({
				projectId: args.projectId,
				limit: limit + 1, // Get one extra to check hasNextPage
			});

			// Apply cursor-based pagination
			let filtered = sessions;

			if (args.after) {
				const afterIndex = sessions.findIndex(
					(s) => encodeCursor(s.id) === args.after,
				);
				if (afterIndex !== -1) {
					filtered = sessions.slice(afterIndex + 1);
				}
			}

			if (args.before) {
				const beforeIndex = filtered.findIndex(
					(s) => encodeCursor(s.id) === args.before,
				);
				if (beforeIndex !== -1) {
					filtered = filtered.slice(0, beforeIndex);
				}
			}

			const sliced = filtered.slice(0, limit);

			const edges = sliced.map((session) => ({
				node: session,
				cursor: encodeCursor(session.id),
			}));

			return {
				edges,
				pageInfo: {
					hasNextPage: filtered.length > sliced.length,
					hasPreviousPage: args.after !== undefined,
					startCursor: edges[0]?.cursor ?? null,
					endCursor: edges[edges.length - 1]?.cursor ?? null,
				},
				totalCount,
			};
		},
	};

	// =========================================================================
	// Message Operations
	// =========================================================================
	messages = {
		get: async (messageId: string): Promise<NativeMessage | null> => {
			const result = await this.db
				.select()
				.from(schema.messages)
				.where(
					and(
						eq(schema.messages.organizationId, this.tenant.organizationId),
						eq(schema.messages.localMessageId, messageId),
					),
				)
				.limit(1);

			return result[0] ? toNativeMessage(result[0]) : null;
		},

		list: async (options: MessageListOptions): Promise<NativeMessage[]> => {
			// First, get the session by local session ID
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, options.sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return [];
			}

			const conditions = [
				eq(schema.messages.organizationId, this.tenant.organizationId),
				eq(schema.messages.sessionId, sessionResult[0].id),
			];

			if (options.messageType) {
				conditions.push(eq(schema.messages.messageType, options.messageType));
			}

			if (options.agentIdFilter !== undefined) {
				if (options.agentIdFilter === null || options.agentIdFilter === "") {
					// Main conversation only - messages with no agent_id
					conditions.push(sql`${schema.messages.agentId} IS NULL`);
				} else {
					conditions.push(eq(schema.messages.agentId, options.agentIdFilter));
				}
			}

			const baseQuery = this.db
				.select()
				.from(schema.messages)
				.where(and(...conditions))
				.orderBy(desc(schema.messages.timestamp))
				.$dynamic();

			// Apply limit and offset conditionally
			let finalQuery = baseQuery;
			if (options.limit) {
				finalQuery = finalQuery.limit(options.limit);
			}
			if (options.offset) {
				finalQuery = finalQuery.offset(options.offset);
			}

			const results = await finalQuery;
			return results.map((m) => ({
				...toNativeMessage(m),
				sessionId: options.sessionId,
			}));
		},

		count: async (sessionId: string): Promise<number> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return 0;
			}

			const result = await this.db
				.select({ count: count() })
				.from(schema.messages)
				.where(
					and(
						eq(schema.messages.organizationId, this.tenant.organizationId),
						eq(schema.messages.sessionId, sessionResult[0].id),
					),
				);

			return result[0]?.count ?? 0;
		},

		countBatch: async (
			sessionIds: string[],
		): Promise<Record<string, number>> => {
			const result: Record<string, number> = {};

			// Initialize all to 0
			for (const sessionId of sessionIds) {
				result[sessionId] = 0;
			}

			// Get counts for each session
			// In a production system, this would be optimized with a single query
			for (const sessionId of sessionIds) {
				result[sessionId] = await this.messages.count(sessionId);
			}

			return result;
		},

		timestampsBatch: async (
			sessionIds: string[],
		): Promise<Record<string, SessionTimestamps>> => {
			const result: Record<string, SessionTimestamps> = {};

			// Get timestamps for each session
			for (const sessionId of sessionIds) {
				const sessionResult = await this.db
					.select()
					.from(schema.sessions)
					.where(
						and(
							eq(schema.sessions.organizationId, this.tenant.organizationId),
							eq(schema.sessions.localSessionId, sessionId),
						),
					)
					.limit(1);

				if (!sessionResult[0]) {
					continue;
				}

				const timestamps = await this.db
					.select({
						minTs: sql<string>`MIN(${schema.messages.timestamp})`,
						maxTs: sql<string>`MAX(${schema.messages.timestamp})`,
					})
					.from(schema.messages)
					.where(
						and(
							eq(schema.messages.organizationId, this.tenant.organizationId),
							eq(schema.messages.sessionId, sessionResult[0].id),
						),
					);

				if (timestamps[0]) {
					result[sessionId] = {
						sessionId,
						startedAt: timestamps[0].minTs ?? undefined,
						endedAt: timestamps[0].maxTs ?? undefined,
					};
				}
			}

			return result;
		},

		search: async (
			options: MessageSearchOptions,
		): Promise<NativeMessage[]> => {
			// PostgreSQL full-text search
			const conditions = [
				eq(schema.messages.organizationId, this.tenant.organizationId),
			];

			if (options.sessionId) {
				const sessionResult = await this.db
					.select()
					.from(schema.sessions)
					.where(
						and(
							eq(schema.sessions.organizationId, this.tenant.organizationId),
							eq(schema.sessions.localSessionId, options.sessionId),
						),
					)
					.limit(1);

				if (sessionResult[0]) {
					conditions.push(eq(schema.messages.sessionId, sessionResult[0].id));
				}
			}

			// Use PostgreSQL's ILIKE for simple text search
			// In production, you'd use pg_trgm or full-text search
			conditions.push(
				sql`${schema.messages.content} ILIKE ${`%${options.query}%`}`,
			);

			const query = this.db
				.select()
				.from(schema.messages)
				.where(and(...conditions))
				.orderBy(desc(schema.messages.timestamp))
				.$dynamic();

			const results = await (options.limit
				? query.limit(options.limit)
				: query);
			return results.map(toNativeMessage);
		},
	};

	// =========================================================================
	// Project Operations
	// =========================================================================
	projects = {
		get: async (projectId: string): Promise<NativeProject | null> => {
			const result = await this.db
				.select()
				.from(schema.projects)
				.where(
					and(
						eq(schema.projects.organizationId, this.tenant.organizationId),
						eq(schema.projects.id, projectId),
					),
				)
				.limit(1);

			return result[0] ? toNativeProject(result[0]) : null;
		},

		list: async (repoId?: string | null): Promise<NativeProject[]> => {
			const conditions = [
				eq(schema.projects.organizationId, this.tenant.organizationId),
			];

			if (repoId) {
				conditions.push(eq(schema.projects.repositoryId, repoId));
			}

			const results = await this.db
				.select()
				.from(schema.projects)
				.where(and(...conditions))
				.orderBy(schema.projects.name);

			return results.map(toNativeProject);
		},

		getBySlug: async (slug: string): Promise<NativeProject | null> => {
			const result = await this.db
				.select()
				.from(schema.projects)
				.where(
					and(
						eq(schema.projects.organizationId, this.tenant.organizationId),
						eq(schema.projects.slug, slug),
					),
				)
				.limit(1);

			return result[0] ? toNativeProject(result[0]) : null;
		},

		getByPath: async (path: string): Promise<NativeProject | null> => {
			const result = await this.db
				.select()
				.from(schema.projects)
				.where(
					and(
						eq(schema.projects.organizationId, this.tenant.organizationId),
						eq(schema.projects.path, path),
					),
				)
				.limit(1);

			return result[0] ? toNativeProject(result[0]) : null;
		},
	};

	// =========================================================================
	// Repo Operations
	// =========================================================================
	repos = {
		getByRemote: async (remote: string): Promise<NativeRepo | null> => {
			const result = await this.db
				.select()
				.from(schema.repositories)
				.where(
					and(
						eq(schema.repositories.organizationId, this.tenant.organizationId),
						eq(schema.repositories.remote, remote),
					),
				)
				.limit(1);

			return result[0] ? toNativeRepo(result[0]) : null;
		},

		list: async (): Promise<NativeRepo[]> => {
			const results = await this.db
				.select()
				.from(schema.repositories)
				.where(
					eq(schema.repositories.organizationId, this.tenant.organizationId),
				)
				.orderBy(schema.repositories.name);

			return results.map(toNativeRepo);
		},
	};

	// =========================================================================
	// Task/Metrics Operations
	// =========================================================================
	tasks = {
		queryMetrics: async (
			_options?: TaskMetricsOptions,
		): Promise<NativeTaskMetrics> => {
			// For hosted mode, task metrics would be computed from native_tasks table
			// This is a placeholder that returns empty metrics
			return {
				totalTasks: 0,
				completedTasks: 0,
				successfulTasks: 0,
				partialTasks: 0,
				failedTasks: 0,
				successRate: 0,
				averageConfidence: undefined,
				averageDurationSeconds: undefined,
				calibrationScore: undefined,
				byType: undefined,
				byOutcome: undefined,
			};
		},
	};

	// =========================================================================
	// Native Tasks Operations
	// =========================================================================
	nativeTasks = {
		getForSession: async (
			sessionId: string,
		): Promise<NativeNativeTask[]> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return [];
			}

			const results = await this.db
				.select()
				.from(schema.nativeTasks)
				.where(
					and(
						eq(schema.nativeTasks.organizationId, this.tenant.organizationId),
						eq(schema.nativeTasks.sessionId, sessionResult[0].id),
					),
				)
				.orderBy(schema.nativeTasks.createdAt);

			return results.map((t) => ({
				...toNativeNativeTask(t),
				sessionId: sessionId,
			}));
		},

		get: async (
			sessionId: string,
			taskId: string,
		): Promise<NativeNativeTask | null> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return null;
			}

			const result = await this.db
				.select()
				.from(schema.nativeTasks)
				.where(
					and(
						eq(schema.nativeTasks.organizationId, this.tenant.organizationId),
						eq(schema.nativeTasks.sessionId, sessionResult[0].id),
						eq(schema.nativeTasks.localTaskId, taskId),
					),
				)
				.limit(1);

			return result[0]
				? { ...toNativeNativeTask(result[0]), sessionId: sessionId }
				: null;
		},
	};

	// =========================================================================
	// Hook Execution Operations
	// =========================================================================
	hookExecutions = {
		list: async (sessionId: string): Promise<NativeHookExecution[]> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return [];
			}

			const results = await this.db
				.select()
				.from(schema.hookExecutions)
				.where(
					and(
						eq(schema.hookExecutions.organizationId, this.tenant.organizationId),
						eq(schema.hookExecutions.sessionId, sessionResult[0].id),
					),
				)
				.orderBy(desc(schema.hookExecutions.executedAt));

			return results.map(toNativeHookExecution);
		},

		queryStats: async (
			_options?: HookStatsOptions,
		): Promise<NativeHookStats> => {
			// Placeholder for hook stats query
			return {
				totalExecutions: 0,
				totalPassed: 0,
				totalFailed: 0,
				passRate: 0,
				uniqueHooks: 0,
				byHookType: undefined,
			};
		},
	};

	// =========================================================================
	// File Change Operations
	// =========================================================================
	fileChanges = {
		list: async (sessionId: string): Promise<NativeSessionFileChange[]> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return [];
			}

			const results = await this.db
				.select()
				.from(schema.sessionFileChanges)
				.where(
					and(
						eq(
							schema.sessionFileChanges.organizationId,
							this.tenant.organizationId,
						),
						eq(schema.sessionFileChanges.sessionId, sessionResult[0].id),
					),
				)
				.orderBy(desc(schema.sessionFileChanges.recordedAt));

			return results.map((c) => ({
				...toNativeFileChange(c),
				sessionId: sessionId,
			}));
		},

		hasChanges: async (sessionId: string): Promise<boolean> => {
			const changes = await this.fileChanges.list(sessionId);
			return changes.length > 0;
		},
	};

	// =========================================================================
	// File Validation Operations
	// =========================================================================
	fileValidations = {
		listAll: async (
			sessionId: string,
		): Promise<NativeSessionFileValidation[]> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return [];
			}

			const results = await this.db
				.select()
				.from(schema.sessionFileValidations)
				.where(
					and(
						eq(
							schema.sessionFileValidations.organizationId,
							this.tenant.organizationId,
						),
						eq(schema.sessionFileValidations.sessionId, sessionResult[0].id),
					),
				)
				.orderBy(desc(schema.sessionFileValidations.validatedAt));

			return results.map((v) => ({
				...toNativeFileValidation(v),
				sessionId: sessionId,
			}));
		},

		get: async (
			sessionId: string,
			filePath: string,
			pluginName: string,
			hookName: string,
			directory: string,
		): Promise<NativeSessionFileValidation | null> => {
			const sessionResult = await this.db
				.select()
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.organizationId, this.tenant.organizationId),
						eq(schema.sessions.localSessionId, sessionId),
					),
				)
				.limit(1);

			if (!sessionResult[0]) {
				return null;
			}

			const result = await this.db
				.select()
				.from(schema.sessionFileValidations)
				.where(
					and(
						eq(
							schema.sessionFileValidations.organizationId,
							this.tenant.organizationId,
						),
						eq(schema.sessionFileValidations.sessionId, sessionResult[0].id),
						eq(schema.sessionFileValidations.filePath, filePath),
						eq(schema.sessionFileValidations.pluginName, pluginName),
						eq(schema.sessionFileValidations.hookName, hookName),
						eq(schema.sessionFileValidations.directory, directory),
					),
				)
				.limit(1);

			return result[0]
				? { ...toNativeFileValidation(result[0]), sessionId: sessionId }
				: null;
		},
	};

	// =========================================================================
	// Session Todos Operations
	// =========================================================================
	sessionTodos = {
		get: async (_sessionId: string): Promise<NativeSessionTodos | null> => {
			// Session todos are not yet implemented in hosted schema
			// Return null for now
			return null;
		},
	};
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Encode a cursor from a session ID
 */
function encodeCursor(sessionId: string): string {
	return Buffer.from(`session:${sessionId}`).toString("base64");
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a HostedDataSource with the current tenant context
 */
export function createHostedDataSource(
	tenant?: TenantContext,
): HostedDataSource {
	return new HostedDataSource(undefined, tenant);
}

// Re-export client utilities
export {
	getDb,
	closeDb,
	getPostgresConfig,
	setTenantContext,
	getTenantContext,
	clearTenantContext,
	withTenantContext,
	type TenantContext,
	type DrizzleDb,
	type PostgresConfig,
} from "./client.ts";
