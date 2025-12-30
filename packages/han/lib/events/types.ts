/**
 * Han Event Types
 *
 * Defines all event types that can be logged to session-scoped Han event logs.
 * Events are stored in {session-id}-han.jsonl files and indexed into SQLite.
 */

/**
 * Base event interface - all events extend this
 */
export interface BaseEvent {
	/** Unique event ID */
	id: string;
	/** Event type discriminator */
	type: string;
	/** ISO timestamp */
	timestamp: string;
}

/**
 * Hook lifecycle events (mirrors tool_use/tool_result pattern)
 */
export interface HookRunEvent extends BaseEvent {
	type: "hook_run";
	data: {
		plugin: string;
		hook: string;
		directory: string;
		cached: boolean;
	};
}

export interface HookResultEvent extends BaseEvent {
	type: "hook_result";
	data: {
		plugin: string;
		hook: string;
		directory: string;
		cached: boolean;
		duration_ms: number;
		exit_code: number;
		success: boolean;
		output?: string;
		error?: string;
	};
}

export type HookEvent = HookRunEvent | HookResultEvent;

/**
 * MCP tool events
 */
export interface McpToolCallEvent extends BaseEvent {
	type: "mcp_tool_call";
	data: {
		tool: string;
		arguments?: Record<string, unknown>;
	};
}

export interface McpToolResultEvent extends BaseEvent {
	type: "mcp_tool_result";
	data: {
		tool: string;
		call_id: string;
		success: boolean;
		duration_ms: number;
		result?: unknown;
		error?: string;
	};
}

export type McpToolEvent = McpToolCallEvent | McpToolResultEvent;

/**
 * Exposed tool events (tools proxied from backend MCP servers)
 */
export interface ExposedToolCallEvent extends BaseEvent {
	type: "exposed_tool_call";
	data: {
		server: string;
		tool: string;
		prefixed_name: string;
		arguments?: Record<string, unknown>;
	};
}

export interface ExposedToolResultEvent extends BaseEvent {
	type: "exposed_tool_result";
	data: {
		server: string;
		tool: string;
		prefixed_name: string;
		call_id: string;
		success: boolean;
		duration_ms: number;
		result?: unknown;
		error?: string;
	};
}

export type ExposedToolEvent = ExposedToolCallEvent | ExposedToolResultEvent;

/**
 * Memory events
 */
export interface MemoryQueryEvent extends BaseEvent {
	type: "memory_query";
	data: {
		question: string;
		route?: "personal" | "team" | "rules";
		success: boolean;
		duration_ms: number;
	};
}

export interface MemoryLearnEvent extends BaseEvent {
	type: "memory_learn";
	data: {
		domain: string;
		scope: "project" | "user";
		success: boolean;
	};
}

export type MemoryEvent = MemoryQueryEvent | MemoryLearnEvent;

/**
 * Sentiment analysis events (generated during indexing)
 */
export type SentimentLevel = "positive" | "neutral" | "negative";
export type FrustrationLevel = "low" | "moderate" | "high";

export interface SentimentAnalysisEvent extends BaseEvent {
	type: "sentiment_analysis";
	data: {
		/** ID of the user message being analyzed */
		message_id: string;
		/** Raw sentiment score (typically -5 to +5) */
		sentiment_score: number;
		/** Categorized sentiment level */
		sentiment_level: SentimentLevel;
		/** Frustration score (0-10) if frustration detected */
		frustration_score?: number;
		/** Frustration level if detected */
		frustration_level?: FrustrationLevel;
		/** Detected signals (e.g., "CAPS", "punctuation", "negative_words") */
		signals: string[];
		/** Optional link to current task ID */
		task_id?: string;
	};
}

export type SentimentEvent = SentimentAnalysisEvent;

/**
 * Union of all Han event types
 */
export type HanEvent =
	| HookEvent
	| McpToolEvent
	| ExposedToolEvent
	| MemoryEvent
	| SentimentEvent;

/**
 * Event type discriminator values
 */
export type HanEventType = HanEvent["type"];

/**
 * Configuration for event logging
 */
export interface EventLogConfig {
	/** Enable event logging (default: true) */
	enabled: boolean;
	/** Include command output in hook events (default: true) */
	logOutput: boolean;
	/** Maximum output length before truncation (default: 10000) */
	maxOutputLength: number;
}

/**
 * Default event log configuration
 */
export const DEFAULT_EVENT_CONFIG: EventLogConfig = {
	enabled: true,
	logOutput: true,
	maxOutputLength: 10000,
};
