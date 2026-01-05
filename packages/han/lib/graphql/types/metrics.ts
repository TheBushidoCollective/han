/**
 * GraphQL Metrics types
 *
 * Represents task metrics and performance data from the database.
 */

import { type Task as DbTask, getDbPath, tasks } from "../../db/index.ts";
import { tryGetNativeModule } from "../../native.ts";
import { builder } from "../builder.ts";

/**
 * Metrics period enum
 */
export const MetricsPeriodEnum = builder.enumType("MetricsPeriod", {
	values: ["DAY", "WEEK", "MONTH"] as const,
	description: "Time period for metrics queries",
});

/**
 * Task type enum
 */
export const TaskTypeEnum = builder.enumType("TaskType", {
	values: ["IMPLEMENTATION", "FIX", "REFACTOR", "RESEARCH"] as const,
	description: "Type of task",
});

/**
 * Task status enum
 */
export const TaskStatusEnum = builder.enumType("TaskStatus", {
	values: ["ACTIVE", "COMPLETED", "FAILED"] as const,
	description: "Status of a task",
});

/**
 * Task outcome enum
 */
export const TaskOutcomeEnum = builder.enumType("TaskOutcome", {
	values: ["SUCCESS", "PARTIAL", "FAILURE"] as const,
	description: "Outcome of a completed task",
});

/**
 * Task type count ref
 */
interface TaskTypeCount {
	type: "IMPLEMENTATION" | "FIX" | "REFACTOR" | "RESEARCH";
	count: number;
}
const TaskTypeCountRef = builder.objectRef<TaskTypeCount>("TaskTypeCount");

/**
 * Task type count implementation
 */
export const TaskTypeCountType = TaskTypeCountRef.implement({
	description: "Task count by type",
	fields: (t) => ({
		type: t.field({
			type: TaskTypeEnum,
			resolve: (obj) => obj.type,
		}),
		count: t.exposeInt("count"),
	}),
});

/**
 * Task outcome count ref
 */
interface TaskOutcomeCount {
	outcome: "SUCCESS" | "PARTIAL" | "FAILURE";
	count: number;
}
const TaskOutcomeCountRef =
	builder.objectRef<TaskOutcomeCount>("TaskOutcomeCount");

/**
 * Task outcome count implementation
 */
export const TaskOutcomeCountType = TaskOutcomeCountRef.implement({
	description: "Task count by outcome",
	fields: (t) => ({
		outcome: t.field({
			type: TaskOutcomeEnum,
			resolve: (obj) => obj.outcome,
		}),
		count: t.exposeInt("count"),
	}),
});

/**
 * Task ref - using database Task type
 */
const TaskRef = builder.objectRef<DbTask>("Task");

/**
 * Determine task status from outcome
 */
function getTaskStatus(task: DbTask): "ACTIVE" | "COMPLETED" | "FAILED" {
	if (!task.outcome) return "ACTIVE";
	if (task.outcome === "failure") return "FAILED";
	return "COMPLETED";
}

/**
 * Task type implementation
 */
export const TaskType = TaskRef.implement({
	description: "A tracked task",
	fields: (t) => ({
		id: t.id({
			description: "Task ID",
			resolve: (task) => task.taskId,
		}),
		taskId: t.exposeString("taskId", { description: "Task ID" }),
		description: t.exposeString("description", {
			description: "Task description",
		}),
		type: t.field({
			type: TaskTypeEnum,
			description: "Type of task",
			resolve: (task) =>
				task.taskType.toUpperCase() as
					| "IMPLEMENTATION"
					| "FIX"
					| "REFACTOR"
					| "RESEARCH",
		}),
		status: t.field({
			type: TaskStatusEnum,
			description: "Current status",
			resolve: (task) => getTaskStatus(task),
		}),
		outcome: t.field({
			type: TaskOutcomeEnum,
			nullable: true,
			description: "Outcome if completed",
			resolve: (task) => {
				if (!task.outcome) return null;
				return task.outcome.toUpperCase() as "SUCCESS" | "PARTIAL" | "FAILURE";
			},
		}),
		confidence: t.float({
			nullable: true,
			description: "Confidence score (0-1)",
			resolve: (task) => task.confidence ?? null,
		}),
		startedAt: t.field({
			type: "DateTime",
			description: "When the task started",
			resolve: (task) => task.startedAt ?? new Date().toISOString(),
		}),
		completedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "When the task completed",
			resolve: (task) => task.completedAt ?? null,
		}),
		durationSeconds: t.int({
			nullable: true,
			description: "Duration in seconds",
			resolve: (task) => {
				if (!task.startedAt || !task.completedAt) return null;
				const start = new Date(task.startedAt).getTime();
				const end = new Date(task.completedAt).getTime();
				return Math.floor((end - start) / 1000);
			},
		}),
		filesModified: t.stringList({
			nullable: true,
			description: "List of modified files",
			resolve: (task) => task.filesModified ?? null,
		}),
		testsAdded: t.int({
			nullable: true,
			description: "Number of tests added",
			resolve: (task) => task.testsAdded ?? null,
		}),
		notes: t.string({
			nullable: true,
			description: "Additional notes",
			resolve: (task) => task.notes ?? null,
		}),
	}),
});

/**
 * Metrics result for GraphQL - maps from database TaskMetrics
 */
interface MetricsResult {
	totalTasks: number;
	completedTasks: number;
	successRate: number;
	averageConfidence: number;
	averageDurationSeconds: number | null;
	calibrationScore: number | null;
	byType: Record<string, number>;
	byOutcome: Record<string, number>;
	significantFrustrations: number;
	significantFrustrationRate: number;
}

/**
 * Metrics data ref
 */
const MetricsDataRef = builder.objectRef<MetricsResult>("MetricsData");

/**
 * Metrics data type implementation
 */
export const MetricsDataType = MetricsDataRef.implement({
	description: "Aggregate metrics for a time period",
	fields: (t) => ({
		totalTasks: t.int({
			description: "Total number of tasks",
			resolve: (data) => data.totalTasks,
		}),
		completedTasks: t.int({
			description: "Number of completed tasks",
			resolve: (data) => data.completedTasks,
		}),
		successRate: t.float({
			description: "Success rate (0-1)",
			resolve: (data) => data.successRate,
		}),
		averageConfidence: t.float({
			description: "Average confidence score (0-1)",
			resolve: (data) => data.averageConfidence,
		}),
		averageDuration: t.float({
			nullable: true,
			description: "Average duration in seconds",
			resolve: (data) => data.averageDurationSeconds,
		}),
		calibrationScore: t.float({
			nullable: true,
			description: "Calibration score (how well confidence matches outcomes)",
			resolve: (data) => data.calibrationScore,
		}),
		tasksByType: t.field({
			type: [TaskTypeCountType],
			description: "Task breakdown by type",
			resolve: (data): TaskTypeCount[] => {
				return Object.entries(data.byType).map(([type, count]) => ({
					type: type.toUpperCase() as
						| "IMPLEMENTATION"
						| "FIX"
						| "REFACTOR"
						| "RESEARCH",
					count: count as number,
				}));
			},
		}),
		tasksByOutcome: t.field({
			type: [TaskOutcomeCountType],
			description: "Task breakdown by outcome",
			resolve: (data): TaskOutcomeCount[] => {
				return Object.entries(data.byOutcome).map(([outcome, count]) => ({
					outcome: outcome.toUpperCase() as "SUCCESS" | "PARTIAL" | "FAILURE",
					count: count as number,
				}));
			},
		}),
		// Note: recentTasks field removed - need native list function to support this
		significantFrustrations: t.int({
			description: "Count of moderate/high frustration events",
			resolve: (data) => data.significantFrustrations,
		}),
		significantFrustrationRate: t.float({
			description: "Significant frustrations per task",
			resolve: (data) => data.significantFrustrationRate,
		}),
	}),
});

/**
 * Helper to query metrics from database
 * Combines task metrics with native database frustration metrics
 */
export async function queryMetrics(
	period?: "DAY" | "WEEK" | "MONTH",
): Promise<MetricsResult> {
	const periodMap = {
		DAY: "day" as const,
		WEEK: "week" as const,
		MONTH: "month" as const,
	};

	// Query task metrics from database
	const dbMetrics = await tasks.queryMetrics({
		period: period ? periodMap[period] : undefined,
	});

	// Parse byType and byOutcome from JSON strings
	let byType: Record<string, number> = {};
	let byOutcome: Record<string, number> = {};

	try {
		if (dbMetrics.byType) {
			byType = JSON.parse(dbMetrics.byType);
		}
	} catch {
		// Ignore parse errors
	}

	try {
		if (dbMetrics.byOutcome) {
			byOutcome = JSON.parse(dbMetrics.byOutcome);
		}
	} catch {
		// Ignore parse errors
	}

	// Base result from task metrics
	const result: MetricsResult = {
		totalTasks: dbMetrics.totalTasks,
		completedTasks: dbMetrics.completedTasks,
		successRate: dbMetrics.successRate,
		averageConfidence: dbMetrics.averageConfidence ?? 0,
		averageDurationSeconds: dbMetrics.averageDurationSeconds ?? null,
		calibrationScore: dbMetrics.calibrationScore ?? null,
		byType,
		byOutcome,
		significantFrustrations: 0,
		significantFrustrationRate: 0,
	};

	// Try to get frustration metrics from native database
	const native = tryGetNativeModule();
	if (native) {
		try {
			const dbPath = getDbPath();
			const nativePeriodMap = {
				DAY: "day" as const,
				WEEK: "week" as const,
				MONTH: "month" as const,
			};
			const frustrationMetrics = native.queryFrustrationMetrics(
				dbPath,
				period ? nativePeriodMap[period] : undefined,
				dbMetrics.totalTasks,
			);
			result.significantFrustrations =
				frustrationMetrics.significantFrustrations;
			result.significantFrustrationRate =
				frustrationMetrics.significantFrustrationRate;
		} catch {
			// Fall back to zero if native fails
		}
	}

	return result;
}

/**
 * Get tasks for a session - stub for now (native list function needed)
 * TODO: Add listTasksForSession to han-native
 */
export function getTasksForSession(_sessionId: string): DbTask[] {
	// No native function to list tasks yet
	return [];
}

/**
 * Get active tasks for a session - stub for now
 * TODO: Add listActiveTasksForSession to han-native
 */
export function getActiveTasksForSession(_sessionId: string): DbTask[] {
	// No native function to list tasks yet
	return [];
}
