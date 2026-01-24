/**
 * Hook Check State Message Type
 *
 * Records when hooks are checked to determine if validation is needed.
 * Used for deduplication in --check mode.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import type { MessageWithSession } from "./message-interface.ts";
import { MessageInterface } from "./message-interface.ts";

const HookCheckStateMessageRef = builder.objectRef<MessageWithSession>(
	"HookCheckStateMessage",
);

export const HookCheckStateMessage = HookCheckStateMessageRef.implement({
	description:
		"Hook check state event recording when hooks are checked for validation",
	interfaces: [MessageInterface],
	isTypeOf: (obj) =>
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as MessageWithSession).type === "han_event" &&
		(obj as MessageWithSession).toolName === "hook_check_state",
	fields: (t) => ({
		id: t.id({
			description: "Message global ID",
			resolve: (msg) => encodeGlobalId("Message", msg.id),
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When the check occurred",
			resolve: (msg) => msg.timestamp,
		}),
		rawJson: t.string({
			nullable: true,
			resolve: (msg) => msg.rawJson || null,
		}),
		hookType: t.string({
			description: "The type of hook being checked (e.g., Stop, PreToolUse)",
			resolve: (msg) => {
				if (!msg.rawJson) return "";
				try {
					const data = JSON.parse(msg.rawJson);
					return data.tool_input?.hook_type || data.hook_type || "";
				} catch {
					return "";
				}
			},
		}),
		fingerprint: t.string({
			description: "Hash of hooks needing validation (for deduplication)",
			resolve: (msg) => {
				if (!msg.rawJson) return "";
				try {
					const data = JSON.parse(msg.rawJson);
					return data.tool_input?.fingerprint || data.fingerprint || "";
				} catch {
					return "";
				}
			},
		}),
		hooksCount: t.int({
			description: "Number of hooks that need to run",
			resolve: (msg) => {
				if (!msg.rawJson) return 0;
				try {
					const data = JSON.parse(msg.rawJson);
					return data.tool_input?.hooks_count || data.hooks_count || 0;
				} catch {
					return 0;
				}
			},
		}),
	}),
});
