/**
 * GraphQL Han Event Types
 *
 * Represents Han events (hooks, MCP calls, memory operations) as polymorphic
 * types using GraphQL interfaces. Each event type has its own type with
 * relevant fields, enabling clean __typename-based discrimination.
 *
 * Paired event types (hook_result, mcp_tool_result, exposed_tool_result) are
 * filtered from the main message list and loaded as nested fields on their
 * parent events via DataLoader.
 */

import { builder, encodeGlobalId } from "../builder.ts";
import type {
	ExposedResultEventData,
	HookResultEventData,
	McpResultEventData,
} from "../loaders.ts";

// =============================================================================
// Han Event Type Enum (for resolveType)
// =============================================================================

export const HanEventTypeEnum = builder.enumType("HanEventType", {
	values: [
		"HOOK_RUN",
		"HOOK_RESULT",
		"MCP_TOOL_CALL",
		"MCP_TOOL_RESULT",
		"EXPOSED_TOOL_CALL",
		"EXPOSED_TOOL_RESULT",
		"MEMORY_QUERY",
		"MEMORY_LEARN",
		"SENTIMENT_ANALYSIS",
	] as const,
	description: "Type of Han event",
});

// =============================================================================
// Inline Result Types (for nested resolution on parent events)
// =============================================================================

/**
 * HookResult type for inline display on HookRunEvent
 */
export const HookResultType = builder
	.objectRef<HookResultEventData>("HookResult")
	.implement({
		description: "Hook execution result (inline, not a separate event)",
		fields: (t) => ({
			id: t.exposeString("id", { description: "Event ID" }),
			timestamp: t.field({
				type: "DateTime",
				description: "When the result was recorded",
				resolve: (data) => data.timestamp,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (data) => data.durationMs,
			}),
			exitCode: t.int({
				description: "Process exit code",
				resolve: (data) => data.exitCode,
			}),
			success: t.boolean({
				description: "Whether hook succeeded",
				resolve: (data) => data.success,
			}),
			output: t.string({
				nullable: true,
				description: "Hook output (if success)",
				resolve: (data) => data.output ?? null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (data) => data.error ?? null,
			}),
		}),
	});

/**
 * McpToolResult type for inline display on McpToolCallEvent
 */
export const McpToolResultType = builder
	.objectRef<McpResultEventData>("McpToolResult")
	.implement({
		description: "MCP tool result (inline, not a separate event)",
		fields: (t) => ({
			id: t.exposeString("id", { description: "Event ID" }),
			timestamp: t.field({
				type: "DateTime",
				description: "When the result was recorded",
				resolve: (data) => data.timestamp,
			}),
			callId: t.exposeString("callId", {
				description: "Call ID for correlation",
			}),
			success: t.boolean({
				description: "Whether call succeeded",
				resolve: (data) => data.success,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (data) => data.durationMs,
			}),
			result: t.string({
				nullable: true,
				description: "Result as JSON string (if success)",
				resolve: (data) => data.result ?? null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (data) => data.error ?? null,
			}),
		}),
	});

/**
 * ExposedToolResult type for inline display on ExposedToolCallEvent
 */
export const ExposedToolResultType = builder
	.objectRef<ExposedResultEventData>("ExposedToolResult")
	.implement({
		description: "Exposed tool result (inline, not a separate event)",
		fields: (t) => ({
			id: t.exposeString("id", { description: "Event ID" }),
			timestamp: t.field({
				type: "DateTime",
				description: "When the result was recorded",
				resolve: (data) => data.timestamp,
			}),
			callId: t.exposeString("callId", {
				description: "Call ID for correlation",
			}),
			success: t.boolean({
				description: "Whether call succeeded",
				resolve: (data) => data.success,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (data) => data.durationMs,
			}),
			result: t.string({
				nullable: true,
				description: "Result as JSON string (if success)",
				resolve: (data) => data.result ?? null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (data) => data.error ?? null,
			}),
		}),
	});

// =============================================================================
// Han Event Data Interfaces
// =============================================================================

export interface BaseHanEventData {
	id: string;
	timestamp: string;
	eventType: string;
	data: Record<string, unknown>;
	/** Session ID for loading paired events via DataLoader */
	sessionId?: string;
}

export interface HookRunEventData extends BaseHanEventData {
	eventType: "hook_run";
	data: {
		plugin: string;
		hook: string;
		directory: string;
		cached: boolean;
	};
}

export interface HookResultHanEventData extends BaseHanEventData {
	eventType: "hook_result";
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

export interface McpToolCallEventData extends BaseHanEventData {
	eventType: "mcp_tool_call";
	data: {
		tool: string;
		arguments?: Record<string, unknown>;
	};
}

export interface McpToolResultEventData extends BaseHanEventData {
	eventType: "mcp_tool_result";
	data: {
		tool: string;
		call_id: string;
		success: boolean;
		duration_ms: number;
		result?: unknown;
		error?: string;
	};
}

export interface ExposedToolCallEventData extends BaseHanEventData {
	eventType: "exposed_tool_call";
	data: {
		server: string;
		tool: string;
		prefixed_name: string;
		arguments?: Record<string, unknown>;
	};
}

export interface ExposedToolResultEventData extends BaseHanEventData {
	eventType: "exposed_tool_result";
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

export interface MemoryQueryEventData extends BaseHanEventData {
	eventType: "memory_query";
	data: {
		question: string;
		route?: "personal" | "team" | "rules";
		success: boolean;
		duration_ms: number;
	};
}

export interface MemoryLearnEventData extends BaseHanEventData {
	eventType: "memory_learn";
	data: {
		domain: string;
		scope: "project" | "user";
		success: boolean;
	};
}

export interface SentimentAnalysisEventData extends BaseHanEventData {
	eventType: "sentiment_analysis";
	data: {
		message_id: string;
		sentiment_score: number;
		sentiment_level: "positive" | "neutral" | "negative";
		frustration_score?: number;
		frustration_level?: "low" | "moderate" | "high";
		signals: string[];
		task_id?: string;
	};
}

export type HanEventData =
	| HookRunEventData
	| HookResultHanEventData
	| McpToolCallEventData
	| McpToolResultEventData
	| ExposedToolCallEventData
	| ExposedToolResultEventData
	| MemoryQueryEventData
	| MemoryLearnEventData
	| SentimentAnalysisEventData;

// =============================================================================
// Han Event Interface
// =============================================================================

/**
 * Map event type to GraphQL typename for global ID encoding
 * Global ID format: {EventTypename}:{uuid}
 */
function getEventTypename(eventType: string): string {
	switch (eventType) {
		case "hook_run":
			return "HookRunEvent";
		case "hook_result":
			return "HookResultEvent";
		case "mcp_tool_call":
			return "McpToolCallEvent";
		case "mcp_tool_result":
			return "McpToolResultEvent";
		case "exposed_tool_call":
			return "ExposedToolCallEvent";
		case "exposed_tool_result":
			return "ExposedToolResultEvent";
		case "memory_query":
			return "MemoryQueryEvent";
		case "memory_learn":
			return "MemoryLearnEvent";
		case "sentiment_analysis":
			return "SentimentAnalysisEvent";
		default:
			return "HanEvent";
	}
}

/**
 * Base interface for all Han events
 * Global ID format: {EventTypename}:{uuid}
 */
export const HanEventInterface = builder
	.interfaceRef<HanEventData>("HanEvent")
	.implement({
		description: "A Han event (hook execution, MCP call, memory operation)",
		fields: (t) => ({
			id: t.id({
				description: "Global event ID in format {EventTypename}:{uuid}",
				resolve: (event) =>
					encodeGlobalId(getEventTypename(event.eventType), event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the event occurred",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType", {
				description: "Event type discriminator (hook_run, mcp_tool_call, etc.)",
			}),
		}),
		resolveType: (event) => {
			switch (event.eventType) {
				case "hook_run":
					return "HookRunEvent";
				case "hook_result":
					return "HookResultEvent";
				case "mcp_tool_call":
					return "McpToolCallEvent";
				case "mcp_tool_result":
					return "McpToolResultEvent";
				case "exposed_tool_call":
					return "ExposedToolCallEvent";
				case "exposed_tool_result":
					return "ExposedToolResultEvent";
				case "memory_query":
					return "MemoryQueryEvent";
				case "memory_learn":
					return "MemoryLearnEvent";
				case "sentiment_analysis":
					return "SentimentAnalysisEvent";
				default:
					return "HookRunEvent"; // Fallback
			}
		},
	});

// =============================================================================
// Hook Event Types
// =============================================================================

export const HookRunEventType = builder
	.objectRef<HookRunEventData>("HookRunEvent")
	.implement({
		description: "Hook execution started",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is HookRunEventData =>
			(obj as HanEventData).eventType === "hook_run",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("HookRunEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			plugin: t.string({
				description: "Plugin name",
				resolve: (event) => event.data.plugin,
			}),
			hook: t.string({
				description: "Hook name",
				resolve: (event) => event.data.hook,
			}),
			directory: t.string({
				description: "Working directory",
				resolve: (event) => event.data.directory,
			}),
			cached: t.boolean({
				description: "Whether result was cached",
				resolve: (event) => event.data.cached,
			}),
			// Nested hook result (loaded via DataLoader)
			result: t.field({
				type: HookResultType,
				nullable: true,
				description:
					"Hook result (if available). Loaded via DataLoader from the session's paired events.",
				resolve: async (event, _args, context) => {
					if (!event.sessionId) return null;
					const pairedEvents =
						await context.loaders.sessionPairedEventsLoader.load(
							event.sessionId,
						);
					const key = `${event.data.plugin}:${event.data.hook}:${event.data.directory}`;
					return pairedEvents.hookResultByKey.get(key) ?? null;
				},
			}),
		}),
	});

export const HookResultEventType = builder
	.objectRef<HookResultHanEventData>("HookResultEvent")
	.implement({
		description: "Hook execution result (success or failure)",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is HookResultHanEventData =>
			(obj as HanEventData).eventType === "hook_result",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("HookResultEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			plugin: t.string({
				description: "Plugin name",
				resolve: (event) => event.data.plugin,
			}),
			hook: t.string({
				description: "Hook name",
				resolve: (event) => event.data.hook,
			}),
			directory: t.string({
				description: "Working directory",
				resolve: (event) => event.data.directory,
			}),
			cached: t.boolean({
				description: "Whether result was cached",
				resolve: (event) => event.data.cached,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (event) => event.data.duration_ms,
			}),
			exitCode: t.int({
				description: "Process exit code",
				resolve: (event) => event.data.exit_code,
			}),
			success: t.boolean({
				description: "Whether hook succeeded",
				resolve: (event) => event.data.success,
			}),
			output: t.string({
				nullable: true,
				description: "Hook output (if success)",
				resolve: (event) => event.data.output ?? null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (event) => event.data.error ?? null,
			}),
		}),
	});

// =============================================================================
// MCP Tool Event Types
// =============================================================================

export const McpToolCallEventType = builder
	.objectRef<McpToolCallEventData>("McpToolCallEvent")
	.implement({
		description: "MCP tool call initiated",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is McpToolCallEventData =>
			(obj as HanEventData).eventType === "mcp_tool_call",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("McpToolCallEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			tool: t.string({
				description: "Tool name",
				resolve: (event) => event.data.tool,
			}),
			arguments: t.string({
				nullable: true,
				description: "Tool arguments as JSON string",
				resolve: (event) =>
					event.data.arguments ? JSON.stringify(event.data.arguments) : null,
			}),
		}),
	});

export const McpToolResultEventType = builder
	.objectRef<McpToolResultEventData>("McpToolResultEvent")
	.implement({
		description: "MCP tool result returned",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is McpToolResultEventData =>
			(obj as HanEventData).eventType === "mcp_tool_result",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("McpToolResultEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			tool: t.string({
				description: "Tool name",
				resolve: (event) => event.data.tool,
			}),
			callId: t.string({
				description: "Call ID for correlation",
				resolve: (event) => event.data.call_id,
			}),
			success: t.boolean({
				description: "Whether call succeeded",
				resolve: (event) => event.data.success,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (event) => event.data.duration_ms,
			}),
			result: t.string({
				nullable: true,
				description: "Result as JSON string (if success)",
				resolve: (event) =>
					event.data.result ? JSON.stringify(event.data.result) : null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (event) => event.data.error ?? null,
			}),
		}),
	});

// =============================================================================
// Exposed Tool Event Types
// =============================================================================

export const ExposedToolCallEventType = builder
	.objectRef<ExposedToolCallEventData>("ExposedToolCallEvent")
	.implement({
		description: "Exposed tool call (proxied from backend MCP server)",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is ExposedToolCallEventData =>
			(obj as HanEventData).eventType === "exposed_tool_call",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("ExposedToolCallEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			server: t.string({
				description: "Backend server name",
				resolve: (event) => event.data.server,
			}),
			tool: t.string({
				description: "Tool name",
				resolve: (event) => event.data.tool,
			}),
			prefixedName: t.string({
				description: "Full prefixed tool name",
				resolve: (event) => event.data.prefixed_name,
			}),
			arguments: t.string({
				nullable: true,
				description: "Tool arguments as JSON string",
				resolve: (event) =>
					event.data.arguments ? JSON.stringify(event.data.arguments) : null,
			}),
		}),
	});

export const ExposedToolResultEventType = builder
	.objectRef<ExposedToolResultEventData>("ExposedToolResultEvent")
	.implement({
		description: "Exposed tool result returned",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is ExposedToolResultEventData =>
			(obj as HanEventData).eventType === "exposed_tool_result",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("ExposedToolResultEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			server: t.string({
				description: "Backend server name",
				resolve: (event) => event.data.server,
			}),
			tool: t.string({
				description: "Tool name",
				resolve: (event) => event.data.tool,
			}),
			prefixedName: t.string({
				description: "Full prefixed tool name",
				resolve: (event) => event.data.prefixed_name,
			}),
			callId: t.string({
				description: "Call ID for correlation",
				resolve: (event) => event.data.call_id,
			}),
			success: t.boolean({
				description: "Whether call succeeded",
				resolve: (event) => event.data.success,
			}),
			durationMs: t.int({
				description: "Execution duration in milliseconds",
				resolve: (event) => event.data.duration_ms,
			}),
			result: t.string({
				nullable: true,
				description: "Result as JSON string (if success)",
				resolve: (event) =>
					event.data.result ? JSON.stringify(event.data.result) : null,
			}),
			error: t.string({
				nullable: true,
				description: "Error message (if failed)",
				resolve: (event) => event.data.error ?? null,
			}),
		}),
	});

// =============================================================================
// Memory Event Types
// =============================================================================

export const MemoryQueryEventType = builder
	.objectRef<MemoryQueryEventData>("MemoryQueryEvent")
	.implement({
		description: "Memory query operation",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is MemoryQueryEventData =>
			(obj as HanEventData).eventType === "memory_query",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("MemoryQueryEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			question: t.string({
				description: "Query question",
				resolve: (event) => event.data.question,
			}),
			route: t.string({
				nullable: true,
				description: "Memory route (personal, team, rules)",
				resolve: (event) => event.data.route ?? null,
			}),
			success: t.boolean({
				description: "Whether query succeeded",
				resolve: (event) => event.data.success,
			}),
			durationMs: t.int({
				description: "Query duration in milliseconds",
				resolve: (event) => event.data.duration_ms,
			}),
		}),
	});

export const MemoryLearnEventType = builder
	.objectRef<MemoryLearnEventData>("MemoryLearnEvent")
	.implement({
		description: "Memory learn operation",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is MemoryLearnEventData =>
			(obj as HanEventData).eventType === "memory_learn",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("MemoryLearnEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			domain: t.string({
				description: "Learning domain",
				resolve: (event) => event.data.domain,
			}),
			scope: t.string({
				description: "Scope (project or user)",
				resolve: (event) => event.data.scope,
			}),
			success: t.boolean({
				description: "Whether learn succeeded",
				resolve: (event) => event.data.success,
			}),
		}),
	});

// =============================================================================
// Sentiment Event Types
// =============================================================================

export const SentimentAnalysisEventType = builder
	.objectRef<SentimentAnalysisEventData>("SentimentAnalysisEvent")
	.implement({
		description: "Sentiment analysis of user message",
		interfaces: [HanEventInterface],
		isTypeOf: (obj): obj is SentimentAnalysisEventData =>
			(obj as HanEventData).eventType === "sentiment_analysis",
		fields: (t) => ({
			id: t.id({
				resolve: (event) => encodeGlobalId("SentimentAnalysisEvent", event.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				resolve: (event) => event.timestamp,
			}),
			eventType: t.exposeString("eventType"),
			messageId: t.string({
				description: "ID of the user message being analyzed",
				resolve: (event) => event.data.message_id,
			}),
			sentimentScore: t.float({
				description: "Raw sentiment score (typically -5 to +5)",
				resolve: (event) => event.data.sentiment_score,
			}),
			sentimentLevel: t.string({
				description:
					"Categorized sentiment level (positive, neutral, negative)",
				resolve: (event) => event.data.sentiment_level,
			}),
			frustrationScore: t.float({
				nullable: true,
				description: "Frustration score (0-10) if frustration detected",
				resolve: (event) => event.data.frustration_score ?? null,
			}),
			frustrationLevel: t.string({
				nullable: true,
				description: "Frustration level if detected (low, moderate, high)",
				resolve: (event) => event.data.frustration_level ?? null,
			}),
			signals: t.stringList({
				description:
					"Detected signals (e.g., CAPS, punctuation, negative_words)",
				resolve: (event) => event.data.signals,
			}),
			taskId: t.string({
				nullable: true,
				description: "Optional link to current task ID",
				resolve: (event) => event.data.task_id ?? null,
			}),
		}),
	});

// =============================================================================
// Helper function to parse Han event from message
// =============================================================================

/**
 * Parse Han event data from message rawJson and toolName
 *
 * @param rawJson - The raw JSON string from the message
 * @param toolName - The event type (hook_run, mcp_tool_call, etc.)
 * @param sessionId - Optional session ID for loading paired events
 */
export function parseHanEventFromMessage(
	rawJson: string | null,
	toolName: string | null,
	sessionId?: string,
): HanEventData | null {
	if (!rawJson || !toolName) return null;

	try {
		const parsed = JSON.parse(rawJson);
		if (!parsed.id || !parsed.timestamp || !parsed.type) return null;

		return {
			id: parsed.id,
			timestamp: parsed.timestamp,
			eventType: parsed.type,
			data: parsed.data ?? {},
			sessionId,
		} as HanEventData;
	} catch {
		return null;
	}
}
