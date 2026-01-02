/**
 * GraphQL Hook types
 *
 * Represents hook execution data from Han metrics.
 */

import {
	getHookExecutionsForSession,
	getRecentHookExecutions,
	getSessionHookStats,
	type HookExecution,
} from "../../api/hooks.ts";
import { builder } from "../builder.ts";

/**
 * Hook execution type ref
 */
const HookExecutionRef = builder.objectRef<HookExecution>("HookExecution");

/**
 * Hook execution type implementation
 */
export const HookExecutionType = HookExecutionRef.implement({
	description: "A single hook execution record",
	fields: (t) => ({
		id: t.exposeString("id", {
			description: "Hook execution ID",
		}),
		sessionId: t.string({
			nullable: true,
			description: "Session ID this hook ran in",
			resolve: (h) => h.sessionId,
		}),
		taskId: t.string({
			nullable: true,
			description: "Task ID this hook ran for",
			resolve: (h) => h.taskId,
		}),
		hookType: t.exposeString("hookType", {
			description: "Type of hook (SessionStart, Stop, etc.)",
		}),
		hookName: t.exposeString("hookName", {
			description: "Name of the hook",
		}),
		hookSource: t.string({
			nullable: true,
			description: "Plugin source of the hook",
			resolve: (h) => h.hookSource,
		}),
		durationMs: t.exposeInt("durationMs", {
			description: "Duration in milliseconds",
		}),
		exitCode: t.exposeInt("exitCode", {
			description: "Exit code (0 = success)",
		}),
		passed: t.exposeBoolean("passed", {
			description: "Whether the hook passed",
		}),
		output: t.string({
			nullable: true,
			description: "Hook output (truncated if long)",
			resolve: (h) => {
				// Truncate long output for display
				if (h.output && h.output.length > 500) {
					return `${h.output.slice(0, 500)}...`;
				}
				return h.output;
			},
		}),
		error: t.string({
			nullable: true,
			description: "Error message if hook failed",
			resolve: (h) => h.error,
		}),
		timestamp: t.exposeString("timestamp", {
			description: "When the hook executed",
		}),
	}),
});

/**
 * Hook statistics type
 */
interface HookStatsData {
	totalHooks: number;
	passedHooks: number;
	failedHooks: number;
	totalDurationMs: number;
	byHookType: Record<string, { total: number; passed: number }>;
}

const HookStatsRef = builder.objectRef<HookStatsData>("HookStats");

/**
 * Hook type breakdown
 */
interface HookTypeStatData {
	hookType: string;
	total: number;
	passed: number;
}

const HookTypeStatRef = builder.objectRef<HookTypeStatData>("HookTypeStat");

const HookTypeStatType = HookTypeStatRef.implement({
	description: "Hook statistics by type",
	fields: (t) => ({
		hookType: t.exposeString("hookType", {
			description: "Hook type name",
		}),
		total: t.exposeInt("total", {
			description: "Total executions of this type",
		}),
		passed: t.exposeInt("passed", {
			description: "Passed executions",
		}),
	}),
});

export const HookStatsType = HookStatsRef.implement({
	description: "Hook execution statistics",
	fields: (t) => ({
		totalHooks: t.exposeInt("totalHooks", {
			description: "Total hook executions",
		}),
		passedHooks: t.exposeInt("passedHooks", {
			description: "Number of passed hooks",
		}),
		failedHooks: t.exposeInt("failedHooks", {
			description: "Number of failed hooks",
		}),
		totalDurationMs: t.exposeInt("totalDurationMs", {
			description: "Total duration of all hooks in ms",
		}),
		passRate: t.float({
			description: "Pass rate as a percentage",
			resolve: (s) =>
				s.totalHooks > 0
					? Math.round((s.passedHooks / s.totalHooks) * 1000) / 10
					: 100,
		}),
		byHookType: t.field({
			type: [HookTypeStatType],
			description: "Statistics broken down by hook type",
			resolve: (s) =>
				Object.entries(s.byHookType).map(([hookType, stats]) => ({
					hookType,
					...stats,
				})),
		}),
	}),
});

/**
 * Query helpers
 */
export function queryHookExecutionsForSession(
	sessionId: string,
): HookExecution[] {
	return getHookExecutionsForSession(sessionId);
}

export function queryRecentHookExecutions(limit?: number): HookExecution[] {
	return getRecentHookExecutions(limit);
}

export function querySessionHookStats(sessionId: string): HookStatsData {
	return getSessionHookStats(sessionId);
}
