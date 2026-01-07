/**
 * GraphQL CommandUserMessage type
 *
 * A slash command message in a session.
 * These are messages where the user invoked a slash command (e.g., /commit, /review).
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
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";
import { SentimentAnalysisType } from "./sentiment-analysis.ts";
import { UserMessageInterface } from "./user-message-interface.ts";

const CommandUserMessageRef =
	builder.objectRef<MessageWithSession>("CommandUserMessage");

export const CommandUserMessageType = CommandUserMessageRef.implement({
	description: "A slash command message in a session",
	interfaces: [MessageInterface, UserMessageInterface],
	isTypeOf: (obj) => {
		if (typeof obj !== "object" || obj === null || !("type" in obj))
			return false;
		const msg = obj as MessageWithSession;
		if (msg.type !== "user") return false;
		const metadata = parseUserMetadata(msg.rawJson);
		return metadata.isCommand;
	},
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the command was sent",
			resolve: (msg) => msg.timestamp,
		}),
		content: t.string({
			nullable: true,
			description: "Command message text content (including command name)",
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
		// Command-specific field
		commandName: t.string({
			nullable: true,
			description: "Name of the slash command (e.g., 'commit', 'review')",
			resolve: (msg) => parseUserMetadata(msg.rawJson).commandName,
		}),
		sentimentAnalysis: t.field({
			type: SentimentAnalysisType,
			nullable: true,
			description: "Sentiment analysis for this message (if available)",
			resolve: async (msg, _args, context) => {
				const pairedEvents =
					await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
				if (!msg.id) return null;
				return pairedEvents.sentimentByMessageId.get(msg.id) ?? null;
			},
		}),
	}),
});
