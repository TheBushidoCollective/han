/**
 * PubSub Module for GraphQL Subscriptions
 *
 * Simple event emitter for broadcasting events to GraphQL subscribers.
 */

import { basename } from "node:path";
import type { MemoryEvent } from "../types.ts";

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

		console.log(`[PubSub] Creating async iterator for topic: ${topic}`);

		const unsubscribe = this.subscribe<T>(topic, (data) => {
			console.log(`[PubSub] AsyncIterator received data for ${topic}:`, data);
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
	console.log(
		`[PubSub] Publishing ${TOPICS.MEMORY_AGENT_PROGRESS} for session ${sessionId}:`,
		type,
		content,
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
	console.log(
		`[PubSub] Publishing ${TOPICS.MEMORY_AGENT_RESULT} for session ${result.sessionId}:`,
		result.success ? "success" : "error",
		result.answer?.slice(0, 50),
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
