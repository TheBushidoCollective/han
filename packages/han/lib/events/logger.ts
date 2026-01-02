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
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ensureMemoryDirs, getHanEventsFilePath } from "../memory/paths.ts";
import { isDebugMode } from "../shared.ts";
import type { EventLogConfig, HanEvent } from "./types.ts";

/**
 * Event Logger class for a specific session
 */
export class EventLogger {
	private logPath: string;
	private config: EventLogConfig;
	private buffer: string[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(sessionId: string, config: Partial<EventLogConfig> = {}) {
		this.config = {
			enabled: config.enabled ?? true,
			logOutput: config.logOutput ?? true,
			maxOutputLength: config.maxOutputLength ?? 10000,
		};

		// Ensure memory directories exist
		ensureMemoryDirs();

		// Use path from paths.ts - same location as session observation files
		// ~/.claude/han/memory/personal/sessions/{date}-{session-id}-han.jsonl
		this.logPath = getHanEventsFilePath(sessionId);

		// Ensure directory exists (should already be created by ensureMemoryDirs)
		if (!existsSync(dirname(this.logPath))) {
			mkdirSync(dirname(this.logPath), { recursive: true });
		}

		if (isDebugMode()) {
			console.error(
				`[EventLogger] Initialized: sessionId=${sessionId}, logPath=${this.logPath}`,
			);
		}
	}

	/**
	 * Generate unique event ID
	 */
	private generateId(): string {
		return `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
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
	 * Write event to log file
	 */
	private writeEvent(event: HanEvent): void {
		if (!this.config.enabled) return;

		const line = `${JSON.stringify(event)}\n`;
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
	 * Returns call ID for correlating with result
	 */
	logHookRun(
		plugin: string,
		hook: string,
		directory: string,
		cached: boolean,
	): string {
		const id = this.generateId();
		this.writeEvent({
			id,
			type: "hook_run",
			timestamp: new Date().toISOString(),
			data: { plugin, hook, directory, cached },
		});
		return id;
	}

	/**
	 * Log hook result event (like tool_result)
	 * Combines success and error cases into single event type
	 */
	logHookResult(
		plugin: string,
		hook: string,
		directory: string,
		cached: boolean,
		durationMs: number,
		exitCode: number,
		success: boolean,
		output?: string,
		error?: string,
	): void {
		this.writeEvent({
			id: this.generateId(),
			type: "hook_result",
			timestamp: new Date().toISOString(),
			data: {
				plugin,
				hook,
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
		});
	}

	// =========================================================================
	// MCP Tool Events
	// =========================================================================

	/**
	 * Log MCP tool call event
	 * Returns call ID for correlating with result
	 */
	logMcpToolCall(tool: string, args?: Record<string, unknown>): string {
		const id = this.generateId();
		this.writeEvent({
			id,
			type: "mcp_tool_call",
			timestamp: new Date().toISOString(),
			data: { tool, arguments: args },
		});
		return id;
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
			id: this.generateId(),
			type: "mcp_tool_result",
			timestamp: new Date().toISOString(),
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
	 * Returns call ID for correlating with result
	 */
	logExposedToolCall(
		server: string,
		tool: string,
		prefixedName: string,
		args?: Record<string, unknown>,
	): string {
		const id = this.generateId();
		this.writeEvent({
			id,
			type: "exposed_tool_call",
			timestamp: new Date().toISOString(),
			data: { server, tool, prefixed_name: prefixedName, arguments: args },
		});
		return id;
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
			id: this.generateId(),
			type: "exposed_tool_result",
			timestamp: new Date().toISOString(),
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
			id: this.generateId(),
			type: "memory_query",
			timestamp: new Date().toISOString(),
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
			id: this.generateId(),
			type: "memory_learn",
			timestamp: new Date().toISOString(),
			data: { domain, scope, success },
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
 */
export function initEventLogger(
	sessionId: string,
	config?: Partial<EventLogConfig>,
): EventLogger {
	globalLogger = new EventLogger(sessionId, config);
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
 */
export function getOrCreateEventLogger(): EventLogger | null {
	if (globalLogger) return globalLogger;

	// Try HAN_SESSION_ID first (explicit override), then CLAUDE_SESSION_ID (from Claude Code)
	const sessionId = process.env.HAN_SESSION_ID || process.env.CLAUDE_SESSION_ID;

	if (!sessionId) {
		// No session ID available, can't log events
		return null;
	}

	return initEventLogger(sessionId);
}
