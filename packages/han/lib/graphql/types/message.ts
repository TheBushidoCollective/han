/**
 * GraphQL Message Types
 *
 * Uses interface pattern with concrete types for each message shape:
 * - UserMessage: User input with command/interrupt detection
 * - AssistantMessage: Claude responses with tokens, thinking, tool use
 * - SummaryMessage: Context summaries
 * - SystemMessage: System notifications with subtype and level
 * - FileHistorySnapshotMessage: File state tracking snapshots
 * - HookRunMessage: Hook execution start events
 * - HookResultMessage: Hook execution result events
 * - QueueOperationMessage: Queue state changes
 * - McpToolCallMessage: MCP tool call events
 * - McpToolResultMessage: MCP tool result events
 * - ExposedToolCallMessage: Exposed tool call events
 * - ExposedToolResultMessage: Exposed tool result events
 * - MemoryQueryMessage: Memory query events
 * - MemoryLearnMessage: Memory learn events
 * - SentimentAnalysisMessage: Sentiment analysis events
 * - UnknownEventMessage: Fallback for unknown types
 *
 * This enables proper __typename discrimination on the frontend.
 */

import {
	getSessionMessagesPaginated,
	type SessionMessage,
} from "../../api/sessions.ts";
import { builder } from "../builder.ts";
import type { SentimentEventData } from "../loaders.ts";
import { encodeGlobalId, registerNodeLoader } from "../node-registry.ts";
import {
	type ContentBlockData,
	ContentBlockInterface,
	parseContentBlocks,
} from "./content-block.ts";
import { ExposedToolResultType, McpToolResultType } from "./han-event.ts";
import { PageInfoType } from "./pagination.ts";

// =============================================================================
// Sentiment Analysis Type (for nested resolution on UserMessage)
// =============================================================================

/**
 * SentimentAnalysis type for inline display on UserMessage
 */
export const SentimentAnalysisType = builder
	.objectRef<SentimentEventData>("SentimentAnalysis")
	.implement({
		description:
			"Sentiment analysis result for a user message (inline, not a separate event)",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) =>
					encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the analysis occurred",
				resolve: (data) => data.timestamp,
			}),
			sentimentScore: t.float({
				description: "Raw sentiment score (typically -5 to +5)",
				resolve: (data) => data.sentimentScore,
			}),
			sentimentLevel: t.string({
				description:
					"Categorized sentiment level (positive, neutral, negative)",
				resolve: (data) => data.sentimentLevel,
			}),
			frustrationScore: t.float({
				nullable: true,
				description: "Frustration score (0-10) if frustration detected",
				resolve: (data) => data.frustrationScore ?? null,
			}),
			frustrationLevel: t.string({
				nullable: true,
				description: "Frustration level if detected (low, moderate, high)",
				resolve: (data) => data.frustrationLevel ?? null,
			}),
			signals: t.stringList({
				description:
					"Detected signals (e.g., CAPS, punctuation, negative_words)",
				resolve: (data) => data.signals,
			}),
			taskId: t.string({
				nullable: true,
				description: "Optional link to current task ID",
				resolve: (data) => data.taskId ?? null,
			}),
		}),
	});

/**
 * Content block types from Claude API
 */
export interface ContentBlock {
	type: string;
	text?: string;
	name?: string;
	input?: Record<string, unknown>;
}

/**
 * Extract text content from a message
 */
export function getMessageText(content: string | ContentBlock[] | undefined): {
	text: string;
	isToolOnly: boolean;
} {
	if (!content) return { text: "", isToolOnly: false };

	if (typeof content === "string") {
		return { text: content, isToolOnly: false };
	}

	if (Array.isArray(content)) {
		const textParts = content
			.filter((c) => c.type === "text" && c.text)
			.map((c) => c.text || "");

		if (textParts.length > 0) {
			return { text: textParts.join("\n"), isToolOnly: false };
		}

		const toolUses = content.filter((c) => c.type === "tool_use" && c.name);
		if (toolUses.length > 0) {
			const toolSummary = toolUses
				.map((t) => {
					const name = t.name || "unknown";
					const input = t.input || {};
					const detail =
						input.file_path || input.command || input.pattern || "";
					return detail ? `${name}: ${String(detail)}` : name;
				})
				.join("\n");
			return { text: toolSummary, isToolOnly: true };
		}

		const hasThinking = content.some((c) => c.type === "thinking");
		if (hasThinking) {
			return { text: "", isToolOnly: true };
		}
	}

	return { text: "", isToolOnly: false };
}

/**
 * Message with session context for ID generation
 */
export type MessageWithSession = SessionMessage & {
	projectDir: string;
	sessionId: string;
	lineNumber: number;
};

/**
 * Parse raw JSON to extract user message metadata
 */
interface UserMessageMetadata {
	isMeta: boolean;
	isInterrupt: boolean;
	isCommand: boolean;
	commandName: string | null;
}

function parseUserMetadata(rawJson: string | undefined): UserMessageMetadata {
	const defaults: UserMessageMetadata = {
		isMeta: false,
		isInterrupt: false,
		isCommand: false,
		commandName: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		if (parsed.isMeta) defaults.isMeta = true;

		const content = parsed.message?.content;
		if (
			typeof content === "string" &&
			content.includes("[Request interrupted")
		) {
			defaults.isInterrupt = true;
		}
		if (Array.isArray(content)) {
			const textBlock = content.find(
				(c: ContentBlock) =>
					c.type === "text" && c.text?.includes("[Request interrupted"),
			);
			if (textBlock) defaults.isInterrupt = true;
		}

		if (typeof content === "string" && content.includes("<command-name>")) {
			defaults.isCommand = true;
			const match = content.match(/<command-name>([^<]+)<\/command-name>/);
			if (match) defaults.commandName = match[1];
		}

		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract assistant message metadata
 */
interface AssistantMessageMetadata {
	model: string | null;
	hasThinking: boolean;
	thinkingCount: number;
	hasToolUse: boolean;
	toolUseCount: number;
	inputTokens: number | null;
	outputTokens: number | null;
	cachedTokens: number | null;
}

function parseAssistantMetadata(
	rawJson: string | undefined,
): AssistantMessageMetadata {
	const defaults: AssistantMessageMetadata = {
		model: null,
		hasThinking: false,
		thinkingCount: 0,
		hasToolUse: false,
		toolUseCount: 0,
		inputTokens: null,
		outputTokens: null,
		cachedTokens: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);

		if (parsed.message?.model) {
			defaults.model = parsed.message.model;
		}

		const content = parsed.message?.content;
		if (Array.isArray(content)) {
			for (const block of content) {
				if (block.type === "thinking") {
					defaults.hasThinking = true;
					defaults.thinkingCount++;
				}
				if (block.type === "tool_use") {
					defaults.hasToolUse = true;
					defaults.toolUseCount++;
				}
			}
		}

		const usage = parsed.message?.usage;
		if (usage) {
			defaults.inputTokens = usage.input_tokens ?? null;
			defaults.outputTokens = usage.output_tokens ?? null;
			defaults.cachedTokens =
				(usage.cache_read_input_tokens ?? 0) +
				(usage.cache_creation_input_tokens ?? 0) || null;
		}

		return defaults;
	} catch {
		return defaults;
	}
}

// ============================================================================
// Message Interface - common fields for all message types
// ============================================================================

/**
 * Check if a user message is actually a continuation summary
 * These are injected when a session runs out of context and is continued
 */
function isUserMessageActuallySummary(msg: MessageWithSession): boolean {
	if (msg.type !== "user") return false;

	// Check content for continuation patterns
	const content =
		typeof msg.content === "string"
			? msg.content
			: Array.isArray(msg.content)
				? msg.content
					.filter((c) => c.type === "text")
					.map((c) => c.text || "")
					.join("")
				: "";

	// Continuation summary patterns
	if (
		content.includes(
			"This session is being continued from a previous conversation",
		)
	) {
		return true;
	}

	// Check rawJson for isMeta flag with summary content
	if (msg.rawJson) {
		try {
			const parsed = JSON.parse(msg.rawJson);
			if (parsed.isMeta && content.includes("Summary:")) {
				return true;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return false;
}

export const MessageInterface =
	builder.interfaceRef<MessageWithSession>("Message");

MessageInterface.implement({
	description:
		"Base interface for all message types in a session. Contains only shared fields - concrete types add their own specific fields.",
	resolveType: (msg) => {
		switch (msg.type) {
			case "user":
				// Check if this is actually a continuation summary
				if (isUserMessageActuallySummary(msg)) {
					return "SummaryMessage";
				}
				return "UserMessage";
			case "assistant":
				return "AssistantMessage";
			case "summary":
				return "SummaryMessage";
			case "system":
				return "SystemMessage";
			case "file-history-snapshot":
				return "FileHistorySnapshotMessage";
			case "hook_run":
				return "HookRunMessage";
			case "hook_result":
				return "HookResultMessage";
			case "queue-operation":
				return "QueueOperationMessage";
			case "han_event":
				// Dispatch to specific event types based on toolName (event subtype)
				switch (msg.toolName) {
					case "hook_run":
						return "HookRunMessage";
					case "hook_result":
						return "HookResultMessage";
					case "hook_reference":
						return "HookReferenceMessage";
					case "hook_validation":
						return "HookValidationMessage";
					case "hook_script":
						return "HookScriptMessage";
					case "hook_datetime":
						return "HookDatetimeMessage";
					case "hook_file_change":
						return "HookFileChangeMessage";
					case "queue_operation":
						return "QueueOperationMessage";
					case "mcp_tool_call":
						return "McpToolCallMessage";
					case "mcp_tool_result":
						return "McpToolResultMessage";
					case "exposed_tool_call":
						return "ExposedToolCallMessage";
					case "exposed_tool_result":
						return "ExposedToolResultMessage";
					case "memory_query":
						return "MemoryQueryMessage";
					case "memory_learn":
						return "MemoryLearnMessage";
					case "sentiment_analysis":
						return "SentimentAnalysisMessage";
					case "hook_validation_cache":
						return "HookValidationCacheMessage";
					default:
						// Unknown han_event subtypes use UnknownEventMessage
						return "UnknownEventMessage";
				}
			default:
				// Unknown message types use UnknownEventMessage
				return "UnknownEventMessage";
		}
	},
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the message was sent",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			description: "Original JSONL line content for debugging",
			resolve: (msg) => msg.rawJson || null,
		}),
		agentId: t.string({
			nullable: true,
			description:
				"Agent ID if this message is from a subagent. NULL for main conversation.",
			resolve: (msg) => msg.agentId ?? null,
		}),
		parentId: t.string({
			nullable: true,
			description:
				"For result messages, references the call message ID (e.g., tool_result -> tool_use)",
			resolve: (msg) => msg.parentId ?? null,
		}),
		searchText: t.string({
			nullable: true,
			description:
				"Searchable text content for message filtering. Returns combined text from message content, tool names, and other relevant fields.",
			resolve: (msg) => {
				// Get text content from message
				const { text } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);

				// Build searchable text from multiple sources
				const parts: string[] = [];

				// Add main text content
				if (text) parts.push(text);

				// Add message type
				parts.push(msg.type);

				// Add tool/event name for tool calls
				if (msg.toolName) parts.push(msg.toolName);

				// Parse rawJson for additional searchable fields
				if (msg.rawJson) {
					try {
						const parsed = JSON.parse(msg.rawJson);

						// Tool use blocks
						if (Array.isArray(parsed.message?.content)) {
							for (const block of parsed.message.content) {
								if (block.type === "tool_use" && block.name) {
									parts.push(block.name);
								}
							}
						}

						// MCP/exposed tool names
						if (parsed.name) parts.push(parsed.name);
						if (parsed.tool) parts.push(parsed.tool);
						if (parsed.serverName) parts.push(parsed.serverName);

						// Hook names
						if (parsed.hookName) parts.push(parsed.hookName);
						if (parsed.hookType) parts.push(parsed.hookType);

						// File paths
						if (parsed.filePath) parts.push(parsed.filePath);
					} catch {
						// Ignore parse errors
					}
				}

				return parts.join(" ").toLowerCase() || null;
			},
		}),
	}),
});

// ============================================================================
// UserMessage - user input with command/interrupt detection
// ============================================================================

const UserMessageRef = builder.objectRef<MessageWithSession>("UserMessage");

export const UserMessageType = UserMessageRef.implement({
	description: "A user message in a session",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "user",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the message was sent",
			resolve: (msg) => msg.timestamp,
		}),
		content: t.string({
			nullable: true,
			description: "User message text content",
			resolve: (msg) => {
				const { text } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);
				return text || null;
			},
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		contentBlocks: t.field({
			type: [ContentBlockInterface],
			resolve: (msg): ContentBlockData[] => {
				if (!msg.rawJson) return [];
				try {
					const parsed = JSON.parse(msg.rawJson);
					const content = parsed.message?.content;
					return parseContentBlocks(content);
				} catch {
					if (msg.content && typeof msg.content === "string") {
						return [{ type: "TEXT", text: msg.content }];
					}
					return [];
				}
			},
		}),
		// User-specific fields
		isMeta: t.boolean({
			description: "Whether this is a meta/system message",
			resolve: (msg) => parseUserMetadata(msg.rawJson).isMeta,
		}),
		isInterrupt: t.boolean({
			description: "Whether this message is an interrupt",
			resolve: (msg) => parseUserMetadata(msg.rawJson).isInterrupt,
		}),
		isCommand: t.boolean({
			description: "Whether this is a slash command",
			resolve: (msg) => parseUserMetadata(msg.rawJson).isCommand,
		}),
		commandName: t.string({
			nullable: true,
			description: "Name of the slash command if isCommand is true",
			resolve: (msg) => parseUserMetadata(msg.rawJson).commandName,
		}),
		// Nested sentiment analysis (loaded via DataLoader)
		sentimentAnalysis: t.field({
			type: SentimentAnalysisType,
			nullable: true,
			description:
				"Sentiment analysis for this message (if available). Loaded via DataLoader from the session's paired events.",
			resolve: async (msg, _args, context) => {
				// Load paired events for this session
				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
				// Look up sentiment by this message's raw UUID (from han event data.message_id)
				if (!msg.id) return null;
				return pairedEvents.sentimentByMessageId.get(msg.id) ?? null;
			},
		}),
	}),
});

// ============================================================================
// AssistantMessage - Claude responses with tokens, thinking, tool use
// ============================================================================

const AssistantMessageRef =
	builder.objectRef<MessageWithSession>("AssistantMessage");

export const AssistantMessageType = AssistantMessageRef.implement({
	description: "An assistant (Claude) message in a session",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "assistant",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the message was sent",
			resolve: (msg) => msg.timestamp,
		}),
		content: t.string({
			nullable: true,
			description: "Assistant message text content",
			resolve: (msg) => {
				const { text } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);
				return text || null;
			},
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		contentBlocks: t.field({
			type: [ContentBlockInterface],
			resolve: (msg): ContentBlockData[] => {
				if (!msg.rawJson) return [];
				try {
					const parsed = JSON.parse(msg.rawJson);
					const content = parsed.message?.content;
					return parseContentBlocks(content);
				} catch {
					if (msg.content && typeof msg.content === "string") {
						return [{ type: "TEXT", text: msg.content }];
					}
					return [];
				}
			},
		}),
		// Assistant-specific fields
		isToolOnly: t.boolean({
			description: "Whether this message only contains tool calls",
			resolve: (msg) => {
				const { isToolOnly } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);
				return isToolOnly;
			},
		}),
		model: t.string({
			nullable: true,
			description: "Model used for this response",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).model,
		}),
		hasThinking: t.boolean({
			description: "Whether this message contains thinking blocks",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).hasThinking,
		}),
		thinkingCount: t.int({
			description: "Number of thinking blocks in this message",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).thinkingCount,
		}),
		hasToolUse: t.boolean({
			description: "Whether this message contains tool use blocks",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).hasToolUse,
		}),
		toolUseCount: t.int({
			description: "Number of tool use blocks in this message",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).toolUseCount,
		}),
		inputTokens: t.field({
			type: "BigInt",
			nullable: true,
			description: "Input tokens used",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).inputTokens,
		}),
		outputTokens: t.field({
			type: "BigInt",
			nullable: true,
			description: "Output tokens generated",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).outputTokens,
		}),
		cachedTokens: t.field({
			type: "BigInt",
			nullable: true,
			description: "Cached tokens used",
			resolve: (msg) => parseAssistantMetadata(msg.rawJson).cachedTokens,
		}),
	}),
});

// ============================================================================
// SummaryMessage - context summaries
// ============================================================================

const SummaryMessageRef =
	builder.objectRef<MessageWithSession>("SummaryMessage");

/**
 * Check if a summary message is a compact/auto-compaction summary
 * Compact summaries are generated automatically when context gets too large
 * Also includes continuation summaries from context overflow
 */
function isCompactSummary(msg: MessageWithSession): boolean {
	// Check for continuation summaries (user messages that are actually summaries)
	if (msg.type === "user") {
		const content =
			typeof msg.content === "string"
				? msg.content
				: Array.isArray(msg.content)
					? msg.content
						.filter((c) => c.type === "text")
						.map((c) => c.text || "")
						.join("")
					: "";
		if (
			content.includes(
				"This session is being continued from a previous conversation",
			)
		) {
			return true;
		}
	}

	if (!msg.rawJson) return false;
	try {
		const parsed = JSON.parse(msg.rawJson);
		// Check for auto-compact indicators in the raw JSON
		// Claude Code uses "auto_compact" or similar flags, or the summary type field
		if (parsed.type === "auto_compact" || parsed.type === "compact") {
			return true;
		}
		// Also check for compact indicator in message metadata
		if (parsed.is_compact || parsed.isCompact || parsed.auto_compacted) {
			return true;
		}
		// Check if it's a summary that starts with specific markers
		const content = parsed.message?.content || parsed.summary || "";
		if (typeof content === "string") {
			// Auto-compact summaries often have specific patterns
			if (
				content.includes("[Auto-compacted]") ||
				content.includes("[Context compacted]") ||
				content.includes(
					"This session is being continued from a previous conversation",
				)
			) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

export const SummaryMessageType = SummaryMessageRef.implement({
	description: "A context summary message in a session",
	interfaces: [MessageInterface],
	isTypeOf: (obj) => {
		if (typeof obj !== "object" || obj === null || !("type" in obj))
			return false;
		const msg = obj as MessageWithSession;
		// Normal summary type
		if (msg.type === "summary") return true;
		// User messages that are continuation summaries
		if (msg.type === "user" && isUserMessageActuallySummary(msg)) return true;
		return false;
	},
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the summary was created",
			resolve: (msg) => msg.timestamp,
		}),
		isCompactSummary: t.boolean({
			description:
				"Whether this is an auto-compaction summary (context was automatically condensed)",
			resolve: (msg) => isCompactSummary(msg),
		}),
		content: t.string({
			nullable: true,
			description: "Summary text content",
			resolve: (msg) => {
				const { text } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);
				return text || null;
			},
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		contentBlocks: t.field({
			type: [ContentBlockInterface],
			resolve: (msg): ContentBlockData[] => {
				if (!msg.rawJson) return [];
				try {
					const parsed = JSON.parse(msg.rawJson);
					const content = parsed.message?.content;
					return parseContentBlocks(content);
				} catch {
					if (msg.content && typeof msg.content === "string") {
						return [{ type: "TEXT", text: msg.content }];
					}
					return [];
				}
			},
		}),
	}),
});

// ============================================================================
// SystemMessage - system notifications with subtype and level
// ============================================================================

/**
 * Parse raw JSON to extract system message metadata
 */
interface SystemMessageMetadata {
	subtype: string | null;
	level: string | null;
	isMeta: boolean;
}

function parseSystemMetadata(
	rawJson: string | undefined,
): SystemMessageMetadata {
	const defaults: SystemMessageMetadata = {
		subtype: null,
		level: null,
		isMeta: false,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.subtype = parsed.subtype ?? null;
		defaults.level = parsed.level ?? null;
		defaults.isMeta = parsed.isMeta ?? false;
		return defaults;
	} catch {
		return defaults;
	}
}

const SystemMessageRef = builder.objectRef<MessageWithSession>("SystemMessage");

export const SystemMessageType = SystemMessageRef.implement({
	description: "A system notification message with subtype and level",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "system",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the system message was sent",
			resolve: (msg) => msg.timestamp,
		}),
		content: t.string({
			nullable: true,
			description: "System message content",
			resolve: (msg) => {
				const { text } = getMessageText(
					msg.content as string | ContentBlock[] | undefined,
				);
				return text || null;
			},
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		// System-specific fields
		subtype: t.string({
			nullable: true,
			description: "System message subtype (e.g., 'init', 'error', 'warning')",
			resolve: (msg) => parseSystemMetadata(msg.rawJson).subtype,
		}),
		level: t.string({
			nullable: true,
			description: "Message severity level (e.g., 'info', 'warning', 'error')",
			resolve: (msg) => parseSystemMetadata(msg.rawJson).level,
		}),
		isMeta: t.boolean({
			description: "Whether this is a meta/internal system message",
			resolve: (msg) => parseSystemMetadata(msg.rawJson).isMeta,
		}),
	}),
});

// ============================================================================
// FileHistorySnapshotMessage - file state tracking snapshots
// ============================================================================

/**
 * Parse raw JSON to extract file history snapshot metadata
 */
interface FileHistorySnapshotMetadata {
	messageId: string | null;
	isSnapshotUpdate: boolean;
	fileCount: number;
	snapshotTimestamp: Date | null;
}

function parseFileHistorySnapshotMetadata(
	rawJson: string | undefined,
): FileHistorySnapshotMetadata {
	const defaults: FileHistorySnapshotMetadata = {
		messageId: null,
		isSnapshotUpdate: false,
		fileCount: 0,
		snapshotTimestamp: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.messageId = parsed.messageId ?? null;
		defaults.isSnapshotUpdate = parsed.isSnapshotUpdate ?? false;

		const snapshot = parsed.snapshot;
		if (snapshot) {
			if (Array.isArray(snapshot.trackedFileBackups)) {
				defaults.fileCount = snapshot.trackedFileBackups.length;
			}
			if (snapshot.timestamp) {
				defaults.snapshotTimestamp = new Date(snapshot.timestamp);
			}
		}

		return defaults;
	} catch {
		return defaults;
	}
}

const FileHistorySnapshotMessageRef = builder.objectRef<MessageWithSession>(
	"FileHistorySnapshotMessage",
);

export const FileHistorySnapshotMessageType =
	FileHistorySnapshotMessageRef.implement({
		description: "A file history snapshot message tracking file state changes",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "file-history-snapshot",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) =>
					encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the snapshot was taken",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			// File history snapshot-specific fields
			messageId: t.string({
				nullable: true,
				description: "ID of the message this snapshot is associated with",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).messageId,
			}),
			isSnapshotUpdate: t.boolean({
				description: "Whether this is an update to an existing snapshot",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).isSnapshotUpdate,
			}),
			fileCount: t.int({
				description: "Number of files tracked in this snapshot",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).fileCount,
			}),
			snapshotTimestamp: t.field({
				type: "DateTime",
				nullable: true,
				description: "Timestamp of the actual snapshot data",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).snapshotTimestamp,
			}),
		}),
	});

// ============================================================================
// HookRunMessage - hook execution start events
// ============================================================================

/**
 * Parse raw JSON to extract hook run metadata
 */
interface HookRunMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	cached: boolean;
}

function parseHookRunMetadata(rawJson: string | undefined): HookRunMetadata {
	const defaults: HookRunMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.hook = data.hook ?? null;
		defaults.directory = data.directory ?? null;
		defaults.cached = data.cached ?? false;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookRunMessageRef =
	builder.objectRef<MessageWithSession>("HookRunMessage");

export const HookRunMessageType = HookRunMessageRef.implement({
	description: "A hook execution start event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		(typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			// Han events with toolName "hook_run" OR legacy type "hook_run"
			(obj as MessageWithSession).type === "han_event" &&
			(obj as MessageWithSession).toolName === "hook_run") ||
		(obj as MessageWithSession).type === "hook_run",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the hook started execution",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		// Hook run-specific fields
		plugin: t.string({
			nullable: true,
			description: "Plugin that owns the hook",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).plugin,
		}),
		hook: t.string({
			nullable: true,
			description: "Name of the hook being executed",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).hook,
		}),
		directory: t.string({
			nullable: true,
			description: "Directory context for the hook",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).directory,
		}),
		cached: t.boolean({
			description: "Whether this hook result was cached",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).cached,
		}),
	}),
});

// ============================================================================
// HookResultMessage - hook execution result events
// ============================================================================

/**
 * Parse raw JSON to extract hook result metadata
 */
interface HookResultMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	cached: boolean;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

function parseHookResultMetadata(
	rawJson: string | undefined,
): HookResultMetadata {
	const defaults: HookResultMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.hook = data.hook ?? null;
		defaults.directory = data.directory ?? null;
		defaults.cached = data.cached ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookResultMessageRef =
	builder.objectRef<MessageWithSession>("HookResultMessage");

export const HookResultMessageType = HookResultMessageRef.implement({
	description: "A hook execution result event with success/failure status",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		(typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			// Han events with toolName "hook_result" OR legacy type "hook_result"
			(obj as MessageWithSession).type === "han_event" &&
			(obj as MessageWithSession).toolName === "hook_result") ||
		(obj as MessageWithSession).type === "hook_result",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the hook completed",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		// Hook result-specific fields
		plugin: t.string({
			nullable: true,
			description: "Plugin that owns the hook",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).plugin,
		}),
		hook: t.string({
			nullable: true,
			description: "Name of the hook that was executed",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).hook,
		}),
		directory: t.string({
			nullable: true,
			description: "Directory context for the hook",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).directory,
		}),
		cached: t.boolean({
			description: "Whether this result was from cache",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).cached,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Execution duration in milliseconds",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).durationMs,
		}),
		exitCode: t.int({
			nullable: true,
			description: "Exit code from the hook process",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).exitCode,
		}),
		success: t.boolean({
			description: "Whether the hook succeeded",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).success,
		}),
		output: t.string({
			nullable: true,
			description: "Hook output content",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).output,
		}),
		error: t.string({
			nullable: true,
			description: "Error message if hook failed",
			resolve: (msg) => parseHookResultMetadata(msg.rawJson).error,
		}),
	}),
});

// ============================================================================
// HookReferenceMessage - file reference injection events
// ============================================================================

/**
 * Parse raw JSON to extract hook reference metadata
 */
interface HookReferenceMetadata {
	plugin: string | null;
	filePath: string | null;
	reason: string | null;
	success: boolean;
	durationMs: number | null;
}

function parseHookReferenceMetadata(
	rawJson: string | undefined,
): HookReferenceMetadata {
	const defaults: HookReferenceMetadata = {
		plugin: null,
		filePath: null,
		reason: null,
		success: false,
		durationMs: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.filePath = data.file_path ?? null;
		defaults.reason = data.reason ?? null;
		defaults.success = data.success ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookReferenceMessageRef = builder.objectRef<MessageWithSession>(
	"HookReferenceMessage",
);

export const HookReferenceMessageType = HookReferenceMessageRef.implement({
	description: "A hook reference injection event (must-read-first files)",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_reference",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the reference was injected",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		plugin: t.string({
			nullable: true,
			description: "Plugin that injected the reference",
			resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).plugin,
		}),
		filePath: t.string({
			nullable: true,
			description: "Path to the referenced file",
			resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).filePath,
		}),
		reason: t.string({
			nullable: true,
			description: "Reason for must-read-first requirement",
			resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).reason,
		}),
		success: t.boolean({
			description: "Whether the file was found and injected",
			resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).success,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Duration in milliseconds",
			resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).durationMs,
		}),
	}),
});

// ============================================================================
// HookValidationMessage - per-directory validation events
// ============================================================================

/**
 * Parse raw JSON to extract hook validation metadata
 */
interface HookValidationMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	cached: boolean;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

function parseHookValidationMetadata(
	rawJson: string | undefined,
): HookValidationMetadata {
	const defaults: HookValidationMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		// Extract just the base hook name (e.g., "typecheck" from "typecheck_packages_browse-client")
		const rawHook = data.hook ?? null;
		if (rawHook && data.directory) {
			// Remove directory suffix if present (e.g., "_packages_browse-client")
			const dirSuffix = `_${(data.directory as string).replace(/\//g, "_")}`;
			if (rawHook.endsWith(dirSuffix)) {
				defaults.hook = rawHook.slice(0, -dirSuffix.length);
			} else {
				defaults.hook = rawHook;
			}
		} else {
			defaults.hook = rawHook;
		}
		defaults.directory = data.directory ?? null;
		defaults.cached = data.cached ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookValidationMessageRef = builder.objectRef<MessageWithSession>(
	"HookValidationMessage",
);

export const HookValidationMessageType = HookValidationMessageRef.implement({
	description: "A per-directory validation hook result event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_validation",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the validation completed",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		plugin: t.string({
			nullable: true,
			description: "Plugin running the validation",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).plugin,
		}),
		hook: t.string({
			nullable: true,
			description: "Validation hook name (e.g., lint, typecheck)",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).hook,
		}),
		directory: t.string({
			nullable: true,
			description: "Directory being validated",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).directory,
		}),
		cached: t.boolean({
			description: "Whether result was from cache",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).cached,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Execution duration in milliseconds",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).durationMs,
		}),
		exitCode: t.int({
			nullable: true,
			description: "Exit code from the validation",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).exitCode,
		}),
		success: t.boolean({
			description: "Whether validation passed",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).success,
		}),
		output: t.string({
			nullable: true,
			description: "Validation output",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).output,
		}),
		error: t.string({
			nullable: true,
			description: "Error message if validation failed",
			resolve: (msg) => parseHookValidationMetadata(msg.rawJson).error,
		}),
	}),
});

// ============================================================================
// HookValidationCacheMessage - cached validation file hashes
// ============================================================================

/**
 * Parse raw JSON to extract hook validation cache metadata
 */
interface HookValidationCacheMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	fileCount: number;
}

function parseHookValidationCacheMetadata(
	rawJson: string | undefined,
): HookValidationCacheMetadata {
	const defaults: HookValidationCacheMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		fileCount: 0,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		// Extract just the base hook name (e.g., "typecheck" from "typecheck_packages_browse-client")
		const rawHook = data.hook ?? null;
		if (rawHook && data.directory) {
			// Remove directory suffix if present (e.g., "_packages_browse-client")
			const dirSuffix = `_${data.directory.replace(/\//g, "_")}`;
			if (rawHook.endsWith(dirSuffix)) {
				defaults.hook = rawHook.slice(0, -dirSuffix.length);
			} else {
				defaults.hook = rawHook;
			}
		} else {
			defaults.hook = rawHook;
		}
		defaults.directory = data.directory ?? null;
		defaults.fileCount = Object.keys(data.files ?? {}).length;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookValidationCacheMessageRef = builder.objectRef<MessageWithSession>(
	"HookValidationCacheMessage",
);

export const HookValidationCacheMessageType =
	HookValidationCacheMessageRef.implement({
		description: "A hook validation cache event with tracked file hashes",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "han_event" &&
			(obj as MessageWithSession).toolName === "hook_validation_cache",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) =>
					encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the cache was written",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			plugin: t.string({
				nullable: true,
				description: "Plugin that ran the validation",
				resolve: (msg) => parseHookValidationCacheMetadata(msg.rawJson).plugin,
			}),
			hook: t.string({
				nullable: true,
				description: "Validation hook name (e.g., typecheck, lint)",
				resolve: (msg) => parseHookValidationCacheMetadata(msg.rawJson).hook,
			}),
			directory: t.string({
				nullable: true,
				description: "Directory that was validated",
				resolve: (msg) =>
					parseHookValidationCacheMetadata(msg.rawJson).directory,
			}),
			fileCount: t.int({
				description: "Number of files tracked in cache",
				resolve: (msg) =>
					parseHookValidationCacheMetadata(msg.rawJson).fileCount,
			}),
		}),
	});

// ============================================================================
// HookScriptMessage - generic bash/cat script execution events
// ============================================================================

/**
 * Parse raw JSON to extract hook script metadata
 */
interface HookScriptMetadata {
	plugin: string | null;
	command: string | null;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
}

function parseHookScriptMetadata(
	rawJson: string | undefined,
): HookScriptMetadata {
	const defaults: HookScriptMetadata = {
		plugin: null,
		command: null,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.command = data.command ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookScriptMessageRef =
	builder.objectRef<MessageWithSession>("HookScriptMessage");

export const HookScriptMessageType = HookScriptMessageRef.implement({
	description: "A generic script execution event (bash/cat commands)",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_script",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the script executed",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		plugin: t.string({
			nullable: true,
			description: "Plugin running the script",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).plugin,
		}),
		command: t.string({
			nullable: true,
			description: "The command that was executed",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).command,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Execution duration in milliseconds",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).durationMs,
		}),
		exitCode: t.int({
			nullable: true,
			description: "Exit code from the script",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).exitCode,
		}),
		success: t.boolean({
			description: "Whether the script succeeded",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).success,
		}),
		output: t.string({
			nullable: true,
			description: "Script output",
			resolve: (msg) => parseHookScriptMetadata(msg.rawJson).output,
		}),
	}),
});

// ============================================================================
// HookDatetimeMessage - datetime injection events
// ============================================================================

/**
 * Parse raw JSON to extract hook datetime metadata
 */
interface HookDatetimeMetadata {
	plugin: string | null;
	datetime: string | null;
	durationMs: number | null;
}

function parseHookDatetimeMetadata(
	rawJson: string | undefined,
): HookDatetimeMetadata {
	const defaults: HookDatetimeMetadata = {
		plugin: null,
		datetime: null,
		durationMs: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.datetime = data.datetime ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookDatetimeMessageRef = builder.objectRef<MessageWithSession>(
	"HookDatetimeMessage",
);

export const HookDatetimeMessageType = HookDatetimeMessageRef.implement({
	description: "A datetime injection event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_datetime",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the datetime was injected",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		plugin: t.string({
			nullable: true,
			description: "Plugin injecting the datetime",
			resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).plugin,
		}),
		datetime: t.string({
			nullable: true,
			description: "The datetime string that was output",
			resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).datetime,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Duration in milliseconds",
			resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).durationMs,
		}),
	}),
});

// ============================================================================
// HookFileChangeMessage - file change recording events
// ============================================================================

/**
 * Parse raw JSON to extract hook file change metadata
 */
interface HookFileChangeMetadata {
	sessionId: string | null;
	toolName: string | null;
	filePath: string | null;
}

function parseHookFileChangeMetadata(
	rawJson: string | undefined,
): HookFileChangeMetadata {
	const defaults: HookFileChangeMetadata = {
		sessionId: null,
		toolName: null,
		filePath: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.sessionId = data.session_id ?? null;
		defaults.toolName = data.tool_name ?? null;
		defaults.filePath = data.file_path ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const HookFileChangeMessageRef = builder.objectRef<MessageWithSession>(
	"HookFileChangeMessage",
);

export const HookFileChangeMessageType = HookFileChangeMessageRef.implement({
	description: "A file change recording event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_file_change",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the file change was recorded",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		recordedSessionId: t.string({
			nullable: true,
			description: "Session ID where the change occurred",
			resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).sessionId,
		}),
		changeToolName: t.string({
			nullable: true,
			description: "Tool that made the change (Edit, Write)",
			resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).toolName,
		}),
		filePath: t.string({
			nullable: true,
			description: "Path to the changed file",
			resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).filePath,
		}),
	}),
});

// ============================================================================
// QueueOperationMessage - queue state changes
// ============================================================================

/**
 * Parse raw JSON to extract queue operation metadata
 */
interface QueueOperationMetadata {
	operation: string | null;
	queueSessionId: string | null;
}

function parseQueueOperationMetadata(
	rawJson: string | undefined,
): QueueOperationMetadata {
	const defaults: QueueOperationMetadata = {
		operation: null,
		queueSessionId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.operation = parsed.operation ?? null;
		defaults.queueSessionId = parsed.sessionId ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const QueueOperationMessageRef = builder.objectRef<MessageWithSession>(
	"QueueOperationMessage",
);

export const QueueOperationMessageType = QueueOperationMessageRef.implement({
	description: "A queue state change operation",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "queue-operation",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the queue operation occurred",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		// Queue operation-specific fields
		operation: t.string({
			nullable: true,
			description:
				"Type of queue operation (e.g., 'enqueue', 'dequeue', 'clear')",
			resolve: (msg) => parseQueueOperationMetadata(msg.rawJson).operation,
		}),
		queueSessionId: t.string({
			nullable: true,
			description: "Session ID involved in the queue operation",
			resolve: (msg) => parseQueueOperationMetadata(msg.rawJson).queueSessionId,
		}),
	}),
});

// ============================================================================
// McpToolCallMessage - MCP tool call events
// ============================================================================

/**
 * Parse raw JSON to extract MCP tool call metadata
 */
interface McpToolCallMetadata {
	tool: string | null;
	server: string | null;
	prefixedName: string | null;
	input: string | null;
	callId: string | null;
}

function parseMcpToolCallMetadata(
	rawJson: string | undefined,
): McpToolCallMetadata {
	const defaults: McpToolCallMetadata = {
		tool: null,
		server: null,
		prefixedName: null,
		input: null,
		callId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.tool = data.tool ?? null;
		defaults.server = data.server ?? null;
		defaults.prefixedName = data.prefixed_name ?? null;
		defaults.callId = data.call_id ?? null;
		if (data.input) {
			defaults.input =
				typeof data.input === "string"
					? data.input
					: JSON.stringify(data.input);
		}
		return defaults;
	} catch {
		return defaults;
	}
}

const McpToolCallMessageRef =
	builder.objectRef<MessageWithSession>("McpToolCallMessage");

export const McpToolCallMessageType = McpToolCallMessageRef.implement({
	description: "An MCP tool call event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		"toolName" in obj &&
		(obj as MessageWithSession).toolName === "mcp_tool_call",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the tool was called",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		tool: t.string({
			nullable: true,
			description: "Name of the MCP tool being called",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).tool,
		}),
		server: t.string({
			nullable: true,
			description: "MCP server handling the tool",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).server,
		}),
		prefixedName: t.string({
			nullable: true,
			description: "Full prefixed tool name",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).prefixedName,
		}),
		input: t.string({
			nullable: true,
			description: "Tool input as JSON string",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).input,
		}),
		callId: t.string({
			nullable: true,
			description: "Correlation ID to match with result",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).callId,
		}),
		// Result loaded via DataLoader
		result: t.field({
			type: McpToolResultType,
			nullable: true,
			description:
				"The result of this tool call (if available). Loaded via DataLoader from paired events.",
			resolve: async (msg, _args, context) => {
				const callId = parseMcpToolCallMetadata(msg.rawJson).callId;
				if (!callId) return null;

				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
				return pairedEvents.mcpResultByCallId.get(callId) ?? null;
			},
		}),
	}),
});

// ============================================================================
// McpToolResultMessage - MCP tool result events
// ============================================================================

/**
 * Parse raw JSON to extract MCP tool result metadata
 */
interface McpToolResultMetadata {
	tool: string | null;
	server: string | null;
	prefixedName: string | null;
	durationMs: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

function parseMcpToolResultMetadata(
	rawJson: string | undefined,
): McpToolResultMetadata {
	const defaults: McpToolResultMetadata = {
		tool: null,
		server: null,
		prefixedName: null,
		durationMs: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.tool = data.tool ?? null;
		defaults.server = data.server ?? null;
		defaults.prefixedName = data.prefixed_name ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const McpToolResultMessageRef = builder.objectRef<MessageWithSession>(
	"McpToolResultMessage",
);

export const McpToolResultMessageType = McpToolResultMessageRef.implement({
	description: "An MCP tool result event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		"toolName" in obj &&
		(obj as MessageWithSession).toolName === "mcp_tool_result",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the tool result was received",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		tool: t.string({
			nullable: true,
			description: "Name of the MCP tool",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).tool,
		}),
		server: t.string({
			nullable: true,
			description: "MCP server that handled the tool",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).server,
		}),
		prefixedName: t.string({
			nullable: true,
			description: "Full prefixed tool name",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).prefixedName,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Execution duration in milliseconds",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).durationMs,
		}),
		success: t.boolean({
			description: "Whether the tool call succeeded",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).success,
		}),
		output: t.string({
			nullable: true,
			description: "Tool output",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).output,
		}),
		error: t.string({
			nullable: true,
			description: "Error message if tool failed",
			resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).error,
		}),
	}),
});

// ============================================================================
// ExposedToolCallMessage - Exposed tool call events
// ============================================================================

const ExposedToolCallMessageRef = builder.objectRef<MessageWithSession>(
	"ExposedToolCallMessage",
);

export const ExposedToolCallMessageType = ExposedToolCallMessageRef.implement({
	description: "An exposed tool call event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		"toolName" in obj &&
		(obj as MessageWithSession).toolName === "exposed_tool_call",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the tool was called",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		tool: t.string({
			nullable: true,
			description: "Name of the exposed tool",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).tool,
		}),
		prefixedName: t.string({
			nullable: true,
			description: "Full prefixed tool name",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).prefixedName,
		}),
		input: t.string({
			nullable: true,
			description: "Tool input as JSON string",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).input,
		}),
		callId: t.string({
			nullable: true,
			description: "Correlation ID to match with result",
			resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).callId,
		}),
		// Result loaded via DataLoader
		result: t.field({
			type: ExposedToolResultType,
			nullable: true,
			description:
				"The result of this tool call (if available). Loaded via DataLoader from paired events.",
			resolve: async (msg, _args, context) => {
				const callId = parseMcpToolCallMetadata(msg.rawJson).callId;
				if (!callId) return null;

				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
				return pairedEvents.exposedResultByCallId.get(callId) ?? null;
			},
		}),
	}),
});

// ============================================================================
// ExposedToolResultMessage - Exposed tool result events
// ============================================================================

const ExposedToolResultMessageRef = builder.objectRef<MessageWithSession>(
	"ExposedToolResultMessage",
);

export const ExposedToolResultMessageType =
	ExposedToolResultMessageRef.implement({
		description: "An exposed tool result event",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "han_event" &&
			"toolName" in obj &&
			(obj as MessageWithSession).toolName === "exposed_tool_result",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) =>
					encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the tool result was received",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			tool: t.string({
				nullable: true,
				description: "Name of the exposed tool",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).tool,
			}),
			prefixedName: t.string({
				nullable: true,
				description: "Full prefixed tool name",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).prefixedName,
			}),
			durationMs: t.int({
				nullable: true,
				description: "Execution duration in milliseconds",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).durationMs,
			}),
			success: t.boolean({
				description: "Whether the tool call succeeded",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).success,
			}),
			output: t.string({
				nullable: true,
				description: "Tool output",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).output,
			}),
			error: t.string({
				nullable: true,
				description: "Error message if tool failed",
				resolve: (msg) => parseMcpToolResultMetadata(msg.rawJson).error,
			}),
		}),
	});

// ============================================================================
// MemoryQueryMessage - Memory query events
// ============================================================================

/**
 * Parse raw JSON to extract memory query metadata
 */
interface MemoryQueryMetadata {
	question: string | null;
	route: string | null;
	durationMs: number | null;
	resultCount: number | null;
}

function parseMemoryQueryMetadata(
	rawJson: string | undefined,
): MemoryQueryMetadata {
	const defaults: MemoryQueryMetadata = {
		question: null,
		route: null,
		durationMs: null,
		resultCount: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.question = data.question ?? null;
		defaults.route = data.route ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.resultCount = data.result_count ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const MemoryQueryMessageRef =
	builder.objectRef<MessageWithSession>("MemoryQueryMessage");

export const MemoryQueryMessageType = MemoryQueryMessageRef.implement({
	description: "A memory query event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		"toolName" in obj &&
		(obj as MessageWithSession).toolName === "memory_query",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the memory was queried",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		question: t.string({
			nullable: true,
			description: "The question being asked",
			resolve: (msg) => parseMemoryQueryMetadata(msg.rawJson).question,
		}),
		route: t.string({
			nullable: true,
			description: "Memory route used (e.g., 'personal', 'team', 'project')",
			resolve: (msg) => parseMemoryQueryMetadata(msg.rawJson).route,
		}),
		durationMs: t.int({
			nullable: true,
			description: "Query duration in milliseconds",
			resolve: (msg) => parseMemoryQueryMetadata(msg.rawJson).durationMs,
		}),
		resultCount: t.int({
			nullable: true,
			description: "Number of results returned",
			resolve: (msg) => parseMemoryQueryMetadata(msg.rawJson).resultCount,
		}),
	}),
});

// ============================================================================
// MemoryLearnMessage - Memory learn events
// ============================================================================

/**
 * Parse raw JSON to extract memory learn metadata
 */
interface MemoryLearnMetadata {
	domain: string | null;
	scope: string | null;
	paths: string[] | null;
	append: boolean;
}

function parseMemoryLearnMetadata(
	rawJson: string | undefined,
): MemoryLearnMetadata {
	const defaults: MemoryLearnMetadata = {
		domain: null,
		scope: null,
		paths: null,
		append: true,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.domain = data.domain ?? null;
		defaults.scope = data.scope ?? null;
		defaults.paths = Array.isArray(data.paths) ? data.paths : null;
		defaults.append = data.append ?? true;
		return defaults;
	} catch {
		return defaults;
	}
}

const MemoryLearnMessageRef =
	builder.objectRef<MessageWithSession>("MemoryLearnMessage");

export const MemoryLearnMessageType = MemoryLearnMessageRef.implement({
	description: "A memory learn event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		"toolName" in obj &&
		(obj as MessageWithSession).toolName === "memory_learn",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the learning was captured",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		domain: t.string({
			nullable: true,
			description: "Domain for the learned content",
			resolve: (msg) => parseMemoryLearnMetadata(msg.rawJson).domain,
		}),
		scope: t.string({
			nullable: true,
			description: "Scope of the learning (e.g., 'project', 'user')",
			resolve: (msg) => parseMemoryLearnMetadata(msg.rawJson).scope,
		}),
		paths: t.stringList({
			nullable: true,
			description: "Path patterns if path-specific",
			resolve: (msg) => parseMemoryLearnMetadata(msg.rawJson).paths,
		}),
		append: t.boolean({
			description: "Whether content was appended vs replaced",
			resolve: (msg) => parseMemoryLearnMetadata(msg.rawJson).append,
		}),
	}),
});

// ============================================================================
// SentimentAnalysisMessage - Sentiment analysis events
// ============================================================================

/**
 * Parse raw JSON to extract sentiment analysis metadata
 */
interface SentimentAnalysisMetadata {
	sentimentScore: number;
	sentimentLevel: string;
	frustrationScore: number | null;
	frustrationLevel: string | null;
	signals: string[];
	analyzedMessageId: string | null;
}

function parseSentimentAnalysisMetadata(
	rawJson: string | undefined,
): SentimentAnalysisMetadata {
	const defaults: SentimentAnalysisMetadata = {
		sentimentScore: 0,
		sentimentLevel: "neutral",
		frustrationScore: null,
		frustrationLevel: null,
		signals: [],
		analyzedMessageId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.sentimentScore = data.sentiment_score ?? 0;
		defaults.sentimentLevel = data.sentiment_level ?? "neutral";
		defaults.frustrationScore = data.frustration_score ?? null;
		defaults.frustrationLevel = data.frustration_level ?? null;
		defaults.signals = Array.isArray(data.signals) ? data.signals : [];
		defaults.analyzedMessageId = data.message_id ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

const SentimentAnalysisMessageRef = builder.objectRef<MessageWithSession>(
	"SentimentAnalysisMessage",
);

export const SentimentAnalysisMessageType =
	SentimentAnalysisMessageRef.implement({
		description: "A sentiment analysis event",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "han_event" &&
			"toolName" in obj &&
			(obj as MessageWithSession).toolName === "sentiment_analysis",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) =>
					encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the analysis was performed",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			sentimentScore: t.float({
				description: "Raw sentiment score (typically -5 to +5)",
				resolve: (msg) =>
					parseSentimentAnalysisMetadata(msg.rawJson).sentimentScore,
			}),
			sentimentLevel: t.string({
				description:
					"Categorized sentiment level (positive, neutral, negative)",
				resolve: (msg) =>
					parseSentimentAnalysisMetadata(msg.rawJson).sentimentLevel,
			}),
			frustrationScore: t.float({
				nullable: true,
				description: "Frustration score (0-10) if detected",
				resolve: (msg) =>
					parseSentimentAnalysisMetadata(msg.rawJson).frustrationScore,
			}),
			frustrationLevel: t.string({
				nullable: true,
				description: "Frustration level if detected (low, moderate, high)",
				resolve: (msg) =>
					parseSentimentAnalysisMetadata(msg.rawJson).frustrationLevel,
			}),
			signals: t.stringList({
				description:
					"Detected signals (e.g., CAPS, punctuation, negative_words)",
				resolve: (msg) => parseSentimentAnalysisMetadata(msg.rawJson).signals,
			}),
			analyzedMessageId: t.string({
				nullable: true,
				description: "ID of the message that was analyzed",
				resolve: (msg) =>
					parseSentimentAnalysisMetadata(msg.rawJson).analyzedMessageId,
			}),
		}),
	});

// ============================================================================
// UnknownEventMessage - Fallback for unknown event types
// ============================================================================

const UnknownEventMessageRef = builder.objectRef<MessageWithSession>(
	"UnknownEventMessage",
);

export const UnknownEventMessageType = UnknownEventMessageRef.implement({
	description:
		"A fallback message type for unknown or future event types. Contains raw JSON for debugging.",
	interfaces: [MessageInterface],
	isTypeOf: (obj) => {
		// This is the catch-all for any unknown types
		if (typeof obj !== "object" || obj === null) return false;
		const msg = obj as MessageWithSession;
		// Match if we don't have a more specific type
		const knownTypes = [
			"user",
			"assistant",
			"summary",
			"system",
			"file-history-snapshot",
			"hook_run",
			"hook_result",
			"queue-operation",
		];
		if (knownTypes.includes(msg.type)) return false;
		if (msg.type === "han_event") {
			const knownEventTypes = [
				"hook_run",
				"hook_result",
				"hook_reference",
				"hook_validation",
				"hook_validation_cache",
				"hook_script",
				"hook_datetime",
				"hook_file_change",
				"queue_operation",
				"mcp_tool_call",
				"mcp_tool_result",
				"exposed_tool_call",
				"exposed_tool_result",
				"memory_query",
				"memory_learn",
				"sentiment_analysis",
			];
			return !knownEventTypes.includes(msg.toolName ?? "");
		}
		return true;
	},
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) =>
				encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the event occurred",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			description: "Raw JSON for debugging unknown types",
			resolve: (msg) => msg.rawJson || null,
		}),
		messageType: t.string({
			nullable: true,
			description: "The original message type",
			resolve: (msg) => msg.type ?? null,
		}),
		eventType: t.string({
			nullable: true,
			description: "The event subtype if han_event",
			resolve: (msg) => msg.toolName ?? null,
		}),
	}),
});

// ============================================================================
// Message Connection Types
// ============================================================================

/**
 * Type for message connection data
 */
export type MessageConnectionData = {
	edges: Array<{ node: MessageWithSession; cursor: string }>;
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor: string | null;
		endCursor: string | null;
	};
	totalCount: number;
};

export const MessageEdgeType = builder
	.objectRef<{ node: MessageWithSession; cursor: string }>("MessageEdge")
	.implement({
		description: "An edge in a message connection",
		fields: (t) => ({
			node: t.field({
				type: MessageInterface,
				description: "The message at this edge",
				resolve: (edge) => edge.node,
			}),
			cursor: t.exposeString("cursor", {
				description: "Cursor for this edge",
			}),
		}),
	});

export const MessageConnectionType = builder
	.objectRef<{
		edges: Array<{ node: MessageWithSession; cursor: string }>;
		pageInfo: {
			hasNextPage: boolean;
			hasPreviousPage: boolean;
			startCursor: string | null;
			endCursor: string | null;
		};
		totalCount: number;
	}>("MessageConnection")
	.implement({
		description: "A paginated list of messages",
		fields: (t) => ({
			edges: t.field({
				type: [MessageEdgeType],
				description: "List of message edges",
				resolve: (conn) => conn.edges,
			}),
			pageInfo: t.field({
				type: PageInfoType,
				description: "Pagination information",
				resolve: (conn) => conn.pageInfo,
			}),
			totalCount: t.exposeInt("totalCount", {
				description: "Total number of messages in the session",
			}),
		}),
	});

// =============================================================================
// Message Node Loader
// =============================================================================

/**
 * Get a single message by its composite ID components
 * Loads the session's messages and finds the one at the specified line number
 *
 * @param projectDir - Encoded project directory (e.g., "-Volumes-dev-src-...")
 * @param sessionId - Session UUID
 * @param lineNumber - Line number in the JSONL file (1-based)
 * @returns The message with session context, or null if not found
 */
export async function getMessageByLineNumber(
	projectDir: string,
	sessionId: string,
	lineNumber: number,
): Promise<MessageWithSession | null> {
	// Load messages for the session
	// Line numbers are 1-based, offset is 0-based
	// To get the message at lineNumber N, we need offset = N-1, limit = 1
	const { messages } = await getSessionMessagesPaginated(
		sessionId,
		lineNumber - 1,
		1,
	);

	if (messages.length === 0) {
		return null;
	}

	const msg = messages[0];
	return {
		...msg,
		projectDir,
		sessionId,
		lineNumber,
	};
}

/**
 * Register node loader for Message type
 * ID format: projectDir:sessionId:lineNumber
 */
registerNodeLoader("Message", async (compositeId: string) => {
	// Parse composite ID: "projectDir:sessionId:lineNumber"
	// projectDir can contain colons (after decoding), so we need to parse carefully
	// Format: {projectDir}:{sessionId}:{lineNumber}
	// sessionId is a UUID (36 chars), lineNumber is an integer
	// We can use the last two colons to split

	const parts = compositeId.split(":");
	if (parts.length < 3) {
		console.warn(`Invalid Message ID format: ${compositeId}`);
		return null;
	}

	// Last part is lineNumber
	const lineNumberStr = parts[parts.length - 1];
	// Second to last is sessionId (UUID)
	const sessionId = parts[parts.length - 2];
	// Everything before is projectDir
	const projectDir = parts.slice(0, -2).join(":");

	const lineNumber = Number.parseInt(lineNumberStr, 10);
	if (Number.isNaN(lineNumber)) {
		console.warn(`Invalid line number in Message ID: ${compositeId}`);
		return null;
	}

	return getMessageByLineNumber(projectDir, sessionId, lineNumber);
});
