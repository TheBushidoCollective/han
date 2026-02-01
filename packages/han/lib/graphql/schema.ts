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
import type { ProjectGroup } from "../api/sessions.ts";
import { indexer } from "../db/index.ts";
import { startMemoryQuerySession } from "../memory/streaming.ts";
import { builder } from "./builder.ts";
import { decodeGlobalId } from "./node-registry.ts";
import {
	type HookResultAddedPayload,
	type MemoryAgentProgressPayload,
	type MemoryAgentResultPayload,
	type NodeUpdatedPayload,
	type ProjectAddedPayload,
	pubsub,
	type RepoAddedPayload,
	type RepoMemoryAddedPayload,
	type SessionAddedPayload,
	type SessionFilesChangedPayload,
	type SessionHooksChangedPayload,
	type SessionMessageAddedPayload,
	type SessionTodosChangedPayload,
	TOPICS,
	type ToolResultAddedPayload,
} from "./pubsub.ts";
import { ActivityDataType, queryActivityData } from "./types/activity-data.ts";
import { CacheEntryType, getAllCacheEntries } from "./types/cache-entry.ts";
import { CacheStatsType, queryCacheStats } from "./types/cache-stats.ts";
import { PluginScopeEnum } from "./types/enums/plugin-scope.ts";
import { HookExecutionType } from "./types/hook-execution.ts";
import { HookStatsType } from "./types/hook-stats.ts";
import { McpServerType } from "./types/mcp-server.ts";
import {
	MemoryAgentProgressType,
	MemoryAgentResultType,
	MemoryQueryType,
	MemorySearchResultType,
} from "./types/memory.ts";
import {
	type MemoryEventPayload,
	MemoryEventType,
} from "./types/memory-event.ts";
import {
	AssistantMessageType,
	CommandUserMessageType,
	ExposedToolCallMessageType,
	ExposedToolResultMessageType,
	ExposedToolResultType,
	FileHistorySnapshotMessageType,
	HookCheckStateMessage,
	HookDatetimeMessageType,
	HookFileChangeMessageType,
	HookReferenceMessageType,
	HookResultMessageType,
	HookRunMessageType,
	HookScriptMessageType,
	HookValidationCacheMessageType,
	HookValidationMessageType,
	InterruptUserMessageType,
	McpToolCallMessageType,
	McpToolResultMessageType,
	McpToolResultType,
	MemoryLearnMessageType,
	MemoryQueryMessageType,
	MessageConnectionType,
	MessageEdgeType,
	MessageInterface,
	type MessageWithSession,
	MetaUserMessageType,
	nativeMessageToMessageWithSession,
	QueueOperationMessageType,
	RegularUserMessageType,
	SentimentAnalysisMessageType,
	SummaryMessageType,
	SystemMessageType,
	ToolResultUserMessageType,
	UnknownEventMessageType,
	UserMessageInterface,
} from "./types/message.ts";
import {
	MetricsDataType,
	MetricsPeriodEnum,
	queryMetrics,
	TaskType,
} from "./types/metrics.ts";
import {
	GranularityEnum,
	queryTeamMetrics,
	TeamMetricsType,
} from "./types/team-metrics/index.ts";
import { PageInfoType } from "./types/pagination.ts";
import { PermissionsType } from "./types/permissions.ts";
// Auth types - registers mutations and queries via side effects
import {
	AuthUserType,
	AuthSessionType,
	OAuthConnectionType,
	TokenPairType,
	OAuthInitiateResultType,
	AuthResultType,
	MagicLinkResultType,
	LinkResultType,
	OAuthProviderEnum,
} from "./types/auth/index.ts";
import {
	getAllPlugins,
	PluginType,
	queryPluginsByScope,
	removePluginFromSettings,
	togglePluginEnabled,
} from "./types/plugin.ts";
import {
	PluginCategoryType,
	queryPluginCategories,
} from "./types/plugin-category.ts";
import { PluginStatsType, queryPluginStats } from "./types/plugin-stats.ts";
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
	querySettingsSummary,
	SettingsSummaryType,
} from "./types/settings-summary.ts";
// Team Memory types (adds teamMemory and orgLearnings queries)
import {
	OrgLearningsQueryInput,
	TeamMemoryQueryInput,
	UserContextInput,
} from "./types/team-memory-query.ts";
// Team Memory mutations (share, export/import, admin controls)
import {
	ShareLearningInput,
	TeamUserContextInput,
	ExportOptionsInput,
	ImportOptionsInput,
	SharingPolicyInput,
	ShareLearningResultType,
	SharedLearningType,
	TeamKnowledgeExportResultType,
	TeamKnowledgeImportResultType,
	ModerationResultType,
	OrgSharingPolicyType,
	PolicyUpdateResultType,
} from "./types/team-memory-mutations.ts";
import {
	CitationVisibilityEnum,
	MemoryLayerInfoType,
	MemoryScopeEnum,
	OrgLearningsResultType,
	OrgLearningsTimeRangeType,
	OrgLearningType,
	TeamCitationType,
	TeamMemoryResultType,
	TeamMemoryStatsType,
} from "./types/memory/index.ts";
import { SlotAcquireResultType } from "./types/slot-acquire-result.ts";
import {
	acquireSlot,
	querySlotStatus,
	releaseSlot,
} from "./types/slot-manager.ts";
import { SlotReleaseResultType } from "./types/slot-release-result.ts";
import { SlotStatusType } from "./types/slot-status.ts";
// Team platform types
import {
	OrgType,
	TeamMemberType,
	UserType,
	type OrgData,
	type TeamMemberData,
	type UserData,
} from "./types/team/index.ts";

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
 * Query for team metrics (aggregate dashboard data)
 */
builder.queryField("teamMetrics", (t) =>
	t.field({
		type: TeamMetricsType,
		args: {
			startDate: t.arg.string({ description: "Start date (ISO format)" }),
			endDate: t.arg.string({ description: "End date (ISO format)" }),
			projectIds: t.arg.stringList({ description: "Filter by project IDs" }),
			granularity: t.arg({ type: GranularityEnum, description: "Time grouping" }),
		},
		description: "Team-level aggregate metrics for dashboard",
		resolve: async (_parent, args, context) => {
			// Permission check: user must be authenticated
			if (!context.user) {
				throw new Error("Authentication required to access team metrics");
			}

			// Permission check: if projectIds specified, user must have access to all of them
			if (args.projectIds && args.projectIds.length > 0) {
				const userProjectIds = context.user.projectIds || [];
				const isAdmin = context.user.role === "admin";

				// Admins can access all projects, others need explicit access
				if (!isAdmin) {
					const unauthorizedProjects = args.projectIds.filter(
						(pid) => !userProjectIds.includes(pid)
					);
					if (unauthorizedProjects.length > 0) {
						throw new Error(
							`Access denied to projects: ${unauthorizedProjects.join(", ")}`
						);
					}
				}
			}

			return queryTeamMetrics({
				startDate: args.startDate,
				endDate: args.endDate,
				projectIds: args.projectIds,
				granularity: args.granularity as "day" | "week" | "month" | null,
				userContext: context.user,
			});
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
 * Query for global slot status
 */
builder.queryField("slots", (t) =>
	t.field({
		type: SlotStatusType,
		description:
			"Global slot pool status for cross-session resource management",
		resolve: () => querySlotStatus(),
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
		resolve: async (_parent, args, context) =>
			queryActivityData(args.days ?? 365, context.dataSource),
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
 * Query for a single message by UUID
 * ID format: UUID (the message's unique identifier) or "Message:{uuid}"
 */
builder.queryField("message", (t) =>
	t.field({
		type: MessageInterface,
		nullable: true,
		args: {
			id: t.arg.string({ required: true }),
		},
		description:
			"Get a message by its UUID (optionally prefixed with 'Message:')",
		resolve: async (_parent, args, context) => {
			// Extract the UUID from the ID
			// Accept either raw UUID or "Message:{uuid}" format
			let messageId = args.id;

			// Strip the "Message:" prefix if present
			if (messageId.startsWith("Message:")) {
				messageId = messageId.slice(8);
			}

			// Fetch message by UUID using DataSource
			const msg = await context.dataSource.messages.get(messageId);
			if (!msg) {
				return null;
			}

			return nativeMessageToMessageWithSession(msg);
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
		resolve: async (_parent, args) => {
			return await getAgentTaskById(args.sessionId, args.agentId);
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
			userId: t.arg.string({
				description: "Filter by user ID (team mode only - filters sessions by owner)",
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
				userId: args.userId,
			});
		},
	}),
);

// =============================================================================
// Team Platform Queries (hosted mode only)
// =============================================================================

/**
 * Query for current user (hosted mode only)
 * Returns null in local mode
 */
builder.queryField("currentUser", (t) =>
	t.field({
		type: UserType,
		nullable: true,
		description:
			"Current authenticated user (only available in hosted team mode)",
		resolve: (): UserData | null => {
			// In local mode, return null
			// In hosted mode, this would be populated from auth context
			// For now, return null - will be extended when team backend is ready
			return null;
		},
	}),
);

/**
 * Query for current organization (hosted mode only)
 * Returns null in local mode
 */
builder.queryField("currentOrg", (t) =>
	t.field({
		type: OrgType,
		nullable: true,
		description:
			"Current organization context (only available in hosted team mode)",
		resolve: (): OrgData | null => {
			// In local mode, return null
			// In hosted mode, this would be populated from auth context
			return null;
		},
	}),
);

/**
 * Query for user's organizations (hosted mode only)
 * Returns empty array in local mode
 */
builder.queryField("orgs", (t) =>
	t.field({
		type: [OrgType],
		description:
			"Organizations the current user belongs to (only available in hosted team mode)",
		resolve: (): OrgData[] => {
			// In local mode, return empty array
			// In hosted mode, this would fetch user's orgs
			return [];
		},
	}),
);

/**
 * Query for organization members (hosted mode only)
 * Returns empty array in local mode
 */
builder.queryField("orgMembers", (t) =>
	t.field({
		type: [TeamMemberType],
		args: {
			orgId: t.arg.string({ required: true }),
		},
		description:
			"Members of an organization (only available in hosted team mode)",
		resolve: (_parent, _args): TeamMemberData[] => {
			// In local mode, return empty array
			// In hosted mode, this would fetch org members
			return [];
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
 * Hook result added subscription payload type
 */
const HookResultAddedPayloadRef = builder.objectRef<HookResultAddedPayload>(
	"HookResultAddedPayload",
);
const HookResultAddedPayloadType = HookResultAddedPayloadRef.implement({
	description: "Payload for hook result added events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session containing the hook run",
		}),
		hookRunId: t.exposeString("hookRunId", {
			description: "UUID of the parent hook_run event for correlation",
		}),
		pluginName: t.exposeString("pluginName", {
			description: "Plugin that executed the hook",
		}),
		hookName: t.exposeString("hookName", {
			description: "Name of the hook that was executed",
		}),
		success: t.exposeBoolean("success", {
			description: "Whether the hook succeeded",
		}),
		durationMs: t.exposeInt("durationMs", {
			description: "Duration of the hook execution in milliseconds",
		}),
	}),
});

/**
 * Session todos changed subscription payload type
 */
const SessionTodosChangedPayloadRef =
	builder.objectRef<SessionTodosChangedPayload>("SessionTodosChangedPayload");
const SessionTodosChangedPayloadType = SessionTodosChangedPayloadRef.implement({
	description: "Payload for session todos changed events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session whose todos changed",
		}),
		todoCount: t.exposeInt("todoCount", {
			description: "Total count of todos after the change",
		}),
		inProgressCount: t.exposeInt("inProgressCount", {
			description: "Count of in-progress todos",
		}),
		completedCount: t.exposeInt("completedCount", {
			description: "Count of completed todos",
		}),
	}),
});

/**
 * Session files changed subscription payload type
 */
const SessionFilesChangedPayloadRef =
	builder.objectRef<SessionFilesChangedPayload>("SessionFilesChangedPayload");
const SessionFilesChangedPayloadType = SessionFilesChangedPayloadRef.implement({
	description: "Payload for session files changed events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session whose files changed",
		}),
		fileCount: t.exposeInt("fileCount", {
			description: "Count of file changes",
		}),
		toolName: t.exposeString("toolName", {
			description: "Name of the tool that triggered the change",
		}),
	}),
});

/**
 * Session hooks changed subscription payload type
 */
const SessionHooksChangedPayloadRef =
	builder.objectRef<SessionHooksChangedPayload>("SessionHooksChangedPayload");
const SessionHooksChangedPayloadType = SessionHooksChangedPayloadRef.implement({
	description: "Payload for session hooks changed events",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "ID of the session whose hooks changed",
		}),
		pluginName: t.exposeString("pluginName", {
			description: "Plugin name of the hook",
		}),
		hookName: t.exposeString("hookName", {
			description: "Name of the hook",
		}),
		eventType: t.exposeString("eventType", {
			description: "Whether this is a new run or a result update",
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

		hookResultAdded: t.field({
			type: HookResultAddedPayloadType,
			args: {
				hookRunId: t.arg.string({
					required: true,
					description: "Hook run UUID to watch for result",
				}),
			},
			description: "Subscribe to hook result for a specific hook run ID",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<HookResultAddedPayload>(
					TOPICS.HOOK_RESULT_ADDED,
				);
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							while (true) {
								const result = await iterator.next();
								if (result.done) return result;
								if (result.value.hookRunId === args.hookRunId) {
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
			resolve: (payload: HookResultAddedPayload) => payload,
		}),

		sessionTodosChanged: t.field({
			type: SessionTodosChangedPayloadType,
			args: {
				sessionId: t.arg.id({
					required: true,
					description: "Session ID to watch for todo changes",
				}),
			},
			description: "Subscribe to todo changes for a session",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<SessionTodosChangedPayload>(
					TOPICS.SESSION_TODOS_CHANGED,
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
			resolve: (payload: SessionTodosChangedPayload) => payload,
		}),

		sessionFilesChanged: t.field({
			type: SessionFilesChangedPayloadType,
			args: {
				sessionId: t.arg.id({
					required: true,
					description: "Session ID to watch for file changes",
				}),
			},
			description: "Subscribe to file changes for a session",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<SessionFilesChangedPayload>(
					TOPICS.SESSION_FILES_CHANGED,
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
			resolve: (payload: SessionFilesChangedPayload) => payload,
		}),

		sessionHooksChanged: t.field({
			type: SessionHooksChangedPayloadType,
			args: {
				sessionId: t.arg.id({
					required: true,
					description: "Session ID to watch for hook changes",
				}),
			},
			description: "Subscribe to hook run and result events for a session",
			subscribe: (_parent, args) => {
				const iterator = pubsub.asyncIterator<SessionHooksChangedPayload>(
					TOPICS.SESSION_HOOKS_CHANGED,
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
			resolve: (payload: SessionHooksChangedPayload) => payload,
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
		// ================== Global Slot Management ==================
		acquireSlot: t.field({
			type: SlotAcquireResultType,
			args: {
				sessionId: t.arg.string({ required: true }),
				hookName: t.arg.string({ required: true }),
				pid: t.arg.int({ required: true }),
				pluginName: t.arg.string({ required: false }),
			},
			description:
				"Acquire a global execution slot. Returns slot ID if granted, -1 if no slots available.",
			resolve: (_parent, args) =>
				acquireSlot(
					args.sessionId,
					args.hookName,
					args.pid,
					args.pluginName ?? undefined,
				),
		}),
		releaseSlot: t.field({
			type: SlotReleaseResultType,
			args: {
				slotId: t.arg.int({ required: true }),
				pid: t.arg.int({ required: true }),
			},
			description: "Release a previously acquired slot",
			resolve: (_parent, args) => releaseSlot(args.slotId, args.pid),
		}),
	}),
});

// Export unused imports to prevent tree shaking
export {
	RuleType,
	TaskType,
	TeamMetricsType,
	MemorySearchResultType,
	MemoryAgentProgressType,
	MemoryAgentResultType,
	CacheEntryType,
	CacheStatsType,
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
	UserMessageInterface,
	RegularUserMessageType,
	MetaUserMessageType,
	CommandUserMessageType,
	InterruptUserMessageType,
	ToolResultUserMessageType,
	AssistantMessageType,
	SummaryMessageType,
	SystemMessageType,
	FileHistorySnapshotMessageType,
	HookRunMessageType,
	HookResultMessageType,
	HookCheckStateMessage,
	HookDatetimeMessageType,
	HookFileChangeMessageType,
	HookReferenceMessageType,
	HookScriptMessageType,
	HookValidationCacheMessageType,
	HookValidationMessageType,
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
	// Auth types
	AuthUserType,
	AuthSessionType,
	OAuthConnectionType,
	TokenPairType,
	OAuthInitiateResultType,
	AuthResultType,
	MagicLinkResultType,
	LinkResultType,
	OAuthProviderEnum,
	// Team platform types
	UserType,
	OrgType,
	TeamMemberType,
	// Team Memory types
	TeamMemoryQueryInput,
	UserContextInput,
	OrgLearningsQueryInput,
	CitationVisibilityEnum,
	MemoryScopeEnum,
	TeamCitationType,
	TeamMemoryResultType,
	TeamMemoryStatsType,
	OrgLearningType,
	OrgLearningsResultType,
	OrgLearningsTimeRangeType,
	MemoryLayerInfoType,
	// Team Memory mutation types
	ShareLearningInput,
	TeamUserContextInput,
	ExportOptionsInput,
	ImportOptionsInput,
	SharingPolicyInput,
	ShareLearningResultType,
	SharedLearningType,
	TeamKnowledgeExportResultType,
	TeamKnowledgeImportResultType,
	ModerationResultType,
	OrgSharingPolicyType,
	PolicyUpdateResultType,
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
