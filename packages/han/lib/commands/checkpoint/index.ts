import type { Command } from "commander";
import { captureCheckpointCommand } from "./capture.ts";
import { cleanCheckpoints } from "./clean.ts";
import { listCheckpoints } from "./list.ts";

/**
 * Register all checkpoint-related commands under `han checkpoint`
 */
export function registerCheckpointCommands(program: Command): void {
	const checkpointCommand = program
		.command("checkpoint")
		.description("Manage session and agent checkpoints");

	checkpointCommand
		.command("capture")
		.description("Capture a checkpoint (called automatically by hook dispatch)")
		.requiredOption("--type <type>", "Checkpoint type (session or agent)")
		.requiredOption("--id <id>", "Checkpoint ID (session_id or agent_id)")
		.action(async (options: { type: "session" | "agent"; id: string }) => {
			try {
				await captureCheckpointCommand(options);
				process.exit(0);
			} catch (error: unknown) {
				// Silently fail - checkpoint capture should not block hooks
				// Only log errors in verbose mode
				if (process.env.HAN_VERBOSE === "1") {
					console.error(
						"Error capturing checkpoint:",
						error instanceof Error ? error.message : error,
					);
				}
				process.exit(1);
			}
		});

	checkpointCommand
		.command("list")
		.description("List active checkpoints")
		.action(async () => {
			try {
				await listCheckpoints();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error listing checkpoints:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	checkpointCommand
		.command("clean")
		.description("Remove stale checkpoints")
		.option("--max-age <hours>", "Max age in hours (default: 24)", "24")
		.action(async (options: { maxAge: string }) => {
			try {
				await cleanCheckpoints(options);
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error cleaning checkpoints:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}
