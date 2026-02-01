/**
 * Sync Receiver API
 *
 * Server-side handler for receiving sync payloads from local han instances.
 * This module provides the logic for:
 * - Validating API keys and payloads
 * - Decompressing incoming data
 * - Upserting sessions and messages with deduplication
 * - Returning appropriate sync responses
 *
 * Note: This is the business logic layer. The actual HTTP endpoint
 * should be implemented by the hosting platform (e.g., Next.js API route).
 */

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
	SYNC_PROTOCOL_VERSION,
	type SyncError,
	type SyncMessage,
	type SyncPayload,
	type SyncResponse,
	type SyncSession,
} from "../sync/types.ts";

/**
 * Result of API key validation
 */
export interface ApiKeyValidation {
	valid: boolean;
	userId?: string;
	teamId?: string;
	error?: string;
}

/**
 * Interface for the data store (to be implemented by hosting platform)
 */
export interface SyncDataStore {
	/**
	 * Validate an API key and return associated user/team info
	 */
	validateApiKey(apiKey: string): Promise<ApiKeyValidation>;

	/**
	 * Upsert a session record
	 * Should use ON CONFLICT for deduplication
	 */
	upsertSession(
		userId: string,
		teamId: string,
		session: SyncSession,
	): Promise<{ id: string; isNew: boolean }>;

	/**
	 * Upsert messages for a session
	 * Should use composite key (session_id, message_id) for deduplication
	 */
	upsertMessages(
		sessionId: string,
		messages: SyncMessage[],
	): Promise<{ inserted: number; updated: number }>;

	/**
	 * Record sync metadata
	 */
	recordSync(
		userId: string,
		clientId: string,
		sessionsProcessed: number,
		messagesProcessed: number,
	): Promise<void>;
}

/**
 * Decompress gzipped payload
 */
export function decompressPayload(data: Buffer): SyncPayload {
	const json = gunzipSync(data).toString("utf-8");
	return JSON.parse(json) as SyncPayload;
}

/**
 * Validate payload structure and checksum
 */
export function validatePayload(payload: SyncPayload): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Check version
	if (payload.version !== SYNC_PROTOCOL_VERSION) {
		errors.push(
			`Unsupported protocol version: ${payload.version}. Expected: ${SYNC_PROTOCOL_VERSION}`,
		);
	}

	// Check required fields
	if (!payload.clientId) {
		errors.push("Missing required field: clientId");
	}
	if (!payload.userId) {
		errors.push("Missing required field: userId");
	}
	if (!payload.timestamp) {
		errors.push("Missing required field: timestamp");
	}
	if (!payload.cursor) {
		errors.push("Missing required field: cursor");
	}
	if (!Array.isArray(payload.sessions)) {
		errors.push("sessions must be an array");
	}

	// Verify checksum
	if (payload.checksum) {
		const payloadWithoutChecksum = { ...payload, checksum: undefined };
		const expectedChecksum = createHash("sha256")
			.update(JSON.stringify(payloadWithoutChecksum))
			.digest("hex");

		if (payload.checksum !== expectedChecksum) {
			errors.push("Checksum verification failed - payload may be corrupted");
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate session data
 */
function validateSession(session: SyncSession): string[] {
	const errors: string[] = [];

	if (!session.id) {
		errors.push("Session missing required field: id");
	}
	if (!session.projectSlug) {
		errors.push(`Session ${session.id}: missing projectSlug`);
	}
	if (!Array.isArray(session.messages)) {
		errors.push(`Session ${session.id}: messages must be an array`);
	}

	return errors;
}

/**
 * Process a sync payload
 */
export async function processSyncPayload(
	payload: SyncPayload,
	store: SyncDataStore,
	teamId: string,
): Promise<SyncResponse> {
	const errors: SyncError[] = [];
	let sessionsProcessed = 0;
	let messagesProcessed = 0;

	for (const session of payload.sessions) {
		try {
			// Validate session
			const validationErrors = validateSession(session);
			if (validationErrors.length > 0) {
				errors.push({
					sessionId: session.id || "unknown",
					code: "VALIDATION_ERROR",
					message: validationErrors.join("; "),
				});
				continue;
			}

			// Upsert session
			const sessionResult = await store.upsertSession(
				payload.userId,
				teamId,
				session,
			);

			// Upsert messages
			if (session.messages.length > 0) {
				const messageResult = await store.upsertMessages(
					session.id,
					session.messages,
				);
				messagesProcessed += messageResult.inserted + messageResult.updated;
			}

			sessionsProcessed++;
		} catch (error) {
			errors.push({
				sessionId: session.id,
				code: "PROCESSING_ERROR",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Record sync metadata
	await store.recordSync(
		payload.userId,
		payload.clientId,
		sessionsProcessed,
		messagesProcessed,
	);

	// Determine status
	const status: SyncResponse["status"] =
		errors.length === 0
			? "success"
			: errors.length < payload.sessions.length
				? "partial"
				: "error";

	return {
		status,
		cursor: payload.cursor,
		processed: sessionsProcessed,
		messagesProcessed,
		errors,
		serverTimestamp: new Date().toISOString(),
	};
}

/**
 * Main handler for sync requests
 * This is the entry point for the hosting platform's HTTP handler
 */
export async function handleSyncRequest(
	request: {
		body: Buffer | string;
		headers: {
			authorization?: string;
			"content-encoding"?: string;
			"x-han-client-id"?: string;
			"x-han-protocol-version"?: string;
		};
	},
	store: SyncDataStore,
): Promise<{
	status: number;
	body: SyncResponse | { error: string };
	headers: Record<string, string>;
}> {
	const responseHeaders: Record<string, string> = {
		"Content-Type": "application/json",
	};

	try {
		// Extract and validate API key
		const authHeader = request.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			return {
				status: 401,
				body: { error: "Missing or invalid authorization header" },
				headers: responseHeaders,
			};
		}

		const apiKey = authHeader.slice(7); // Remove "Bearer " prefix
		const keyValidation = await store.validateApiKey(apiKey);

		if (!keyValidation.valid) {
			return {
				status: 401,
				body: { error: keyValidation.error ?? "Invalid API key" },
				headers: responseHeaders,
			};
		}

		// Parse payload
		let payload: SyncPayload;
		const body =
			typeof request.body === "string"
				? Buffer.from(request.body)
				: request.body;

		if (request.headers["content-encoding"] === "gzip") {
			payload = decompressPayload(body);
		} else {
			payload = JSON.parse(body.toString("utf-8")) as SyncPayload;
		}

		// Validate payload structure
		const validation = validatePayload(payload);
		if (!validation.valid) {
			return {
				status: 400,
				body: { error: `Invalid payload: ${validation.errors.join("; ")}` },
				headers: responseHeaders,
			};
		}

		// Process the payload
		const response = await processSyncPayload(
			payload,
			store,
			keyValidation.teamId ?? keyValidation.userId!,
		);

		// Determine HTTP status code
		const httpStatus =
			response.status === "success"
				? 200
				: response.status === "partial"
					? 207 // Multi-Status
					: 422; // Unprocessable Entity

		return {
			status: httpStatus,
			body: response,
			headers: responseHeaders,
		};
	} catch (error) {
		console.error("Sync request error:", error);

		return {
			status: 500,
			body: {
				error:
					error instanceof Error
						? error.message
						: "Internal server error during sync",
			},
			headers: responseHeaders,
		};
	}
}

/**
 * Example data store implementation using SQLite
 * This shows the expected interface - actual implementation depends on hosting platform
 */
export const createMockDataStore = (): SyncDataStore => ({
	async validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
		// In real implementation, look up API key in database
		if (apiKey.startsWith("han_")) {
			return {
				valid: true,
				userId: "user-123",
				teamId: "team-456",
			};
		}
		return { valid: false, error: "Invalid API key format" };
	},

	async upsertSession(
		userId: string,
		teamId: string,
		session: SyncSession,
	): Promise<{ id: string; isNew: boolean }> {
		// In real implementation, INSERT ... ON CONFLICT DO UPDATE
		console.log(`Upserting session ${session.id} for team ${teamId}`);
		return { id: session.id, isNew: true };
	},

	async upsertMessages(
		sessionId: string,
		messages: SyncMessage[],
	): Promise<{ inserted: number; updated: number }> {
		// In real implementation, batch INSERT ... ON CONFLICT DO UPDATE
		console.log(`Upserting ${messages.length} messages for session ${sessionId}`);
		return { inserted: messages.length, updated: 0 };
	},

	async recordSync(
		userId: string,
		clientId: string,
		sessionsProcessed: number,
		messagesProcessed: number,
	): Promise<void> {
		// In real implementation, insert into sync_history table
		console.log(
			`Recorded sync: user=${userId}, client=${clientId}, sessions=${sessionsProcessed}, messages=${messagesProcessed}`,
		);
	},
});
