/**
 * GraphQL Metrics types
 *
 * Represents task metrics and performance data from the metrics system.
 */

import { JsonlMetricsStorage } from "../../../../metrics/jsonl-storage.ts";
import type {
	MetricsResult,
	Task as TaskData,
} from "../../../../metrics/types.ts";
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
 * Task ref
 */
const TaskRef = builder.objectRef<TaskData>("Task");

/**
 * Task type implementation
 */
export const TaskType = TaskRef.implement({
	description: "A tracked task",
	fields: (t) => ({
		id: t.id({
			description: "Task ID",
			resolve: (task) => task.id,
		}),
		taskId: t.exposeString("id", { description: "Task ID" }),
		description: t.exposeString("description", {
			description: "Task description",
		}),
		type: t.field({
			type: TaskTypeEnum,
			description: "Type of task",
			resolve: (task) =>
				task.type.toUpperCase() as
					| "IMPLEMENTATION"
					| "FIX"
					| "REFACTOR"
					| "RESEARCH",
		}),
		status: t.field({
			type: TaskStatusEnum,
			description: "Current status",
			resolve: (task) =>
				task.status.toUpperCase() as "ACTIVE" | "COMPLETED" | "FAILED",
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
			resolve: (task) => task.started_at,
		}),
		completedAt: t.field({
			type: "DateTime",
			nullable: true,
			description: "When the task completed",
			resolve: (task) => task.completed_at ?? null,
		}),
		durationSeconds: t.int({
			nullable: true,
			description: "Duration in seconds",
			resolve: (task) => task.duration_seconds ?? null,
		}),
		filesModified: t.stringList({
			nullable: true,
			description: "List of modified files",
			resolve: (task) => {
				if (!task.files_modified) return null;
				try {
					return JSON.parse(task.files_modified);
				} catch {
					return [task.files_modified];
				}
			},
		}),
		testsAdded: t.int({
			nullable: true,
			description: "Number of tests added",
			resolve: (task) => task.tests_added ?? null,
		}),
		notes: t.string({
			nullable: true,
			description: "Additional notes",
			resolve: (task) => task.notes ?? null,
		}),
	}),
});

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
			resolve: (data) => data.total_tasks,
		}),
		completedTasks: t.int({
			description: "Number of completed tasks",
			resolve: (data) => data.completed_tasks,
		}),
		successRate: t.float({
			description: "Success rate (0-1)",
			resolve: (data) => data.success_rate,
		}),
		averageConfidence: t.float({
			description: "Average confidence score (0-1)",
			resolve: (data) => data.average_confidence,
		}),
		averageDuration: t.float({
			nullable: true,
			description: "Average duration in seconds",
			resolve: (data) => data.average_duration_seconds || null,
		}),
		calibrationScore: t.float({
			nullable: true,
			description: "Calibration score (how well confidence matches outcomes)",
			resolve: (data) => data.calibration_score || null,
		}),
		tasksByType: t.field({
			type: [TaskTypeCountType],
			description: "Task breakdown by type",
			resolve: (data): TaskTypeCount[] => {
				return Object.entries(data.by_type).map(([type, count]) => ({
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
				return Object.entries(data.by_outcome).map(([outcome, count]) => ({
					outcome: outcome.toUpperCase() as "SUCCESS" | "PARTIAL" | "FAILURE",
					count: count as number,
				}));
			},
		}),
		recentTasks: t.field({
			type: [TaskType],
			args: {
				first: t.arg.int({ defaultValue: 10 }),
			},
			description: "Most recent tasks",
			resolve: (data, args) => {
				return data.tasks.slice(0, args.first || 10);
			},
		}),
		significantFrustrations: t.int({
			description: "Count of moderate/high frustration events",
			resolve: (data) => data.significant_frustrations,
		}),
		significantFrustrationRate: t.float({
			description: "Significant frustrations per task",
			resolve: (data) => data.significant_frustration_rate,
		}),
	}),
});

/**
 * Helper to get metrics storage instance
 */
export function getMetricsStorage(): JsonlMetricsStorage {
	return new JsonlMetricsStorage();
}

/**
 * Helper to query metrics
 */
export function queryMetrics(period?: "DAY" | "WEEK" | "MONTH"): MetricsResult {
	const storage = getMetricsStorage();
	const periodMap = {
		DAY: "day" as const,
		WEEK: "week" as const,
		MONTH: "month" as const,
	};
	return storage.queryMetrics({
		period: period ? periodMap[period] : undefined,
	});
}
