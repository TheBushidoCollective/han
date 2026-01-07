/**
 * GraphQL MessageInterface
 *
 * Base interface for all message types in a session.
 */

import type { SessionMessage } from "../../../api/sessions.ts";
import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import {
	type ContentBlock,
	getMessageText,
	parseUserMetadata,
} from "./message-helpers.ts";

/**
 * Message with session context for ID generation
 */
export type MessageWithSession = SessionMessage & {
	projectDir: string;
	sessionId: string;
	lineNumber: number;
};

/**
 * Check if a user message is actually a continuation summary
 * These are injected when a session runs out of context and is continued
 */
export function isUserMessageActuallySummary(msg: MessageWithSession): boolean {
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

/**
 * Check if a user message is actually a tool_result
 * Claude API sends tool results with role: "user" but content containing only tool_result blocks
 * These should not be displayed as user messages or have sentiment analysis
 */
export function isUserMessageActuallyToolResult(
	msg: MessageWithSession,
): boolean {
	if (msg.type !== "user") return false;

	// Check rawJson for message.content structure
	if (msg.rawJson) {
		try {
			const parsed = JSON.parse(msg.rawJson);
			const content = parsed.message?.content;

			// If content is an array and ALL blocks are tool_result, this is a tool result message
			if (Array.isArray(content) && content.length > 0) {
				const isAllToolResults = content.every(
					(block: { type: string }) => block.type === "tool_result",
				);
				if (isAllToolResults) {
					return true;
				}
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
			case "user": {
				// Check if this is actually a continuation summary
				if (isUserMessageActuallySummary(msg)) {
					return "SummaryMessage";
				}
				// Check for tool-result-only user messages
				if (isUserMessageActuallyToolResult(msg)) {
					return "ToolResultUserMessage";
				}
				// Route to specific UserMessage subtypes based on metadata
				const metadata = parseUserMetadata(msg.rawJson);
				if (metadata.isCommand) {
					return "CommandUserMessage";
				}
				if (metadata.isInterrupt) {
					return "InterruptUserMessage";
				}
				if (metadata.isMeta) {
					return "MetaUserMessage";
				}
				return "RegularUserMessage";
			}
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
			description: "Message global ID (Message:{uuid})",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
		}),
		uuid: t.string({
			description:
				"Raw message UUID. Use this for URLs and links instead of the global ID.",
			resolve: (msg) => msg.id,
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
