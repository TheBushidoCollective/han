/**
 * GraphQL SlotReleaseResult type
 *
 * Result of slot release.
 */

import { builder } from "../builder.ts";

/**
 * Slot release result data
 */
export interface SlotReleaseResultData {
	success: boolean;
	message: string;
}

/**
 * Slot release result type ref
 */
const SlotReleaseResultRef =
	builder.objectRef<SlotReleaseResultData>("SlotReleaseResult");

/**
 * Slot release result type implementation
 */
export const SlotReleaseResultType = SlotReleaseResultRef.implement({
	description: "Result of slot release",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the slot was released",
		}),
		message: t.exposeString("message", { description: "Result message" }),
	}),
});
