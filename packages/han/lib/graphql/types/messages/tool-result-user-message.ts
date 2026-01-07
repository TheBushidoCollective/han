/**
 * GraphQL ToolResultUserMessage type
 *
 * A user message that contains only tool_result blocks.
 * Claude API sends tool results with role: "user" but content containing only tool_result blocks.
 * These are typically filtered from the main message list but are available for debugging.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import {
	type ContentBlockData,
	ContentBlockInterface,
	parseContentBlocks,
} from "../content-block.ts";
import { type ContentBlock, getMessageText } from "./message-helpers.ts";
import {
	isUserMessageActuallyToolResult,
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";
import { UserMessageInterface } from "./user-message-interface.ts";

const ToolResultUserMessageRef = builder.objectRef<MessageWithSession>(
	"ToolResultUserMessage",
);

export const ToolResultUserMessageType = ToolResultUserMessageRef.implement({
	description:
		"A user message containing only tool_result blocks (internal API structure)",
	interfaces: [MessageInterface, UserMessageInterface],
	isTypeOf: (obj) => {
		if (typeof obj !== "object" || obj === null || !("type" in obj))
			return false;
		const msg = obj as MessageWithSession;
		return msg.type === "user" && isUserMessageActuallyToolResult(msg);
	},
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the tool result was recorded",
			resolve: (msg) => msg.timestamp,
		}),
		content: t.string({
			nullable: true,
			description: "Tool result content (usually empty for display)",
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
					return parseContentBlocks(content, { sessionId: msg.sessionId });
				} catch {
					return [];
				}
			},
		}),
		// Tool result specific fields
		toolResultCount: t.int({
			description: "Number of tool_result blocks in this message",
			resolve: (msg) => {
				if (!msg.rawJson) return 0;
				try {
					const parsed = JSON.parse(msg.rawJson);
					const content = parsed.message?.content;
					if (Array.isArray(content)) {
						return content.filter(
							(block: { type: string }) => block.type === "tool_result",
						).length;
					}
					return 0;
				} catch {
					return 0;
				}
			},
		}),
	}),
});
