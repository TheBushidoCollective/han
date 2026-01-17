/**
 * GraphQL HookTypeStat type
 *
 * Represents hook statistics by type.
 */

import { builder } from "../builder.ts";

/**
 * Hook type breakdown data
 */
export interface HookTypeStatData {
	hookType: string;
	total: number;
	passed: number;
}

/**
 * Hook type stat type ref
 */
const HookTypeStatRef = builder.objectRef<HookTypeStatData>("HookTypeStat");

/**
 * Hook type stat type implementation
 */
export const HookTypeStatType = HookTypeStatRef.implement({
	description: "Hook statistics by type",
	fields: (t) => ({
		hookType: t.exposeString("hookType", {
			description: "Hook type name",
		}),
		total: t.exposeInt("total", {
			description: "Total executions of this type",
		}),
		passed: t.exposeInt("passed", {
			description: "Passed executions",
		}),
	}),
});
