/**
 * GraphQL MemoryQueryMessage type
 *
 * A memory query event.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseMemoryQueryMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
			resolve: (msg) => encodeGlobalId("Message", msg.id),
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
