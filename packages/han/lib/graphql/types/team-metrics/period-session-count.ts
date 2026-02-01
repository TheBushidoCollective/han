/**
 * PeriodSessionCount Type
 *
 * Session count aggregated by time period.
 */

import { builder } from "../../builder.ts";

export interface PeriodSessionCount {
	period: string;
	sessionCount: number;
	taskCount: number;
	tokenUsage: number;
}

const PeriodSessionCountRef =
	builder.objectRef<PeriodSessionCount>("PeriodSessionCount");

export const PeriodSessionCountType = PeriodSessionCountRef.implement({
	description: "Session count aggregated by time period",
	fields: (t) => ({
		period: t.exposeString("period", {
			description: "Time period label (e.g., '2026-01-30' or '2026-W05')",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions in this period",
		}),
		taskCount: t.exposeInt("taskCount", {
			description: "Number of tasks in this period",
		}),
		tokenUsage: t.exposeInt("tokenUsage", {
			description: "Total tokens used in this period",
		}),
	}),
});
