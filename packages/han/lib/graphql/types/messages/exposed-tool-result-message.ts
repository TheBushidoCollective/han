/**
 * GraphQL ExposedToolResultMessage type
 *
 * An exposed tool result event.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseMcpToolResultMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
				resolve: (msg) => encodeGlobalId("Message", msg.id),
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
