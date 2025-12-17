import { readFileSync } from "node:fs";
import type { Command } from "commander";

/**
 * Check if stdin has data available without blocking
 */
function hasStdinData(): boolean {
	try {
		if (process.stdin.isTTY) {
			return false;
		}
		if (process.stdin.readable && process.stdin.readableLength > 0) {
			return true;
		}
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		if (stat.isFile()) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Register memory command
 */
export function registerMemoryCommand(program: Command): void {
	const memoryCommand = program
		.command("memory")
		.description("Memory system operations (session summarization, etc.)");

	// Capture tool observation from PostToolUse hook
	memoryCommand
		.command("capture")
		.description("Capture tool observation (called from PostToolUse hook)")
		.action(async () => {
			try {
				// Read PostToolUse event from stdin
				if (!hasStdinData()) {
					// No stdin data - nothing to capture (silent exit)
					process.exit(0);
				}

				const stdin = readFileSync(0, "utf-8");
				if (!stdin.trim()) {
					process.exit(0);
				}

				const event = JSON.parse(stdin);

				// Lazy import to avoid loading until needed
				const { captureToolUse } = await import("../../memory/capture.ts");
				await captureToolUse({
					session_id: event.session_id,
					tool_name: event.tool_name,
					tool_input: event.tool_input || {},
					tool_result: event.tool_result,
				});

				process.exit(0);
			} catch (error: unknown) {
				// Silent failure for capture - don't disrupt the session
				console.error(
					"Error capturing observation:",
					error instanceof Error ? error.message : error,
				);
				process.exit(0); // Exit 0 to not block hooks
			}
		});

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
