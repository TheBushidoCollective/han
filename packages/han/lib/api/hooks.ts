/**
 * Hooks API
 *
 * Reads hook execution data from han_events in the database.
 * Han events are indexed by the Rust coordinator from JSONL files.
 *
 * IMPORTANT: This module queries the SQLite database - it does NOT read JSONL files directly.
 * The coordinator handles JSONL → SQLite indexing.
 */

import type { Message } from "../db/index.ts";
import { messages, withFreshData } from "../db/index.ts";

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
 * Hook event data from han_event rawJson
 * Supports both snake_case (from JSONL storage) and camelCase formats
 */
interface HookEventData {
	type: "hook_run" | "hook_result" | "hook_execution";
	id?: string;
	timestamp: string;
	// Top-level fields (from hook_execution events in JSONL)
	hook_type?: string;
	hook_name?: string;
	hook_source?: string;
	duration_ms?: number;
	exit_code?: number;
	passed?: boolean;
	output?: string;
	error?: string;
	session_id?: string;
	task_id?: string;
	// Nested data fields (from hook_run/hook_result events)
	data?: {
		plugin?: string;
		hook?: string;
		hookType?: string;
		hook_type?: string;
		hook_name?: string;
		hook_source?: string;
		directory?: string;
		success?: boolean;
		passed?: boolean;
		duration_ms?: number;
		durationMs?: number;
		exit_code?: number;
		exitCode?: number;
		output?: string;
		error?: string;
		session_id?: string;
		sessionId?: string;
		task_id?: string;
		taskId?: string;
	};
}

/**
 * Parse hook execution data from a Message with han_event type
 * Handles multiple event formats:
 * - hook_execution: From JSONL storage (snake_case fields at top level)
 * - hook_result: From event logger (nested data object)
 */
function parseHookExecutionFromMessage(msg: Message): HookExecution | null {
	// Try to parse the rawJson which contains the full event data
	if (!msg.rawJson) {
		return null;
	}

	try {
		const event = JSON.parse(msg.rawJson) as HookEventData;

		// Process hook_execution events (from JSONL storage via metrics)
		if (event.type === "hook_execution") {
			return {
				id: msg.id || event.id || `hook-${msg.timestamp}-${msg.lineNumber}`,
				sessionId: msg.sessionId || event.session_id || null,
				taskId: event.task_id || null,
				hookType: event.hook_type || "unknown",
				hookName: event.hook_name || "unknown",
				hookSource: event.hook_source || null,
				durationMs: event.duration_ms || 0,
				exitCode: event.exit_code ?? 0,
				passed: event.passed ?? true,
				output: event.output || null,
				error: event.error || null,
				timestamp: msg.timestamp || event.timestamp,
			};
		}

		// Process hook_result events (from event logger)
		if (event.type === "hook_result") {
			const data = event.data || {};

			return {
				id: msg.id || event.id || `hook-${msg.timestamp}-${msg.lineNumber}`,
				sessionId: msg.sessionId || data.session_id || data.sessionId || null,
				taskId: data.task_id || data.taskId || null,
				hookType:
					data.hookType || data.hook_type || event.hook_type || "unknown",
				hookName: data.hook || data.hook_name || data.plugin || "unknown",
				hookSource: data.hook_source || data.plugin || null,
				durationMs: data.duration_ms || data.durationMs || 0,
				exitCode: data.exit_code ?? data.exitCode ?? 0,
				passed: data.passed ?? data.success ?? true,
				output: data.output || null,
				error: data.error || null,
				timestamp: msg.timestamp || event.timestamp,
			};
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get hook executions for a specific session
 * Queries han_events from the database instead of reading JSONL files.
 */
export async function getHookExecutionsForSession(
	sessionId: string,
): Promise<HookExecution[]> {
	return withFreshData(async () => {
		// Query han_events for this session
		const hanEvents = await messages.list({
			sessionId,
			messageType: "han_event",
		});

		const executions: HookExecution[] = [];

		for (const msg of hanEvents) {
			const execution = parseHookExecutionFromMessage(msg);
			if (execution) {
				executions.push(execution);
			}
		}

		// Sort by timestamp (oldest first for timeline)
		return executions.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);
	});
}

/**
 * Get all recent hook executions across all sessions
 * Queries han_events from the database instead of reading JSONL files.
 */
export async function getRecentHookExecutions(
	limit = 50,
): Promise<HookExecution[]> {
	return withFreshData(async () => {
		// Search for hook-related events across all sessions
		// Note: We can't filter by message_type without a sessionId in the current API,
		// so we search for hook-related content and filter
		const searchResults = await messages.search({
			query: "hook_result",
			limit: limit * 3, // Get more to account for filtering
		});

		const executions: HookExecution[] = [];

		for (const msg of searchResults) {
			if (msg.messageType !== "han_event") {
				continue;
			}

			const execution = parseHookExecutionFromMessage(msg);
			if (execution) {
				executions.push(execution);
			}
		}

		// Sort by timestamp (newest first) and limit
		return executions
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
			)
			.slice(0, limit);
	});
}

/**
 * Get hook execution statistics for a session
 * Queries han_events from the database instead of reading JSONL files.
 */
export async function getSessionHookStats(sessionId: string): Promise<{
	totalHooks: number;
	passedHooks: number;
	failedHooks: number;
	totalDurationMs: number;
	byHookType: Record<string, { total: number; passed: number }>;
}> {
	const executions = await getHookExecutionsForSession(sessionId);

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
