/**
 * Han Event Logger
 *
 * Logs Han events (hooks, MCP calls, memory operations) to session-scoped
 * JSONL files that are indexed into SQLite by the coordinator.
 *
 * File location: ~/.claude/han/memory/personal/sessions/{date}-{session-id}-han.jsonl
 * (Same location as session observation files, with -han suffix)
 */

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getGitBranch as nativeGetGitBranch } from "../native.ts";
import { ensureMemoryDirs, getHanEventsFilePath } from "../memory/paths.ts";
import { isDebugMode } from "../shared.ts";
import type {
	EventLogConfig,
	FrustrationLevel,
	HanEvent,
	HanEventType,
	TaskComplexity,
	TaskOutcome,
	TaskType,
} from "./types.ts";

/**
 * Maximum safe inline size for JSONL entries.
 * POSIX guarantees atomic writes only up to PIPE_BUF (512 bytes minimum).
 * We use 400 bytes as a safe margin to account for JSON overhead.
 */
const INLINE_SIZE_LIMIT = 400;

/**
 * Get current git branch for a directory
 * Returns undefined if not in a git repository or on a detached HEAD
 */
function getGitBranch(directory: string): string | undefined {
	return nativeGetGitBranch(directory) ?? undefined;
}

/**
 * Event Logger class for a specific session
 *
 * Creates events with consistent metadata matching Claude transcript format:
 * - uuid: Unique event identifier
 * - sessionId: Parent session UUID
 * - agentId: (optional) Agent ID for agent contexts
 * - cwd: Current working directory
 * - gitBranch: (optional) Current git branch
 * - timestamp: ISO timestamp
 */
export class EventLogger {
	private logPath: string;
	private refDir: string;
	private config: EventLogConfig;
	private buffer: string[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly sessionId: string;
	private readonly agentId?: string;
	private readonly cwd?: string;
	private readonly gitBranch?: string;

	constructor(
		sessionId: string,
		config: Partial<EventLogConfig> = {},
		projectPath?: string,
		agentId?: string,
	) {
		this.sessionId = sessionId;
		this.agentId = agentId;
		this.cwd = projectPath;

		// Detect git branch at initialization (matches Claude transcript behavior)
		if (projectPath) {
			this.gitBranch = getGitBranch(projectPath);
		}

		this.config = {
			enabled: config.enabled ?? true,
			logOutput: config.logOutput ?? true,
			maxOutputLength: config.maxOutputLength ?? 10000,
			verbose: config.verbose ?? process.env.HAN_VERBOSE === "1",
			verboseOnly: config.verboseOnly ?? false,
		};

		// Store han events alongside Claude transcripts in the project directory
		// ~/.claude/projects/{project-slug}/{sessionId}-han.jsonl
		if (projectPath) {
			this.logPath = getHanEventsFilePath(projectPath, sessionId);
		} else {
			// Fallback to sessions directory if no project path
			ensureMemoryDirs();
			this.logPath = getHanEventsFilePath(sessionId);
		}

		// Ref directory for large content: {logPath-dir}/{sessionId}/
		this.refDir = join(dirname(this.logPath), sessionId);

		// Ensure directory exists
		if (!existsSync(dirname(this.logPath))) {
			mkdirSync(dirname(this.logPath), { recursive: true });
		}

		if (isDebugMode()) {
			console.error(
				`[EventLogger] Initialized: sessionId=${sessionId}, agentId=${agentId ?? "none"}, gitBranch=${this.gitBranch ?? "none"}, logPath=${this.logPath}`,
			);
		}
	}

	/**
	 * Generate unique event UUID (matches Claude's uuid format)
	 */
	private generateUuid(): string {
		return randomUUID();
	}

	/**
	 * Create base event metadata for all events
	 * Matches Claude transcript metadata structure for consistent indexing
	 */
	private createBaseEvent<T extends HanEventType>(
		type: T,
	): {
		uuid: string;
		sessionId: string;
		agentId?: string;
		type: T;
		timestamp: string;
		cwd?: string;
		gitBranch?: string;
	} {
		return {
			uuid: this.generateUuid(),
			sessionId: this.sessionId,
			...(this.agentId && { agentId: this.agentId }),
			type,
			timestamp: new Date().toISOString(),
			...(this.cwd && { cwd: this.cwd }),
			...(this.gitBranch && { gitBranch: this.gitBranch }),
		};
	}

	/**
	 * Truncate output if needed
	 */
	private truncateOutput(output: string): string {
		if (output.length <= this.config.maxOutputLength) {
			return output;
		}
		const truncated = output.slice(0, this.config.maxOutputLength);
		return `${truncated}\n... [truncated, ${output.length - this.config.maxOutputLength} more bytes]`;
	}

	/**
	 * Write large content to a ref file
	 * Returns the relative ref path: {event-type}/{uuid}.json
	 */
	private writeRefFile(event: HanEvent): string {
		const refSubdir = join(this.refDir, event.type);
		if (!existsSync(refSubdir)) {
			mkdirSync(refSubdir, { recursive: true });
		}

		const refFileName = `${event.uuid}.json`;
		const refPath = join(refSubdir, refFileName);
		const relativePath = `${event.type}/${refFileName}`;

		try {
			writeFileSync(refPath, JSON.stringify(event, null, 2));
			if (isDebugMode()) {
				console.error(
					`[EventLogger] Wrote ref file: ${relativePath} (${JSON.stringify(event).length} bytes)`,
				);
			}
		} catch (error) {
			console.error(
				`[EventLogger] Failed to write ref file ${refPath}:`,
				error instanceof Error ? error.message : String(error),
			);
		}

		return relativePath;
	}

	/**
	 * Write event to log file
	 * If event exceeds INLINE_SIZE_LIMIT, writes full content to ref file
	 * and stores only a ref pointer in the JSONL
	 */
	private writeEvent(event: HanEvent): void {
		if (!this.config.enabled) return;

		// Verbose mode: print user-friendly event summary
		if (this.config.verbose) {
			this.printVerboseEvent(event);
		}

		// If verboseOnly mode, skip writing to JSONL file
		if (this.config.verboseOnly) {
			return;
		}

		const fullJson = JSON.stringify(event);

		let line: string;
		if (fullJson.length > INLINE_SIZE_LIMIT) {
			// Large event: write to ref file and store pointer in JSONL
			const refPath = this.writeRefFile(event);
			const refEvent = {
				uuid: event.uuid,
				sessionId: event.sessionId,
				...(event.agentId && { agentId: event.agentId }),
				type: event.type,
				timestamp: event.timestamp,
				ref: refPath,
			};
			line = `${JSON.stringify(refEvent)}\n`;

			if (isDebugMode()) {
				console.error(
					`[EventLogger] Large event (${fullJson.length} bytes) -> ref: ${refPath}`,
				);
			}
		} else {
			// Small event: inline in JSONL
			line = `${fullJson}\n`;
		}

		this.buffer.push(line);

		if (isDebugMode()) {
			console.error(
				`[EventLogger] writeEvent: type=${event.type}, buffer size=${this.buffer.length}`,
			);
		}

		// Flush immediately for result events, batch run/call events
		if (event.type.endsWith("_result")) {
			this.flush();
		} else {
			this.scheduleFlush();
		}
	}

	/**
	 * Print a user-friendly event summary to stderr
	 * Used when HAN_VERBOSE=1 is set
	 */
	private printVerboseEvent(event: HanEvent): void {
		const time = new Date(event.timestamp).toLocaleTimeString();
		// biome-ignore lint/suspicious/noExplicitAny: Event data varies by type
		const data: any = "data" in event ? event.data : {};

		// Format based on event type
		switch (event.type) {
			case "hook_run":
				console.error(
					`[${time}] 🪝 hook_run: ${data.plugin}/${data.hook} in ${data.directory}${data.cached ? " (cached)" : ""}`,
				);
				break;
			case "hook_result": {
				const icon = data.success ? "✓" : "✗";
				console.error(
					`[${time}] ${icon} hook_result: ${data.plugin}/${data.hook} ${data.success ? "passed" : "failed"} (${data.duration_ms}ms)`,
				);
				break;
			}
			case "hook_validation":
				console.error(
					`[${time}] 🔍 hook_validation: ${data.plugin}/${data.hook} exit=${data.exit_code}`,
				);
				break;
			case "hook_validation_cache": {
				const fileCount = Object.keys(data.files || {}).length;
				console.error(
					`[${time}] 💾 hook_validation_cache: ${data.plugin}/${data.hook} cached ${fileCount} files`,
				);
				break;
			}
			case "task_start":
				console.error(
					`[${time}] 📋 task_start: ${data.task_id} - ${data.description}`,
				);
				break;
			case "task_complete":
				console.error(
					`[${time}] ✅ task_complete: ${data.task_id} outcome=${data.outcome}`,
				);
				break;
			case "task_fail":
				console.error(
					`[${time}] ❌ task_fail: ${data.task_id} - ${data.reason}`,
				);
				break;
			case "frustration_detected":
				console.error(
					`[${time}] 😤 frustration_detected: level=${data.frustration_level} score=${data.frustration_score}`,
				);
				break;
			case "mcp_tool_call":
				console.error(`[${time}] 🔧 mcp_tool_call: ${data.tool}`);
				break;
			case "mcp_tool_result":
				console.error(
					`[${time}] ${data.success ? "✓" : "✗"} mcp_tool_result: ${data.tool} (${data.duration_ms}ms)`,
				);
				break;
			default:
				console.error(`[${time}] 📝 ${event.type}`);
		}
	}

	/**
	 * Schedule a delayed flush
	 */
	private scheduleFlush(): void {
		if (this.flushTimer) return;
		this.flushTimer = setTimeout(() => {
			this.flush();
		}, 100);
	}

	/**
	 * Flush buffered events to disk
	 */
	flush(): void {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.buffer.length === 0) {
			if (isDebugMode()) {
				console.error("[EventLogger] flush() called but buffer is empty");
			}
			return;
		}

		try {
			const content = this.buffer.join("");
			if (isDebugMode()) {
				console.error(
					`[EventLogger] Writing ${this.buffer.length} events to ${this.logPath}`,
				);
			}
			appendFileSync(this.logPath, content);
			this.buffer = [];
			if (isDebugMode()) {
				console.error("[EventLogger] Write successful");
			}
		} catch (error) {
			// Log error but don't throw - event logging shouldn't break functionality
			console.error(
				`[EventLogger] Failed to write to ${this.logPath}:`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	// =========================================================================
	// Hook Events (mirrors tool_use/tool_result pattern)
	// =========================================================================

	/**
	 * Log hook run event (like tool_use)
	 * Returns event UUID for correlating with result
	 * @param ifChanged - Glob patterns for file validation (snapshot at execution time)
	 * @param command - The command that will be executed
	 */
	logHookRun(
		plugin: string,
		hook: string,
		hookType: string,
		directory: string,
		cached: boolean,
		ifChanged?: string[],
		command?: string,
	): string {
		const base = this.createBaseEvent("hook_run");
		this.writeEvent({
			...base,
			data: {
				plugin,
				hook,
				hook_type: hookType,
				directory,
				cached,
				// Only include if_changed if patterns exist (captures config at execution time)
				...(ifChanged && ifChanged.length > 0 && { if_changed: ifChanged }),
				// Include command for validation tracking
				...(command && { command }),
			},
		});
		return base.uuid;
	}

	/**
	 * Log hook result event (like tool_result)
	 * Combines success and error cases into single event type
	 * @param hookRunId - UUID of the parent hook_run event for correlation
	 * @param ifChanged - Glob patterns for file validation (snapshot at execution time)
	 * @param command - The command that was executed
	 */
	logHookResult(
		plugin: string,
		hook: string,
		hookType: string,
		directory: string,
		cached: boolean,
		durationMs: number,
		exitCode: number,
		success: boolean,
		output?: string,
		error?: string,
		hookRunId?: string,
		ifChanged?: string[],
		command?: string,
	): void {
		const event = {
			...this.createBaseEvent("hook_result"),
			...(hookRunId && { hookRunId }),
			data: {
				plugin,
				hook,
				hook_type: hookType,
				directory,
				cached,
				duration_ms: durationMs,
				exit_code: exitCode,
				success,
				output:
					this.config.logOutput && output
						? this.truncateOutput(output)
						: undefined,
				error,
				// Include validation context for tracking
				...(ifChanged && ifChanged.length > 0 && { if_changed: ifChanged }),
				...(command && { command }),
			},
		} as const;
		this.writeEvent(event as HanEvent);
	}

	// =========================================================================
	// MCP Tool Events
	// =========================================================================

	/**
	 * Log MCP tool call event
	 * Returns event UUID for correlating with result
	 */
	logMcpToolCall(tool: string, args?: Record<string, unknown>): string {
		const base = this.createBaseEvent("mcp_tool_call");
		this.writeEvent({
			...base,
			data: { tool, arguments: args },
		});
		return base.uuid;
	}

	/**
	 * Log MCP tool result event
	 */
	logMcpToolResult(
		tool: string,
		callId: string,
		success: boolean,
		durationMs: number,
		result?: unknown,
		error?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("mcp_tool_result"),
			data: {
				tool,
				call_id: callId,
				success,
				duration_ms: durationMs,
				result: success ? result : undefined,
				error,
			},
		});
	}

	// =========================================================================
	// Exposed Tool Events
	// =========================================================================

	/**
	 * Log exposed tool call event
	 * Returns event UUID for correlating with result
	 */
	logExposedToolCall(
		server: string,
		tool: string,
		prefixedName: string,
		args?: Record<string, unknown>,
	): string {
		const base = this.createBaseEvent("exposed_tool_call");
		this.writeEvent({
			...base,
			data: { server, tool, prefixed_name: prefixedName, arguments: args },
		});
		return base.uuid;
	}

	/**
	 * Log exposed tool result event
	 */
	logExposedToolResult(
		server: string,
		tool: string,
		prefixedName: string,
		callId: string,
		success: boolean,
		durationMs: number,
		result?: unknown,
		error?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("exposed_tool_result"),
			data: {
				server,
				tool,
				prefixed_name: prefixedName,
				call_id: callId,
				success,
				duration_ms: durationMs,
				result: success ? result : undefined,
				error,
			},
		});
	}

	// =========================================================================
	// Memory Events
	// =========================================================================

	/**
	 * Log memory query event
	 */
	logMemoryQuery(
		question: string,
		route: "personal" | "team" | "rules" | undefined,
		success: boolean,
		durationMs: number,
	): void {
		this.writeEvent({
			...this.createBaseEvent("memory_query"),
			data: { question, route, success, duration_ms: durationMs },
		});
	}

	/**
	 * Log memory learn event
	 */
	logMemoryLearn(
		domain: string,
		scope: "project" | "user",
		success: boolean,
	): void {
		this.writeEvent({
			...this.createBaseEvent("memory_learn"),
			data: { domain, scope, success },
		});
	}

	// =========================================================================
	// Specific Hook Events
	// =========================================================================

	/**
	 * Log hook reference event (han hook reference)
	 */
	logHookReference(
		plugin: string,
		filePath: string,
		reason: string | undefined,
		success: boolean,
		durationMs: number,
	): void {
		this.writeEvent({
			...this.createBaseEvent("hook_reference"),
			data: {
				plugin,
				file_path: filePath,
				reason,
				success,
				duration_ms: durationMs,
			},
		});
	}

	/**
	 * Log hook validation event (han hook run)
	 */
	logHookValidation(
		plugin: string,
		hook: string,
		hookType: string,
		directory: string,
		cached: boolean,
		durationMs: number,
		exitCode: number,
		success: boolean,
		output?: string,
		error?: string,
	): void {
		const event = {
			...this.createBaseEvent("hook_validation"),
			data: {
				plugin,
				hook,
				hook_type: hookType,
				directory,
				cached,
				duration_ms: durationMs,
				exit_code: exitCode,
				success,
				output:
					this.config.logOutput && output
						? this.truncateOutput(output)
						: undefined,
				error,
			},
		} as const;
		this.writeEvent(event as HanEvent);
	}

	/**
	 * Log hook validation cache event
	 * Records which files were validated with their hashes for cache invalidation
	 */
	logHookValidationCache(
		plugin: string,
		hook: string,
		directory: string,
		commandHash: string,
		files: Record<string, string>,
	): void {
		this.writeEvent({
			...this.createBaseEvent("hook_validation_cache"),
			data: {
				plugin,
				hook,
				directory,
				command_hash: commandHash,
				files,
			},
		});
	}

	/**
	 * Log hook datetime event
	 */
	logHookDatetime(plugin: string, datetime: string, durationMs: number): void {
		this.writeEvent({
			...this.createBaseEvent("hook_datetime"),
			data: { plugin, datetime, duration_ms: durationMs },
		});
	}

	/**
	 * Log hook file change event
	 */
	logHookFileChange(toolName: string, filePath: string): void {
		this.writeEvent({
			...this.createBaseEvent("hook_file_change"),
			data: {
				session_id: this.sessionId,
				tool_name: toolName,
				file_path: filePath,
			},
		});
	}

	/**
	 * Log hook script event (generic bash/cat commands)
	 */
	logHookScript(
		plugin: string,
		command: string,
		durationMs: number,
		exitCode: number,
		success: boolean,
		output?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("hook_script"),
			data: {
				plugin,
				command,
				duration_ms: durationMs,
				exit_code: exitCode,
				success,
				output:
					this.config.logOutput && output
						? this.truncateOutput(output)
						: undefined,
			},
		});
	}

	/**
	 * Log queue operation event
	 */
	logQueueOperation(
		operation: "enqueue" | "dequeue" | "complete" | "fail",
		queueName: string,
		taskId?: string,
		taskDescription?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("queue_operation"),
			data: {
				operation,
				queue_name: queueName,
				task_id: taskId,
				task_description: taskDescription,
			},
		});
	}

	// =========================================================================
	// Sentiment Analysis Events
	// =========================================================================

	/**
	 * Log sentiment analysis event for a user message
	 */
	logSentimentAnalysis(
		messageId: string,
		sentimentScore: number,
		sentimentLevel: "positive" | "neutral" | "negative",
		signals: string[],
		frustrationScore?: number,
		frustrationLevel?: "low" | "moderate" | "high",
		taskId?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("sentiment_analysis"),
			data: {
				message_id: messageId,
				sentiment_score: sentimentScore,
				sentiment_level: sentimentLevel,
				frustration_score: frustrationScore,
				frustration_level: frustrationLevel,
				signals,
				task_id: taskId,
			},
		});
	}

	// =========================================================================
	// Task Events
	// =========================================================================

	/**
	 * Log task start event
	 * Returns the task ID for correlation with completion
	 */
	logTaskStart(
		taskId: string,
		description: string,
		taskType: TaskType,
		estimatedComplexity?: TaskComplexity,
	): string {
		this.writeEvent({
			...this.createBaseEvent("task_start"),
			data: {
				task_id: taskId,
				description,
				task_type: taskType,
				estimated_complexity: estimatedComplexity,
			},
		});
		return taskId;
	}

	/**
	 * Log task update event
	 */
	logTaskUpdate(taskId: string, status?: string, notes?: string): void {
		this.writeEvent({
			...this.createBaseEvent("task_update"),
			data: {
				task_id: taskId,
				status,
				notes,
			},
		});
	}

	/**
	 * Log task complete event
	 */
	logTaskComplete(
		taskId: string,
		outcome: TaskOutcome,
		confidence: number,
		durationSeconds: number,
		filesModified?: string[],
		testsAdded?: number,
		notes?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("task_complete"),
			data: {
				task_id: taskId,
				outcome,
				confidence,
				duration_seconds: durationSeconds,
				files_modified: filesModified,
				tests_added: testsAdded,
				notes,
			},
		});
	}

	/**
	 * Log task fail event
	 */
	logTaskFail(
		taskId: string,
		reason: string,
		durationSeconds: number,
		confidence?: number,
		attemptedSolutions?: string[],
		notes?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("task_fail"),
			data: {
				task_id: taskId,
				reason,
				duration_seconds: durationSeconds,
				confidence,
				attempted_solutions: attemptedSolutions,
				notes,
			},
		});
	}

	// =========================================================================
	// Frustration Events
	// =========================================================================

	/**
	 * Log hook check state event (for check mode deduplication)
	 */
	logHookCheckState(
		hookType: string,
		fingerprint: string,
		hooksCount: number,
	): void {
		this.writeEvent({
			...this.createBaseEvent("hook_check_state"),
			data: {
				hook_type: hookType,
				fingerprint,
				hooks_count: hooksCount,
			},
		});
	}

	/**
	 * Log frustration detected event
	 */
	logFrustrationDetected(
		frustrationLevel: FrustrationLevel,
		frustrationScore: number,
		userMessage: string,
		detectedSignals: string[],
		context?: string,
		taskId?: string,
	): void {
		this.writeEvent({
			...this.createBaseEvent("frustration_detected"),
			data: {
				frustration_level: frustrationLevel,
				frustration_score: frustrationScore,
				user_message: userMessage,
				detected_signals: detectedSignals,
				context,
				task_id: taskId,
			},
		});
	}

	/**
	 * Get log file path
	 */
	getLogPath(): string {
		return this.logPath;
	}
}

// ============================================================================
// Global Logger Instance
// ============================================================================

let globalLogger: EventLogger | null = null;

/**
 * Initialize the global event logger for a session
 * @param sessionId - Claude session ID
 * @param config - Optional logger configuration
 * @param projectPath - Optional project path to store events alongside transcripts
 */
export function initEventLogger(
	sessionId: string,
	config?: Partial<EventLogConfig>,
	projectPath?: string,
): EventLogger {
	globalLogger = new EventLogger(sessionId, config, projectPath);
	return globalLogger;
}

/**
 * Get the current event logger instance
 * Returns null if not initialized
 */
export function getEventLogger(): EventLogger | null {
	return globalLogger;
}

/**
 * Get or create event logger for current context
 * Uses HAN_SESSION_ID env var if available, falls back to CLAUDE_SESSION_ID
 * Uses process.cwd() as the project path
 */
export function getOrCreateEventLogger(): EventLogger | null {
	if (globalLogger) return globalLogger;

	// Try HAN_SESSION_ID first (explicit override), then CLAUDE_SESSION_ID (from Claude Code)
	const sessionId = process.env.HAN_SESSION_ID || process.env.CLAUDE_SESSION_ID;

	if (!sessionId) {
		// No session ID available, can't log events
		return null;
	}

	// Use cwd as project path to store events alongside Claude transcripts
	return initEventLogger(sessionId, {}, process.cwd());
}
