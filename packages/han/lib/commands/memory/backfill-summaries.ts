/**
 * Backfill Generated Session Summaries
 *
 * CLI command to generate summaries for sessions that don't have them yet.
 * Uses Haiku for fast, cheap summarization.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { tryGetNativeModule } from "../../native.ts";
import {
	generateSessionSummary,
	saveGeneratedSummary,
} from "../../memory/summary-generator.ts";

/**
 * Options for backfill operation
 */
export interface BackfillOptions {
	/** Maximum sessions to process (default: 100) */
	limit?: number;
	/** Show what would be processed without making changes */
	dryRun?: boolean;
	/** Show detailed progress */
	verbose?: boolean;
	/** Minimum messages for a meaningful session (default: 5) */
	minMessages?: number;
}

/**
 * Result of backfill operation
 */
export interface BackfillResult {
	processed: number;
	skipped: number;
	errors: number;
	errorDetails?: Array<{ sessionId: string; error: string }>;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate summaries for sessions without them
 */
export async function backfillSummaries(
	options: BackfillOptions = {},
): Promise<BackfillResult> {
	const {
		limit = 100,
		dryRun = false,
		verbose = false,
		minMessages = 5,
	} = options;

	const nativeModule = tryGetNativeModule();
	if (!nativeModule) {
		throw new Error("Native module not available");
	}

	const dbPath = join(homedir(), ".claude", "han", "han.db");

	// Get sessions without summaries
	const sessionsToProcess = nativeModule.listSessionsWithoutSummaries(
		dbPath,
		limit * 2, // Get more than we need since we'll filter
	);

	if (sessionsToProcess.length === 0) {
		if (verbose) {
			console.log("No sessions without summaries found.");
		}
		return { processed: 0, skipped: 0, errors: 0 };
	}

	// Get message counts for filtering
	const messageCounts = nativeModule.getMessageCountsBatch(
		dbPath,
		sessionsToProcess,
	);

	// Get timestamps for duration calculation
	const timestamps = nativeModule.getSessionTimestampsBatch(
		dbPath,
		sessionsToProcess,
	);

	let processed = 0;
	let skipped = 0;
	let errors = 0;
	const errorDetails: Array<{ sessionId: string; error: string }> = [];

	for (const sessionId of sessionsToProcess) {
		if (processed >= limit) {
			break;
		}

		const messageCount = messageCounts[sessionId] || 0;

		// Skip sessions with too few messages
		if (messageCount < minMessages) {
			if (verbose) {
				console.log(
					`Skipping ${sessionId}: only ${messageCount} messages (min: ${minMessages})`,
				);
			}
			skipped++;
			continue;
		}

		// Calculate duration if we have timestamps
		let durationSeconds: number | undefined;
		const ts = timestamps[sessionId];
		if (ts?.startedAt && ts?.endedAt) {
			const start = new Date(ts.startedAt).getTime();
			const end = new Date(ts.endedAt).getTime();
			durationSeconds = Math.floor((end - start) / 1000);
		}

		if (dryRun) {
			console.log(
				`Would process: ${sessionId} (${messageCount} messages${durationSeconds ? `, ${Math.floor(durationSeconds / 60)}m` : ""})`,
			);
			processed++;
			continue;
		}

		try {
			if (verbose) {
				console.log(
					`Processing ${sessionId} (${messageCount} messages)...`,
				);
			}

			const summary = await generateSessionSummary(sessionId);

			await saveGeneratedSummary(
				sessionId,
				summary,
				messageCount,
				durationSeconds,
			);

			if (verbose) {
				console.log(`  Summary: ${summary.summaryText.slice(0, 100)}...`);
				console.log(`  Topics: ${summary.topics.join(", ")}`);
				console.log(`  Outcome: ${summary.outcome}`);
			}

			processed++;

			// Rate limit to avoid API throttling (only if we have API key)
			if (process.env.ANTHROPIC_API_KEY) {
				await sleep(500);
			}
		} catch (error) {
			errors++;
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			errorDetails.push({ sessionId, error: errorMessage });
			if (verbose) {
				console.error(`Error processing ${sessionId}: ${errorMessage}`);
			}
		}
	}

	return { processed, skipped, errors, errorDetails };
}
