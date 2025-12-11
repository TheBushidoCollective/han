import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
} from "node:fs";
import { join } from "node:path";
import { getClaudeConfigDir } from "../claude-settings.ts";
import type {
	CompleteTaskParams,
	FailTaskParams,
	FrustrationByLevel,
	FrustrationEvent,
	FrustrationLevel,
	MetricsQuery,
	MetricsResult,
	RecordFrustrationParams,
	StartTaskParams,
	Task,
	TaskOutcome,
	UpdateTaskParams,
} from "./types.ts";

/**
 * Event types stored in JSONL files
 */
type MetricEventType =
	| "session_start"
	| "session_end"
	| "session_resume"
	| "task_start"
	| "task_update"
	| "task_complete"
	| "task_fail"
	| "hook_execution"
	| "frustration";

interface BaseEvent {
	type: MetricEventType;
	timestamp: string;
}

interface SessionStartEvent extends BaseEvent {
	type: "session_start";
	session_id: string;
}

interface SessionEndEvent extends BaseEvent {
	type: "session_end";
	session_id: string;
	duration_minutes: number;
	task_count: number;
	success_count: number;
	failure_count: number;
}

interface SessionResumeEvent extends BaseEvent {
	type: "session_resume";
	session_id: string;
}

interface TaskStartEvent extends BaseEvent {
	type: "task_start";
	task_id: string;
	session_id?: string;
	description: string;
	task_type: string;
	complexity?: string;
}

interface TaskUpdateEvent extends BaseEvent {
	type: "task_update";
	task_id: string;
	status?: string;
	notes?: string;
}

interface TaskCompleteEvent extends BaseEvent {
	type: "task_complete";
	task_id: string;
	outcome: string;
	confidence: number;
	duration_seconds: number;
	files_modified?: string[];
	tests_added?: number;
	notes?: string;
}

interface TaskFailEvent extends BaseEvent {
	type: "task_fail";
	task_id: string;
	reason: string;
	confidence?: number;
	duration_seconds: number;
	attempted_solutions?: string[];
	notes?: string;
}

interface HookExecutionEvent extends BaseEvent {
	type: "hook_execution";
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

interface FrustrationEventData extends BaseEvent {
	type: "frustration";
	task_id?: string;
	frustration_level: FrustrationLevel;
	frustration_score: number;
	user_message: string;
	detected_signals: string[];
	context?: string;
}

type MetricEvent =
	| SessionStartEvent
	| SessionEndEvent
	| SessionResumeEvent
	| TaskStartEvent
	| TaskUpdateEvent
	| TaskCompleteEvent
	| TaskFailEvent
	| HookExecutionEvent
	| FrustrationEventData;

/**
 * Get han metrics directory path
 * Stored in CLAUDE_CONFIG_DIR/han/metrics/jsonldb (e.g., ~/.claude/han/metrics/jsonldb)
 */
function getMetricsDir(): string {
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		throw new Error(
			"Could not determine Claude config directory. Set CLAUDE_CONFIG_DIR or HOME environment variable.",
		);
	}
	return join(configDir, "han", "metrics", "jsonldb");
}

/**
 * Get UTC date string (YYYY-MM-DD) from a Date object
 */
function getUtcDateString(date: Date = new Date()): string {
	return date.toISOString().split("T")[0];
}

/**
 * Get the JSONL file path for a specific date (uses UTC date)
 */
function getMetricsFilePath(date: Date = new Date()): string {
	const dateStr = getUtcDateString(date);
	return join(getMetricsDir(), `metrics-${dateStr}.jsonl`);
}

/**
 * JSONL-based metrics storage with daily partitioning
 *
 * Storage: ~/.claude/han/metrics/jsonldb/metrics-YYYY-MM-DD.jsonl
 *
 * Design:
 * - Daily file partitioning (one file per UTC day)
 * - All dates/times stored and compared in UTC for consistency
 * - Lazy loading (only loads files needed for query period)
 * - No cleanup (files persist indefinitely)
 * - No index files (full scan within loaded files)
 * - Global metrics (not session-specific storage location)
 *
 * Benefits over SQLite:
 * - Fast startup (no connection overhead)
 * - Safe concurrent writes (atomic append under PIPE_BUF)
 * - Simple file format (easy to inspect, process, backup)
 * - No locking issues across processes
 */
export class JsonlMetricsStorage {
	private metricsDir: string;
	private currentSessionId: string | null = null;
	private taskStartTimes: Map<string, string> = new Map();

	constructor() {
		this.metricsDir = getMetricsDir();

		// Ensure directory exists
		if (!existsSync(this.metricsDir)) {
			mkdirSync(this.metricsDir, { recursive: true });
		}
	}

	/**
	 * Append an event to today's JSONL file
	 * Uses atomic append for concurrent safety
	 */
	private appendEvent(event: MetricEvent): void {
		const filePath = getMetricsFilePath();
		const line = `${JSON.stringify(event)}\n`;
		appendFileSync(filePath, line, { encoding: "utf-8" });
	}

	/**
	 * Process events from a JSONL file line by line
	 * Uses a callback to avoid loading all events into memory
	 */
	private forEachEventInFile(
		filePath: string,
		callback: (event: MetricEvent) => void,
	): void {
		if (!existsSync(filePath)) {
			return;
		}

		const content = readFileSync(filePath, "utf-8");
		let start = 0;
		let end = content.indexOf("\n");

		while (end !== -1) {
			const line = content.slice(start, end).trim();
			if (line) {
				try {
					callback(JSON.parse(line) as MetricEvent);
				} catch {
					// Skip malformed lines
				}
			}
			start = end + 1;
			end = content.indexOf("\n", start);
		}

		// Handle last line without trailing newline
		const lastLine = content.slice(start).trim();
		if (lastLine) {
			try {
				callback(JSON.parse(lastLine) as MetricEvent);
			} catch {
				// Skip malformed lines
			}
		}
	}

	/**
	 * Get list of JSONL files within a UTC date range
	 */
	private getFilesInRange(
		startDate: Date,
		endDate: Date = new Date(),
	): string[] {
		if (!existsSync(this.metricsDir)) {
			return [];
		}

		// Convert boundaries to UTC date strings for comparison
		const startDateStr = getUtcDateString(startDate);
		const endDateStr = getUtcDateString(endDate);

		const files = readdirSync(this.metricsDir)
			.filter((f) => f.startsWith("metrics-") && f.endsWith(".jsonl"))
			.map((f) => {
				const dateStr = f.replace("metrics-", "").replace(".jsonl", "");
				return { file: join(this.metricsDir, f), dateStr };
			})
			.filter((f) => f.dateStr >= startDateStr && f.dateStr <= endDateStr)
			.sort((a, b) => b.dateStr.localeCompare(a.dateStr)) // Most recent first
			.map((f) => f.file);

		return files;
	}

	/**
	 * Get start date for a time period
	 */
	private getStartDateForPeriod(period?: "day" | "week" | "month"): Date {
		const now = new Date();

		switch (period) {
			case "day":
				return new Date(now.getTime() - 24 * 60 * 60 * 1000);
			case "week":
				return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			case "month":
				return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			default:
				// Default to last 7 days if no period specified
				return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		}
	}

	/**
	 * Process events within a time period using a callback
	 * Memory-efficient: processes line by line without loading all events
	 */
	private forEachEventForPeriod(
		period: "day" | "week" | "month" | undefined,
		callback: (event: MetricEvent) => void,
	): void {
		const startDate = this.getStartDateForPeriod(period);
		const startTimestamp = startDate.toISOString();
		const files = this.getFilesInRange(startDate, new Date());

		for (const file of files) {
			this.forEachEventInFile(file, (event) => {
				if (event.timestamp >= startTimestamp) {
					callback(event);
				}
			});
		}
	}

	/**
	 * Read all events within a time period into an array
	 * Note: For aggregations, prefer forEachEventForPeriod to avoid memory overhead
	 */
	private readEventsForPeriod(
		period?: "day" | "week" | "month",
	): MetricEvent[] {
		const events: MetricEvent[] = [];
		this.forEachEventForPeriod(period, (event) => events.push(event));
		return events;
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(prefix: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		return `${prefix}-${timestamp}-${random}`;
	}

	/**
	 * Start a new session or resume existing one
	 */
	startSession(sessionId?: string): { session_id: string; resumed: boolean } {
		const timestamp = new Date().toISOString();

		if (sessionId) {
			// Check if session exists in recent events
			const events = this.readEventsForPeriod("week");
			const sessionExists = events.some(
				(e) =>
					(e.type === "session_start" || e.type === "session_resume") &&
					e.session_id === sessionId,
			);

			if (sessionExists) {
				// Resume existing session
				this.appendEvent({
					type: "session_resume",
					timestamp,
					session_id: sessionId,
				});
				this.currentSessionId = sessionId;
				return { session_id: sessionId, resumed: true };
			}
		}

		// Create new session
		const newSessionId = sessionId || this.generateId("session");
		this.appendEvent({
			type: "session_start",
			timestamp,
			session_id: newSessionId,
		});
		this.currentSessionId = newSessionId;
		return { session_id: newSessionId, resumed: false };
	}

	/**
	 * End a session
	 */
	endSession(sessionId: string): { success: boolean } {
		const events = this.readEventsForPeriod("day");

		// Find session start
		const sessionStart = events.find(
			(e) => e.type === "session_start" && e.session_id === sessionId,
		) as SessionStartEvent | undefined;

		if (!sessionStart) {
			// Session might be from a previous day, still record the end
		}

		// Count tasks for this session
		const taskStarts = events.filter(
			(e) =>
				e.type === "task_start" &&
				(e as TaskStartEvent).session_id === sessionId,
		) as TaskStartEvent[];

		const taskCompletes = events.filter(
			(e) => e.type === "task_complete",
		) as TaskCompleteEvent[];

		const taskFails = events.filter(
			(e) => e.type === "task_fail",
		) as TaskFailEvent[];

		const taskIds = new Set(taskStarts.map((t) => t.task_id));
		const successCount = taskCompletes.filter(
			(t) => taskIds.has(t.task_id) && t.outcome === "success",
		).length;
		const failureCount = taskFails.filter((t) => taskIds.has(t.task_id)).length;

		const duration_minutes = sessionStart
			? Math.floor(
					(Date.now() - new Date(sessionStart.timestamp).getTime()) /
						(1000 * 60),
				)
			: 0;

		this.appendEvent({
			type: "session_end",
			timestamp: new Date().toISOString(),
			session_id: sessionId,
			duration_minutes,
			task_count: taskStarts.length,
			success_count: successCount,
			failure_count: failureCount,
		});

		if (this.currentSessionId === sessionId) {
			this.currentSessionId = null;
		}

		return { success: true };
	}

	/**
	 * Get current active session
	 */
	getCurrentSession(): { session_id: string } | null {
		if (this.currentSessionId) {
			return { session_id: this.currentSessionId };
		}

		// Look for most recent active session in today's events
		const events = this.readEventsForPeriod("day");

		// Find sessions that started but haven't ended
		const sessionStarts = new Map<string, string>();
		const sessionEnds = new Set<string>();

		for (const event of events) {
			if (event.type === "session_start" || event.type === "session_resume") {
				sessionStarts.set(event.session_id, event.timestamp);
			} else if (event.type === "session_end") {
				sessionEnds.add(event.session_id);
			}
		}

		// Find most recent session that hasn't ended
		let mostRecentSession: string | null = null;
		let mostRecentTime = "";

		for (const [sessionId, timestamp] of sessionStarts) {
			if (!sessionEnds.has(sessionId) && timestamp > mostRecentTime) {
				mostRecentSession = sessionId;
				mostRecentTime = timestamp;
			}
		}

		return mostRecentSession ? { session_id: mostRecentSession } : null;
	}

	/**
	 * Start a new task
	 */
	startTask(params: StartTaskParams): { task_id: string } {
		const task_id = this.generateId("task");
		const timestamp = new Date().toISOString();

		this.taskStartTimes.set(task_id, timestamp);

		// Use explicit session_id if provided, otherwise fall back to current session lookup
		const session_id =
			params.session_id || this.getCurrentSession()?.session_id;

		this.appendEvent({
			type: "task_start",
			timestamp,
			task_id,
			session_id,
			description: params.description,
			task_type: params.type,
			complexity: params.estimated_complexity,
		});

		return { task_id };
	}

	/**
	 * Update a task
	 */
	updateTask(params: UpdateTaskParams): { success: boolean } {
		this.appendEvent({
			type: "task_update",
			timestamp: new Date().toISOString(),
			task_id: params.task_id,
			status: params.status,
			notes: params.notes,
		});

		return { success: true };
	}

	/**
	 * Complete a task
	 */
	completeTask(params: CompleteTaskParams): { success: boolean } {
		const now = new Date();
		const startTime = this.taskStartTimes.get(params.task_id);

		let duration_seconds = 0;
		if (startTime) {
			duration_seconds = Math.floor(
				(now.getTime() - new Date(startTime).getTime()) / 1000,
			);
			this.taskStartTimes.delete(params.task_id);
		} else {
			// Try to find start time from events
			const events = this.readEventsForPeriod("day");
			const startEvent = events.find(
				(e) =>
					e.type === "task_start" &&
					(e as TaskStartEvent).task_id === params.task_id,
			) as TaskStartEvent | undefined;

			if (startEvent) {
				duration_seconds = Math.floor(
					(now.getTime() - new Date(startEvent.timestamp).getTime()) / 1000,
				);
			}
		}

		this.appendEvent({
			type: "task_complete",
			timestamp: now.toISOString(),
			task_id: params.task_id,
			outcome: params.outcome,
			confidence: params.confidence,
			duration_seconds,
			files_modified: params.files_modified,
			tests_added: params.tests_added,
			notes: params.notes,
		});

		return { success: true };
	}

	/**
	 * Fail a task
	 */
	failTask(params: FailTaskParams): { success: boolean } {
		const now = new Date();
		const startTime = this.taskStartTimes.get(params.task_id);

		let duration_seconds = 0;
		if (startTime) {
			duration_seconds = Math.floor(
				(now.getTime() - new Date(startTime).getTime()) / 1000,
			);
			this.taskStartTimes.delete(params.task_id);
		} else {
			// Try to find start time from events
			const events = this.readEventsForPeriod("day");
			const startEvent = events.find(
				(e) =>
					e.type === "task_start" &&
					(e as TaskStartEvent).task_id === params.task_id,
			) as TaskStartEvent | undefined;

			if (startEvent) {
				duration_seconds = Math.floor(
					(now.getTime() - new Date(startEvent.timestamp).getTime()) / 1000,
				);
			}
		}

		this.appendEvent({
			type: "task_fail",
			timestamp: now.toISOString(),
			task_id: params.task_id,
			reason: params.reason,
			confidence: params.confidence,
			duration_seconds,
			attempted_solutions: params.attempted_solutions,
			notes: params.notes,
		});

		return { success: true };
	}

	/**
	 * Record a hook execution
	 */
	recordHookExecution(params: {
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
	}): { success: boolean } {
		this.appendEvent({
			type: "hook_execution",
			timestamp: new Date().toISOString(),
			session_id: params.sessionId,
			task_id: params.taskId,
			hook_type: params.hookType,
			hook_name: params.hookName,
			hook_source: params.hookSource,
			duration_ms: params.durationMs,
			exit_code: params.exitCode,
			passed: params.passed,
			output: params.output,
			error: params.error,
		});

		return { success: true };
	}

	/**
	 * Record a frustration event
	 */
	recordFrustration(params: RecordFrustrationParams): { success: boolean } {
		this.appendEvent({
			type: "frustration",
			timestamp: new Date().toISOString(),
			task_id: params.task_id,
			frustration_level: params.frustration_level,
			frustration_score: params.frustration_score,
			user_message: params.user_message,
			detected_signals: params.detected_signals,
			context: params.context,
		});

		return { success: true };
	}

	/**
	 * Query metrics using streaming aggregation
	 * Memory-efficient: builds maps incrementally without loading all events
	 */
	queryMetrics(params: MetricsQuery): MetricsResult {
		// Build task map and collect frustration events in a single pass
		const taskMap = new Map<string, Task>();
		const frustrationEvents: FrustrationEvent[] = [];
		let frustrationIndex = 0;

		this.forEachEventForPeriod(params.period, (event) => {
			if (event.type === "task_start") {
				const e = event as TaskStartEvent;
				taskMap.set(e.task_id, {
					id: e.task_id,
					session_id: e.session_id,
					description: e.description,
					type: e.task_type as Task["type"],
					complexity: e.complexity as Task["complexity"],
					started_at: e.timestamp,
					status: "active",
				});
			} else if (event.type === "task_complete") {
				const e = event as TaskCompleteEvent;
				const task = taskMap.get(e.task_id);
				if (task) {
					task.completed_at = e.timestamp;
					task.status = "completed";
					task.outcome = e.outcome as TaskOutcome;
					task.confidence = e.confidence;
					task.duration_seconds = e.duration_seconds;
					task.files_modified = e.files_modified
						? JSON.stringify(e.files_modified)
						: undefined;
					task.tests_added = e.tests_added;
					task.notes = e.notes;
				}
			} else if (event.type === "task_fail") {
				const e = event as TaskFailEvent;
				const task = taskMap.get(e.task_id);
				if (task) {
					task.completed_at = e.timestamp;
					task.status = "failed";
					task.outcome = "failure";
					task.confidence = e.confidence;
					task.duration_seconds = e.duration_seconds;
					task.failure_reason = e.reason;
					task.attempted_solutions = e.attempted_solutions
						? JSON.stringify(e.attempted_solutions)
						: undefined;
					task.notes = e.notes;
				}
			} else if (event.type === "frustration") {
				const fe = event as FrustrationEventData;
				frustrationIndex++;
				frustrationEvents.push({
					id: frustrationIndex,
					task_id: fe.task_id,
					timestamp: fe.timestamp,
					frustration_level: fe.frustration_level,
					frustration_score: fe.frustration_score,
					user_message: fe.user_message,
					detected_signals: JSON.stringify(fe.detected_signals),
					context: fe.context,
				});
			}
		});

		// Convert to array and apply filters
		let tasks = Array.from(taskMap.values());

		if (params.task_type) {
			tasks = tasks.filter((t) => t.type === params.task_type);
		}

		if (params.outcome) {
			tasks = tasks.filter((t) => t.outcome === params.outcome);
		}

		// Sort by started_at descending
		tasks.sort(
			(a, b) =>
				new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
		);

		// Calculate metrics using running totals
		const total_tasks = tasks.length;
		let completed_tasks = 0;
		let success_count = 0;
		let confidence_sum = 0;
		let confidence_count = 0;
		let duration_sum = 0;
		let duration_count = 0;
		const by_type: Record<string, number> = {};
		const by_outcome: Record<string, number> = {};

		for (const task of tasks) {
			// Count by type
			by_type[task.type] = (by_type[task.type] || 0) + 1;

			// Count by outcome
			if (task.outcome) {
				by_outcome[task.outcome] = (by_outcome[task.outcome] || 0) + 1;
			}

			// Completed tasks
			if (task.status === "completed") {
				completed_tasks++;
				if (task.outcome === "success") {
					success_count++;
				}
			}

			// Confidence aggregation
			if (task.confidence !== null && task.confidence !== undefined) {
				confidence_sum += task.confidence;
				confidence_count++;
			}

			// Duration aggregation
			if (
				task.duration_seconds !== null &&
				task.duration_seconds !== undefined
			) {
				duration_sum += task.duration_seconds;
				duration_count++;
			}
		}

		const success_rate =
			completed_tasks > 0 ? success_count / completed_tasks : 0;
		const average_confidence =
			confidence_count > 0 ? confidence_sum / confidence_count : 0;
		const average_duration_seconds =
			duration_count > 0 ? duration_sum / duration_count : 0;

		// Calculate calibration score
		const calibration_score = this.calculateCalibrationScore(tasks);

		// Calculate frustration metrics with weighting
		const total_frustrations = frustrationEvents.length;
		const frustration_rate =
			total_tasks > 0 ? total_frustrations / total_tasks : 0;

		// Calculate weighted frustration metrics (excludes "low" level)
		const frustration_by_level: FrustrationByLevel = {
			low: 0,
			moderate: 0,
			high: 0,
		};
		let weighted_frustration_score = 0;

		for (const event of frustrationEvents) {
			// Count by level
			if (event.frustration_level in frustration_by_level) {
				frustration_by_level[event.frustration_level]++;
			}

			// Only moderate and high contribute to weighted metrics
			if (
				event.frustration_level === "moderate" ||
				event.frustration_level === "high"
			) {
				weighted_frustration_score += event.frustration_score;
			}
		}

		const significant_frustrations =
			frustration_by_level.moderate + frustration_by_level.high;
		const significant_frustration_rate =
			total_tasks > 0 ? significant_frustrations / total_tasks : 0;

		return {
			total_tasks,
			completed_tasks,
			success_rate,
			average_confidence,
			average_duration_seconds,
			by_type,
			by_outcome,
			calibration_score,
			tasks,
			frustration_events: frustrationEvents,
			total_frustrations,
			frustration_rate,
			significant_frustrations,
			significant_frustration_rate,
			weighted_frustration_score,
			frustration_by_level,
		};
	}

	/**
	 * Calculate calibration score
	 */
	private calculateCalibrationScore(tasks: Task[]): number {
		let totalError = 0;
		let count = 0;

		for (const task of tasks) {
			if (
				task.outcome &&
				task.confidence !== null &&
				task.confidence !== undefined
			) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				totalError += Math.abs(task.confidence - actualSuccess);
				count++;
			}
		}

		if (count === 0) {
			return 0;
		}

		const averageError = totalError / count;
		return Math.max(0, 1 - averageError);
	}

	/**
	 * Get hook failure statistics using streaming aggregation
	 */
	getHookFailureStats(period: "day" | "week" | "month" = "week"): Array<{
		name: string;
		source: string;
		total: number;
		failures: number;
		failureRate: number;
	}> {
		// Group hook executions by name and source
		const hookStats = new Map<
			string,
			{ total: number; failures: number; source: string }
		>();

		this.forEachEventForPeriod(period, (event) => {
			if (event.type === "hook_execution") {
				const e = event as HookExecutionEvent;
				const key = `${e.hook_name}:${e.hook_source || "unknown"}`;

				const stats = hookStats.get(key) || {
					total: 0,
					failures: 0,
					source: e.hook_source || "unknown",
				};
				stats.total++;
				if (!e.passed) {
					stats.failures++;
				}
				hookStats.set(key, stats);
			}
		});

		// Convert to array and filter by failure rate > 20%
		return Array.from(hookStats.entries())
			.map(([key, stats]) => ({
				name: key.split(":")[0],
				source: stats.source,
				total: stats.total,
				failures: stats.failures,
				failureRate:
					Math.round(((100 * stats.failures) / stats.total) * 10) / 10,
			}))
			.filter((s) => s.failureRate > 20)
			.sort((a, b) => b.failureRate - a.failureRate)
			.slice(0, 5);
	}

	/**
	 * Get overall hook statistics (all hooks, not just failures)
	 */
	getAllHookStats(period: "day" | "week" | "month" = "week"): {
		totalExecutions: number;
		totalPassed: number;
		totalFailed: number;
		passRate: number;
		uniqueHooks: number;
		byHookType: Record<string, { total: number; passed: number }>;
	} {
		let totalExecutions = 0;
		let totalPassed = 0;
		let totalFailed = 0;
		const hookNames = new Set<string>();
		const byHookType: Record<string, { total: number; passed: number }> = {};

		this.forEachEventForPeriod(period, (event) => {
			if (event.type === "hook_execution") {
				const e = event as HookExecutionEvent;
				totalExecutions++;
				if (e.passed) {
					totalPassed++;
				} else {
					totalFailed++;
				}
				hookNames.add(e.hook_name);

				// Group by hook type
				const hookType = e.hook_type || "unknown";
				if (!byHookType[hookType]) {
					byHookType[hookType] = { total: 0, passed: 0 };
				}
				byHookType[hookType].total++;
				if (e.passed) {
					byHookType[hookType].passed++;
				}
			}
		});

		return {
			totalExecutions,
			totalPassed,
			totalFailed,
			passRate: totalExecutions > 0 ? totalPassed / totalExecutions : 0,
			uniqueHooks: hookNames.size,
			byHookType,
		};
	}

	/**
	 * Query session metrics using streaming aggregation
	 */
	querySessionMetrics(
		period: "day" | "week" | "month" = "week",
		limit = 10,
	): {
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
	} {
		// Build session map in a single pass
		const sessionMap = new Map<
			string,
			{
				session_id: string;
				started_at: string;
				ended_at: string | null;
				duration_minutes: number | null;
				task_count: number;
				success_count: number;
				hooks_passed_count: number;
				hooks_failed_count: number;
			}
		>();

		this.forEachEventForPeriod(period, (event) => {
			if (event.type === "session_start") {
				const e = event as SessionStartEvent;
				sessionMap.set(e.session_id, {
					session_id: e.session_id,
					started_at: e.timestamp,
					ended_at: null,
					duration_minutes: null,
					task_count: 0,
					success_count: 0,
					hooks_passed_count: 0,
					hooks_failed_count: 0,
				});
			} else if (event.type === "session_end") {
				const e = event as SessionEndEvent;
				const session = sessionMap.get(e.session_id);
				if (session) {
					session.ended_at = e.timestamp;
					session.duration_minutes = e.duration_minutes;
					session.task_count = e.task_count;
					session.success_count = e.success_count;
				}
			} else if (event.type === "hook_execution") {
				const e = event as HookExecutionEvent;
				if (e.session_id) {
					const session = sessionMap.get(e.session_id);
					if (session) {
						if (e.passed) {
							session.hooks_passed_count++;
						} else {
							session.hooks_failed_count++;
						}
					}
				}
			}
		});

		// Convert to array
		const sessions = Array.from(sessionMap.values())
			.map((s) => ({
				session_id: s.session_id,
				started_at: s.started_at,
				ended_at: s.ended_at,
				duration_minutes: s.duration_minutes,
				task_count: s.task_count,
				success_count: s.success_count,
				hooks_passed_count: s.hooks_passed_count,
				hooks_failed_count: s.hooks_failed_count,
				average_calibration: null as number | null,
			}))
			.sort(
				(a, b) =>
					new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
			)
			.slice(0, limit);

		// Calculate trends
		const trends = this.calculateSessionTrends(sessions);

		return { sessions, trends };
	}

	/**
	 * Calculate session trends
	 */
	private calculateSessionTrends(
		sessions: Array<{
			success_count: number;
			task_count: number;
			average_calibration: number | null;
		}>,
	): {
		calibration_trend: "improving" | "declining" | "stable";
		success_rate_trend: "improving" | "declining" | "stable";
	} {
		if (sessions.length < 2) {
			return {
				calibration_trend: "stable",
				success_rate_trend: "stable",
			};
		}

		const midpoint = Math.floor(sessions.length / 2);
		const recentSessions = sessions.slice(0, midpoint);
		const olderSessions = sessions.slice(midpoint);

		// Calculate success rates
		let recentTotal = 0;
		let recentSuccess = 0;
		for (const s of recentSessions) {
			recentTotal += s.task_count;
			recentSuccess += s.success_count;
		}
		const recentSuccessRate = recentTotal > 0 ? recentSuccess / recentTotal : 0;

		let olderTotal = 0;
		let olderSuccess = 0;
		for (const s of olderSessions) {
			olderTotal += s.task_count;
			olderSuccess += s.success_count;
		}
		const olderSuccessRate = olderTotal > 0 ? olderSuccess / olderTotal : 0;

		const success_rate_trend =
			recentSuccessRate > olderSuccessRate + 0.1
				? "improving"
				: recentSuccessRate < olderSuccessRate - 0.1
					? "declining"
					: "stable";

		return {
			calibration_trend: "stable",
			success_rate_trend,
		};
	}

	/**
	 * Close storage (no-op for JSONL, but maintains interface compatibility)
	 */
	close(): void {
		// No resources to clean up for JSONL
	}
}

/**
 * Export path helper for external use
 */
export { getMetricsDir, getMetricsFilePath };
