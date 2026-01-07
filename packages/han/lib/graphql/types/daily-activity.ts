/**
 * GraphQL DailyActivity type
 *
 * Activity metrics for a single day.
 */

import { builder } from "../builder.ts";

/**
 * Activity for a single day (for heatmap)
 */
export interface DailyActivity {
	date: string; // YYYY-MM-DD format
	sessionCount: number;
	messageCount: number;
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
	linesAdded: number;
	linesRemoved: number;
	filesChanged: number;
}

/**
 * Daily activity type ref
 */
const DailyActivityRef = builder.objectRef<DailyActivity>("DailyActivity");

/**
 * Daily activity type implementation
 */
export const DailyActivityType = DailyActivityRef.implement({
	description: "Activity metrics for a single day",
	fields: (t) => ({
		date: t.exposeString("date", {
			description: "Date in YYYY-MM-DD format",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions started on this day",
		}),
		messageCount: t.exposeInt("messageCount", {
			description: "Number of messages sent on this day",
		}),
		inputTokens: t.field({
			type: "BigInt",
			description: "Total input tokens used",
			resolve: (data) => data.inputTokens,
		}),
		outputTokens: t.field({
			type: "BigInt",
			description: "Total output tokens generated",
			resolve: (data) => data.outputTokens,
		}),
		cachedTokens: t.field({
			type: "BigInt",
			description: "Total cached tokens used",
			resolve: (data) => data.cachedTokens,
		}),
		linesAdded: t.exposeInt("linesAdded", {
			description: "Lines of code added",
		}),
		linesRemoved: t.exposeInt("linesRemoved", {
			description: "Lines of code removed",
		}),
		filesChanged: t.exposeInt("filesChanged", {
			description: "Number of files changed",
		}),
	}),
});
