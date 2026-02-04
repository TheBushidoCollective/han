/**
 * PubSub Module for GraphQL Subscriptions
 *
 * Simple event emitter for broadcasting events to GraphQL subscribers.
 */

import { basename } from "node:path";
import { createLogger } from "../logger.ts";

const log = createLogger("pubsub");

import type { MemoryEvent } from "../commands/browse/types.ts";

/**
 * Subscription topic names
 */
export const TOPICS = {
	// Legacy topics
	MEMORY_UPDATED: "memory:updated",
	METRICS_UPDATED: "metrics:updated",
	// Node-based subscriptions
	NODE_UPDATED: "node:updated",
	SESSION_UPDATED: "session:updated",
	SESSION_MESSAGE_ADDED: "session:message:added",
	SESSION_ADDED: "session:added",
	REPO_ADDED: "repo:added",
	PROJECT_ADDED: "project:added",
	REPO_MEMORY_ADDED: "repo:memory:added",
	// Memory Agent subscriptions
	MEMORY_AGENT_PROGRESS: "memory:agent:progress",
	MEMORY_AGENT_RESULT: "memory:agent:result",
	// Tool result subscriptions
	TOOL_RESULT_ADDED: "tool:result:added",
	// Hook result subscriptions (for paired hook_run/hook_result events)
	HOOK_RESULT_ADDED: "hook:result:added",
	// Session todos subscription
	SESSION_TODOS_CHANGED: "session:todos:changed",
	// Session file changes subscription
	SESSION_FILES_CHANGED: "session:files:changed",
	// Session hooks subscription
	SESSION_HOOKS_CHANGED: "session:hooks:changed",
	// Async hook result subscriptions (for PostToolUse validation hooks)
	ASYNC_HOOK_RESULT: "async:hook:result",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

/**
 * Subscriber callback function
 */
type Subscriber<T> = (data: T) => void;

/**
 * Simple PubSub implementation
 */
class PubSub {
	private subscribers: Map<string, Set<Subscriber<unknown>>> = new Map();

	/**
	 * Subscribe to a topic
	 */
	subscribe<T>(topic: string, callback: Subscriber<T>): () => void {
		if (!this.subscribers.has(topic)) {
			this.subscribers.set(topic, new Set());
		}
		const subscribers = this.subscribers.get(topic);
		subscribers?.add(callback as Subscriber<unknown>);

		// Return unsubscribe function
		return () => {
			this.subscribers.get(topic)?.delete(callback as Subscriber<unknown>);
		};
	}

	/**
	 * Publish an event to a topic
	 */
	publish<T>(topic: string, data: T): void {
		const topicSubscribers = this.subscribers.get(topic);
		if (topicSubscribers) {
			for (const subscriber of topicSubscribers) {
				try {
					subscriber(data);
				} catch {
					// Ignore subscriber errors
				}
			}
		}
	}

	/**
	 * Create an async iterator for subscriptions
	 */
	asyncIterator<T>(topic: string): AsyncIterableIterator<T> {
		const queue: T[] = [];
		let resolveWait: ((value: IteratorResult<T>) => void) | null = null;
		let isComplete = false;

		const unsubscribe = this.subscribe<T>(topic, (data) => {
			if (resolveWait) {
				resolveWait({ value: data, done: false });
				resolveWait = null;
			} else {
				queue.push(data);
			}
		});

		return {
			next(): Promise<IteratorResult<T>> {
				if (isComplete) {
					return Promise.resolve({ value: undefined as T, done: true });
				}

				const queuedValue = queue.shift();
				if (queuedValue !== undefined) {
					return Promise.resolve({ value: queuedValue, done: false });
				}

				return new Promise((resolve) => {
					resolveWait = resolve;
				});
			},

			return(): Promise<IteratorResult<T>> {
				isComplete = true;
				unsubscribe();
				return Promise.resolve({ value: undefined as T, done: true });
			},

			throw(error: Error): Promise<IteratorResult<T>> {
				isComplete = true;
				unsubscribe();
				return Promise.reject(error);
			},

			[Symbol.asyncIterator]() {
				return this;
			},
		};
	}
}

/**
 * Global PubSub instance
 */
export const pubsub = new PubSub();

/**
 * Subscription event payloads
 */
export interface NodeUpdatedPayload {
	id: string;
	typename: string;
}

export interface SessionUpdatedPayload {
	sessionId: string;
}

/**
 * Edge data for appending messages via Relay @appendEdge
 */
export interface MessageEdgeData {
	node: {
		id: string;
		timestamp: string;
		type: string;
		rawJson: string;
		// Additional fields will be resolved by GraphQL type resolvers
		projectDir: string;
		sessionId: string;
		lineNumber: number;
		// For han_event messages, toolName determines the concrete type (hook_run, etc.)
		toolName?: string;
	};
	cursor: string;
}

export interface SessionMessageAddedPayload {
	sessionId: string;
	messageIndex: number;
	/** The new message edge for @appendEdge directive */
	newMessageEdge: MessageEdgeData | null;
}

export interface SessionAddedPayload {
	sessionId: string;
	parentId: string | null; // projectId or null for global
}

export interface RepoAddedPayload {
	repoId: string;
}

export interface ProjectAddedPayload {
	projectId: string;
	parentId: string | null; // repoId or null for non-git projects
}

export interface RepoMemoryAddedPayload {
	repoId: string;
	domain: string;
	path: string;
}

/**
 * Memory Agent progress update
 */
export interface MemoryAgentProgressPayload {
	sessionId: string;
	type: "searching" | "found" | "synthesizing" | "complete" | "error";
	layer?: string;
	content: string;
	resultCount?: number;
	timestamp: number;
}

/**
 * Memory Agent final result
 */
export interface MemoryAgentResultPayload {
	sessionId: string;
	answer: string;
	confidence: "high" | "medium" | "low";
	citations: Array<{
		source: string;
		excerpt: string;
		author?: string;
		timestamp?: number;
		browseUrl?: string;
	}>;
	searchedLayers: string[];
	success: boolean;
	error?: string;
}

/**
 * Tool result added payload
 * Emitted when an MCP or exposed tool result is received
 */
export interface ToolResultAddedPayload {
	sessionId: string;
	callId: string;
	type: "mcp" | "exposed";
	success: boolean;
	durationMs: number;
}

/**
 * Hook result added payload
 * Emitted when a hook_result event is received, correlating with its parent hook_run
 */
export interface HookResultAddedPayload {
	sessionId: string;
	/** UUID of the parent hook_run event */
	hookRunId: string;
	pluginName: string;
	hookName: string;
	success: boolean;
	durationMs: number;
}

/**
 * Session todos changed payload
 * Emitted when a TodoWrite tool call is detected in new messages
 */
export interface SessionTodosChangedPayload {
	sessionId: string;
	/** Count of todos after the change */
	todoCount: number;
	/** Count of in-progress todos */
	inProgressCount: number;
	/** Count of completed todos */
	completedCount: number;
}

/**
 * Session files changed payload
 * Emitted when file-modifying tool calls are detected (Edit, Write, etc.)
 */
export interface SessionFilesChangedPayload {
	sessionId: string;
	/** Count of file changes */
	fileCount: number;
	/** Name of the tool that triggered the change */
	toolName: string;
}

/**
 * Session hooks changed payload
 * Emitted when hook_run or hook_result events are detected
 */
export interface SessionHooksChangedPayload {
	sessionId: string;
	/** Plugin name of the hook */
	pluginName: string;
	/** Hook name */
	hookName: string;
	/** Whether this is a new run or a result update */
	eventType: "run" | "result";
}

/**
 * Async hook result payload
 * Emitted when an async PostToolUse hook completes execution
 * Used by `han hook run --async` to receive results via WebSocket
 */
export interface AsyncHookResultPayload {
	/** Unique hook execution ID (from async_hook_queued event) */
	hookId: string;
	/** Session ID */
	sessionId: string;
	/** Plugin name */
	pluginName: string;
	/** Hook name */
	hookName: string;
	/** Whether the hook succeeded */
	success: boolean;
	/** Duration in milliseconds */
	durationMs: number;
	/** Output from the hook (stdout) */
	output?: string;
	/** Error output (stderr) */
	error?: string;
	/** Exit code */
	exitCode: number;
	/** Whether the hook was cancelled (e.g., due to deduplication) */
	cancelled?: boolean;
}

/**
 * Extract session ID from a file path
 * e.g., /Users/.../.claude/projects/slug/abc123.jsonl -> abc123
 */
function extractSessionIdFromPath(filePath: string): string | null {
	const filename = basename(filePath);
	if (filename.endsWith(".jsonl")) {
		return filename.slice(0, -6); // Remove .jsonl extension
	}
	return null;
}

/**
 * Publish a memory event (called from file watcher or server broadcast)
 */
export function publishMemoryEvent(event: MemoryEvent): void {
	pubsub.publish(TOPICS.MEMORY_UPDATED, event);

	// Also publish to new topics based on event type
	if (event.type === "session") {
		const sessionId = extractSessionIdFromPath(event.path);
		if (sessionId) {
			if (event.action === "created") {
				const payload: SessionAddedPayload = {
					sessionId: event.path,
					parentId: null,
				};
				pubsub.publish(TOPICS.SESSION_ADDED, payload);
			}

			// Publish session updated for any session change (created, updated, deleted)
			// This allows subscriptions to receive fresh session data
			publishSessionUpdated(sessionId);

			// Publish message added event for session updates (new messages)
			// Use -1 as index since we don't know the exact message index
			// Client will refetch to get new messages
			if (event.action === "updated") {
				publishSessionMessageAdded(sessionId, -1);
			}

			// Also publish node updated for legacy compatibility
			const globalId = `Session_${sessionId}`;
			publishNodeUpdated(globalId, "Session");
		}
	}
}

/**
 * Publish node updated event
 */
export function publishNodeUpdated(id: string, typename: string): void {
	const payload: NodeUpdatedPayload = { id, typename };
	pubsub.publish(TOPICS.NODE_UPDATED, payload);
}

/**
 * Publish session updated event
 */
export function publishSessionUpdated(sessionId: string): void {
	const payload: SessionUpdatedPayload = { sessionId };
	pubsub.publish(TOPICS.SESSION_UPDATED, payload);
}

/**
 * Publish session message added event
 * @param sessionId - The session ID
 * @param messageIndex - Index of the new message
 * @param newMessageEdge - Optional edge data for @appendEdge (when available from indexer)
 */
export function publishSessionMessageAdded(
	sessionId: string,
	messageIndex: number,
	newMessageEdge?: MessageEdgeData | null,
): void {
	const payload: SessionMessageAddedPayload = {
		sessionId,
		messageIndex,
		newMessageEdge: newMessageEdge ?? null,
	};
	pubsub.publish(TOPICS.SESSION_MESSAGE_ADDED, payload);
}

/**
 * Publish session added event
 */
export function publishSessionAdded(
	sessionId: string,
	parentId: string | null,
): void {
	const payload: SessionAddedPayload = { sessionId, parentId };
	pubsub.publish(TOPICS.SESSION_ADDED, payload);
}

/**
 * Publish repo added event
 */
export function publishRepoAdded(repoId: string): void {
	const payload: RepoAddedPayload = { repoId };
	pubsub.publish(TOPICS.REPO_ADDED, payload);
}

/**
 * Publish project added event
 */
export function publishProjectAdded(
	projectId: string,
	parentId: string | null,
): void {
	const payload: ProjectAddedPayload = { projectId, parentId };
	pubsub.publish(TOPICS.PROJECT_ADDED, payload);
}

/**
 * Publish repo memory added event
 */
export function publishRepoMemoryAdded(
	repoId: string,
	domain: string,
	path: string,
): void {
	const payload: RepoMemoryAddedPayload = { repoId, domain, path };
	pubsub.publish(TOPICS.REPO_MEMORY_ADDED, payload);
}

/**
 * Publish Memory Agent progress event
 *
 * Used to stream progress updates from the Memory Agent to the Browse UI.
 */
export function publishMemoryAgentProgress(
	sessionId: string,
	type: MemoryAgentProgressPayload["type"],
	content: string,
	options?: { layer?: string; resultCount?: number },
): void {
	const payload: MemoryAgentProgressPayload = {
		sessionId,
		type,
		content,
		layer: options?.layer,
		resultCount: options?.resultCount,
		timestamp: Date.now(),
	};
	log.debug(
		`Publishing ${TOPICS.MEMORY_AGENT_PROGRESS} for session ${sessionId}:`,
		type,
	);
	pubsub.publish(TOPICS.MEMORY_AGENT_PROGRESS, payload);
}

/**
 * Publish Memory Agent final result
 *
 * Used to notify the Browse UI when a Memory Agent query is complete.
 */
export function publishMemoryAgentResult(
	result: MemoryAgentResultPayload,
): void {
	log.debug(
		`Publishing ${TOPICS.MEMORY_AGENT_RESULT} for session ${result.sessionId}:`,
		result.success ? "success" : "error",
	);
	pubsub.publish(TOPICS.MEMORY_AGENT_RESULT, result);
}

/**
 * Publish tool result added event
 *
 * Called when an MCP or exposed tool result is received, allowing
 * subscribed UI components to refetch their data.
 */
export function publishToolResultAdded(
	sessionId: string,
	callId: string,
	type: "mcp" | "exposed",
	success: boolean,
	durationMs: number,
): void {
	const payload: ToolResultAddedPayload = {
		sessionId,
		callId,
		type,
		success,
		durationMs,
	};
	pubsub.publish(TOPICS.TOOL_RESULT_ADDED, payload);
}

/**
 * Publish hook result added event
 *
 * Called when a hook_result event is received, allowing
 * subscribed UI components to update the corresponding hook_run message.
 */
export function publishHookResultAdded(
	sessionId: string,
	hookRunId: string,
	pluginName: string,
	hookName: string,
	success: boolean,
	durationMs: number,
): void {
	const payload: HookResultAddedPayload = {
		sessionId,
		hookRunId,
		pluginName,
		hookName,
		success,
		durationMs,
	};
	pubsub.publish(TOPICS.HOOK_RESULT_ADDED, payload);
}

/**
 * Publish session todos changed event
 *
 * Called when a TodoWrite tool call is detected, allowing
 * subscribed UI components to refetch the session's todos.
 */
export function publishSessionTodosChanged(
	sessionId: string,
	todoCount: number,
	inProgressCount: number,
	completedCount: number,
): void {
	const payload: SessionTodosChangedPayload = {
		sessionId,
		todoCount,
		inProgressCount,
		completedCount,
	};
	pubsub.publish(TOPICS.SESSION_TODOS_CHANGED, payload);
}

/**
 * Publish session files changed event
 *
 * Called when file-modifying tool calls are detected (Edit, Write, etc.),
 * allowing subscribed UI components to refetch the session's file changes.
 */
export function publishSessionFilesChanged(
	sessionId: string,
	fileCount: number,
	toolName: string,
): void {
	const payload: SessionFilesChangedPayload = {
		sessionId,
		fileCount,
		toolName,
	};
	pubsub.publish(TOPICS.SESSION_FILES_CHANGED, payload);
}

/**
 * Publish session hooks changed event
 *
 * Called when hook_run or hook_result events are detected,
 * allowing subscribed UI components to refetch the session's hook stats.
 */
export function publishSessionHooksChanged(
	sessionId: string,
	pluginName: string,
	hookName: string,
	eventType: "run" | "result",
): void {
	const payload: SessionHooksChangedPayload = {
		sessionId,
		pluginName,
		hookName,
		eventType,
	};
	pubsub.publish(TOPICS.SESSION_HOOKS_CHANGED, payload);
}

/**
 * Publish async hook result event
 *
 * Called by the coordinator when an async PostToolUse hook completes.
 * The `han hook run --async` command subscribes to this topic to receive
 * results and return the appropriate JSON to Claude Code.
 */
export function publishAsyncHookResult(result: AsyncHookResultPayload): void {
	log.debug(
		`Publishing ${TOPICS.ASYNC_HOOK_RESULT} for hook ${result.hookId}:`,
		result.success ? "success" : "failure",
	);
	pubsub.publish(TOPICS.ASYNC_HOOK_RESULT, result);
}

/**
 * Create an async iterator for async hook results
 * Used by `han hook run --async` to subscribe to results
 */
export function subscribeAsyncHookResult(
	hookId: string,
): AsyncIterableIterator<AsyncHookResultPayload> {
	// Create a filtered iterator that only returns results for the specific hookId
	const baseIterator = pubsub.asyncIterator<AsyncHookResultPayload>(
		TOPICS.ASYNC_HOOK_RESULT,
	);

	return {
		async next(): Promise<IteratorResult<AsyncHookResultPayload>> {
			// Keep pulling from base iterator until we get our hook's result
			while (true) {
				const result = await baseIterator.next();
				if (result.done) {
					return result;
				}
				if (result.value.hookId === hookId) {
					return result;
				}
				// Skip results for other hooks
			}
		},

		return(): Promise<IteratorResult<AsyncHookResultPayload>> {
			return baseIterator.return?.() ?? Promise.resolve({ value: undefined as unknown as AsyncHookResultPayload, done: true });
		},

		throw(error: Error): Promise<IteratorResult<AsyncHookResultPayload>> {
			return baseIterator.throw?.(error) ?? Promise.reject(error);
		},

		[Symbol.asyncIterator]() {
			return this;
		},
	};
}
