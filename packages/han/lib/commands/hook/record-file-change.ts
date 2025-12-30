import { readFileSync } from "node:fs";
import type { Command } from "commander";

/**
 * PostToolUse hook payload from Claude Code
 */
interface PostToolUsePayload {
	session_id?: string;
	hook_event_name?: string;
	tool_name?: string;
	tool_input?: {
		file_path?: string;
		command?: string;
	};
	tool_response?: unknown;
}

/**
 * Check if stdin has data available
 */
function hasStdinData(): boolean {
	try {
		if (process.stdin.isTTY) {
			return false;
		}
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		if (stat.isFile() || stat.isFIFO()) {
			return true;
		}
		return process.stdin.readable && process.stdin.readableLength > 0;
	} catch {
		return false;
	}
}

/**
 * Read and parse PostToolUse payload from stdin
 */
function readPayload(): PostToolUsePayload | null {
	try {
		if (!hasStdinData()) {
			return null;
		}
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as PostToolUsePayload;
		}
	} catch {
		// stdin not available or invalid JSON
	}
	return null;
}

/**
 * Determine action from tool name
 */
function determineAction(
	toolName: string,
): "created" | "modified" | "deleted" | null {
	switch (toolName.toLowerCase()) {
		case "write":
			// Write tool creates files (or overwrites them completely)
			return "created";
		case "edit":
			// Edit tool modifies existing files
			return "modified";
		default:
			return null;
	}
}

/**
 * Record a file change from PostToolUse hook
 *
 * This command is called by the PostToolUse hook to track file modifications.
 * It reads the tool event from stdin and records file changes to the session.
 *
 * The Smart Dispatch feature uses this to skip validation hooks when no files
 * were modified in a session.
 */
async function recordFileChange(): Promise<void> {
	const payload = readPayload();

	if (!payload) {
		// No payload - nothing to record
		return;
	}

	const { session_id, tool_name, tool_input } = payload;

	// Validate required fields
	if (!session_id || !tool_name || !tool_input?.file_path) {
		// Missing required fields - silently skip
		return;
	}

	// Determine action from tool name
	const action = determineAction(tool_name);
	if (!action) {
		// Not a file-modifying tool - skip
		return;
	}

	// Record the file change in the database
	const { sessionFileChanges } = await import("../../db/index.ts");

	await sessionFileChanges.record({
		sessionId: session_id,
		filePath: tool_input.file_path,
		action,
		toolName: tool_name,
	});
}

/**
 * Register the record-file-change command
 */
export function registerRecordFileChange(hookCommand: Command): void {
	hookCommand
		.command("record-file-change")
		.description(
			"Record a file change from PostToolUse hook.\n" +
				"Reads tool event from stdin and tracks file modifications.\n" +
				"Used by Smart Dispatch to skip validation hooks when no files changed.",
		)
		.action(async () => {
			await recordFileChange();
		});
}
