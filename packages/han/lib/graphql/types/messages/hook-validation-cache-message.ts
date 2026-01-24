/**
 * GraphQL HookValidationCacheMessage type
 *
 * A hook validation cache event with tracked file hashes.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseHookValidationCacheMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

const HookValidationCacheMessageRef = builder.objectRef<MessageWithSession>(
	"HookValidationCacheMessage",
);

export const HookValidationCacheMessageType =
	HookValidationCacheMessageRef.implement({
		description: "A hook validation cache event with tracked file hashes",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "han_event" &&
			(obj as MessageWithSession).toolName === "hook_validation_cache",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) => encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the cache was written",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			plugin: t.string({
				nullable: true,
				description: "Plugin that ran the validation",
				resolve: (msg) => parseHookValidationCacheMetadata(msg.rawJson).plugin,
			}),
			hook: t.string({
				nullable: true,
				description: "Validation hook name (e.g., typecheck, lint)",
				resolve: (msg) => parseHookValidationCacheMetadata(msg.rawJson).hook,
			}),
			directory: t.string({
				nullable: true,
				description: "Directory that was validated",
				resolve: (msg) =>
					parseHookValidationCacheMetadata(msg.rawJson).directory,
			}),
			fileCount: t.int({
				description: "Number of files tracked in cache",
				resolve: (msg) =>
					parseHookValidationCacheMetadata(msg.rawJson).fileCount,
			}),
		}),
	});
