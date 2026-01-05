/**
 * DataLoader instances for GraphQL resolvers
 *
 * DataLoaders batch and cache data fetching within a single GraphQL request,
 * eliminating N+1 query problems. Each loader instance is created per-request
 * to ensure proper request isolation.
 *
 * Key loaders:
 * - sessionMessagesLoader: Batch load messages for multiple sessions
 * - sessionCheckpointsLoader: Batch load checkpoints for multiple sessions
 * - projectByIdLoader: Batch load projects by ID
 *
 * Paired event loaders (extract linked events from session messages):
 * - sentimentByMessageIdLoader: sentiment_analysis events by message_id
 * - sessionPairedEventsLoader: All paired events for a session (for nested resolution)
 */

import DataLoader from "dataloader";
import {
	type CheckpointSummary,
	getCheckpointsBySessionIds,
} from "../api/checkpoints.ts";
import {
	getSessionMessagesBatch,
	type SessionMessage,
} from "../api/sessions.ts";

/**
 * Parsed paired event data for nested resolution
 */
export interface PairedEventData {
	/** sentiment_analysis events keyed by message_id */
	sentimentByMessageId: Map<string, SentimentEventData>;
	/** hook_result events keyed by "${plugin}:${hook}:${directory}" */
	hookResultByKey: Map<string, HookResultEventData>;
	/** mcp_tool_result events keyed by call_id */
	mcpResultByCallId: Map<string, McpResultEventData>;
	/** exposed_tool_result events keyed by call_id */
	exposedResultByCallId: Map<string, ExposedResultEventData>;
}

export interface SentimentEventData {
	id: string;
	timestamp: string;
	messageId: string;
	sentimentScore: number;
	sentimentLevel: "positive" | "neutral" | "negative";
	frustrationScore?: number;
	frustrationLevel?: "low" | "moderate" | "high";
	signals: string[];
	taskId?: string;
}

export interface HookResultEventData {
	id: string;
	timestamp: string;
	plugin: string;
	hook: string;
	directory: string;
	cached: boolean;
	durationMs: number;
	exitCode: number;
	success: boolean;
	output?: string;
	error?: string;
}

export interface McpResultEventData {
	id: string;
	timestamp: string;
	tool: string;
	callId: string;
	success: boolean;
	durationMs: number;
	result?: string;
	error?: string;
}

export interface ExposedResultEventData {
	id: string;
	timestamp: string;
	server: string;
	tool: string;
	prefixedName: string;
	callId: string;
	success: boolean;
	durationMs: number;
	result?: string;
	error?: string;
}

/**
 * Parse paired events from session messages
 */
function parsePairedEvents(messages: SessionMessage[]): PairedEventData {
	const result: PairedEventData = {
		sentimentByMessageId: new Map(),
		hookResultByKey: new Map(),
		mcpResultByCallId: new Map(),
		exposedResultByCallId: new Map(),
	};

	for (const msg of messages) {
		if (msg.type !== "han_event" || !msg.rawJson) continue;

		try {
			const parsed = JSON.parse(msg.rawJson);
			const eventType = parsed.type;
			const data = parsed.data ?? {};

			switch (eventType) {
				case "sentiment_analysis":
					if (data.message_id) {
						result.sentimentByMessageId.set(data.message_id, {
							id: parsed.id,
							timestamp: parsed.timestamp,
							messageId: data.message_id,
							sentimentScore: data.sentiment_score ?? 0,
							sentimentLevel: data.sentiment_level ?? "neutral",
							frustrationScore: data.frustration_score,
							frustrationLevel: data.frustration_level,
							signals: data.signals ?? [],
							taskId: data.task_id,
						});
					}
					break;

				case "hook_result": {
					const key = `${data.plugin}:${data.hook}:${data.directory}`;
					result.hookResultByKey.set(key, {
						id: parsed.id,
						timestamp: parsed.timestamp,
						plugin: data.plugin ?? "",
						hook: data.hook ?? "",
						directory: data.directory ?? "",
						cached: data.cached ?? false,
						durationMs: data.duration_ms ?? 0,
						exitCode: data.exit_code ?? 0,
						success: data.success ?? false,
						output: data.output,
						error: data.error,
					});
					break;
				}

				case "mcp_tool_result":
					if (data.call_id) {
						result.mcpResultByCallId.set(data.call_id, {
							id: parsed.id,
							timestamp: parsed.timestamp,
							tool: data.tool ?? "",
							callId: data.call_id,
							success: data.success ?? false,
							durationMs: data.duration_ms ?? 0,
							result: data.result ? JSON.stringify(data.result) : undefined,
							error: data.error,
						});
					}
					break;

				case "exposed_tool_result":
					if (data.call_id) {
						result.exposedResultByCallId.set(data.call_id, {
							id: parsed.id,
							timestamp: parsed.timestamp,
							server: data.server ?? "",
							tool: data.tool ?? "",
							prefixedName: data.prefixed_name ?? "",
							callId: data.call_id,
							success: data.success ?? false,
							durationMs: data.duration_ms ?? 0,
							result: data.result ? JSON.stringify(data.result) : undefined,
							error: data.error,
						});
					}
					break;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return result;
}

/**
 * All DataLoaders available in GraphQL context
 */
export interface GraphQLLoaders {
	/** Batch load messages for sessions by sessionId */
	sessionMessagesLoader: DataLoader<string, SessionMessage[]>;
	/** Batch load checkpoints for sessions by sessionId */
	sessionCheckpointsLoader: DataLoader<string, CheckpointSummary[]>;
	/** Batch load paired events for sessions by sessionId */
	sessionPairedEventsLoader: DataLoader<string, PairedEventData>;
}

/**
 * Create fresh DataLoader instances for a new GraphQL request
 *
 * Must be called per-request to ensure:
 * - Request isolation (no data leaking between requests)
 * - Proper batching window (loaders collect keys during single tick)
 * - Cache scoped to request lifetime
 */
export function createLoaders(): GraphQLLoaders {
	// Create messages loader first since paired events loader depends on it
	const sessionMessagesLoader = new DataLoader<string, SessionMessage[]>(
		async (sessionIds) => {
			const results = await getSessionMessagesBatch([...sessionIds]);
			// DataLoader expects results in same order as keys
			return sessionIds.map((id) => results.get(id) ?? []);
		},
		{
			// Cache messages for entire request - they won't change mid-request
			cache: true,
			// Batch all session IDs collected in the same tick
			batchScheduleFn: (callback) => setTimeout(callback, 0),
		},
	);

	return {
		sessionMessagesLoader,

		/**
		 * Batch load session checkpoints
		 *
		 * Instead of: for each session -> getCheckpointsForSession(sessionId)
		 * Uses: getCheckpointsBySessionIds([sessionId1, sessionId2, ...])
		 */
		sessionCheckpointsLoader: new DataLoader<string, CheckpointSummary[]>(
			async (sessionIds) => {
				const results = await getCheckpointsBySessionIds([...sessionIds]);
				return sessionIds.map((id) => results.get(id) ?? []);
			},
			{
				cache: true,
				batchScheduleFn: (callback) => setTimeout(callback, 0),
			},
		),

		/**
		 * Batch load paired events for sessions
		 *
		 * Extracts sentiment_analysis, hook_result, mcp_tool_result, exposed_tool_result
		 * events from session messages for nested resolution on parent types.
		 * Uses the sessionMessagesLoader to reuse cached messages.
		 */
		sessionPairedEventsLoader: new DataLoader<string, PairedEventData>(
			async (sessionIds) => {
				// Load messages for all sessions (reuses cache from sessionMessagesLoader)
				const messagesBySession = await Promise.all(
					sessionIds.map((id) => sessionMessagesLoader.load(id)),
				);

				// Parse paired events for each session
				return messagesBySession.map((messages) => parsePairedEvents(messages));
			},
			{
				cache: true,
				batchScheduleFn: (callback) => setTimeout(callback, 0),
			},
		),
	};
}
