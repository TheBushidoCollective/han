/**
 * GraphQL ModelUsageStats type
 *
 * Cumulative usage statistics for a model.
 */

import { builder } from "../builder.ts";

/**
 * Cumulative model usage stats (from stats-cache.json)
 */
export interface ModelUsageStats {
	model: string;
	displayName: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	totalTokens: number;
}

/**
 * Model usage stats type ref
 */
const ModelUsageStatsRef =
	builder.objectRef<ModelUsageStats>("ModelUsageStats");

/**
 * Model usage stats type implementation
 */
export const ModelUsageStatsType = ModelUsageStatsRef.implement({
	description: "Cumulative usage statistics for a model",
	fields: (t) => ({
		model: t.exposeString("model", {
			description: "Model ID",
		}),
		displayName: t.exposeString("displayName", {
			description: "Human-readable model name",
		}),
		inputTokens: t.field({
			type: "BigInt",
			description: "Total input tokens",
			resolve: (data) => data.inputTokens,
		}),
		outputTokens: t.field({
			type: "BigInt",
			description: "Total output tokens",
			resolve: (data) => data.outputTokens,
		}),
		cacheReadTokens: t.field({
			type: "BigInt",
			description: "Total cache read tokens",
			resolve: (data) => data.cacheReadTokens,
		}),
		cacheCreationTokens: t.field({
			type: "BigInt",
			description: "Total cache creation tokens",
			resolve: (data) => data.cacheCreationTokens,
		}),
		totalTokens: t.field({
			type: "BigInt",
			description: "Total tokens (input + output)",
			resolve: (data) => data.totalTokens,
		}),
	}),
});
