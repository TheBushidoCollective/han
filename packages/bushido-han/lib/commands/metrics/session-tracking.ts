import { MetricsStorage } from "../../metrics/storage.js";

/**
 * Lazy-load storage to avoid native binding issues in CI
 */
let storageInstance: MetricsStorage | null = null;
function getStorage(): MetricsStorage {
	if (!storageInstance) {
		storageInstance = new MetricsStorage();

		// Ensure clean shutdown on process exit
		const cleanup = () => {
			if (storageInstance) {
				storageInstance.close();
				storageInstance = null;
			}
		};

		process.on("exit", cleanup);
		process.on("SIGINT", cleanup);
		process.on("SIGTERM", cleanup);
	}
	return storageInstance;
}

/**
 * Start a new session or resume an existing one
 */
export async function startSession(sessionId?: string): Promise<string> {
	const storage = getStorage();

	// Retry logic for database locks
	let lastError: Error | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const result = storage.startSession(sessionId);

			// Output JSON for programmatic consumption
			console.log(
				JSON.stringify({
					session_id: result.session_id,
					resumed: result.resumed,
				}),
			);

			return result.session_id;
		} catch (error) {
			lastError = error as Error;
			if (
				error instanceof Error &&
				error.message.includes("database is locked")
			) {
				// Wait before retry (exponential backoff)
				await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
				continue;
			}
			// Not a lock error, rethrow immediately
			throw error;
		}
	}

	// All retries failed
	throw new Error(`Failed after 3 attempts: ${lastError?.message}`);
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
