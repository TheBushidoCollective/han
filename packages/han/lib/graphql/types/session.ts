/**
 * GraphQL Session type
 *
 * Represents a Claude Code session with messages.
 */

import type { CheckpointSummary } from "../../api/checkpoints.ts";
import {
	getAgentTask,
	getAgentTasksForSession,
	getSessionAsync,
	getSessionMessagesOnlyAsync,
	listSessions,
	listSessionsAsync,
	type SessionMessage,
} from "../../api/sessions.ts";
import type {
	Task as DbTask,
	SessionFileChange as FileChangeData,
	SessionFileValidation as FileValidationData,
} from "../../db/index.ts";
import { sessionFileChanges, sessionFileValidations } from "../../db/index.ts";
import { builder } from "../builder.ts";
import { registerNodeLoader } from "../node-registry.ts";
import { CheckpointType } from "./checkpoint.ts";
import {
	ImageBlockType,
	TextBlockType,
	ThinkingBlockType,
	type ToolResultBlockData,
	ToolResultBlockType,
	ToolUseBlockType,
} from "./content-block.ts";
import {
	ExposedToolCallEventType,
	ExposedToolResultEventType,
	HookResultEventType,
	HookRunEventType,
	McpToolCallEventType,
	McpToolResultEventType,
	MemoryLearnEventType,
	MemoryQueryEventType,
} from "./han-event.ts";
import {
	HookExecutionType,
	HookStatsType,
	queryHookExecutionsForSession,
	querySessionHookStats,
} from "./hook.ts";
import {
	AssistantMessageType,
	type ContentBlock,
	ExposedToolCallMessageType,
	ExposedToolResultMessageType,
	FileHistorySnapshotMessageType,
	getMessageText,
	HookResultMessageType,
	HookRunMessageType,
	McpToolCallMessageType,
	McpToolResultMessageType,
	MemoryLearnMessageType,
	MemoryQueryMessageType,
	type MessageConnectionData,
	MessageConnectionType,
	MessageEdgeType,
	QueueOperationMessageType,
	SentimentAnalysisMessageType,
	SummaryMessageType,
	SystemMessageType,
	UnknownEventMessageType,
	UserMessageType,
} from "./message.ts";
import {
	getActiveTasksForSession,
	getTasksForSession,
	TaskType,
} from "./metrics.ts";
import {
	applyConnectionArgs,
	type ConnectionArgs,
	encodeCursor,
} from "./pagination.ts";
// Import shared session types to avoid circular dependencies
import { ProjectRef } from "./project.ts";
import {
	type SessionConnectionData,
	SessionConnectionType,
	type SessionData,
	SessionEdgeType,
	SessionRef,
} from "./session-connection.ts";
import {
	extractTodosFromMessages,
	getActiveTodos,
	getCurrentTodo,
	getTodoCounts,
	TodoCountsType,
	type TodoItem,
	TodoType,
} from "./todo.ts";

// Note: getProjectById is imported dynamically at resolve time to avoid circular dependency

/**
 * MessageSearchResult type for searchMessages field
 */
export interface MessageSearchResultData {
	messageId: string;
	messageIndex: number;
	preview: string;
	matchContext: string;
}

export const MessageSearchResultType =
	builder.objectRef<MessageSearchResultData>("MessageSearchResult");
MessageSearchResultType.implement({
	description: "A search result from searching session messages",
	fields: (t) => ({
		messageId: t.exposeString("messageId", {
			description: "The message ID",
		}),
		messageIndex: t.exposeInt("messageIndex", {
			description:
				"The 0-based index of the message in the session (for jumping)",
		}),
		preview: t.exposeString("preview", {
			description: "Preview text showing match context",
		}),
		matchContext: t.exposeString("matchContext", {
			description: "The matched text with surrounding context",
		}),
	}),
});

/**
 * FileChange action enum
 */
export const FileChangeActionEnum = builder.enumType("FileChangeAction", {
	description: "The type of file change action",
	values: {
		CREATED: { value: "created", description: "File was created" },
		MODIFIED: { value: "modified", description: "File was modified" },
		DELETED: { value: "deleted", description: "File was deleted" },
	},
});

/**
 * FileValidation GraphQL type
 * Represents a hook validation for a file
 */
export const FileValidationType =
	builder.objectRef<FileValidationData>("FileValidation");
FileValidationType.implement({
	description: "A hook validation for a file",
	fields: (t) => ({
		id: t.exposeString("id", {
			nullable: true,
			description: "Unique identifier for this validation",
		}),
		pluginName: t.exposeString("pluginName", {
			description: "Name of the plugin that validated the file",
		}),
		hookName: t.exposeString("hookName", {
			description: "Name of the hook that validated the file",
		}),
		directory: t.exposeString("directory", {
			description: "Directory context for the validation",
		}),
		validatedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "When the file was validated",
			resolve: (fv) => fv.validatedAt ?? null,
		}),
	}),
});

/**
 * FileChange GraphQL type
 * Represents a file that was changed during a session
 */
export const FileChangeType = builder.objectRef<FileChangeData>("FileChange");
FileChangeType.implement({
	description: "A file change that occurred during a session",
	fields: (t) => ({
		id: t.exposeString("id", {
			nullable: true,
			description: "Unique identifier for this file change",
		}),
		sessionId: t.exposeString("sessionId", {
			description: "The session ID this change belongs to",
		}),
		filePath: t.exposeString("filePath", {
			description: "Path to the changed file",
		}),
		action: t.field({
			type: FileChangeActionEnum,
			description: "The type of change (created, modified, deleted)",
			resolve: (fc) => fc.action as "created" | "modified" | "deleted",
		}),
		fileHashBefore: t.exposeString("fileHashBefore", {
			nullable: true,
			description: "SHA256 hash of file before change (if available)",
		}),
		fileHashAfter: t.exposeString("fileHashAfter", {
			nullable: true,
			description: "SHA256 hash of file after change (if available)",
		}),
		toolName: t.exposeString("toolName", {
			nullable: true,
			description: "The tool that made the change (Edit, Write, Bash)",
		}),
		recordedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "When the change was recorded",
			resolve: (fc) => fc.recordedAt ?? null,
		}),
		validations: t.field({
			type: [FileValidationType],
			description: "Hook validations for this file",
			resolve: async (fc): Promise<FileValidationData[]> => {
				// Get all validations for the session
				const allValidations = await sessionFileValidations.listAll(
					fc.sessionId,
				);
				// Filter to validations for this specific file
				return allValidations.filter((v) => v.filePath === fc.filePath);
			},
		}),
		isValidated: t.boolean({
			description: "Whether this file has been validated by any hook",
			resolve: async (fc): Promise<boolean> => {
				const allValidations = await sessionFileValidations.listAll(
					fc.sessionId,
				);
				return allValidations.some((v) => v.filePath === fc.filePath);
			},
		}),
	}),
});

// Ensure content block types are registered
void ThinkingBlockType;
void TextBlockType;
void ToolUseBlockType;
void ToolResultBlockType;
void ImageBlockType;

// Ensure Han event types are registered
void HookRunEventType;
void HookResultEventType;
void McpToolCallEventType;
void McpToolResultEventType;
void ExposedToolCallEventType;
void ExposedToolResultEventType;
void MemoryQueryEventType;
void MemoryLearnEventType;

// Ensure message types are registered (interface pattern)
void UserMessageType;
void AssistantMessageType;
void SummaryMessageType;
void SystemMessageType;
void FileHistorySnapshotMessageType;
void HookRunMessageType;
void HookResultMessageType;
void QueueOperationMessageType;
void McpToolCallMessageType;
void McpToolResultMessageType;
void ExposedToolCallMessageType;
void ExposedToolResultMessageType;
void MemoryQueryMessageType;
void MemoryLearnMessageType;
void SentimentAnalysisMessageType;
void UnknownEventMessageType;
void MessageEdgeType;
void MessageConnectionType;

// Message types are now defined in message.ts with interface pattern

/**
 * Get messages for a session with cursor-based pagination (internal helper)
 * Returns messages in DESCENDING order (newest first) for column-reverse display.
 * @param sessionId - The session ID
 * @param projectDir - The encoded project directory (e.g., -Volumes-dev-src-...)
 * @param args - Pagination arguments
 */
async function getMessagesConnectionInternal(
	sessionId: string,
	projectDir: string | null,
	args: ConnectionArgs,
): Promise<MessageConnectionData> {
	// Load messages from database
	const messages = await getSessionMessagesOnlyAsync(sessionId);
	if (messages.length === 0) {
		return {
			edges: [],
			pageInfo: {
				hasNextPage: false,
				hasPreviousPage: false,
				startCursor: null,
				endCursor: null,
			},
			totalCount: 0,
		};
	}

	// Use projectDir from parameter or empty string
	const msgProjectDir = projectDir || "";

	// Add projectDir, sessionId, and positional index to each message
	// Messages are sorted by timestamp DESC from the database, so index is stable for cursors
	// Note: This is NOT the JSONL line number - it's a positional index for cursor generation
	const messagesWithMetadata = messages.map((msg, index) => ({
		...msg,
		projectDir: msgProjectDir,
		sessionId,
		lineNumber: index + 1, // 1-indexed positional index for cursor
	}));

	// Filter out empty messages, tool-result-only messages, and paired Han event types
	// Paired events are loaded via DataLoader as nested fields on their parent messages:
	// - sentiment_analysis → UserMessage.sentimentAnalysis
	// - hook_result → shown with hook_run (parent has the result data)
	// - mcp_tool_result → shown with mcp_tool_call
	// - exposed_tool_result → shown with exposed_tool_call
	const PAIRED_EVENT_TYPES = new Set([
		"sentiment_analysis",
		"hook_result",
		"mcp_tool_result",
		"exposed_tool_result",
	]);

	const filteredMessages = messagesWithMetadata.filter((msg) => {
		// Filter out paired Han event types - they're loaded as nested fields
		if (msg.type === "han_event" && msg.toolName) {
			if (PAIRED_EVENT_TYPES.has(msg.toolName)) {
				return false;
			}
			return true;
		}

		const { text } = getMessageText(
			msg.content as string | ContentBlock[] | undefined,
		);

		// Check if this is a tool-result-only message
		if (msg.rawJson) {
			try {
				const parsed = JSON.parse(msg.rawJson);
				const content = parsed.message?.content;
				if (
					Array.isArray(content) &&
					content.length > 0 &&
					content.every((block: ContentBlock) => block.type === "tool_result")
				) {
					// This is a tool-result-only message, filter it out
					return false;
				}
			} catch {
				// Ignore parse errors
			}
		}

		// Include messages with text, summaries, or non-paired han_event messages
		return (
			text.length > 0 || msg.type === "summary" || msg.type === "han_event"
		);
	});

	// Messages are already in descending order (newest first) from database
	// This works with column-reverse in the UI: newest at visual bottom

	// Apply cursor-based pagination
	// Cursor is the Message global ID: Message:{projectDir}:{sessionId}:{lineNumber}
	// This allows fast file lookup: ~/.claude/projects/{projectDir}/{sessionId}.jsonl
	return applyConnectionArgs(
		filteredMessages,
		args,
		(msg) => `Message:${msg.projectDir}:${msg.sessionId}:${msg.lineNumber}`,
	);
}

// SessionRef and SessionData are imported from session-connection.ts

/**
 * Session type implementation with global ID
 * Implements Node interface for Relay global object identification
 */
export const SessionType = SessionRef.implement({
	description: "A Claude Code session",
	interfaces: [builder.nodeInterfaceRef()],
	isTypeOf: (obj): obj is SessionData => {
		return (
			obj !== null &&
			typeof obj === "object" &&
			"sessionId" in obj &&
			typeof (obj as SessionData).sessionId === "string"
		);
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			description:
				"Session global ID in format Session:{projectDir}:{sessionId}",
			resolve: (s) => {
				// Composite ID includes projectDir for fast file lookup
				// Format: {projectDir}:{sessionId} - framework adds Session: prefix
				const projectDir = "projectDir" in s ? s.projectDir : "";
				const compositeId = projectDir
					? `${projectDir}:${s.sessionId}`
					: s.sessionId;
				return { id: compositeId, type: "Session" as const };
			},
		}),
		sessionId: t.exposeString("sessionId", { description: "Session ID" }),
		name: t.exposeString("sessionId", {
			description:
				"Session name for URL routing (default is UUID, can be renamed)",
		}),
		date: t.exposeString("date", { description: "Session date" }),
		projectName: t.exposeString("project", {
			description: "Project name",
		}),
		projectPath: t.exposeString("projectPath", {
			description: "Full project path",
		}),
		projectId: t.string({
			nullable: true,
			description: "Canonical project ID for grouping",
			resolve: (s) => s.projectId ?? null,
		}),
		projectSlug: t.string({
			nullable: true,
			description:
				"Encoded project directory for URL routing (e.g., -Volumes-dev-src-...)",
			resolve: (s) => {
				// projectDir is the encoded path stored by Claude Code
				if ("projectDir" in s && s.projectDir) {
					return s.projectDir;
				}
				return null;
			},
		}),
		project: t.field({
			type: ProjectRef,
			nullable: true,
			description: "The project this session belongs to",
			resolve: async (s) => {
				if (!s.projectId) return null;
				// Dynamic import to avoid circular dependency
				const { getProjectById } = await import("./project.ts");
				return getProjectById(s.projectId);
			},
		}),
		worktreeName: t.string({
			nullable: true,
			description: "Worktree name if part of multi-worktree project",
			resolve: (s) => s.worktreeName ?? null,
		}),
		summary: t.string({
			nullable: true,
			description: "First user message as summary",
			resolve: async (s, _args, context) => {
				try {
					// Return existing summary if available
					if ("summary" in s && s.summary) {
						return s.summary;
					}
					// Otherwise, extract first user message as summary
					let messages: SessionMessage[] = [];
					if ("messages" in s && Array.isArray(s.messages)) {
						messages = s.messages;
					} else if (context?.loaders?.sessionMessagesLoader) {
						messages = await context.loaders.sessionMessagesLoader.load(
							s.sessionId,
						);
					} else {
						// No loader available - can't fetch messages
						return null;
					}
					// Find first user message
					const firstUserMessage = messages.find((m) => m.type === "user");
					if (firstUserMessage) {
						// Extract text from content
						let text = "";
						if (typeof firstUserMessage.content === "string") {
							text = firstUserMessage.content;
						} else if (Array.isArray(firstUserMessage.content)) {
							text = firstUserMessage.content
								.filter(
									(block): block is { type: string; text: string } =>
										block.type === "text" && typeof block.text === "string",
								)
								.map((block) => block.text)
								.join("\n");
						}
						// Truncate to reasonable length for summary
						if (text.length > 200) {
							return `${text.slice(0, 200)}...`;
						}
						return text || null;
					}
					return null;
				} catch (error) {
					// Log error but don't fail the entire query
					console.error("[session.summary] Error extracting summary:", error);
					return null;
				}
			},
		}),
		messageCount: t.int({
			description: "Number of messages in session",
			resolve: (s) => {
				if ("messageCount" in s) return s.messageCount;
				if ("messages" in s && Array.isArray(s.messages)) {
					return s.messages.filter(
						(m: SessionMessage) => m.type === "user" || m.type === "assistant",
					).length;
				}
				return 0;
			},
		}),
		startedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "Session start time",
			resolve: (s) => ("startedAt" in s ? s.startedAt : null) ?? null,
		}),
		updatedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "When the session was last updated (most recent message)",
			resolve: (s) => ("endedAt" in s ? s.endedAt : null) ?? null,
		}),
		gitBranch: t.string({
			nullable: true,
			description: "Git branch active during session",
			resolve: (s) => s.gitBranch ?? null,
		}),
		version: t.string({
			nullable: true,
			description: "Claude Code version",
			resolve: (s) => s.version ?? null,
		}),
		checkpoints: t.field({
			type: [CheckpointType],
			description: "Checkpoints associated with this session",
			resolve: async (
				session,
				_args,
				context,
			): Promise<CheckpointSummary[]> => {
				// Use DataLoader for batched loading
				return context.loaders.sessionCheckpointsLoader.load(session.sessionId);
			},
		}),
		hookExecutions: t.field({
			type: [HookExecutionType],
			description: "Hook executions that occurred during this session",
			resolve: (session) => {
				return queryHookExecutionsForSession(session.sessionId);
			},
		}),
		hookStats: t.field({
			type: HookStatsType,
			description: "Hook execution statistics for this session",
			resolve: (session) => {
				return querySessionHookStats(session.sessionId);
			},
		}),
		agentTaskIds: t.stringList({
			description: "IDs of agent tasks spawned during this session",
			resolve: (session) => {
				return getAgentTasksForSession(session.sessionId);
			},
		}),
		// Todo fields - extracted from TodoWrite tool calls in session
		todos: t.field({
			type: [TodoType],
			description: "All todos from the most recent TodoWrite in this session",
			resolve: async (session, _args, context): Promise<TodoItem[]> => {
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					// Use DataLoader for batched loading
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}
				return extractTodosFromMessages(messages);
			},
		}),
		activeTodos: t.field({
			type: [TodoType],
			description: "Non-completed todos (pending or in-progress)",
			resolve: async (session, _args, context): Promise<TodoItem[]> => {
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					// Use DataLoader for batched loading
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}
				return getActiveTodos(extractTodosFromMessages(messages));
			},
		}),
		currentTodo: t.field({
			type: TodoType,
			nullable: true,
			description: "The currently in-progress todo, if any",
			resolve: async (session, _args, context): Promise<TodoItem | null> => {
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					// Use DataLoader for batched loading
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}
				return getCurrentTodo(extractTodosFromMessages(messages));
			},
		}),
		todoCounts: t.field({
			type: TodoCountsType,
			description: "Counts of todos by status",
			resolve: async (session, _args, context) => {
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					// Use DataLoader for batched loading
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}
				return getTodoCounts(extractTodosFromMessages(messages));
			},
		}),
		// Task fields - from metrics system task tracking
		tasks: t.field({
			type: [TaskType],
			description: "All tasks tracked in this session via start_task MCP tool",
			resolve: (session): DbTask[] => {
				return getTasksForSession(session.sessionId);
			},
		}),
		// Messages with Relay-style cursor pagination
		messages: t.field({
			type: MessageConnectionType,
			args: {
				first: t.arg.int({ description: "Number of messages from the start" }),
				after: t.arg.string({ description: "Cursor to fetch messages after" }),
				last: t.arg.int({ description: "Number of messages from the end" }),
				before: t.arg.string({
					description: "Cursor to fetch messages before",
				}),
			},
			description: "Paginated messages in this session",
			resolve: (session, args) => {
				// Pass projectDir for cursor generation (enables fast file lookup)
				const projectDir = "projectDir" in session ? session.projectDir : null;
				return getMessagesConnectionInternal(
					session.sessionId,
					projectDir,
					args,
				);
			},
		}),
		// Tool results for inline display under tool use blocks
		toolResults: t.field({
			type: [ToolResultBlockType],
			description:
				"All tool results from this session, for inline display under tool use blocks",
			resolve: async (session, _args, context) => {
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}

				// Extract all tool_result blocks from all messages
				const toolResults: ToolResultBlockData[] = [];
				for (const msg of messages) {
					if (!msg.rawJson) continue;
					try {
						const parsed = JSON.parse(msg.rawJson);
						const content = parsed.message?.content;
						if (!Array.isArray(content)) continue;

						for (const block of content) {
							if (block.type === "tool_result" && block.tool_use_id) {
								const contentStr =
									typeof block.content === "string"
										? block.content
										: Array.isArray(block.content)
											? block.content
													.filter(
														(c: { type: string; text?: string }) =>
															c.type === "text" && c.text,
													)
													.map((c: { text: string }) => c.text)
													.join("\n")
											: "";
								const hasImage =
									Array.isArray(block.content) &&
									block.content.some(
										(c: { type: string }) => c.type === "image",
									);

								toolResults.push({
									type: "TOOL_RESULT",
									toolCallId: block.tool_use_id,
									content: contentStr,
									isError: block.is_error ?? false,
									isLong: contentStr.length > 500,
									preview:
										contentStr.length > 500
											? `${contentStr.slice(0, 500)}...`
											: contentStr,
									hasImage,
								});
							}
						}
					} catch {
						// Ignore parse errors
					}
				}
				return toolResults;
			},
		}),
		activeTasks: t.field({
			type: [TaskType],
			description: "Active (in-progress) tasks in this session",
			resolve: (session): DbTask[] => {
				return getActiveTasksForSession(session.sessionId);
			},
		}),
		currentTask: t.field({
			type: TaskType,
			nullable: true,
			description: "The most recently started active task, if any",
			resolve: (session): DbTask | null => {
				const activeTasks = getActiveTasksForSession(session.sessionId);
				// Return the most recent active task (sorted by started_at descending)
				return activeTasks.length > 0 ? activeTasks[0] : null;
			},
		}),
		// File changes tracked during this session
		fileChanges: t.field({
			type: [FileChangeType],
			description: "Files that were changed during this session",
			resolve: async (session): Promise<FileChangeData[]> => {
				return sessionFileChanges.list(session.sessionId);
			},
		}),
		fileChangeCount: t.int({
			description: "Number of file changes in this session",
			resolve: async (session): Promise<number> => {
				const changes = await sessionFileChanges.list(session.sessionId);
				return changes.length;
			},
		}),
		// Search messages across the entire session using FTS
		searchMessages: t.field({
			type: [MessageSearchResultType],
			args: {
				query: t.arg.string({
					required: true,
					description: "Search query to find in messages",
				}),
				limit: t.arg.int({
					description: "Maximum number of results to return (default: 20)",
				}),
			},
			description:
				"Search all messages in this session using FTS and return matching results with indices",
			resolve: async (session, args): Promise<MessageSearchResultData[]> => {
				const query = args.query.trim();
				if (!query) return [];

				const limit = args.limit ?? 20;

				// Import the FTS search function
				const { searchMessages: searchMessagesDb } = await import(
					"../../db/index.ts"
				);

				// Use FTS search - this queries SQLite directly
				const matchedMessages = await searchMessagesDb({
					query,
					sessionId: session.sessionId,
					limit,
				});

				// Convert to search results with message indices
				// Messages from FTS are ordered by relevance/timestamp
				const results: MessageSearchResultData[] = matchedMessages.map(
					(msg, idx) => {
						// Get text content for preview
						const { text } = getMessageText(
							msg.content as string | ContentBlock[] | undefined,
						);

						// Use content or messageType as preview
						const preview = text.slice(0, 150) || msg.messageType || "Message";

						// Build match context from content
						const searchText = (text || "").toLowerCase();
						const queryLower = query.toLowerCase();
						const matchIndex = searchText.indexOf(queryLower);
						let matchContext = preview;
						if (matchIndex >= 0) {
							const start = Math.max(0, matchIndex - 40);
							const end = Math.min(
								searchText.length,
								matchIndex + queryLower.length + 80,
							);
							matchContext =
								(start > 0 ? "..." : "") +
								searchText.slice(start, end) +
								(end < searchText.length ? "..." : "");
						}

						return {
							messageId: msg.id || `msg-${idx}`,
							// lineNumber from DB is the position in the session
							// We use it directly as the index for jumping
							messageIndex: msg.lineNumber ?? idx,
							preview,
							matchContext,
						};
					},
				);

				return results;
			},
		}),
	}),
});

/**
 * Get all sessions
 */
export function getAllSessions(params: URLSearchParams) {
	return listSessions(params);
}

/**
 * Get a session by ID (async - reads from database)
 */
export async function getSessionById(id: string) {
	return getSessionAsync(id);
}

/**
 * Get agent task IDs for a session
 */
export function getAgentTaskIds(sessionId: string): string[] {
	return getAgentTasksForSession(sessionId);
}

/**
 * Get agent task by ID
 */
export function getAgentTaskById(sessionId: string, agentId: string) {
	return getAgentTask(sessionId, agentId);
}

// SessionEdgeType and SessionConnectionType are imported from session-connection.ts
// and re-exported for use by schema.ts
export { SessionConnectionType, SessionEdgeType };

/**
 * Get sessions with cursor-based pagination from database
 */
export async function getSessionsConnection(
	args: ConnectionArgs & {
		projectId?: string | null;
		worktreeName?: string | null;
	},
): Promise<SessionConnectionData> {
	const startTime = Date.now();

	// Build params for the underlying listSessions function
	const params = new URLSearchParams();

	// Set a large page size to get all sessions for cursor-based filtering
	// In production, you'd want to optimize this with proper database cursors
	params.set("pageSize", "1000");

	if (args.projectId) {
		params.set("projectId", args.projectId);
	}
	if (args.worktreeName) {
		params.set("worktree", args.worktreeName);
	}

	// Use async version that reads from database
	const listStart = Date.now();
	const result = await listSessionsAsync(params);
	const listEnd = Date.now();
	console.log(
		`[getSessionsConnection] listSessionsAsync took ${listEnd - listStart}ms, returned ${result.data.length} sessions`,
	);

	// Filter out sessions with no messages
	const filterStart = Date.now();
	const sessions = result.data.filter((s) => s.messageCount > 0);
	const filterEnd = Date.now();
	console.log(
		`[getSessionsConnection] Filtering took ${filterEnd - filterStart}ms, ${sessions.length} sessions with messages`,
	);

	// Apply cursor-based pagination
	const paginationStart = Date.now();
	const connection = applyConnectionArgs(sessions, args, (session) =>
		encodeCursor(
			"session",
			session.sessionId,
			session.startedAt ? new Date(session.startedAt).getTime() : undefined,
		),
	);
	const paginationEnd = Date.now();
	console.log(
		`[getSessionsConnection] Pagination took ${paginationEnd - paginationStart}ms`,
	);

	const totalTime = Date.now() - startTime;
	console.log(`[getSessionsConnection] Total time: ${totalTime}ms`);

	return connection;
}

// getMessagesConnection is now defined earlier as getMessagesConnectionInternal
// to support the messagesConnection field on SessionType

// Register node loader for Session type
// The composite ID format is: projectDir:sessionId or just sessionId (for backwards compat)
registerNodeLoader("Session", async (compositeId: string) => {
	// Parse composite ID: may be "projectDir:sessionId" or just "sessionId"
	const lastColonIndex = compositeId.lastIndexOf(":");
	const sessionId =
		lastColonIndex !== -1 ? compositeId.slice(lastColonIndex + 1) : compositeId;
	return getSessionAsync(sessionId);
});
