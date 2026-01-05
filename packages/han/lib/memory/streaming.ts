/**
 * Memory Agent Streaming
 *
 * Connects the Memory Agent to the Browse UI via GraphQL subscriptions.
 * Publishes progress updates and final results to the PubSub system.
 */

import {
	publishMemoryAgentProgress,
	publishMemoryAgentResult,
} from "../graphql/pubsub.ts";
import {
	type MemoryAgentResponse,
	type MemoryProgressUpdate,
	type MemoryQueryParams,
	queryMemoryAgent,
} from "./memory-agent.ts";

/**
 * Query memory with streaming to Browse UI
 *
 * This wraps the Memory Agent and publishes progress events
 * via GraphQL subscriptions for real-time UI updates.
 *
 * @param params - Query parameters
 * @returns The Memory Agent response with sessionId for attaching
 *
 * @example
 * ```typescript
 * // In the main agent/MCP handler
 * const result = await queryMemoryWithStreaming({
 *   question: "Who implemented the auth system?",
 * });
 *
 * // The Browse UI can subscribe to updates:
 * // subscription {
 * //   memoryAgentProgress(sessionId: "${result.sessionId}") {
 * //     type
 * //     content
 * //     resultCount
 * //   }
 * // }
 * ```
 */
export async function queryMemoryWithStreaming(
	params: MemoryQueryParams,
): Promise<MemoryAgentResponse> {
	// Create a progress callback that publishes to PubSub
	const onProgress = (update: MemoryProgressUpdate): void => {
		// Note: sessionId will be set after queryMemoryAgent returns,
		// but we can still publish progress updates as they happen
		// by using a placeholder - the actual sessionId is embedded
		// in the result. The UI should subscribe AFTER receiving the
		// initial response with the sessionId.

		// For streaming during the query, we use a different approach:
		// we publish with a temporary session ID pattern that can be
		// matched later. However, the cleaner approach is to use the
		// sessionId that queryMemoryAgent generates internally.
		publishMemoryAgentProgress(
			"pending", // Will be replaced with actual sessionId
			update.type,
			update.content,
			{
				layer: update.layer,
				resultCount: update.resultCount,
			},
		);
	};

	// Execute the memory query with streaming
	const result = await queryMemoryAgent(params, onProgress);

	// Publish the final result
	publishMemoryAgentResult({
		sessionId: result.sessionId,
		answer: result.answer,
		confidence: result.confidence,
		citations: result.citations,
		searchedLayers: result.searchedLayers,
		success: result.success,
		error: result.error,
	});

	return result;
}

/**
 * Active memory query sessions
 *
 * Tracks ongoing memory queries for the Browse UI to attach to.
 */
const activeSessions = new Map<
	string,
	{
		question: string;
		startedAt: number;
		status: "running" | "complete" | "error";
	}
>();

/**
 * Start a memory query session
 *
 * Creates a session that the Browse UI can attach to for streaming.
 *
 * @param params - Query parameters
 * @returns Session ID that can be used to subscribe to updates
 */
export async function startMemoryQuerySession(
	params: MemoryQueryParams,
): Promise<string> {
	// Generate a session ID upfront
	const sessionId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	// Track the session
	activeSessions.set(sessionId, {
		question: params.question,
		startedAt: Date.now(),
		status: "running",
	});

	// Create a progress callback that publishes to PubSub with the real sessionId
	const onProgress = (update: MemoryProgressUpdate): void => {
		console.log(
			`[Memory Agent] Publishing progress: ${update.type} ${update.layer || ""} - ${update.content}`,
		);
		publishMemoryAgentProgress(sessionId, update.type, update.content, {
			layer: update.layer,
			resultCount: update.resultCount,
		});
	};

	// Add a delay to give the client time to set up subscriptions
	// This prevents a race condition where events are published before
	// the WebSocket subscription is established
	// 500ms should be enough for React to re-render and establish WebSocket
	const startTime = Date.now();
	console.log(
		`[Memory Agent] Session ${sessionId} created at ${startTime}, waiting 500ms for subscriptions...`,
	);

	setTimeout(() => {
		console.log(
			`[Memory Agent] Session ${sessionId} starting query after ${Date.now() - startTime}ms delay`,
		);

		// Emit an initial progress event so the UI knows we started
		onProgress({
			type: "searching",
			content: "Memory Agent started, connecting to layers...",
		});

		const queryStart = Date.now();
		queryMemoryAgent(params, onProgress)
			.then((result) => {
				const queryDuration = Date.now() - queryStart;
				console.log(
					`[Memory Agent] Session ${sessionId} query completed in ${queryDuration}ms`,
				);

				// Update session status
				const session = activeSessions.get(sessionId);
				if (session) {
					session.status = result.success ? "complete" : "error";
				}

				// Small delay to ensure result subscription is ready
				// (progress subscription is already receiving events, but result
				// subscription may have different timing)
				setTimeout(() => {
					console.log(
						`[Memory Agent] Publishing result for session ${sessionId} (total time: ${Date.now() - startTime}ms)`,
					);
					// Publish the final result
					publishMemoryAgentResult({
						sessionId,
						answer: result.answer,
						confidence: result.confidence,
						citations: result.citations,
						searchedLayers: result.searchedLayers,
						success: result.success,
						error: result.error,
					});
				}, 100);

				// Clean up after a delay
				setTimeout(() => {
					activeSessions.delete(sessionId);
				}, 60000); // Keep for 1 minute
			})
			.catch((error) => {
				// Update session status
				const session = activeSessions.get(sessionId);
				if (session) {
					session.status = "error";
				}

				// Publish error
				publishMemoryAgentProgress(sessionId, "error", String(error));

				// Clean up after a delay
				setTimeout(() => {
					activeSessions.delete(sessionId);
				}, 60000);
			});
	}, 500); // 500ms delay for client to set up WebSocket subscriptions

	// Return the session ID immediately so the UI can attach
	return sessionId;
}

/**
 * Get active memory query sessions
 *
 * Returns all currently running or recently completed memory queries.
 */
export function getActiveMemorySessions(): Array<{
	sessionId: string;
	question: string;
	startedAt: number;
	status: "running" | "complete" | "error";
}> {
	return Array.from(activeSessions.entries()).map(([sessionId, data]) => ({
		sessionId,
		...data,
	}));
}

/**
 * Get a specific memory session's status
 */
export function getMemorySessionStatus(sessionId: string): {
	status: "running" | "complete" | "error" | "not_found";
} {
	const session = activeSessions.get(sessionId);
	if (!session) {
		return { status: "not_found" };
	}
	return { status: session.status };
}
