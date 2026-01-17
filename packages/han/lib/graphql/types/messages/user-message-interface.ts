/**
 * GraphQL UserMessage Interface
 *
 * Base interface for all user message subtypes.
 * User messages can be regular input, meta/system messages, commands, or interrupts.
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
	parseUserMetadata,
} from "./message-helpers.ts";
import {
	isUserMessageActuallyToolResult,
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";
import { SentimentAnalysisType } from "./sentiment-analysis.ts";

/**
 * Determine the specific UserMessage subtype from message data
 */
export function getUserMessageSubtype(
	msg: MessageWithSession,
):
	| "RegularUserMessage"
	| "MetaUserMessage"
	| "CommandUserMessage"
	| "InterruptUserMessage"
	| "ToolResultUserMessage" {
	// Check for tool result messages first (these are filtered from normal display)
	if (isUserMessageActuallyToolResult(msg)) {
		return "ToolResultUserMessage";
	}

	const metadata = parseUserMetadata(msg.rawJson);

	// Priority order: Command > Interrupt > Meta > Regular
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

export const UserMessageInterface =
	builder.interfaceRef<MessageWithSession>("UserMessage");

UserMessageInterface.implement({
	description:
		"Base interface for all user message types. Subtypes include regular messages, meta/system messages, commands, and interrupts.",
	interfaces: [MessageInterface],
	resolveType: (msg) => getUserMessageSubtype(msg),
	fields: (t) => ({
		// Inherited from MessageInterface
		id: t.id({
			description: "Message global ID",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
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
		// UserMessage-specific shared fields
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
		// Sentiment analysis - available on all user message types
		sentimentAnalysis: t.field({
			type: SentimentAnalysisType,
			nullable: true,
			description:
				"Sentiment analysis for this message (if available). Loaded via DataLoader from the session's paired events.",
			resolve: async (msg, _args, context) => {
				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
				if (!msg.id) return null;
				return pairedEvents.sentimentByMessageId.get(msg.id) ?? null;
			},
		}),
	}),
});
