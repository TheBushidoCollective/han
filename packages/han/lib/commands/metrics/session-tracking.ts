import { readFileSync } from "node:fs";
import { JsonlMetricsStorage } from "../../metrics/jsonl-storage.ts";

/**
 * Get storage instance (no cleanup needed for JSONL)
 */
let storageInstance: JsonlMetricsStorage | null = null;
function getStorage(): JsonlMetricsStorage {
	if (!storageInstance) {
		storageInstance = new JsonlMetricsStorage();
	}
	return storageInstance;
}

/**
 * Read session_id from stdin (piped from Claude Code via dispatch)
 */
function getSessionIdFromStdin(): string | undefined {
	try {
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			const parsed = JSON.parse(stdin);
			return typeof parsed?.session_id === "string"
				? parsed.session_id
				: undefined;
		}
	} catch {
		// stdin not available or not valid JSON - this is fine
	}
	return undefined;
}

/**
 * Start a new session or resume an existing one
 * Reads session_id from stdin (piped from Claude Code via dispatch)
 */
export async function startSession(sessionId?: string): Promise<string> {
	const storage = getStorage();

	// Try to get session_id from stdin if not provided (piped from Claude Code via dispatch)
	const effectiveSessionId = sessionId || getSessionIdFromStdin();

	// JSONL storage doesn't need retry logic - atomic appends
	const result = storage.startSession(effectiveSessionId);

	// Output JSON for programmatic consumption
	console.log(
		JSON.stringify({
			session_id: result.session_id,
			resumed: result.resumed,
		}),
	);

	return result.session_id;
}

/**
 * End the current session
 */
export async function endSession(sessionId?: string): Promise<void> {
	const storage = getStorage();

	// If no session ID provided, use current active session
	let targetSessionId = sessionId;
	if (!targetSessionId) {
		const current = storage.getCurrentSession();
		if (!current) {
			console.error("No active session to end");
			process.exit(1);
		}
		targetSessionId = current.session_id;
	}

	storage.endSession(targetSessionId);

	console.log(
		JSON.stringify({
			success: true,
			session_id: targetSessionId,
		}),
	);
}

/**
 * Get the current active session
 */
export async function getCurrentSession(): Promise<void> {
	const storage = getStorage();
	const result = storage.getCurrentSession();

	if (result) {
		console.log(JSON.stringify(result));
	} else {
		console.log(JSON.stringify({ session_id: null }));
	}
}
