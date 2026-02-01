/**
 * Org Learning Type
 *
 * Type for aggregated organization learnings and patterns.
 */

import { builder } from "../../builder.ts";
import { ConfidenceEnum } from "./confidence-enum.ts";

/**
 * Org learning data interface
 */
export interface OrgLearningData {
	pattern: string;
	frequency: number;
	domain: string;
	lastSeen: number;
	confidence: "high" | "medium" | "low";
}

/**
 * Org learning object reference
 */
const OrgLearningRef = builder.objectRef<OrgLearningData>("OrgLearning");

/**
 * Org learning type implementation
 */
export const OrgLearningType = OrgLearningRef.implement({
	description:
		"Aggregated learning/pattern detected across organization sessions",
	fields: (t) => ({
		pattern: t.exposeString("pattern", {
			description: "Pattern or convention observed",
		}),
		frequency: t.exposeInt("frequency", {
			description: "How many sessions exhibited this pattern",
		}),
		domain: t.exposeString("domain", {
			description: "Domain/category (e.g., api, testing, database)",
		}),
		lastSeen: t.field({
			type: "DateTime",
			description: "When this pattern was last observed",
			resolve: (l) => new Date(l.lastSeen),
		}),
		confidence: t.field({
			type: ConfidenceEnum,
			description: "Confidence level based on consistency",
			resolve: (l) => l.confidence.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
		}),
	}),
});

/**
 * Org learnings result data interface
 */
export interface OrgLearningsResultData {
	learnings: OrgLearningData[];
	sessionsAnalyzed: number;
	timeRange: {
		start: number;
		end: number;
	};
	cached: boolean;
}

/**
 * Org learnings time range object reference
 */
const OrgLearningsTimeRangeRef = builder.objectRef<{
	start: number;
	end: number;
}>("OrgLearningsTimeRange");

/**
 * Org learnings time range type implementation
 */
export const OrgLearningsTimeRangeType = OrgLearningsTimeRangeRef.implement({
	description: "Time range of analysis",
	fields: (t) => ({
		start: t.field({
			type: "DateTime",
			description: "Start of analysis period",
			resolve: (r) => new Date(r.start),
		}),
		end: t.field({
			type: "DateTime",
			description: "End of analysis period",
			resolve: (r) => new Date(r.end),
		}),
	}),
});

/**
 * Org learnings result object reference
 */
const OrgLearningsResultRef =
	builder.objectRef<OrgLearningsResultData>("OrgLearningsResult");

/**
 * Org learnings result type implementation
 */
export const OrgLearningsResultType = OrgLearningsResultRef.implement({
	description: "Result of org learnings query",
	fields: (t) => ({
		learnings: t.field({
			type: [OrgLearningType],
			description: "Aggregated learnings",
			resolve: (r) => r.learnings,
		}),
		sessionsAnalyzed: t.exposeInt("sessionsAnalyzed", {
			description: "Total sessions analyzed",
		}),
		timeRange: t.field({
			type: OrgLearningsTimeRangeType,
			description: "Time range of analysis",
			resolve: (r) => r.timeRange,
		}),
		cached: t.exposeBoolean("cached", {
			description: "Whether result was served from cache",
		}),
	}),
});
