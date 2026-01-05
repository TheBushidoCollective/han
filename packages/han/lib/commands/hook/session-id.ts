import { readFileSync } from "node:fs";
import type { Command } from "commander";

/**
 * Hook payload from Claude Code containing session context
 */
interface SessionPayload {
	session_id?: string;
	[key: string]: unknown;
}

/**
 * Check if stdin has data available.
 * Handles various stdin types: files, FIFOs, pipes, and sockets.
 */
function hasStdinData(): boolean {
	try {
		// TTY means interactive terminal - no piped input
		if (process.stdin.isTTY) {
			return false;
		}
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		// Accept any non-TTY stdin type (file, FIFO, socket, pipe)
		// Socket is used when parent process passes data via execSync's input option
		return stat.isFile() || stat.isFIFO() || stat.isSocket();
	} catch {
		return false;
	}
}

/**
 * Read and parse session payload from stdin
 */
function readPayload(): SessionPayload | null {
	try {
		if (!hasStdinData()) {
			return null;
		}
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as SessionPayload;
		}
	} catch {
		// stdin not available or invalid JSON
	}
	return null;
}

/**
 * Output the session ID in a format Claude can reference
 *
 * This command is called by SessionStart hook to expose the Claude Code
 * session ID so it can be passed to tools like han_workflow and memory.
 */
function outputSessionId(): void {
	const payload = readPayload();

	if (!payload?.session_id) {
		// No session ID available
		return;
	}

	// Output in XML format that Claude can parse and reference
	console.log(`<session-id>${payload.session_id}</session-id>`);
}

/**
 * Register the session-id command
 */
export function registerSessionId(hookCommand: Command): void {
	hookCommand
		.command("session-id")
		.description(
			"Output the Claude Code session ID from stdin.\n" +
				"Reads session context from stdin and outputs the session_id\n" +
				"in a format that Claude can reference for workflow/memory tools.",
		)
		.action(() => {
			outputSessionId();
		});
}
