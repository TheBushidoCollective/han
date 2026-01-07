import type { Command } from "commander";

/**
 * Register memory command
 *
 * Note: The memory capture and session-end commands have been removed.
 * File changes are now tracked by the indexer from JSONL transcripts.
 * Session observations are stored in SQLite via the indexer, not separate JSONL files.
 */
export function registerMemoryCommand(program: Command): void {
	program
		.command("memory")
		.description("Memory system operations")
		.action(() => {
			console.log(
				"Memory system is now integrated with the indexer.\n" +
					"File changes and tool usage are tracked automatically from session transcripts.\n" +
					"\n" +
					"Use the Browse UI (han browse) to search session history.",
			);
		});
}
