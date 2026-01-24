/**
 * GraphQL HookRunMessage type
 *
 * A hook execution start event.
 * Subscribes to hookResultAdded to get real-time updates when result arrives.
 */

import { builder } from "../../builder.ts";
import type { GraphQLLoaders } from "../../loaders.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { HookResultType } from "./hook-result.ts";
import { parseHookRunMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

const HookRunMessageRef =
	builder.objectRef<MessageWithSession>("HookRunMessage");

export const HookRunMessageType = HookRunMessageRef.implement({
	description: "A hook execution start event",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		(typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			// Han events with toolName "hook_run" OR legacy type "hook_run"
			(obj as MessageWithSession).type === "han_event" &&
			(obj as MessageWithSession).toolName === "hook_run") ||
		(obj as MessageWithSession).type === "hook_run",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the hook started execution",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		// Hook run-specific fields
		hookRunId: t.string({
			nullable: true,
			description: "UUID of this hook run (used to correlate with result)",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).hookRunId,
		}),
		plugin: t.string({
			nullable: true,
			description: "Plugin that owns the hook",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).plugin,
		}),
		hook: t.string({
			nullable: true,
			description: "Name of the hook being executed",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).hook,
		}),
		directory: t.string({
			nullable: true,
			description: "Directory context for the hook",
			resolve: (msg) => {
				const dir = parseHookRunMetadata(msg.rawJson).directory;
				return dir === "." ? "(root)" : dir;
			},
		}),
		cached: t.boolean({
			description: "Whether this hook result was cached",
			resolve: (msg) => parseHookRunMetadata(msg.rawJson).cached,
		}),
		/**
		 * Hook result (loaded via DataLoader)
		 * Returns null if result hasn't arrived yet
		 */
		result: t.field({
			type: HookResultType,
			nullable: true,
			description: "Hook result (null if still pending)",
			resolve: async (msg, _args, context) => {
				const hookRunId = parseHookRunMetadata(msg.rawJson).hookRunId;
				if (!hookRunId) return null;

				const loaders = (context as { loaders?: GraphQLLoaders }).loaders;
				if (!loaders) return null;

				// Load paired events for this session to get the result
				const pairedEvents = await loaders.sessionPairedEventsLoader.load(
					msg.sessionId,
				);
				return pairedEvents.hookResultByHookRunId.get(hookRunId) ?? null;
			},
		}),
	}),
});
