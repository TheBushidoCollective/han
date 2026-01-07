/**
 * GraphQL SentimentAnalysisMessage type
 *
 * A sentiment analysis event message.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseSentimentAnalysisMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
				resolve: (msg) => encodeGlobalId("Message", msg.id),
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
