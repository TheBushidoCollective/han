/**
 * Database-backed metrics storage using SQLite via han-native
 *
 * This replaces JsonlMetricsStorage with database-backed persistence.
 * All operations go through the unified db module which handles
 * coordinator lazy-start and SQLite access.
 *
 * Migration path:
 * 1. DbMetricsStorage implements the same interface as JsonlMetricsStorage
 * 2. MCP server switches to use DbMetricsStorage
 * 3. Old JSONL data can be migrated via one-time script
 */

import * as db from "../db/index.ts";
import type {
	CompleteTaskParams,
	FailTaskParams,
	MetricsQuery,
	MetricsResult,
	RecordFrustrationParams,
	StartTaskParams,
	Task,
	TaskOutcome,
	UpdateTaskParams,
} from "./types.ts";

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `task-${timestamp}-${random}`;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `session-${timestamp}-${random}`;
}

/**
 * Convert native Task to metrics Task type
 */
function _nativeTaskToMetricsTask(nativeTask: db.Task): Task {
	return {
		id: nativeTask.taskId,
		session_id: nativeTask.sessionId ?? undefined,
		description: nativeTask.description,
		type: nativeTask.taskType as Task["type"],
		started_at: nativeTask.startedAt ?? new Date().toISOString(),
		completed_at: nativeTask.completedAt ?? undefined,
		status: nativeTask.completedAt
			? nativeTask.outcome === "failure"
				? "failed"
				: "completed"
			: "active",
		outcome: nativeTask.outcome as TaskOutcome | undefined,
		confidence: nativeTask.confidence ?? undefined,
		notes: nativeTask.notes ?? undefined,
		files_modified: nativeTask.filesModified
			? JSON.stringify(nativeTask.filesModified)
			: undefined,
		tests_added: nativeTask.testsAdded ?? undefined,
	};
}

/**
 * Database-backed metrics storage
 *
 * Provides the same interface as JsonlMetricsStorage but uses SQLite
 * for persistence through the coordinator pattern.
 */
export class DbMetricsStorage {
	private currentSessionId: string | null = null;
	private taskStartTimes: Map<string, string> = new Map();

	/**
	 * Start a new session or resume existing one
	 */
	async startSession(
		sessionId?: string,
	): Promise<{ session_id: string; resumed: boolean }> {
		const id = sessionId || generateSessionId();

		// Check if session exists
		const existing = await db.sessions.get(id);

		if (existing) {
			// Resume existing session
			this.currentSessionId = id;
			return { session_id: id, resumed: true };
		}

		// Create new session
		await db.sessions.upsert({
			id,
			status: "active",
		});

		this.currentSessionId = id;
		return { session_id: id, resumed: false };
	}

	/**
	 * End a session
	 */
	async endSession(sessionId: string): Promise<{ success: boolean }> {
		await db.sessions.end(sessionId);

		if (this.currentSessionId === sessionId) {
			this.currentSessionId = null;
		}

		return { success: true };
	}

	/**
	 * Get current active session
	 */
	async getCurrentSession(): Promise<{ session_id: string } | null> {
		if (this.currentSessionId) {
			return { session_id: this.currentSessionId };
		}

		// Look for most recent active session
		const sessions = await db.sessions.list({ status: "active", limit: 1 });
		if (sessions.length > 0) {
			this.currentSessionId = sessions[0].id;
			return { session_id: sessions[0].id };
		}

		return null;
	}

	/**
	 * Start a new task
	 */
	async startTask(params: StartTaskParams): Promise<{ task_id: string }> {
		const taskId = generateTaskId();
		const timestamp = new Date().toISOString();

		this.taskStartTimes.set(taskId, timestamp);

		// Use explicit session_id if provided, otherwise fall back to current session
		const sessionId =
			params.session_id || (await this.getCurrentSession())?.session_id;

		await db.tasks.create({
			taskId: taskId,
			sessionId: sessionId ?? undefined,
			description: params.description,
			taskType: params.type,
			estimatedComplexity: params.estimated_complexity,
		});

		return { task_id: taskId };
	}

	/**
	 * Update a task
	 * Note: The DB schema doesn't have a separate updates table,
	 * so we store updates as notes on the task
	 */
	async updateTask(params: UpdateTaskParams): Promise<{ success: boolean }> {
		// For now, updates are logged but not persisted separately
		// The native module doesn't have an updateTask function
		// This is a simplified implementation
		console.debug(
			`Task update: ${params.task_id} - ${params.status ?? ""} ${params.notes ?? ""}`,
		);
		return { success: true };
	}

	/**
	 * Complete a task
	 */
	async completeTask(
		params: CompleteTaskParams,
	): Promise<{ success: boolean }> {
		await db.tasks.complete({
			taskId: params.task_id,
			outcome: params.outcome,
			confidence: params.confidence,
			notes: params.notes ?? undefined,
			filesModified: params.files_modified ?? undefined,
			testsAdded: params.tests_added ?? undefined,
		});

		this.taskStartTimes.delete(params.task_id);
		return { success: true };
	}

	/**
	 * Fail a task
	 */
	async failTask(params: FailTaskParams): Promise<{ success: boolean }> {
		await db.tasks.fail({
			taskId: params.task_id,
			reason: params.reason,
			confidence: params.confidence ?? undefined,
			attemptedSolutions: params.attempted_solutions ?? undefined,
			notes: params.notes ?? undefined,
		});

		this.taskStartTimes.delete(params.task_id);
		return { success: true };
	}

	/**
	 * Record a hook execution
	 */
	async recordHookExecution(params: {
		sessionId?: string;
		taskId?: string;
		hookType: string;
		hookName: string;
		hookSource?: string;
		durationMs: number;
		exitCode: number;
		passed: boolean;
		output?: string;
		error?: string;
	}): Promise<{ success: boolean }> {
		await db.hookExecutions.record({
			sessionId: params.sessionId ?? undefined,
			taskId: params.taskId ?? undefined,
			hookType: params.hookType,
			hookName: params.hookName,
			hookSource: params.hookSource ?? undefined,
			durationMs: params.durationMs,
			exitCode: params.exitCode,
			passed: params.passed,
			output: params.output ?? undefined,
			error: params.error ?? undefined,
		});
		return { success: true };
	}

	/**
	 * Record a frustration event
	 */
	async recordFrustration(
		params: RecordFrustrationParams,
	): Promise<{ success: boolean }> {
		// Get current session if available
		const currentSession = await this.getCurrentSession();

		await db.frustrations.record({
			sessionId: currentSession?.session_id ?? undefined,
			taskId: params.task_id ?? undefined,
			frustrationLevel: params.frustration_level,
			frustrationScore: params.frustration_score,
			userMessage: params.user_message,
			detectedSignals: params.detected_signals ?? undefined,
			context: params.context ?? undefined,
		});
		return { success: true };
	}

	/**
	 * Query metrics
	 */
	async queryMetrics(params: MetricsQuery): Promise<MetricsResult> {
		const metrics = await db.tasks.queryMetrics({
			taskType: params.task_type,
			outcome: params.outcome,
			period: params.period,
		});

		// The native module returns TaskMetrics which we need to map
		// For now, return a compatible structure
		// TODO: Enhance native queryTaskMetrics to return full task list

		// Parse JSON strings from native module
		const byType = metrics.byType ? JSON.parse(metrics.byType) : {};
		const byOutcome = metrics.byOutcome ? JSON.parse(metrics.byOutcome) : {};

		return {
			total_tasks: metrics.totalTasks,
			completed_tasks: metrics.completedTasks,
			success_rate: metrics.successRate,
			average_confidence: metrics.averageConfidence ?? 0,
			average_duration_seconds: metrics.averageDurationSeconds ?? 0,
			by_type: byType,
			by_outcome: byOutcome,
			calibration_score: metrics.calibrationScore ?? 0,
			tasks: [], // TODO: Return actual tasks from DB
			frustration_events: [],
			total_frustrations: 0,
			frustration_rate: 0,
			significant_frustrations: 0,
			significant_frustration_rate: 0,
			weighted_frustration_score: 0,
			frustration_by_level: { low: 0, moderate: 0, high: 0 },
		};
	}

	/**
	 * Get hook failure statistics
	 * Note: Not yet implemented in DB - returns empty array
	 */
	async getHookFailureStats(
		_period: "day" | "week" | "month" = "week",
	): Promise<
		Array<{
			name: string;
			source: string;
			total: number;
			failures: number;
			failureRate: number;
		}>
	> {
		// TODO: Implement when hook_executions table is added
		return [];
	}

	/**
	 * Get overall hook statistics
	 */
	async getAllHookStats(period: "day" | "week" | "month" = "week"): Promise<{
		totalExecutions: number;
		totalPassed: number;
		totalFailed: number;
		passRate: number;
		uniqueHooks: number;
		byHookType: Record<string, { total: number; passed: number }>;
	}> {
		const stats = await db.hookExecutions.queryStats(period);

		// Parse JSON string for byHookType
		const byHookType = stats.byHookType ? JSON.parse(stats.byHookType) : {};

		return {
			totalExecutions: stats.totalExecutions,
			totalPassed: stats.totalPassed,
			totalFailed: stats.totalFailed,
			passRate: stats.passRate,
			uniqueHooks: stats.uniqueHooks,
			byHookType,
		};
	}

	/**
	 * Query session metrics
	 * Note: Partially implemented - returns session list without full metrics
	 */
	async querySessionMetrics(
		_period: "day" | "week" | "month" = "week",
		limit = 10,
	): Promise<{
		sessions: Array<{
			session_id: string;
			started_at: string;
			ended_at: string | null;
			duration_minutes: number | null;
			task_count: number;
			success_count: number;
			hooks_passed_count: number;
			hooks_failed_count: number;
			average_calibration: number | null;
		}>;
		trends: {
			calibration_trend: "improving" | "declining" | "stable";
			success_rate_trend: "improving" | "declining" | "stable";
		};
	}> {
		const sessions = await db.sessions.list({ limit });

		return {
			sessions: sessions.map((s) => ({
				session_id: s.id,
				started_at: s.id, // TODO: Get from messages
				ended_at: s.status === "completed" ? s.id : null,
				duration_minutes: null,
				task_count: 0,
				success_count: 0,
				hooks_passed_count: 0,
				hooks_failed_count: 0,
				average_calibration: null,
			})),
			trends: {
				calibration_trend: "stable",
				success_rate_trend: "stable",
			},
		};
	}

	/**
	 * Get all tasks for a specific session
	 */
	async getTasksForSession(_sessionId: string): Promise<Task[]> {
		// TODO: Add session filter to native queryTaskMetrics or add listTasks
		// For now, query all and filter
		const _metrics = await db.tasks.queryMetrics({});

		// The native module doesn't return task list in queryMetrics
		// We need to enhance the native module or add a listTasks function
		// For now, return empty array
		return [];
	}

	/**
	 * Get active (in-progress) tasks for a specific session
	 */
	async getActiveTasksForSession(sessionId: string): Promise<Task[]> {
		const tasks = await this.getTasksForSession(sessionId);
		return tasks.filter((task) => task.status === "active");
	}

	/**
	 * Close storage (no-op for DB, but maintains interface compatibility)
	 */
	close(): void {
		// DB connection is managed by the native module
	}
}
