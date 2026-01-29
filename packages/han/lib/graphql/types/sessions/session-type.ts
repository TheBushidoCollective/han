/**
 * GraphQL Session type
 *
 * Represents a Claude Code session with messages.
 */

import {
	getAgentTask,
	getAgentTasksForSession,
	getSessionAsync,
	getSessionMessagesOnlyAsync,
	type SessionMessage,
} from "../../../api/sessions.ts";
import type {
	Task as DbTask,
	SessionFileChange as FileChangeData,
} from "../../../db/index.ts";
import { sessionFileChanges } from "../../../db/index.ts";
import { builder } from "../../builder.ts";
import { registerNodeLoader } from "../../node-registry.ts";
import {
	ImageBlockType,
	TextBlockType,
	ThinkingBlockType,
	type ToolResultBlockData,
	ToolResultBlockType,
	ToolUseBlockType,
} from "../content-block.ts";
import {
	calculateFrustrationSummary,
	FrustrationSummaryType,
} from "../frustration-summary.ts";
import { queryHookExecutionsForSession } from "../hook-execution.ts";
import {
	type HookExecutionConnectionData,
	HookExecutionConnectionType,
} from "../hook-execution-connection.ts";
import { HookStatsType, querySessionHookStats } from "../hook-stats.ts";
import {
	AssistantMessageType,
	CommandUserMessageType,
	type ContentBlock,
	ExposedToolCallMessageType,
	ExposedToolResultMessageType,
	FileHistorySnapshotMessageType,
	getMessageText,
	HookResultMessageType,
	HookRunMessageType,
	InterruptUserMessageType,
	McpToolCallMessageType,
	McpToolResultMessageType,
	MemoryLearnMessageType,
	MemoryQueryMessageType,
	type MessageConnectionData,
	MessageConnectionType,
	MessageEdgeType,
	MetaUserMessageType,
	QueueOperationMessageType,
	RegularUserMessageType,
	SentimentAnalysisMessageType,
	SummaryMessageType,
	SystemMessageType,
	ToolResultUserMessageType,
	UnknownEventMessageType,
	UserMessageInterface,
} from "../message.ts";
import {
	getActiveTasksForSession,
	getTasksForSession,
	type TaskConnectionData,
	TaskConnectionType,
	TaskType,
} from "../metrics.ts";
import {
	getNativeTasksForSession,
	type NativeTaskData,
	NativeTaskType,
} from "../native-task.ts";
import { applyConnectionArgs, type ConnectionArgs } from "../pagination.ts";
import { ProjectRef } from "../project.ts";
import { type SessionData, SessionRef } from "../session-connection.ts";
import {
	extractTodosFromMessages,
	getActiveTodos,
	getCurrentTodo,
	getTodoCounts,
	getTodosFromDb,
	type TodoItem,
	TodoType,
} from "../todo.ts";
import {
	type TodoConnectionData,
	TodoConnectionType,
} from "../todo-connection.ts";
import { TodoCountsType } from "../todo-counts.ts";
import {
	type FileChangeConnectionData,
	FileChangeConnectionType,
} from "./file-change-connection.ts";
import type { MessageSearchResultData } from "./message-search-result.ts";
import { MessageSearchResultType } from "./message-search-result.ts";

// Ensure content block types are registered
void ThinkingBlockType;
void TextBlockType;
void ToolUseBlockType;
void ToolResultBlockType;
void ImageBlockType;

// Ensure message types are registered (interface pattern)
void UserMessageInterface;
void RegularUserMessageType;
void MetaUserMessageType;
void CommandUserMessageType;
void InterruptUserMessageType;
void ToolResultUserMessageType;
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
		slug: t.string({
			nullable: true,
			description: "Human-readable session name (e.g., 'snug-dreaming-knuth')",
			resolve: (s) => ("slug" in s ? s.slug : null) ?? null,
		}),
		name: t.string({
			description:
				"Display name for session (slug if available, otherwise sessionId)",
			resolve: (s) => ("slug" in s && s.slug ? s.slug : s.sessionId),
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
				const { getProjectById } = await import("../project.ts");
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

					// Helper to check if a message is tool-result-only by checking rawJson
					const isToolResultOnly = (m: SessionMessage): boolean => {
						// Check rawJson for the original message structure
						if (m.rawJson) {
							try {
								const raw = JSON.parse(m.rawJson);
								const content = raw?.message?.content;
								if (Array.isArray(content) && content.length > 0) {
									// Check if all blocks are tool_result type
									return content.every(
										(block: { type: string }) => block.type === "tool_result",
									);
								}
							} catch {
								// Ignore parse errors
							}
						}
						// Fallback to checking content directly
						if (!Array.isArray(m.content)) return false;
						return (
							m.content.length > 0 &&
							m.content.every(
								(block: { type: string }) => block.type === "tool_result",
							)
						);
					};

					// Helper to extract text from a user message
					const extractText = (m: SessionMessage): string => {
						// Check rawJson for the original message structure with text blocks
						if (m.rawJson) {
							try {
								const raw = JSON.parse(m.rawJson);
								const content = raw?.message?.content;
								// If content is a string in rawJson, use it
								if (typeof content === "string") {
									return content;
								}
								// If content is an array, extract text blocks
								if (Array.isArray(content)) {
									const textParts = content
										.filter(
											(block: { type: string; text?: string }) =>
												block.type === "text" && typeof block.text === "string",
										)
										.map((block: { text: string }) => block.text);
									if (textParts.length > 0) {
										return textParts.join("\n");
									}
								}
							} catch {
								// Ignore parse errors, fall through to legacy handling
							}
						}
						// Legacy fallback - use content field directly
						if (typeof m.content === "string") {
							return m.content;
						}
						if (Array.isArray(m.content)) {
							return m.content
								.filter(
									(block): block is { type: string; text: string } =>
										block.type === "text" && typeof block.text === "string",
								)
								.map((block) => block.text)
								.join("\n");
						}
						return "";
					};

					// Find first (chronologically) user message with actual text content
					// Messages are returned DESC (newest first), so search from the end
					// to find the oldest user message which is typically the first user input
					let firstUserMessage: SessionMessage | undefined;
					for (let i = messages.length - 1; i >= 0; i--) {
						const m = messages[i];
						if (m.type !== "user") continue;
						// Skip tool-result-only messages
						if (isToolResultOnly(m)) continue;
						// Check if there's actual text content
						const text = extractText(m);
						if (text.length > 0) {
							firstUserMessage = m;
							break;
						}
					}

					if (firstUserMessage) {
						const text = extractText(firstUserMessage);
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
		hookExecutions: t.field({
			type: HookExecutionConnectionType,
			args: {
				first: t.arg.int({
					description: "Number of hook executions from the start",
				}),
				after: t.arg.string({
					description: "Cursor to fetch hook executions after",
				}),
				last: t.arg.int({
					description: "Number of hook executions from the end",
				}),
				before: t.arg.string({
					description: "Cursor to fetch hook executions before",
				}),
			},
			description:
				"Hook executions that occurred during this session (paginated)",
			resolve: async (session, args): Promise<HookExecutionConnectionData> => {
				const executions = await queryHookExecutionsForSession(
					session.sessionId,
				);
				return applyConnectionArgs(
					executions,
					args,
					(exec) => `HookExecution:${exec.id}`,
				);
			},
		}),
		hookStats: t.field({
			type: HookStatsType,
			description: "Hook execution statistics for this session",
			resolve: (session) => {
				return querySessionHookStats(session.sessionId);
			},
		}),
		frustrationSummary: t.field({
			type: FrustrationSummaryType,
			description: "Aggregated frustration metrics for this session",
			resolve: async (session, _args, context) => {
				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(
						session.sessionId,
					);
				return calculateFrustrationSummary(pairedEvents.sentimentByMessageId);
			},
		}),
		agentTaskIds: t.stringList({
			description: "IDs of agent tasks spawned during this session",
			resolve: (session) => {
				return getAgentTasksForSession(session.sessionId);
			},
		}),
		// Todo fields - from database (indexed) or fallback to message parsing
		todos: t.field({
			type: TodoConnectionType,
			description: "All todos from the most recent TodoWrite in this session",
			args: {
				first: t.arg.int({ description: "Number of todos from the start" }),
				after: t.arg.string({ description: "Cursor to fetch todos after" }),
				last: t.arg.int({ description: "Number of todos from the end" }),
				before: t.arg.string({ description: "Cursor to fetch todos before" }),
			},
			resolve: async (session, args, context): Promise<TodoConnectionData> => {
				// Try database first (faster - pre-indexed)
				let todos = await getTodosFromDb(session.sessionId);
				if (todos.length === 0) {
					// Fallback to parsing messages (for sessions not yet indexed)
					let messages: SessionMessage[] = [];
					if ("messages" in session && Array.isArray(session.messages)) {
						messages = session.messages;
					} else {
						messages = await context.loaders.sessionMessagesLoader.load(
							session.sessionId,
						);
					}
					todos = extractTodosFromMessages(messages);
				}
				// Generate cursor from content hash
				const getCursor = (todo: TodoItem) => {
					let hash = 0;
					for (let i = 0; i < todo.content.length; i++) {
						const char = todo.content.charCodeAt(i);
						hash = (hash << 5) - hash + char;
						hash = hash & hash;
					}
					return `Todo:${Math.abs(hash).toString(36)}`;
				};
				return applyConnectionArgs(todos, args, getCursor);
			},
		}),
		activeTodos: t.field({
			type: TodoConnectionType,
			description: "Non-completed todos (pending or in-progress)",
			args: {
				first: t.arg.int({ description: "Number of todos from the start" }),
				after: t.arg.string({ description: "Cursor to fetch todos after" }),
				last: t.arg.int({ description: "Number of todos from the end" }),
				before: t.arg.string({ description: "Cursor to fetch todos before" }),
			},
			resolve: async (session, args, context): Promise<TodoConnectionData> => {
				// Try database first (faster - pre-indexed)
				let todos = await getTodosFromDb(session.sessionId);
				if (todos.length > 0) {
					todos = getActiveTodos(todos);
				} else {
					// Fallback to parsing messages
					let messages: SessionMessage[] = [];
					if ("messages" in session && Array.isArray(session.messages)) {
						messages = session.messages;
					} else {
						messages = await context.loaders.sessionMessagesLoader.load(
							session.sessionId,
						);
					}
					todos = getActiveTodos(extractTodosFromMessages(messages));
				}
				// Generate cursor from content hash
				const getCursor = (todo: TodoItem) => {
					let hash = 0;
					for (let i = 0; i < todo.content.length; i++) {
						const char = todo.content.charCodeAt(i);
						hash = (hash << 5) - hash + char;
						hash = hash & hash;
					}
					return `Todo:${Math.abs(hash).toString(36)}`;
				};
				return applyConnectionArgs(todos, args, getCursor);
			},
		}),
		currentTodo: t.field({
			type: TodoType,
			nullable: true,
			description: "The currently in-progress todo, if any",
			resolve: async (session, _args, context): Promise<TodoItem | null> => {
				// Try database first (faster - pre-indexed)
				const dbTodos = await getTodosFromDb(session.sessionId);
				if (dbTodos.length > 0) {
					return getCurrentTodo(dbTodos);
				}
				// Fallback to parsing messages
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
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
				// Try database first (faster - pre-indexed)
				const dbTodos = await getTodosFromDb(session.sessionId);
				if (dbTodos.length > 0) {
					return getTodoCounts(dbTodos);
				}
				// Fallback to parsing messages
				let messages: SessionMessage[] = [];
				if ("messages" in session && Array.isArray(session.messages)) {
					messages = session.messages;
				} else {
					messages = await context.loaders.sessionMessagesLoader.load(
						session.sessionId,
					);
				}
				return getTodoCounts(extractTodosFromMessages(messages));
			},
		}),
		// Task fields - from metrics system task tracking
		tasks: t.field({
			type: TaskConnectionType,
			args: {
				first: t.arg.int({ description: "Number of tasks from the start" }),
				after: t.arg.string({ description: "Cursor to fetch tasks after" }),
				last: t.arg.int({ description: "Number of tasks from the end" }),
				before: t.arg.string({ description: "Cursor to fetch tasks before" }),
			},
			description: "All tasks tracked in this session via start_task MCP tool",
			resolve: (session, args): TaskConnectionData => {
				const tasks = getTasksForSession(session.sessionId);
				return applyConnectionArgs(
					tasks,
					args,
					(task) => `Task:${task.taskId}`,
				);
			},
		}),
		// Native tasks - Claude Code's built-in task system (TaskCreate/TaskUpdate)
		nativeTasks: t.field({
			type: [NativeTaskType],
			description:
				"Tasks from Claude Code's built-in task system (TaskCreate/TaskUpdate tools)",
			resolve: async (session): Promise<NativeTaskData[]> => {
				return getNativeTasksForSession(session.sessionId);
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
			type: TaskConnectionType,
			args: {
				first: t.arg.int({
					description: "Number of active tasks from the start",
				}),
				after: t.arg.string({
					description: "Cursor to fetch active tasks after",
				}),
				last: t.arg.int({ description: "Number of active tasks from the end" }),
				before: t.arg.string({
					description: "Cursor to fetch active tasks before",
				}),
			},
			description: "Active (in-progress) tasks in this session",
			resolve: (session, args): TaskConnectionData => {
				const tasks = getActiveTasksForSession(session.sessionId);
				return applyConnectionArgs(
					tasks,
					args,
					(task) => `Task:${task.taskId}`,
				);
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
		// Deduplicated by file path - shows the most recent change for each unique file
		fileChanges: t.field({
			type: FileChangeConnectionType,
			args: {
				first: t.arg.int({
					description: "Number of file changes from the start",
				}),
				after: t.arg.string({
					description: "Cursor to fetch file changes after",
				}),
				last: t.arg.int({
					description: "Number of file changes from the end",
				}),
				before: t.arg.string({
					description: "Cursor to fetch file changes before",
				}),
			},
			description:
				"Files that were changed during this session (deduplicated by path, paginated)",
			resolve: async (session, args): Promise<FileChangeConnectionData> => {
				const allChanges = await sessionFileChanges.list(session.sessionId);
				// Deduplicate by filePath - keep the most recent change for each file
				// Changes are already ordered by recorded_at DESC from the database
				const uniqueByPath = new Map<string, FileChangeData>();
				for (const change of allChanges) {
					if (!uniqueByPath.has(change.filePath)) {
						uniqueByPath.set(change.filePath, change);
					}
				}
				const dedupedChanges = Array.from(uniqueByPath.values());
				return applyConnectionArgs(
					dedupedChanges,
					args,
					(change) => `FileChange:${change.id}`,
				);
			},
		}),
		fileChangeCount: t.int({
			description: "Number of unique files changed in this session",
			resolve: async (session): Promise<number> => {
				const allChanges = await sessionFileChanges.list(session.sessionId);
				// Count unique file paths
				const uniquePaths = new Set(allChanges.map((c) => c.filePath));
				return uniquePaths.size;
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
					"../../../db/index.ts"
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

// Register node loader for Session type
// The composite ID format is: projectDir:sessionId or just sessionId (for backwards compat)
registerNodeLoader("Session", async (compositeId: string) => {
	// Parse composite ID: may be "projectDir:sessionId" or just "sessionId"
	const lastColonIndex = compositeId.lastIndexOf(":");
	const sessionId =
		lastColonIndex !== -1 ? compositeId.slice(lastColonIndex + 1) : compositeId;
	return getSessionAsync(sessionId);
});

// Re-export getAgentTask for use in session-helpers.ts
export { getAgentTask, getAgentTasksForSession };
