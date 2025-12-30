/**
 * GraphQL Schema
 *
 * Combines all types and creates the executable schema.
 * Uses Relay Node interface - no viewer pattern.
 *
 * Includes @defer directive support for incremental delivery via GraphQL Yoga.
 */

import {
	DirectiveLocation,
	GraphQLBoolean,
	GraphQLDirective,
	GraphQLSchema,
	GraphQLString,
} from "graphql";
import { indexer } from "../../../db/index.ts";
import { startMemoryQuerySession } from "../../../memory/streaming.ts";
import type { ProjectGroup } from "../api/sessions.ts";
import { builder } from "./builder.ts";
import { decodeGlobalId } from "./node-registry.ts";
import {
	type MemoryAgentProgressPayload,
	type MemoryAgentResultPayload,
	type NodeUpdatedPayload,
	type ProjectAddedPayload,
	pubsub,
	type RepoAddedPayload,
	type RepoMemoryAddedPayload,
	type SessionAddedPayload,
	type SessionMessageAddedPayload,
	TOPICS,
	type ToolResultAddedPayload,
} from "./pubsub.ts";
import { ActivityDataType, queryActivityData } from "./types/activity.ts";
import {
	CacheEntryType,
	CacheStatsType,
	getAllCacheEntries,
	queryCacheStats,
} from "./types/cache.ts";
import {
	CheckpointStatsType,
	CheckpointType,
	getAllCheckpoints,
	queryCheckpointStats,
} from "./types/checkpoint.ts";
import { ExposedToolResultType, McpToolResultType } from "./types/han-event.ts";
import { HookExecutionType, HookStatsType } from "./types/hook.ts";
import {
	MemoryAgentProgressType,
	MemoryAgentResultType,
	MemoryQueryType,
	MemorySearchResultType,
} from "./types/memory.ts";
import {
	AssistantMessageType,
	ExposedToolCallMessageType,
	ExposedToolResultMessageType,
	FileHistorySnapshotMessageType,
	HookResultMessageType,
	HookRunMessageType,
	McpToolCallMessageType,
	McpToolResultMessageType,
	MemoryLearnMessageType,
	MemoryQueryMessageType,
	MessageConnectionType,
	MessageEdgeType,
	type MessageWithSession,
	QueueOperationMessageType,
	SentimentAnalysisMessageType,
	SummaryMessageType,
	SystemMessageType,
	UnknownEventMessageType,
	UserMessageType,
} from "./types/message.ts";
import {
	MetricsDataType,
	MetricsPeriodEnum,
	queryMetrics,
	TaskType,
} from "./types/metrics.ts";
import { PageInfoType } from "./types/pagination.ts";
import {
	getAllPlugins,
	PluginCategoryType,
	PluginScopeEnum,
	PluginStatsType,
	PluginType,
	queryPluginCategories,
	queryPluginStats,
	queryPluginsByScope,
	removePluginFromSettings,
	togglePluginEnabled,
} from "./types/plugin.ts";
// Import all types (side effects register them with builder)
import {
	getAllProjects,
	getProjectById,
	ProjectType,
} from "./types/project.ts";
import { getAllRepos, getRepoById, RepoType } from "./types/repo.ts";
import { RuleType } from "./types/rule.ts";
import {
	getAgentTaskById,
	getSessionById,
	getSessionsConnection,
	SessionType,
} from "./types/session.ts";
// Import session-connection first to register shared types
import {
	SessionConnectionType,
	SessionEdgeType,
} from "./types/session-connection.ts";
import {
	McpServerType,
	PermissionsType,
	querySettingsSummary,
	SettingsSummaryType,
} from "./types/settings.ts";
import {
	type MemoryEventPayload,
	MemoryEventType,
} from "./types/subscription.ts";

// =============================================================================
// Direct Root Queries (no viewer pattern)
// =============================================================================

/**
 * Query for all projects
 */
builder.queryField("projects", (t) =>
	t.field({
		type: [ProjectType],
		args: {
			first: t.arg.int({ defaultValue: 20 }),
		},
		description: "All projects with sessions",
		resolve: (_parent, args): ProjectGroup[] => {
			const projects = getAllProjects();
			const first = args.first || 20;
			return projects.slice(0, first);
		},
	}),
);

/**
 * Query for all repos (git repositories)
 */
builder.queryField("repos", (t) =>
	t.field({
		type: [RepoType],
		args: {
			first: t.arg.int({ defaultValue: 20 }),
		},
		description: "All git repositories with sessions",
		resolve: (_parent, args): ProjectGroup[] => {
			const repos = getAllRepos();
			const first = args.first || 20;
			return repos.slice(0, first);
		},
	}),
);

/**
 * Query for a single repo by ID
 */
builder.queryField("repo", (t) =>
	t.field({
		type: RepoType,
		nullable: true,
		args: {
			id: t.arg.string({ required: true }),
		},
		description: "Get a repo by its repoId (git remote-based ID)",
		resolve: (_parent, args) => {
			return getRepoById(args.id);
		},
	}),
);

/**
 * Query for metrics
 */
builder.queryField("metrics", (t) =>
	t.field({
		type: MetricsDataType,
		args: {
			period: t.arg({ type: MetricsPeriodEnum }),
		},
		description: "Task metrics for a time period",
		resolve: (_parent, args) => {
			return queryMetrics(args.period ?? undefined);
		},
	}),
);

/**
 * Query for memory
 */
builder.queryField("memory", (t) =>
	t.field({
		type: MemoryQueryType,
		description: "Memory query interface",
		resolve: () => ({}),
	}),
);

/**
 * Query for cache entries
 */
builder.queryField("cacheEntries", (t) =>
	t.field({
		type: [CacheEntryType],
		description: "All cache entries for the current project",
		resolve: () => getAllCacheEntries(),
	}),
);

/**
 * Query for cache stats
 */
builder.queryField("cacheStats", (t) =>
	t.field({
		type: CacheStatsType,
		description: "Aggregate cache statistics",
		resolve: () => queryCacheStats(),
	}),
);

/**
 * Query for checkpoints
 */
builder.queryField("checkpoints", (t) =>
	t.field({
		type: [CheckpointType],
		description: "All checkpoints for the current project",
		resolve: () => getAllCheckpoints(),
	}),
);

/**
 * Query for checkpoint stats
 */
builder.queryField("checkpointStats", (t) =>
	t.field({
		type: CheckpointStatsType,
		description: "Aggregate checkpoint statistics",
		resolve: () => queryCheckpointStats(),
	}),
);

/**
 * Query for activity data (heatmap, hourly distribution, token usage)
 */
builder.queryField("activity", (t) =>
	t.field({
		type: ActivityDataType,
		args: {
			days: t.arg.int({ defaultValue: 365 }),
		},
		description: "Activity data for dashboard visualizations",
		resolve: async (_parent, args) => queryActivityData(args.days ?? 365),
	}),
);

/**
 * Query for plugins
 */
builder.queryField("plugins", (t) =>
	t.field({
		type: [PluginType],
		args: {
			scope: t.arg({ type: PluginScopeEnum, required: false }),
		},
		description: "Installed plugins, optionally filtered by scope",
		resolve: (_parent, args) => {
			if (args.scope) {
				return queryPluginsByScope(args.scope);
			}
			return getAllPlugins();
		},
	}),
);

/**
 * Query for plugin stats
 */
builder.queryField("pluginStats", (t) =>
	t.field({
		type: PluginStatsType,
		description: "Aggregate plugin statistics",
		resolve: () => queryPluginStats(),
	}),
);

/**
 * Query for plugin categories
 */
builder.queryField("pluginCategories", (t) =>
	t.field({
		type: [PluginCategoryType],
		description: "Plugin counts by category",
		resolve: () => queryPluginCategories(),
	}),
);

/**
 * Query for settings
 */
builder.queryField("settings", (t) =>
	t.field({
		type: SettingsSummaryType,
		args: {
			projectId: t.arg.string({ required: false }),
		},
		description: "Settings summary with all configuration locations",
		resolve: (_parent, args) =>
			querySettingsSummary(args.projectId ?? undefined),
	}),
);

/**
 * Query for a single session by ID
 */
builder.queryField("session", (t) =>
	t.field({
		type: SessionType,
		nullable: true,
		args: {
			id: t.arg.string({ required: true }),
		},
		description: "Get a session by ID",
		resolve: (_parent, args) => {
			return getSessionById(args.id);
		},
	}),
);

/**
 * Query for an agent task by session ID and agent ID
 */
builder.queryField("agentTask", (t) =>
	t.field({
		type: SessionType,
		nullable: true,
		args: {
			sessionId: t.arg.string({ required: true }),
			agentId: t.arg.string({ required: true }),
		},
		description: "Get an agent task by session ID and agent ID",
		resolve: (_parent, args) => {
			return getAgentTaskById(args.sessionId, args.agentId);
		},
	}),
);

/**
 * Query for a single project by ID
 */
builder.queryField("project", (t) =>
	t.field({
		type: ProjectType,
		nullable: true,
		args: {
			id: t.arg.string({ required: true }),
		},
		description: "Get a project by ID",
		resolve: (_parent, args) => {
			return getProjectById(args.id);
		},
	}),
);

/**
 * Query for sessions with Relay-style cursor pagination
 */
builder.queryField("sessions", (t) =>
	t.field({
		type: SessionConnectionType,
		args: {
			first: t.arg.int({
				description: "Number of sessions to fetch from the start",
			}),
			after: t.arg.string({
				description: "Cursor to fetch sessions after",
			}),
			last: t.arg.int({
				description: "Number of sessions to fetch from the end",
			}),
			before: t.arg.string({
				description: "Cursor to fetch sessions before",
			}),
			projectId: t.arg.string({
				description: "Filter by project ID (groups all worktrees)",
			}),
			worktreeName: t.arg.string({
				description: "Filter by worktree name/path",
			}),
		},
		description: "Get sessions with cursor-based pagination",
		resolve: (_parent, args) => {
			return getSessionsConnection({
				first: args.first,
				after: args.after,
				last: args.last,
				before: args.before,
				projectId: args.projectId,
				worktreeName: args.worktreeName,
			});
		},
	}),
);

// =============================================================================
// Subscription Types for Real-time Updates
// =============================================================================

/**
 * Node updated subscription payload type
 */
const NodeUpdatedPayloadRef =
	builder.objectRef<NodeUpdatedPayload>("NodeUpdatedPayload");
const NodeUpdatedPayloadType = NodeUpdatedPayloadRef.implement({
	description: "Payload for node updated events",
	fields: (t) => ({
		id: t.exposeString("id", {
			description: "Global ID of the updated node",
		}),
		typename: t.exposeString("typename", {
			description: "GraphQL typename of the updated node",
		}),
		node: t.field({
			type: builder.nodeInterfaceRef(),
			nullable: true,
			description: "The updated node",
			resolve: async (payload) => {
				const parsed = decodeGlobalId(payload.id);
				if (!parsed) {
					return null;
				}
				// Resolve based on typename
				switch (payload.typename) {
					case "Session":
						return getSessionById(parsed.id);
					// Add other node types here as they implement Node interface
					default:
						return null;
				}
			},
		}),
	}),
});

/**
 * Session message added subscription payload type
 */
const SessionMessageAddedPayloadRef =
	builder.objectRef<SessionMessageAddedPayload>("SessionMessageAddedPayload");
const SessionMessageAddedPayloadType = SessionMessageAddedPayloadRef.implement({
	description: "Payload for session message added events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session the message was added to",
		}),
		messageIndex: t.exposeInt("messageIndex", {
			description: "Index of the new message in the session",
		}),
		newMessageEdge: t.field({
			type: MessageEdgeType,
			nullable: true,
			description:
				"The new message edge for Relay @appendEdge directive. Returns null if message data is not available.",
			resolve: (payload) => {
				// Return the edge data if available - it will be resolved by MessageEdgeType
				if (!payload.newMessageEdge) return null;
				return {
					node: payload.newMessageEdge.node as MessageWithSession,
					cursor: payload.newMessageEdge.cursor,
				};
			},
		}),
	}),
});

/**
 * Tool result added subscription payload type
 */
const ToolResultAddedPayloadRef = builder.objectRef<ToolResultAddedPayload>(
	"ToolResultAddedPayload",
);
const ToolResultAddedPayloadType = ToolResultAddedPayloadRef.implement({
	description: "Payload for tool result added events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session containing the tool call",
		}),
		callId: t.exposeString("callId", {
			description: "Call ID to correlate with the tool call message",
		}),
		type: t.exposeString("type", {
			description: "Type of tool call (mcp or exposed)",
		}),
		success: t.exposeBoolean("success", {
			description: "Whether the tool call succeeded",
		}),
		durationMs: t.exposeInt("durationMs", {
			description: "Duration of the tool call in milliseconds",
		}),
	}),
});

/**
 * Session added subscription payload type
 */
const SessionAddedPayloadRef = builder.objectRef<SessionAddedPayload>(
	"SessionAddedPayload",
);
const SessionAddedPayloadType = SessionAddedPayloadRef.implement({
	description: "Payload for session added events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the new session",
		}),
		parentId: t.string({
			nullable: true,
			description: "Parent project ID (if filtered)",
			resolve: (payload) => payload.parentId,
		}),
	}),
});

/**
 * Repo added subscription payload type
 */
const RepoAddedPayloadRef =
	builder.objectRef<RepoAddedPayload>("RepoAddedPayload");
const RepoAddedPayloadType = RepoAddedPayloadRef.implement({
	description: "Payload for repo added events",
	fields: (t) => ({
		repoId: t.exposeString("repoId", {
			description: "ID of the new repo",
		}),
	}),
});

/**
 * Project added subscription payload type
 */
const ProjectAddedPayloadRef = builder.objectRef<ProjectAddedPayload>(
	"ProjectAddedPayload",
);
const ProjectAddedPayloadType = ProjectAddedPayloadRef.implement({
	description: "Payload for project added events",
	fields: (t) => ({
		projectId: t.exposeString("projectId", {
			description: "ID of the new project",
		}),
		parentId: t.string({
			nullable: true,
			description: "Parent repo ID (for git projects)",
			resolve: (payload) => payload.parentId,
		}),
	}),
});

/**
 * Repo memory added subscription payload type
 */
const RepoMemoryAddedPayloadRef = builder.objectRef<RepoMemoryAddedPayload>(
	"RepoMemoryAddedPayload",
);
const RepoMemoryAddedPayloadType = RepoMemoryAddedPayloadRef.implement({
	description: "Payload for repo memory added events",
	fields: (t) => ({
		repoId: t.exposeString("repoId", {
			description: "ID of the repo",
		}),
		domain: t.exposeString("domain", {
			description: "Memory domain (e.g., 'rules', 'observations')",
		}),
		path: t.exposeString("path", {
			description: "Path to the memory file",
		}),
	}),
});

/**
 * Subscription type for real-time updates
 */
builder.subscriptionType({
	fields: (t) => ({
		// Legacy memory subscription
		memoryUpdated: t.field({
			type: MemoryEventType,
			description: "Subscribe to memory change events",
			subscribe: () =>
				pubsub.asyncIterator<MemoryEventPayload>(TOPICS.MEMORY_UPDATED),
			resolve: (payload: MemoryEventPayload) => payload,
		}),

		// Node-based subscriptions
		nodeUpdated: t.field({
			type: NodeUpdatedPayloadType,
			args: {
				id: t.arg.id({
					required: true,
					description: "Global ID of the node to watch",
				}),
			},
			description: "Subscribe to updates for a specific node",
			subscribe: (_parent, args) => {
				// Filter events by the requested node ID
				const iterator = pubsub.asyncIterator<NodeUpdatedPayload>(
					TOPICS.NODE_UPDATED,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.id === args.id) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: NodeUpdatedPayload) => payload,
		}),

		sessionMessageAdded: t.field({
			type: SessionMessageAddedPayloadType,
			args: {
				sessionId: t.arg.id({
					required: true,
					description: "Session ID to watch for new messages",
				}),
			},
			description: "Subscribe to new messages in a session",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<SessionMessageAddedPayload>(
					TOPICS.SESSION_MESSAGE_ADDED,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.sessionId === args.sessionId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: SessionMessageAddedPayload) => payload,
		}),

		toolResultAdded: t.field({
			type: ToolResultAddedPayloadType,
			args: {
				callId: t.arg.string({
					required: true,
					description: "Call ID to watch for result",
				}),
			},
			description: "Subscribe to tool result for a specific call ID",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<ToolResultAddedPayload>(
					TOPICS.TOOL_RESULT_ADDED,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.callId === args.callId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: ToolResultAddedPayload) => payload,
		}),

		sessionAdded: t.field({
			type: SessionAddedPayloadType,
			args: {
				parentId: t.arg.id({
					required: false,
					description: "Optional project ID to filter by",
				}),
			},
			description: "Subscribe to new sessions",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<SessionAddedPayload>(
					TOPICS.SESSION_ADDED,
				);
				if (!args.parentId) {
					return iterator;
				}
				// Filter by parent ID
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.parentId === args.parentId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: SessionAddedPayload) => payload,
		}),

		repoAdded: t.field({
			type: RepoAddedPayloadType,
			description: "Subscribe to new repos being added",
			subscribe: () =>
				pubsub.asyncIterator<RepoAddedPayload>(TOPICS.REPO_ADDED),
			resolve: (payload: RepoAddedPayload) => payload,
		}),

		projectAdded: t.field({
			type: ProjectAddedPayloadType,
			args: {
				parentId: t.arg.id({
					required: false,
					description: "Optional repo ID to filter by",
				}),
			},
			description: "Subscribe to new projects",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<ProjectAddedPayload>(
					TOPICS.PROJECT_ADDED,
				);
				if (!args.parentId) {
					return iterator;
				}
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.parentId === args.parentId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: ProjectAddedPayload) => payload,
		}),

		repoMemoryAdded: t.field({
			type: RepoMemoryAddedPayloadType,
			args: {
				repoId: t.arg.id({
					required: true,
					description: "Repo ID to watch for memory updates",
				}),
			},
			description: "Subscribe to memory being added to a repo",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<RepoMemoryAddedPayload>(
					TOPICS.REPO_MEMORY_ADDED,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.repoId === args.repoId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: RepoMemoryAddedPayload) => payload,
		}),

		// Memory Agent subscriptions for live streaming
		memoryAgentProgress: t.field({
			type: MemoryAgentProgressType,
			args: {
				sessionId: t.arg.string({
					required: true,
					description: "Memory Agent session ID to watch for progress updates",
				}),
			},
			description: "Subscribe to Memory Agent progress updates during a query",
			subscribe: (_parent, args) => {
				console.log(
					`[GraphQL] memoryAgentProgress subscription started for session: ${args.sessionId}`,
				);
				const iterator = pubsub.asyncIterator<MemoryAgentProgressPayload>(
					TOPICS.MEMORY_AGENT_PROGRESS,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.sessionId === args.sessionId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: MemoryAgentProgressPayload) => payload,
		}),

		memoryAgentResult: t.field({
			type: MemoryAgentResultType,
			args: {
				sessionId: t.arg.string({
					required: true,
					description: "Memory Agent session ID to watch for final result",
				}),
			},
			description: "Subscribe to Memory Agent final result",
			subscribe: (_parent, args) => {
				console.log(
					`[GraphQL] memoryAgentResult subscription started for session: ${args.sessionId}`,
				);
				const iterator = pubsub.asyncIterator<MemoryAgentResultPayload>(
					TOPICS.MEMORY_AGENT_RESULT,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.sessionId === args.sessionId) {
									return result;
								}
							}
						},
						return: () =>
							iterator.return?.() ??
							Promise.resolve({ value: undefined, done: true }),
						throw: (e: Error) => iterator.throw?.(e) ?? Promise.reject(e),
					}),
				};
			},
			resolve: (payload: MemoryAgentResultPayload) => payload,
		}),
	}),
});

/**
 * Plugin mutation result type
 */
interface PluginMutationResult {
	success: boolean;
	message: string;
}

/**
 * Indexing result type
 */
interface IndexingResult {
	success: boolean;
	sessionsIndexed: number;
	totalMessages: number;
	errors: string[];
}

const PluginMutationResultRef = builder.objectRef<PluginMutationResult>(
	"PluginMutationResult",
);

const PluginMutationResultType = PluginMutationResultRef.implement({
	description: "Result of a plugin mutation",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the operation succeeded",
		}),
		message: t.exposeString("message", {
			description: "Status message",
		}),
	}),
});

/**
 * Memory query start result type
 */
interface MemoryQueryStartResult {
	sessionId: string;
	success: boolean;
	message: string;
}

const MemoryQueryStartResultRef = builder.objectRef<MemoryQueryStartResult>(
	"MemoryQueryStartResult",
);

const MemoryQueryStartResultType = MemoryQueryStartResultRef.implement({
	description: "Result of starting a memory query with streaming",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description:
				"Session ID to use for subscribing to progress updates via memoryAgentProgress subscription",
		}),
		success: t.exposeBoolean("success", {
			description: "Whether the query was started successfully",
		}),
		message: t.exposeString("message", {
			description: "Status message or error details",
		}),
	}),
});

/**
 * Indexing result type for GraphQL
 */
const IndexingResultRef = builder.objectRef<IndexingResult>("IndexingResult");

const IndexingResultType = IndexingResultRef.implement({
	description: "Result of indexing sessions",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether indexing completed successfully",
		}),
		sessionsIndexed: t.exposeInt("sessionsIndexed", {
			description: "Number of sessions indexed",
		}),
		totalMessages: t.exposeInt("totalMessages", {
			description: "Total messages indexed",
		}),
		errors: t.exposeStringList("errors", {
			description: "Any errors encountered during indexing",
		}),
	}),
});

/**
 * Mutation type for plugin management
 */
builder.mutationType({
	fields: (t) => ({
		togglePlugin: t.field({
			type: PluginMutationResultType,
			args: {
				name: t.arg.string({ required: true }),
				marketplace: t.arg.string({ required: true }),
				scope: t.arg({ type: PluginScopeEnum, required: true }),
				enabled: t.arg.boolean({ required: true }),
			},
			description: "Enable or disable a plugin",
			resolve: (_parent, args) => {
				const success = togglePluginEnabled(
					args.name,
					args.marketplace,
					args.scope,
					args.enabled,
				);
				return {
					success,
					message: success
						? `Plugin ${args.name} ${args.enabled ? "enabled" : "disabled"}`
						: `Failed to ${args.enabled ? "enable" : "disable"} plugin ${args.name}`,
				};
			},
		}),
		removePlugin: t.field({
			type: PluginMutationResultType,
			args: {
				name: t.arg.string({ required: true }),
				marketplace: t.arg.string({ required: true }),
				scope: t.arg({ type: PluginScopeEnum, required: true }),
			},
			description: "Remove a plugin from settings",
			resolve: (_parent, args) => {
				const success = removePluginFromSettings(
					args.name,
					args.marketplace,
					args.scope,
				);
				return {
					success,
					message: success
						? `Plugin ${args.name} removed`
						: `Failed to remove plugin ${args.name}`,
				};
			},
		}),
		indexSessions: t.field({
			type: IndexingResultType,
			description:
				"Trigger full indexing of all Claude Code sessions from JSONL files",
			resolve: async () => {
				try {
					const results = await indexer.fullScanAndIndex();
					const errors = results
						.filter((r) => r.error)
						.map((r) => `${r.sessionId}: ${r.error}`);
					const totalMessages = results.reduce(
						(sum, r) => sum + r.messagesIndexed,
						0,
					);
					return {
						success: errors.length === 0,
						sessionsIndexed: results.length,
						totalMessages,
						errors,
					};
				} catch (error) {
					return {
						success: false,
						sessionsIndexed: 0,
						totalMessages: 0,
						errors: [error instanceof Error ? error.message : String(error)],
					};
				}
			},
		}),
		startMemoryQuery: t.field({
			type: MemoryQueryStartResultType,
			args: {
				question: t.arg.string({ required: true }),
				projectPath: t.arg.string({
					required: true,
					description:
						"Project filesystem path for plugin discovery. Required for context-aware search.",
				}),
				model: t.arg.string({ required: false }),
			},
			description:
				"Start a memory query with streaming. Returns a session ID to subscribe to progress updates.",
			resolve: async (_parent, args) => {
				try {
					const sessionId = await startMemoryQuerySession({
						question: args.question,
						projectPath: args.projectPath,
						model: (args.model as "haiku" | "sonnet" | "opus") || "haiku",
					});
					return {
						sessionId,
						success: true,
						message:
							"Memory query started. Subscribe to memoryAgentProgress for updates.",
					};
				} catch (error) {
					return {
						sessionId: "",
						success: false,
						message: error instanceof Error ? error.message : String(error),
					};
				}
			},
		}),
	}),
});

// Export unused imports to prevent tree shaking
export {
	RuleType,
	TaskType,
	MemorySearchResultType,
	MemoryAgentProgressType,
	MemoryAgentResultType,
	CacheEntryType,
	CacheStatsType,
	CheckpointType,
	CheckpointStatsType,
	PluginType,
	PluginStatsType,
	PluginCategoryType,
	SettingsSummaryType,
	McpServerType,
	PermissionsType,
	HookExecutionType,
	HookStatsType,
	RepoType,
	ActivityDataType,
	// Pagination types
	PageInfoType,
	SessionConnectionType,
	SessionEdgeType,
	MessageConnectionType,
	MessageEdgeType,
	// Message types - concrete implementations of Message interface
	UserMessageType,
	AssistantMessageType,
	SummaryMessageType,
	SystemMessageType,
	FileHistorySnapshotMessageType,
	HookRunMessageType,
	HookResultMessageType,
	QueueOperationMessageType,
	McpToolCallMessageType,
	McpToolResultMessageType,
	ExposedToolCallMessageType,
	ExposedToolResultMessageType,
	MemoryQueryMessageType,
	MemoryLearnMessageType,
	SentimentAnalysisMessageType,
	UnknownEventMessageType,
	// Inline result types for tool calls
	McpToolResultType,
	ExposedToolResultType,
};

// Define the @defer directive for incremental delivery
// This allows fragments to be loaded asynchronously via GraphQL Yoga
const deferDirective = new GraphQLDirective({
	name: "defer",
	description:
		"Defers resolution of a fragment, allowing the rest of the response to be returned first",
	locations: [
		DirectiveLocation.FRAGMENT_SPREAD,
		DirectiveLocation.INLINE_FRAGMENT,
	],
	args: {
		if: {
			type: GraphQLBoolean,
			description: "Condition to check if the fragment should be deferred",
		},
		label: {
			type: GraphQLString,
			description: "Unique label to identify the deferred fragment",
		},
	},
});

// Build the base schema from Pothos
const baseSchema = builder.toSchema();

// Create a new schema that includes the @defer directive
export const schema = new GraphQLSchema({
	query: baseSchema.getQueryType(),
	mutation: baseSchema.getMutationType(),
	subscription: baseSchema.getSubscriptionType(),
	types: Object.values(baseSchema.getTypeMap()),
	directives: [...baseSchema.getDirectives(), deferDirective],
});
