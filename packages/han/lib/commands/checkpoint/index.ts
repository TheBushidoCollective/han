import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { captureCheckpointCommand } from "./capture.ts";
import { cleanCheckpoints } from "./clean.ts";
import { listCheckpoints } from "./list.ts";

/**
 * Hook payload structure from Claude Code stdin
 */
interface HookPayload {
	session_id?: string;
	hook_event_name?: string;
	agent_id?: string;
}

/**
 * Read stdin synchronously if available (non-blocking check)
 */
function readStdinIfAvailable(): string | null {
	try {
		// In a TTY, stdin is interactive - never try to read
		if (process.stdin.isTTY) {
			return null;
		}
		// Read stdin synchronously
		const stdin = readFileSync(0, "utf-8");
		return stdin.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Parse stdin to get hook payload
 */
function parseStdinPayload(): HookPayload | null {
	const raw = readStdinIfAvailable();
	if (!raw) return null;
	try {
		return JSON.parse(raw) as HookPayload;
	} catch {
		return null;
	}
}

/**
 * Register all checkpoint-related commands under `han checkpoint`
 */
export function registerCheckpointCommands(program: Command): void {
	const checkpointCommand = program
		.command("checkpoint")
		.description("Manage session and agent checkpoints");

	checkpointCommand
		.command("capture")
		.description(
			"Capture a checkpoint. Can read from stdin (hook payload) or use explicit options.",
		)
		.option("--type <type>", "Checkpoint type (session or agent)")
		.option("--id <id>", "Checkpoint ID (session_id or agent_id)")
		.action(async (options: { type?: string; id?: string }) => {
			try {
				let checkpointType: "session" | "agent";
				let checkpointId: string;

				if (options.type && options.id) {
					// Explicit options provided
					if (options.type !== "session" && options.type !== "agent") {
						console.error("Error: --type must be 'session' or 'agent'");
						process.exit(1);
					}
					checkpointType = options.type;
					checkpointId = options.id;
				} else {
					// Try to read from stdin (hook payload)
					const payload = parseStdinPayload();
					if (!payload) {
						console.error(
							"Error: No stdin payload and --type/--id not provided",
						);
						process.exit(1);
					}

					// Determine type from hook_event_name
					if (payload.hook_event_name === "SessionStart") {
						checkpointType = "session";
						checkpointId = payload.session_id || "";
					} else if (payload.hook_event_name === "SubagentStart") {
						checkpointType = "agent";
						checkpointId = payload.agent_id || "";
					} else {
						console.error(
							`Error: Unsupported hook event '${payload.hook_event_name}' for checkpoint capture`,
						);
						process.exit(1);
					}

					if (!checkpointId) {
						console.error(
							`Error: Missing ${checkpointType === "session" ? "session_id" : "agent_id"} in payload`,
						);
						process.exit(1);
					}
				}

				await captureCheckpointCommand({
					type: checkpointType,
					id: checkpointId,
				});
				console.log(`${checkpointType} checkpoint: ${checkpointId}`);
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
