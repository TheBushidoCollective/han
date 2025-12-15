import type { Command } from "commander";

/**
 * Register memory command
 */
export function registerMemoryCommand(program: Command): void {
	const memoryCommand = program
		.command("memory")
		.description("Memory system operations (session summarization, etc.)");

	// Session end with summarization
	memoryCommand
		.command("session-end")
		.description("End session and create summary from observations")
		.option("--session-id <id>", "Session ID to summarize")
		.action(async (options: { sessionId?: string }) => {
			try {
				// Lazy import to avoid loading native module until needed
				const { endSessionWithSummary } = await import("./session-end.ts");
				await endSessionWithSummary(options.sessionId);
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error ending session:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}
