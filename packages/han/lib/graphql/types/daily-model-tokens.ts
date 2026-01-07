/**
 * GraphQL DailyModelTokens type
 *
 * Daily token usage broken down by model.
 */

import { builder } from "../builder.ts";
import {
	type ModelTokenEntry,
	ModelTokenEntryType,
} from "./model-token-entry.ts";

/**
 * Daily model tokens with parsed entries
 */
export interface DailyModelTokensParsed {
	date: string;
	models: ModelTokenEntry[];
	totalTokens: number;
}

/**
 * Daily model tokens from stats-cache.json
 */
export interface DailyModelTokens {
	date: string; // YYYY-MM-DD format
	tokensByModel: Record<string, number>;
}

/**
 * Daily model tokens type ref
 */
const DailyModelTokensRef =
	builder.objectRef<DailyModelTokensParsed>("DailyModelTokens");

/**
 * Daily model tokens type implementation
 */
export const DailyModelTokensType = DailyModelTokensRef.implement({
	description: "Daily token usage broken down by model",
	fields: (t) => ({
		date: t.exposeString("date", {
			description: "Date in YYYY-MM-DD format",
		}),
		models: t.field({
			type: [ModelTokenEntryType],
			description: "Token usage per model for this day",
			resolve: (data) => data.models,
		}),
		totalTokens: t.field({
			type: "BigInt",
			description: "Total tokens across all models for this day",
			resolve: (data) => data.totalTokens,
		}),
	}),
});
