/**
 * GraphQL HookResult type
 *
 * Hook execution result (inline, not a separate event).
 */

import { builder } from "../../builder.ts";
import type { HookResultEventData } from "../../loaders.ts";

/**
 * HookResult type for inline display on HookRunEvent
 */
export const HookResultType = builder
	.objectRef<HookResultEventData>("HookResult")
	.implement({
		description: "Hook execution result (inline, not a separate event)",
		fields: (t) => ({
			id: t.exposeString("id", { description: "Event ID" }),
			timestamp: t.field({
				type: "DateTime",
				description: "When the result was recorded",
				resolve: (data) => data.timestamp,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (data) => data.durationMs,
			}),
			exitCode: t.int({
				description: "Process exit code",
				resolve: (data) => data.exitCode,
			}),
			success: t.boolean({
				description: "Whether hook succeeded",
				resolve: (data) => data.success,
			}),
			output: t.string({
				nullable: true,
				description: "Hook output (if success)",
				resolve: (data) => data.output ?? null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (data) => data.error ?? null,
			}),
		}),
	});
