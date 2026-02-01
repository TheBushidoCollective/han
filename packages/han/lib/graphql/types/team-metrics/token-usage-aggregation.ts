/**
 * TokenUsageAggregation Type
 *
 * Aggregated token usage statistics.
 */

import { builder } from "../../builder.ts";

export interface TokenUsageAggregation {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCachedTokens: number;
	totalTokens: number;
	estimatedCostUsd: number;
}

const TokenUsageAggregationRef =
	builder.objectRef<TokenUsageAggregation>("TokenUsageAggregation");

export const TokenUsageAggregationType = TokenUsageAggregationRef.implement({
	description: "Aggregated token usage statistics",
	fields: (t) => ({
		totalInputTokens: t.exposeInt("totalInputTokens", {
			description: "Total input tokens consumed",
		}),
		totalOutputTokens: t.exposeInt("totalOutputTokens", {
			description: "Total output tokens generated",
		}),
		totalCachedTokens: t.exposeInt("totalCachedTokens", {
			description: "Total cached tokens used",
		}),
		totalTokens: t.exposeInt("totalTokens", {
			description: "Total tokens (input + output)",
		}),
		estimatedCostUsd: t.exposeFloat("estimatedCostUsd", {
			description: "Estimated cost in USD",
		}),
	}),
});
