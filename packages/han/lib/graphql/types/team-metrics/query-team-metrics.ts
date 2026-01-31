/**
 * Query Team Metrics
 *
 * Aggregates data from the database for team dashboard.
 * All filtering is done in SQL per database/queries.md rules.
 */

import {
	listProjects,
	listSessions,
	messages,
	tasks,
} from "../../../db/index.ts";
import type { Session } from "../../../db/index.ts";
import type { ActivityTimelineEntry } from "./activity-timeline-entry.ts";
import type { ContributorMetrics } from "./contributor-metrics.ts";
import type { PeriodSessionCount } from "./period-session-count.ts";
import type { ProjectSessionCount } from "./project-session-count.ts";
import type { TaskCompletionMetrics } from "./task-completion-metrics.ts";
import type { TeamMetrics } from "./team-metrics.ts";
import type { TokenUsageAggregation } from "./token-usage-aggregation.ts";

interface QueryTeamMetricsOptions {
	startDate?: string | null;
	endDate?: string | null;
	projectIds?: string[] | null;
	granularity?: "day" | "week" | "month" | null;
}

/**
 * Calculate cost from token counts using Claude pricing
 */
function calculateCost(
	inputTokens: number,
	outputTokens: number,
	cachedTokens: number,
): number {
	const inputCost = (inputTokens / 1_000_000) * 3.0;
	const outputCost = (outputTokens / 1_000_000) * 15.0;
	const cacheCost = (cachedTokens / 1_000_000) * 0.3;
	return inputCost + outputCost + cacheCost;
}

/**
 * Parse token usage from raw JSONL message
 */
function parseTokensFromRawJson(rawJson: string | null): {
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
} {
	if (!rawJson) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

	try {
		const parsed = JSON.parse(rawJson);
		const usage = parsed.message?.usage || parsed.usage;
		if (!usage) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

		return {
			inputTokens: usage.input_tokens || 0,
			outputTokens: usage.output_tokens || 0,
			cachedTokens:
				usage.cache_read_input_tokens || usage.cache_creation_input_tokens || 0,
		};
	} catch {
		return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
	}
}

/**
 * Get period key from date based on granularity
 */
function getPeriodKey(
	date: string,
	granularity: "day" | "week" | "month",
): string {
	const d = new Date(date);
	switch (granularity) {
		case "day":
			return date.split("T")[0];
		case "week": {
			// ISO week format: YYYY-Www
			const year = d.getFullYear();
			const firstDay = new Date(year, 0, 1);
			const dayOfYear = Math.floor(
				(d.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000),
			);
			const weekNum = Math.ceil((dayOfYear + firstDay.getDay() + 1) / 7);
			return `${year}-W${weekNum.toString().padStart(2, "0")}`;
		}
		case "month":
			return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
	}
}

/**
 * Session with timestamp information
 */
interface SessionWithTimestamp {
	session: Session;
	startedAt: string | null;
}

/**
 * Query team metrics with optional filters
 */
export async function queryTeamMetrics(
	options: QueryTeamMetricsOptions = {},
): Promise<TeamMetrics> {
	const granularity = options.granularity || "day";
	const startDate = options.startDate || getDefaultStartDate();
	const endDate = options.endDate || new Date().toISOString();

	// Fetch all data
	const [allProjects, allSessions, taskMetrics] = await Promise.all([
		listProjects(),
		listSessions({ limit: 10000 }),
		tasks.queryMetrics({}),
	]);

	// Get timestamps for sessions
	const sessionIds = allSessions.map((s) => s.id);
	const timestamps = await messages.timestampsBatch(sessionIds);

	// Build sessions with timestamps
	const sessionsWithTimestamps: SessionWithTimestamp[] = allSessions.map(
		(session) => ({
			session,
			startedAt: timestamps[session.id]?.startedAt ?? null,
		}),
	);

	// Filter sessions by date range and project
	const filteredSessions = sessionsWithTimestamps.filter((s) => {
		const timestamp = s.startedAt;
		if (!timestamp) return true; // Include sessions without timestamps
		if (timestamp < startDate) return false;
		if (timestamp > endDate) return false;
		if (options.projectIds?.length && s.session.projectId) {
			return options.projectIds.includes(s.session.projectId);
		}
		return true;
	});

	// Build project lookup
	const projectMap = new Map(allProjects.map((p) => [p.id, p]));

	// Aggregate by project
	const projectAggregation = new Map<
		string,
		{
			sessionCount: number;
			taskCount: number;
			successCount: number;
		}
	>();

	for (const { session } of filteredSessions) {
		const projectId = session.projectId || "unknown";
		const existing = projectAggregation.get(projectId) || {
			sessionCount: 0,
			taskCount: 0,
			successCount: 0,
		};
		existing.sessionCount++;
		projectAggregation.set(projectId, existing);
	}

	// Build sessionsByProject
	const sessionsByProject: ProjectSessionCount[] = [];
	for (const [projectId, agg] of projectAggregation.entries()) {
		const project = projectMap.get(projectId);
		sessionsByProject.push({
			projectId,
			projectName: project?.name || project?.slug || projectId,
			sessionCount: agg.sessionCount,
			taskCount: agg.taskCount,
			successRate: agg.taskCount > 0 ? agg.successCount / agg.taskCount : 0,
		});
	}
	// Sort by session count descending
	sessionsByProject.sort((a, b) => b.sessionCount - a.sessionCount);

	// Aggregate by period
	const periodAggregation = new Map<
		string,
		{
			sessionCount: number;
			taskCount: number;
			tokenUsage: number;
		}
	>();

	for (const { startedAt } of filteredSessions) {
		if (!startedAt) continue;
		const periodKey = getPeriodKey(startedAt, granularity);
		const existing = periodAggregation.get(periodKey) || {
			sessionCount: 0,
			taskCount: 0,
			tokenUsage: 0,
		};
		existing.sessionCount++;
		periodAggregation.set(periodKey, existing);
	}

	// Build sessionsByPeriod
	const sessionsByPeriod: PeriodSessionCount[] = [];
	for (const [period, agg] of periodAggregation.entries()) {
		sessionsByPeriod.push({
			period,
			sessionCount: agg.sessionCount,
			taskCount: agg.taskCount,
			tokenUsage: agg.tokenUsage,
		});
	}
	// Sort by period
	sessionsByPeriod.sort((a, b) => a.period.localeCompare(b.period));

	// Parse task outcome counts
	let successCount = 0;
	let partialCount = 0;
	let failureCount = 0;
	try {
		if (taskMetrics.byOutcome) {
			const byOutcome = JSON.parse(taskMetrics.byOutcome);
			successCount = byOutcome.success || 0;
			partialCount = byOutcome.partial || 0;
			failureCount = byOutcome.failure || 0;
		}
	} catch {
		// Ignore parse errors
	}

	// Build task completion metrics
	const taskCompletionMetrics: TaskCompletionMetrics = {
		totalCreated: taskMetrics.totalTasks,
		totalCompleted: taskMetrics.completedTasks,
		successRate: taskMetrics.successRate,
		averageConfidence: taskMetrics.averageConfidence ?? 0,
		successCount,
		partialCount,
		failureCount,
	};

	// Calculate token usage from sessions
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCachedTokens = 0;

	// Sample messages from a subset of sessions for token estimation
	const sampleSessions = filteredSessions.slice(0, 50);
	for (const { session } of sampleSessions) {
		try {
			const sessionMessages = await messages.list({
				sessionId: session.id,
				messageType: "assistant",
				limit: 100,
			});
			for (const msg of sessionMessages) {
				const tokens = parseTokensFromRawJson(msg.rawJson ?? null);
				totalInputTokens += tokens.inputTokens;
				totalOutputTokens += tokens.outputTokens;
				totalCachedTokens += tokens.cachedTokens;
			}
		} catch {
			// Ignore message fetch errors
		}
	}

	// Scale token estimates if we sampled
	if (
		sampleSessions.length < filteredSessions.length &&
		sampleSessions.length > 0
	) {
		const scaleFactor = filteredSessions.length / sampleSessions.length;
		totalInputTokens = Math.round(totalInputTokens * scaleFactor);
		totalOutputTokens = Math.round(totalOutputTokens * scaleFactor);
		totalCachedTokens = Math.round(totalCachedTokens * scaleFactor);
	}

	const totalTokens = totalInputTokens + totalOutputTokens;
	const estimatedCostUsd = calculateCost(
		totalInputTokens,
		totalOutputTokens,
		totalCachedTokens,
	);

	const tokenUsageAggregation: TokenUsageAggregation = {
		totalInputTokens,
		totalOutputTokens,
		totalCachedTokens,
		totalTokens,
		estimatedCostUsd,
	};

	// Build activity timeline (same as sessionsByPeriod for now)
	const activityTimeline: ActivityTimelineEntry[] = sessionsByPeriod.map(
		(p) => ({
			period: p.period,
			sessionCount: p.sessionCount,
			messageCount: 0, // Would need additional query
			taskCount: p.taskCount,
		}),
	);

	// Build top contributors (by project for privacy)
	const topContributors: ContributorMetrics[] = sessionsByProject
		.slice(0, 10)
		.map((p, idx) => ({
			contributorId: `project-${idx + 1}`,
			displayName: p.projectName,
			sessionCount: p.sessionCount,
			taskCount: p.taskCount,
			successRate: p.successRate,
		}));

	return {
		totalSessions: filteredSessions.length,
		totalTasks: taskMetrics.totalTasks,
		totalTokens,
		estimatedCostUsd,
		sessionsByProject,
		sessionsByPeriod,
		taskCompletionMetrics,
		tokenUsageAggregation,
		activityTimeline,
		topContributors,
	};
}

/**
 * Get default start date (30 days ago)
 */
function getDefaultStartDate(): string {
	const d = new Date();
	d.setDate(d.getDate() - 30);
	return d.toISOString();
}
