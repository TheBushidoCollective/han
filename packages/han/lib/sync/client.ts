/**
 * Sync Client
 *
 * Main client for syncing data to the team platform.
 * Handles:
 * - Payload building and compression
 * - HTTP transport with authentication
 * - Response handling and cursor updates
 * - Error handling with retry logic
 */

import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { getSyncConfig, isSyncEnabled } from "../config/han-settings.ts";
import { calculateDelta, calculateSessionOnlyDelta, getSyncStatus } from "./delta.ts";
import { getQueueManager } from "./queue.ts";
import {
	DEFAULT_SYNC_CONFIG,
	SYNC_PROTOCOL_VERSION,
	type SyncConfig,
	type SyncPayload,
	type SyncResponse,
	type SyncResult,
} from "./types.ts";

/**
 * Build sync payload from delta calculation
 */
export function buildSyncPayload(
	delta: Awaited<ReturnType<typeof calculateDelta>>,
	config: SyncConfig,
	userId: string,
): SyncPayload {
	const queueManager = getQueueManager();

	const payload: SyncPayload = {
		version: SYNC_PROTOCOL_VERSION,
		clientId: queueManager.getClientId(),
		userId,
		timestamp: new Date().toISOString(),
		cursor: delta.newCursor,
		sessions: delta.sessions,
		checksum: "", // Will be computed after serialization
	};

	// Compute checksum of the payload (excluding checksum field itself)
	const payloadWithoutChecksum = { ...payload, checksum: undefined };
	payload.checksum = createHash("sha256")
		.update(JSON.stringify(payloadWithoutChecksum))
		.digest("hex");

	return payload;
}

/**
 * Compress payload using gzip
 */
export function compressPayload(payload: SyncPayload): Buffer {
	const json = JSON.stringify(payload);
	return gzipSync(Buffer.from(json, "utf-8"), { level: 6 });
}

/**
 * Decompress response
 */
export function decompressResponse(data: Buffer): SyncResponse {
	const json = gunzipSync(data).toString("utf-8");
	return JSON.parse(json) as SyncResponse;
}

/**
 * Send sync payload to the server
 */
async function sendSyncRequest(
	endpoint: string,
	apiKey: string,
	payload: SyncPayload,
	useCompression: boolean,
): Promise<{ response: SyncResponse; bytesTransferred: number }> {
	const compressedBody = useCompression ? compressPayload(payload) : null;
	const jsonBody = useCompression ? null : JSON.stringify(payload);

	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
		"X-Han-Client-Id": payload.clientId,
		"X-Han-Protocol-Version": SYNC_PROTOCOL_VERSION,
	};

	if (useCompression) {
		headers["Content-Encoding"] = "gzip";
		headers["Accept-Encoding"] = "gzip";
	}

	// Use Uint8Array for compressed body (compatible with fetch), string for JSON
	const body = useCompression
		? new Uint8Array(compressedBody!)
		: jsonBody!;

	const response = await fetch(endpoint, {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Sync request failed: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	// Handle compressed or uncompressed response
	const contentEncoding = response.headers.get("Content-Encoding");
	let syncResponse: SyncResponse;

	if (contentEncoding === "gzip") {
		const buffer = Buffer.from(await response.arrayBuffer());
		syncResponse = decompressResponse(buffer);
	} else {
		syncResponse = (await response.json()) as SyncResponse;
	}

	const bytesTransferred = useCompression
		? compressedBody!.length
		: Buffer.from(jsonBody!, "utf-8").length;

	return {
		response: syncResponse,
		bytesTransferred,
	};
}

/**
 * Main sync operation
 */
export async function sync(
	options: {
		sessionId?: string;
		userId?: string;
		force?: boolean;
	} = {},
): Promise<SyncResult> {
	const startTime = Date.now();

	// Check if sync is enabled
	if (!options.force && !isSyncEnabled()) {
		return {
			success: false,
			sessionsProcessed: 0,
			messagesProcessed: 0,
			bytesTransferred: 0,
			durationMs: Date.now() - startTime,
			error: "Sync is not enabled. Configure sync in han.yml or via environment variables.",
		};
	}

	// Get config
	const configFromSettings = getSyncConfig();
	const config: SyncConfig = {
		...DEFAULT_SYNC_CONFIG,
		...configFromSettings,
	};

	if (!config.endpoint) {
		return {
			success: false,
			sessionsProcessed: 0,
			messagesProcessed: 0,
			bytesTransferred: 0,
			durationMs: Date.now() - startTime,
			error: "Sync endpoint not configured. Set sync.endpoint in han.yml or HAN_SYNC_ENDPOINT.",
		};
	}

	if (!config.apiKey) {
		return {
			success: false,
			sessionsProcessed: 0,
			messagesProcessed: 0,
			bytesTransferred: 0,
			durationMs: Date.now() - startTime,
			error: "Sync API key not configured. Set sync.apiKey in han.yml or HAN_SYNC_API_KEY.",
		};
	}

	const queueManager = getQueueManager();

	// Prevent concurrent sync operations
	if (!queueManager.setProcessing(true)) {
		return {
			success: false,
			sessionsProcessed: 0,
			messagesProcessed: 0,
			bytesTransferred: 0,
			durationMs: Date.now() - startTime,
			error: "Another sync operation is in progress.",
		};
	}

	try {
		// Calculate delta
		const delta = options.sessionId
			? await calculateSessionOnlyDelta(options.sessionId, config)
			: await calculateDelta(config);

		// Nothing to sync
		if (delta.sessions.length === 0) {
			queueManager.setProcessing(false);
			return {
				success: true,
				sessionsProcessed: 0,
				messagesProcessed: 0,
				bytesTransferred: 0,
				durationMs: Date.now() - startTime,
			};
		}

		// Build and send payload
		const payload = buildSyncPayload(delta, config, options.userId ?? "unknown");
		const { response, bytesTransferred } = await sendSyncRequest(
			config.endpoint,
			config.apiKey,
			payload,
			config.compression,
		);

		// Handle response
		if (response.status === "success" || response.status === "partial") {
			// Update cursors for successfully processed sessions
			for (const session of delta.sessions) {
				const lastMessage = session.messages[session.messages.length - 1];
				if (lastMessage) {
					queueManager.updateSessionCursor(session.id, {
						lastSessionId: session.id,
						lastMessageLineNumber: lastMessage.lineNumber,
						lastSyncTimestamp: new Date().toISOString(),
					});
				}
			}

			// Update global cursor
			queueManager.updateCursor(delta.newCursor);

			// Update stats
			queueManager.incrementSynced(delta.newMessageCount);
			queueManager.recordSyncDuration(Date.now() - startTime);
		}

		const durationMs = Date.now() - startTime;
		queueManager.setProcessing(false);

		return {
			success: response.status === "success",
			sessionsProcessed: response.processed,
			messagesProcessed: response.messagesProcessed,
			bytesTransferred,
			durationMs,
			response,
			error:
				response.status === "error"
					? response.errors.map((e) => e.message).join("; ")
					: undefined,
		};
	} catch (error) {
		queueManager.setProcessing(false);

		return {
			success: false,
			sessionsProcessed: 0,
			messagesProcessed: 0,
			bytesTransferred: 0,
			durationMs: Date.now() - startTime,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Process the sync queue
 * Processes items in priority order with retry logic
 */
export async function processQueue(
	options: { userId?: string; maxItems?: number } = {},
): Promise<{
	processed: number;
	succeeded: number;
	failed: number;
	errors: string[];
}> {
	const queueManager = getQueueManager();
	const maxItems = options.maxItems ?? 10;

	let processed = 0;
	let succeeded = 0;
	let failed = 0;
	const errors: string[] = [];

	while (processed < maxItems) {
		const item = queueManager.getNextReady();
		if (!item) break;

		queueManager.markInProgress(item.id);
		processed++;

		try {
			const result = await sync({
				sessionId: item.sessionId,
				userId: options.userId,
			});

			if (result.success) {
				queueManager.markCompleted(item.id);
				succeeded++;
			} else {
				queueManager.markFailed(item.id, result.error ?? "Unknown error");
				failed++;
				errors.push(`${item.sessionId}: ${result.error}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			queueManager.markFailed(item.id, errorMessage);
			failed++;
			errors.push(`${item.sessionId}: ${errorMessage}`);
		}
	}

	return { processed, succeeded, failed, errors };
}

/**
 * Get current sync status
 */
export async function getStatus(): Promise<{
	enabled: boolean;
	configured: boolean;
	endpoint: string | null;
	queueSize: number;
	pendingSessions: number;
	pendingMessages: number;
	lastSyncTime: string | null;
	eligibleSessions: number;
	excludedSessions: number;
	stats: ReturnType<typeof getQueueManager>["getStats"] extends () => infer R
		? R
		: never;
}> {
	const enabled = isSyncEnabled();
	const configFromSettings = getSyncConfig();

	const config: SyncConfig = {
		...DEFAULT_SYNC_CONFIG,
		...configFromSettings,
	};

	const queueManager = getQueueManager();
	const status = await getSyncStatus(config);

	return {
		enabled,
		configured: Boolean(config.endpoint && config.apiKey),
		endpoint: config.endpoint || null,
		queueSize: queueManager.getPendingCount(),
		pendingSessions: status.pendingSessions,
		pendingMessages: status.pendingMessages,
		lastSyncTime: status.lastSyncTime,
		eligibleSessions: status.eligibleSessions,
		excludedSessions: status.excludedSessions,
		stats: queueManager.getStats(),
	};
}

/**
 * Trigger sync for a specific session (high priority)
 */
export function enqueueSyncSession(sessionId: string): void {
	const queueManager = getQueueManager();
	queueManager.enqueue(sessionId, "high");
}

/**
 * Trigger sync for all pending sessions
 */
export async function enqueuePendingSessions(): Promise<number> {
	if (!isSyncEnabled()) {
		return 0;
	}

	const configFromSettings = getSyncConfig();
	const config: SyncConfig = {
		...DEFAULT_SYNC_CONFIG,
		...configFromSettings,
	};

	const status = await getSyncStatus(config);
	const queueManager = getQueueManager();

	// Calculate delta to find sessions with pending data
	const delta = await calculateDelta(config);

	let enqueued = 0;
	for (const session of delta.sessions) {
		queueManager.enqueue(session.id, "normal");
		enqueued++;
	}

	return enqueued;
}
