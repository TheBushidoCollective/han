/**
 * ContributorMetrics Type
 *
 * Anonymized metrics for top contributors.
 */

import { builder } from "../../builder.ts";

export interface ContributorMetrics {
	contributorId: string;
	displayName: string;
	sessionCount: number;
	taskCount: number;
	successRate: number;
}

const ContributorMetricsRef =
	builder.objectRef<ContributorMetrics>("ContributorMetrics");

export const ContributorMetricsType = ContributorMetricsRef.implement({
	description: "Anonymized metrics for a contributor",
	fields: (t) => ({
		contributorId: t.exposeString("contributorId", {
			description: "Anonymized contributor identifier",
		}),
		displayName: t.exposeString("displayName", {
			description: "Display name (e.g., 'Project A', 'Workstation 1')",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Total sessions by this contributor",
		}),
		taskCount: t.exposeInt("taskCount", {
			description: "Total tasks by this contributor",
		}),
		successRate: t.exposeFloat("successRate", {
			description: "Task success rate (0-1)",
		}),
	}),
});
