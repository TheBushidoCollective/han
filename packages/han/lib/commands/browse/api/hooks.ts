/**
 * Hooks API
 *
 * Reads hook execution data from Han metrics storage.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Hook execution record
 */
export interface HookExecution {
	id: string;
	sessionId: string | null;
	taskId: string | null;
	hookType: string;
	hookName: string;
	hookSource: string | null;
	durationMs: number;
	exitCode: number;
	passed: boolean;
	output: string | null;
	error: string | null;
	timestamp: string;
}

/**
 * Hook execution event from JSONL storage
 */
interface HookExecutionEvent {
	type: "hook_execution";
	timestamp: string;
	session_id?: string;
	task_id?: string;
	hook_type: string;
	hook_name: string;
	hook_source?: string;
	duration_ms: number;
	exit_code: number;
	passed: boolean;
	output?: string;
	error?: string;
}

/**
 * Get Claude config directory
 */
function getClaudeConfigDir(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return process.env.CLAUDE_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		throw new Error("Could not determine home directory");
	}
	return join(homeDir, ".claude");
}

/**
 * Get metrics directory path
 */
function getMetricsDir(): string {
	const configDir = getClaudeConfigDir();
	return join(configDir, "han", "metrics", "jsonldb");
}

/**
 * Get all JSONL files sorted by date (newest first)
 */
function getMetricFiles(): string[] {
	const metricsDir = getMetricsDir();

	if (!existsSync(metricsDir)) {
		return [];
	}

	try {
		const files = readdirSync(metricsDir)
			.filter((f) => f.endsWith(".jsonl"))
			.sort()
			.reverse(); // Newest first

		return files.map((f) => join(metricsDir, f));
	} catch {
		return [];
	}
}

/**
 * Parse a JSONL line safely
 */
function parseLine(line: string): HookExecutionEvent | null {
	if (!line.trim()) return null;

	try {
		const event = JSON.parse(line);
		if (event.type === "hook_execution") {
			return event as HookExecutionEvent;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Convert hook execution event to API format
 */
function toHookExecution(
	event: HookExecutionEvent,
	index: number,
): HookExecution {
	return {
		id: `hook-${event.timestamp}-${index}`,
		sessionId: event.session_id || null,
		taskId: event.task_id || null,
		hookType: event.hook_type,
		hookName: event.hook_name,
		hookSource: event.hook_source || null,
		durationMs: event.duration_ms,
		exitCode: event.exit_code,
		passed: event.passed,
		output: event.output || null,
		error: event.error || null,
		timestamp: event.timestamp,
	};
}

/**
 * Get hook executions for a specific session
 */
export function getHookExecutionsForSession(
	sessionId: string,
): HookExecution[] {
	const files = getMetricFiles();
	const executions: HookExecution[] = [];
	let index = 0;

	for (const file of files) {
		try {
			const content = readFileSync(file, "utf-8");
			const lines = content.split("\n");

			for (const line of lines) {
				const event = parseLine(line);
				if (event && event.session_id === sessionId) {
					executions.push(toHookExecution(event, index++));
				}
			}
		} catch {
			// Skip files we can't read
		}
	}

	// Sort by timestamp (oldest first for timeline)
	return executions.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
}

/**
 * Get all recent hook executions
 */
export function getRecentHookExecutions(limit = 50): HookExecution[] {
	const files = getMetricFiles();
	const executions: HookExecution[] = [];
	let index = 0;

	for (const file of files) {
		try {
			const content = readFileSync(file, "utf-8");
			const lines = content.split("\n");

			for (const line of lines) {
				const event = parseLine(line);
				if (event) {
					executions.push(toHookExecution(event, index++));
				}
			}
		} catch {
			// Skip files we can't read
		}

		// Stop if we have enough
		if (executions.length >= limit * 2) {
			break;
		}
	}

	// Sort by timestamp (newest first) and limit
	return executions
		.sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		)
		.slice(0, limit);
}

/**
 * Get hook execution statistics for a session
 */
export function getSessionHookStats(sessionId: string): {
	totalHooks: number;
	passedHooks: number;
	failedHooks: number;
	totalDurationMs: number;
	byHookType: Record<string, { total: number; passed: number }>;
} {
	const executions = getHookExecutionsForSession(sessionId);

	const byHookType: Record<string, { total: number; passed: number }> = {};
	let totalDurationMs = 0;
	let passedHooks = 0;
	let failedHooks = 0;

	for (const exec of executions) {
		if (exec.passed) {
			passedHooks++;
		} else {
			failedHooks++;
		}
		totalDurationMs += exec.durationMs;

		if (!byHookType[exec.hookType]) {
			byHookType[exec.hookType] = { total: 0, passed: 0 };
		}
		byHookType[exec.hookType].total++;
		if (exec.passed) {
			byHookType[exec.hookType].passed++;
		}
	}

	return {
		totalHooks: executions.length,
		passedHooks,
		failedHooks,
		totalDurationMs,
		byHookType,
	};
}
