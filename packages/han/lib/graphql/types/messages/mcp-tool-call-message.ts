/**
 * GraphQL McpToolCallMessage type
 *
 * An MCP tool call event.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { McpToolResultType } from "./mcp-tool-result.ts";
import { parseMcpToolCallMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
			resolve: (msg) => encodeGlobalId("Message", msg.id),
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
