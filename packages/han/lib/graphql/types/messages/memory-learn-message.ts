/**
 * GraphQL MemoryLearnMessage type
 *
 * A memory learn event.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseMemoryLearnMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

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
			resolve: (msg) => encodeGlobalId("Message", msg.id),
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
