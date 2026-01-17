/**
 * GraphQL AssistantMessage type
 *
 * An assistant (Claude) message with tokens, thinking, and tool use.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import {
	type ContentBlockData,
	ContentBlockInterface,
	parseContentBlocks,
} from "../content-block.ts";
import {
	type ContentBlock,
	getMessageText,
	parseAssistantMetadata,
} from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
			resolve: (msg) => encodeGlobalId("Message", msg.id),
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
					return parseContentBlocks(content, { sessionId: msg.sessionId });
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
