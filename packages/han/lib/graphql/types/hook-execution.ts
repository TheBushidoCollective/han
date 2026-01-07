/**
 * GraphQL HookExecution type
 *
 * Represents a single hook execution record.
 */

import {
	getHookExecutionsForSession,
	getRecentHookExecutions,
	type HookExecution,
} from "../../api/hooks.ts";
import { builder } from "../builder.ts";

/**
 * Hook execution status enum
 */
export const HookExecutionStatusEnum = builder.enumType("HookExecutionStatus", {
	values: ["RUNNING", "PASSED", "FAILED", "KILLED"] as const,
	description: "Status of a hook execution",
});

/**
 * Derive status from hook execution data
 */
function getHookExecutionStatus(
	h: HookExecution,
): "RUNNING" | "PASSED" | "FAILED" | "KILLED" {
	// Kill signals: 137 = 128 + SIGKILL(9), 143 = 128 + SIGTERM(15)
	if (h.exitCode === 137 || h.exitCode === 143) {
		return "KILLED";
	}
	if (h.passed) {
		return "PASSED";
	}
	// If durationMs is 0, it might still be running (edge case)
	if (h.durationMs === 0 && h.exitCode === 0 && !h.output && !h.error) {
		return "RUNNING";
	}
	return "FAILED";
}

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
		status: t.field({
			type: HookExecutionStatusEnum,
			description: "Execution status (RUNNING, PASSED, FAILED, KILLED)",
			resolve: (h) => getHookExecutionStatus(h),
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
		directory: t.string({
			nullable: true,
			description: "Directory where the hook executed",
			resolve: (h) => (h.directory === "." ? "(root)" : h.directory),
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
		ifChanged: t.stringList({
			nullable: true,
			description:
				"Glob patterns that trigger this hook (for file validation tracking)",
			resolve: (h) => h.ifChanged,
		}),
		command: t.string({
			nullable: true,
			description: "The command that was executed",
			resolve: (h) => h.command,
		}),
	}),
});

/**
 * Query helpers for hook executions
 */
export async function queryHookExecutionsForSession(
	sessionId: string,
): Promise<HookExecution[]> {
	return getHookExecutionsForSession(sessionId);
}

export async function queryRecentHookExecutions(
	limit?: number,
): Promise<HookExecution[]> {
	return getRecentHookExecutions(limit);
}
