/**
 * Memory session end command
 *
 * Called from Stop hook to summarize session and store observations
 */

import { readFileSync } from "node:fs";
import { getMemoryStore, summarizeSession } from "../../memory/index.ts";
import { indexObservations } from "../../memory/indexer.ts";

/**
 * Check if stdin has data available without blocking
 */
function hasStdinData(): boolean {
	try {
		// In a TTY, stdin is interactive - never try to read
		if (process.stdin.isTTY) {
			return false;
		}
		// For piped stdin, check if there's data available
		if (process.stdin.readable && process.stdin.readableLength > 0) {
			return true;
		}
		// Check if stdin is a file (not a pipe/FIFO)
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		// Only read from actual files, not pipes/FIFOs (which would block)
		if (stat.isFile()) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Read session_id from stdin (piped from Claude Code via dispatch)
 */
function getSessionIdFromStdin(): string | undefined {
	try {
		// Only read if stdin has data available
		if (!hasStdinData()) {
			return undefined;
		}
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
 * End session and create summary
 *
 * Reads session_id from stdin (piped from Claude Code via dispatch)
 */
export async function endSessionWithSummary(sessionId?: string): Promise<void> {
	const store = getMemoryStore();

	// Try to get session_id from stdin if not provided
	const effectiveSessionId = sessionId || getSessionIdFromStdin();

	if (!effectiveSessionId) {
		// No session ID - nothing to summarize
		console.log(
			JSON.stringify({
				success: false,
				error: "No session ID provided",
			}),
		);
		return;
	}

	// Create summary from observations
	const summary = summarizeSession(effectiveSessionId, store, {
		autoStore: true,
	});

	// Index the session's observations into FTS
	let indexedCount = 0;
	try {
		indexedCount = await indexObservations(effectiveSessionId);
	} catch {
		// Indexing failure should not block session end
		// Observations are still stored in JSONL files
	}

	if (summary) {
		console.log(
			JSON.stringify({
				success: true,
				session_id: effectiveSessionId,
				summary: {
					work_items: summary.work_items.length,
					in_progress: summary.in_progress.length,
					decisions: summary.decisions.length,
				},
				indexed: indexedCount,
			}),
		);
	} else {
		// No observations - session was empty
		console.log(
			JSON.stringify({
				success: true,
				session_id: effectiveSessionId,
				summary: null,
				indexed: indexedCount,
			}),
		);
	}
}
