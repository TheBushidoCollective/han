/**
 * GraphQL type for session frustration summary
 *
 * Aggregates frustration data from sentiment_analysis events in a session.
 */

import { builder } from "../builder.ts";
import type { SentimentEventData } from "../loaders.ts";

/**
 * Data shape for frustration summary
 */
export interface FrustrationSummaryData {
	/** Total messages analyzed for sentiment */
	totalAnalyzed: number;
	/** Count of moderate frustration events */
	moderateCount: number;
	/** Count of high frustration events */
	highCount: number;
	/** Overall frustration level based on aggregated data */
	overallLevel: "none" | "low" | "moderate" | "high";
	/** Average frustration score (0-10) across all analyzed messages */
	averageScore: number;
	/** Peak frustration score in the session */
	peakScore: number;
	/** Most common frustration signals */
	topSignals: string[];
}

/**
 * Calculate frustration summary from sentiment events
 */
export function calculateFrustrationSummary(
	sentimentByMessageId: Map<string, SentimentEventData>,
): FrustrationSummaryData {
	const events = Array.from(sentimentByMessageId.values());

	if (events.length === 0) {
		return {
			totalAnalyzed: 0,
			moderateCount: 0,
			highCount: 0,
			overallLevel: "none",
			averageScore: 0,
			peakScore: 0,
			topSignals: [],
		};
	}

	let totalScore = 0;
	let peakScore = 0;
	let moderateCount = 0;
	let highCount = 0;
	const signalCounts = new Map<string, number>();

	for (const event of events) {
		const score = event.frustrationScore ?? 0;
		totalScore += score;
		if (score > peakScore) {
			peakScore = score;
		}

		if (event.frustrationLevel === "moderate") {
			moderateCount++;
		} else if (event.frustrationLevel === "high") {
			highCount++;
		}

		// Count signals
		for (const signal of event.signals) {
			signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
		}
	}

	const averageScore = totalScore / events.length;

	// Determine overall level based on counts and average
	let overallLevel: "none" | "low" | "moderate" | "high" = "none";
	if (highCount >= 2 || (highCount >= 1 && moderateCount >= 2)) {
		overallLevel = "high";
	} else if (moderateCount >= 2 || highCount >= 1 || averageScore >= 5) {
		overallLevel = "moderate";
	} else if (moderateCount >= 1 || averageScore >= 2) {
		overallLevel = "low";
	}

	// Get top 5 signals by frequency
	const topSignals = Array.from(signalCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([signal]) => signal);

	return {
		totalAnalyzed: events.length,
		moderateCount,
		highCount,
		overallLevel,
		averageScore,
		peakScore,
		topSignals,
	};
}

/**
 * GraphQL object type for frustration summary
 */
export const FrustrationSummaryType = builder.objectType(
	builder.objectRef<FrustrationSummaryData>("FrustrationSummary"),
	{
		description: "Aggregated frustration metrics for a session",
		fields: (t) => ({
			totalAnalyzed: t.exposeInt("totalAnalyzed", {
				description: "Total messages analyzed for sentiment",
			}),
			moderateCount: t.exposeInt("moderateCount", {
				description: "Count of moderate frustration events",
			}),
			highCount: t.exposeInt("highCount", {
				description: "Count of high frustration events",
			}),
			overallLevel: t.exposeString("overallLevel", {
				description: "Overall frustration level: none, low, moderate, or high",
			}),
			averageScore: t.exposeFloat("averageScore", {
				description: "Average frustration score (0-10)",
			}),
			peakScore: t.exposeFloat("peakScore", {
				description: "Peak frustration score in the session",
			}),
			topSignals: t.exposeStringList("topSignals", {
				description: "Most common frustration signals",
			}),
		}),
	},
);
