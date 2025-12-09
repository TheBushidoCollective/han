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
 * Start a new session or resume an existing one
 */
export async function startSession(sessionId?: string): Promise<string> {
	const storage = getStorage();

	// JSONL storage doesn't need retry logic - atomic appends
	const result = storage.startSession(sessionId);

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
