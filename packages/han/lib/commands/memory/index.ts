import type { Command } from "commander";
import { backfillSummaries } from "./backfill-summaries.ts";

/**
 * Register memory command
 *
 * Note: The memory capture and session-end commands have been removed.
 * File changes are now tracked by the indexer from JSONL transcripts.
 * Session observations are stored in SQLite via the indexer, not separate JSONL files.
 */
export function registerMemoryCommand(program: Command): void {
	const memoryCmd = program
		.command("memory")
		.description("Memory system operations");

	// Default action when no subcommand
	memoryCmd.action(() => {
		console.log(
			"Memory system is now integrated with the indexer.\n" +
				"File changes and tool usage are tracked automatically from session transcripts.\n" +
				"\n" +
				"Commands:\n" +
				"  han memory backfill-summaries  Generate summaries for sessions without them\n" +
				"\n" +
				"Use the Browse UI (han browse) to search session history.",
		);
	});

	// Backfill summaries subcommand
	memoryCmd
		.command("backfill-summaries")
		.description("Generate summaries for sessions that don't have them")
		.option("-l, --limit <n>", "Maximum sessions to process", "100")
		.option("-n, --dry-run", "Show what would be processed without making changes")
		.option("-v, --verbose", "Show detailed progress")
		.option("--min-messages <n>", "Minimum messages for a meaningful session", "5")
		.action(async (options) => {
			try {
				const result = await backfillSummaries({
					limit: Number.parseInt(options.limit, 10),
					dryRun: options.dryRun,
					verbose: options.verbose,
					minMessages: Number.parseInt(options.minMessages, 10),
				});

				console.log("\nSummary:");
				console.log(`  Processed: ${result.processed}`);
				console.log(`  Skipped: ${result.skipped}`);
				console.log(`  Errors: ${result.errors}`);

				if (result.errors > 0 && result.errorDetails) {
					console.log("\nError details:");
					for (const { sessionId, error } of result.errorDetails.slice(0, 5)) {
						console.log(`  ${sessionId}: ${error}`);
					}
					if (result.errorDetails.length > 5) {
						console.log(`  ... and ${result.errorDetails.length - 5} more errors`);
					}
				}
			} catch (error) {
				console.error("Failed to backfill summaries:", error);
				process.exit(1);
			}
		});
}
