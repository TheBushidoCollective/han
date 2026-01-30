/**
 * DataSource Interface
 *
 * Abstracts over SQLite (local mode) and PostgreSQL (hosted mode).
 * This interface enables the same GraphQL schema to work with both
 * backend storage systems.
 *
 * All data access in GraphQL resolvers should go through this interface,
 * injected via the GraphQL context.
 */

import type {
	HookExecution,
	HookStats,
	Message,
	NativeTask,
	Project,
	Repo,
	Session,
	SessionFileChange,
	SessionFileValidation,
	SessionTimestamps,
	SessionTodos,
	TaskMetrics,
} from "../../han-native";

// =============================================================================
// Query Options Types
// =============================================================================

/**
 * Options for listing sessions
 */
export interface SessionListOptions {
	projectId?: string | null;
	status?: string | null;
	limit?: number | null;
}

/**
 * Options for listing messages
 */
export interface MessageListOptions {
	sessionId: string;
	messageType?: string | null;
	agentIdFilter?: string | null;
	limit?: number | null;
	offset?: number | null;
}

/**
 * Options for searching messages
 */
export interface MessageSearchOptions {
	query: string;
	sessionId?: string | null;
	limit?: number | null;
}

/**
 * Options for querying task metrics
 */
export interface TaskMetricsOptions {
	taskType?: string | null;
	outcome?: string | null;
	period?: "day" | "week" | "month" | null;
}

/**
 * Options for querying hook stats
 */
export interface HookStatsOptions {
	period?: "day" | "week" | "month" | null;
}

// =============================================================================
// Relay Connection Types
// =============================================================================

/**
 * Page info for Relay connections
 */
export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor?: string | null;
	endCursor?: string | null;
}

/**
 * Generic edge type for Relay connections
 */
export interface Edge<T> {
	node: T;
	cursor: string;
}

/**
 * Generic connection type for Relay connections
 */
export interface Connection<T> {
	edges: Edge<T>[];
	pageInfo: PageInfo;
	totalCount?: number;
}

/**
 * Relay connection arguments
 */
export interface ConnectionArgs {
	first?: number | null;
	after?: string | null;
	last?: number | null;
	before?: string | null;
}

// =============================================================================
// DataSource Interface
// =============================================================================

/**
 * DataSource interface
 *
 * Abstracts database operations so resolvers don't know about the
 * underlying storage mechanism.
 *
 * Two implementations:
 * - LocalDataSource: Wraps existing han-native SQLite operations
 * - HostedDataSource: Uses Drizzle ORM with PostgreSQL
 */
export interface DataSource {
	// =========================================================================
	// Session Operations
	// =========================================================================
	sessions: {
		/**
		 * Get a session by ID
		 */
		get(sessionId: string): Promise<Session | null>;

		/**
		 * List sessions with optional filters
		 */
		list(options?: SessionListOptions): Promise<Session[]>;

		/**
		 * Get sessions as a Relay connection
		 */
		getConnection(
			args: ConnectionArgs & {
				projectId?: string | null;
			},
		): Promise<Connection<Session>>;
	};

	// =========================================================================
	// Message Operations
	// =========================================================================
	messages: {
		/**
		 * Get a message by ID
		 */
		get(messageId: string): Promise<Message | null>;

		/**
		 * List messages with filters and pagination
		 */
		list(options: MessageListOptions): Promise<Message[]>;

		/**
		 * Get message count for a session
		 */
		count(sessionId: string): Promise<number>;

		/**
		 * Get message counts for multiple sessions (batch)
		 */
		countBatch(sessionIds: string[]): Promise<Record<string, number>>;

		/**
		 * Get timestamps for multiple sessions (batch)
		 */
		timestampsBatch(
			sessionIds: string[],
		): Promise<Record<string, SessionTimestamps>>;

		/**
		 * Search messages using full-text search
		 */
		search(options: MessageSearchOptions): Promise<Message[]>;
	};

	// =========================================================================
	// Project Operations
	// =========================================================================
	projects: {
		/**
		 * Get a project by ID
		 */
		get(projectId: string): Promise<Project | null>;

		/**
		 * List all projects
		 */
		list(repoId?: string | null): Promise<Project[]>;

		/**
		 * Get a project by slug
		 */
		getBySlug(slug: string): Promise<Project | null>;

		/**
		 * Get a project by path
		 */
		getByPath(path: string): Promise<Project | null>;
	};

	// =========================================================================
	// Repo Operations
	// =========================================================================
	repos: {
		/**
		 * Get a repo by remote URL
		 */
		getByRemote(remote: string): Promise<Repo | null>;

		/**
		 * List all repos
		 */
		list(): Promise<Repo[]>;
	};

	// =========================================================================
	// Task/Metrics Operations
	// =========================================================================
	tasks: {
		/**
		 * Query task metrics with optional filters
		 */
		queryMetrics(options?: TaskMetricsOptions): Promise<TaskMetrics>;
	};

	// =========================================================================
	// Native Tasks (Claude Code's built-in TaskCreate/TaskUpdate)
	// =========================================================================
	nativeTasks: {
		/**
		 * Get native tasks for a session
		 */
		getForSession(sessionId: string): Promise<NativeTask[]>;

		/**
		 * Get a specific native task by session ID and task ID
		 */
		get(sessionId: string, taskId: string): Promise<NativeTask | null>;
	};

	// =========================================================================
	// Hook Execution Operations
	// =========================================================================
	hookExecutions: {
		/**
		 * List hook executions for a session
		 */
		list(sessionId: string): Promise<HookExecution[]>;

		/**
		 * Query hook statistics
		 */
		queryStats(options?: HookStatsOptions): Promise<HookStats>;
	};

	// =========================================================================
	// File Change Operations
	// =========================================================================
	fileChanges: {
		/**
		 * List file changes for a session
		 */
		list(sessionId: string): Promise<SessionFileChange[]>;

		/**
		 * Check if a session has any file changes
		 */
		hasChanges(sessionId: string): Promise<boolean>;
	};

	// =========================================================================
	// File Validation Operations
	// =========================================================================
	fileValidations: {
		/**
		 * List all validations for a session
		 */
		listAll(sessionId: string): Promise<SessionFileValidation[]>;

		/**
		 * Get a specific file validation
		 */
		get(
			sessionId: string,
			filePath: string,
			pluginName: string,
			hookName: string,
			directory: string,
		): Promise<SessionFileValidation | null>;
	};

	// =========================================================================
	// Session Todos Operations
	// =========================================================================
	sessionTodos: {
		/**
		 * Get todos for a session
		 */
		get(sessionId: string): Promise<SessionTodos | null>;
	};
}

/**
 * DataSource mode indicator
 */
export type DataSourceMode = "local" | "hosted";
