/**
 * Coordinator Service for Real-Time Updates
 *
 * This service manages the single-instance coordinator pattern:
 * 1. Tries to acquire the coordinator lock
 * 2. If coordinator, watches for JSONL file changes
 * 3. Indexes changed files into the database
 * 4. Publishes events to GraphQL subscriptions
 *
 * The coordinator pattern ensures only one instance is indexing at a time.
 */

import {
	coordinator,
	type IndexResult,
	indexer,
	initDb,
	messages,
	watcher,
} from "../db/index.ts";
import {
	type MessageEdgeData,
	publishSessionAdded,
	publishSessionMessageAdded,
	publishSessionUpdated,
} from "../graphql/pubsub.ts";

/**
 * Event types that are paired with other messages (loaded as nested fields)
 * These should NOT be published in the main message stream
 */
const PAIRED_EVENT_TYPES = new Set([
	"sentiment_analysis",
	"hook_result",
	"mcp_tool_result",
	"exposed_tool_result",
]);

/**
 * Coordinator service state
 */
interface CoordinatorState {
	isCoordinator: boolean;
	heartbeatInterval: NodeJS.Timeout | null;
	isRunning: boolean;
}

const state: CoordinatorState = {
	isCoordinator: false,
	heartbeatInterval: null,
	isRunning: false,
};

/**
 * Callback for when data is indexed
 * Publishes events to GraphQL subscriptions
 */
async function onDataIndexed(result: IndexResult): Promise<void> {
	if (result.error) {
		// Skip errored results
		return;
	}

	// Publish session events
	if (result.isNewSession) {
		// New session was created
		publishSessionAdded(result.sessionId, null);
	}

	// Always publish session updated for any change
	publishSessionUpdated(result.sessionId);

	// Publish message added events for new messages
	if (result.messagesIndexed > 0) {
		// Fetch the newly indexed messages to include in the subscription payload
		try {
			// Get the latest messages (the ones we just indexed)
			const newMessages = await messages.list({
				sessionId: result.sessionId,
				limit: result.messagesIndexed,
				// Messages are returned in ascending order, we want the latest ones
				// Offset to skip earlier messages: totalMessages - messagesIndexed
				offset: Math.max(0, result.totalMessages - result.messagesIndexed),
			});

			// Publish each message as a separate event with edge data for @appendEdge
			// Filter out paired event types that are loaded as nested fields
			for (let i = 0; i < newMessages.length; i++) {
				const msg = newMessages[i];

				// Skip paired event types - they're loaded as nested fields on other messages
				if (msg.messageType === "han_event" && msg.toolName) {
					if (PAIRED_EVENT_TYPES.has(msg.toolName)) {
						continue;
					}
				}

				const messageIndex = result.totalMessages - result.messagesIndexed + i;

				// Build the edge data for Relay @appendEdge
				const edgeData: MessageEdgeData = {
					node: {
						id: msg.id,
						timestamp: msg.timestamp,
						type: msg.messageType,
						rawJson: msg.rawJson ?? "{}",
						projectDir: "", // Project dir is on session, not message
						sessionId: result.sessionId,
						lineNumber: msg.lineNumber,
					},
					cursor: Buffer.from(`cursor:${messageIndex}`).toString("base64"),
				};

				publishSessionMessageAdded(result.sessionId, messageIndex, edgeData);
			}
		} catch (error) {
			console.error(
				`[coordinator] Failed to fetch messages for subscription:`,
				error,
			);
			// Fallback: publish without edge data (client will refetch)
			publishSessionMessageAdded(result.sessionId, -1, null);
		}
	}
}

/**
 * Start the coordinator service
 *
 * Call this when the browse server starts. This function:
 * 1. Initializes the database
 * 2. Tries to become the coordinator
 * 3. If coordinator, starts file watching and initial indexing
 */
export async function startCoordinatorService(): Promise<void> {
	if (state.isRunning) {
		console.log("[coordinator] Already running");
		return;
	}

	state.isRunning = true;

	try {
		// Initialize the database
		await initDb();
		console.log("[coordinator] Database initialized");

		// Try to acquire the coordinator lock
		state.isCoordinator = coordinator.tryAcquire();

		if (state.isCoordinator) {
			console.log("[coordinator] Acquired coordinator lock");
			await startCoordinating();
		} else {
			console.log("[coordinator] Another instance is coordinating");
			// Start polling to try to become coordinator if the current one fails
			scheduleCoordinatorCheck();
		}
	} catch (error) {
		console.error("[coordinator] Failed to start:", error);
		state.isRunning = false;
	}
}

/**
 * Start coordinating (watching and indexing)
 */
async function startCoordinating(): Promise<void> {
	// Start heartbeat to maintain lock
	const heartbeatMs = coordinator.getHeartbeatInterval() * 1000;
	state.heartbeatInterval = setInterval(() => {
		if (!coordinator.updateHeartbeat()) {
			console.error("[coordinator] Failed to update heartbeat");
			stopCoordinating();
		}
	}, heartbeatMs);

	// Perform initial full scan and index
	console.log("[coordinator] Starting full scan and index...");
	try {
		const results = await indexer.fullScanAndIndex();
		const totalSessions = results.length;
		const newSessions = results.filter((r) => r.isNewSession).length;
		const totalMessages = results.reduce(
			(sum, r) => sum + r.messagesIndexed,
			0,
		);

		console.log(
			`[coordinator] Indexed ${totalSessions} sessions (${newSessions} new), ${totalMessages} messages`,
		);

		// Publish events for indexed data
		for (const result of results) {
			// Fire and forget - don't block startup
			void onDataIndexed(result);
		}
	} catch (error) {
		console.error("[coordinator] Full scan failed:", error);
	}

	// Start the file watcher
	console.log("[coordinator] Starting file watcher...");
	const watchPath = watcher.getDefaultPath();
	const watchStarted = await watcher.start(watchPath);

	if (watchStarted) {
		console.log(`[coordinator] Watching ${watchPath} for changes`);
		// Set up periodic check for new files (the native watcher handles events)
		setupFileChangePolling();
		// Set up periodic full scan to catch any missed sessions (macOS FSEvents can miss some events)
		setupPeriodicFullScan();
	} else {
		console.error("[coordinator] Failed to start file watcher");
	}
}

/**
 * Stop coordinating
 */
function stopCoordinating(): void {
	if (state.heartbeatInterval) {
		clearInterval(state.heartbeatInterval);
		state.heartbeatInterval = null;
	}

	watcher.stop();
	coordinator.release();
	state.isCoordinator = false;
	console.log("[coordinator] Released coordinator lock");

	// Try to become coordinator again
	scheduleCoordinatorCheck();
}

/**
 * Schedule periodic check to become coordinator
 */
function scheduleCoordinatorCheck(): void {
	if (!state.isRunning) return;

	// Check every 10 seconds if we can become coordinator
	setTimeout(async () => {
		if (!state.isRunning || state.isCoordinator) return;

		state.isCoordinator = coordinator.tryAcquire();
		if (state.isCoordinator) {
			console.log("[coordinator] Acquired coordinator lock (failover)");
			await startCoordinating();
		} else {
			scheduleCoordinatorCheck();
		}
	}, 10000);
}

/**
 * Setup polling for index results from the native watcher
 * The watcher queues results that we poll and publish to GraphQL subscriptions
 */
function setupFileChangePolling(): void {
	// Poll every 500ms for watcher results
	const pollInterval = setInterval(() => {
		if (!state.isCoordinator || !state.isRunning) {
			clearInterval(pollInterval);
			return;
		}

		// Poll for index results from the native watcher's queue
		try {
			const results = watcher.pollResults();
			for (const result of results) {
				// Fire and forget - don't block polling
				void onDataIndexed(result);
			}
		} catch (_error) {
			// Silently ignore poll errors - not critical
		}
	}, 500);
}

/**
 * Setup periodic full scan to catch any missed sessions
 * macOS FSEvents can sometimes miss file creation events, especially
 * when files are created atomically (via rename) or rapidly
 */
function setupPeriodicFullScan(): void {
	// Run full scan every 30 seconds to catch missed sessions
	const scanInterval = setInterval(async () => {
		if (!state.isCoordinator || !state.isRunning) {
			clearInterval(scanInterval);
			return;
		}

		try {
			const results = await indexer.fullScanAndIndex();
			// Only publish events for newly discovered sessions
			const newSessions = results.filter((r) => r.isNewSession);
			if (newSessions.length > 0) {
				console.log(
					`[coordinator] Periodic scan found ${newSessions.length} new sessions`,
				);
				for (const result of newSessions) {
					void onDataIndexed(result);
				}
			}
		} catch (_error) {
			// Silently ignore scan errors - not critical
		}
	}, 30000);
}

/**
 * Stop the coordinator service
 */
export function stopCoordinatorService(): void {
	if (!state.isRunning) return;

	state.isRunning = false;

	if (state.isCoordinator) {
		stopCoordinating();
	}

	console.log("[coordinator] Service stopped");
}

/**
 * Check if this instance is the coordinator
 */
export function isCoordinatorInstance(): boolean {
	return state.isCoordinator;
}

/**
 * Manually trigger indexing of a file
 * Used when we detect a file change externally
 */
export async function indexFile(filePath: string): Promise<void> {
	if (!state.isCoordinator) {
		console.log("[coordinator] Not coordinator, skipping index");
		return;
	}

	try {
		const result = await indexer.indexSessionFile(filePath);
		await onDataIndexed(result);
	} catch (error) {
		console.error(`[coordinator] Failed to index ${filePath}:`, error);
	}
}
