/**
 * PostToolUse hook for capturing tool observations during Claude sessions
 *
 * This module provides the captureToolUse function which is called after
 * every tool use during a Claude Code session. It extracts relevant information
 * and stores it as a RawObservation using the memory storage layer.
 */

import { isMemoryEnabled } from "../han-settings.ts";
import { generateId } from "./paths.ts";
import { getMemoryStore } from "./storage.ts";
import type { RawObservation } from "./types.ts";

/**
 * Tool use event structure matching Claude Code's PostToolUse hook payload
 */
export interface ToolUseEvent {
	session_id: string;
	tool_name: string;
	tool_input: Record<string, unknown>;
	tool_result: unknown;
}

/**
 * Maximum length for summaries to keep observations compact
 */
const MAX_SUMMARY_LENGTH = 500;

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Create a concise summary of tool input
 */
function summarizeInput(
	toolName: string,
	input: Record<string, unknown>,
): string {
	const parts: string[] = [];

	// Extract key information based on tool type
	if (toolName === "Read" && input.file_path) {
		parts.push(`Reading ${input.file_path}`);
		if (input.offset !== undefined || input.limit !== undefined) {
			const offset = typeof input.offset === "number" ? input.offset : 0;
			const limitStr =
				typeof input.limit === "number" ? String(offset + input.limit) : "end";
			parts.push(`(lines ${offset}-${limitStr})`);
		}
	} else if (toolName === "Edit" && input.file_path) {
		parts.push(`Editing ${input.file_path}`);
	} else if (toolName === "Write" && input.file_path) {
		parts.push(`Writing ${input.file_path}`);
	} else if (toolName === "Bash" && input.command) {
		parts.push(`Running: ${input.command}`);
	} else if (toolName === "Grep" && input.pattern) {
		parts.push(`Searching for: ${input.pattern}`);
		if (input.glob) {
			parts.push(`in ${input.glob}`);
		}
	} else if (toolName === "Glob" && input.pattern) {
		parts.push(`Finding files: ${input.pattern}`);
	} else if (toolName === "WebSearch" && input.query) {
		parts.push(`Searching web: ${input.query}`);
	} else if (toolName === "WebFetch" && input.url) {
		parts.push(`Fetching: ${input.url}`);
	} else {
		// Generic fallback: show all input keys
		const keys = Object.keys(input).slice(0, 3);
		if (keys.length > 0) {
			parts.push(`${toolName}: ${keys.join(", ")}`);
		} else {
			parts.push(toolName);
		}
	}

	return truncate(parts.join(" "), 200);
}

/**
 * Create a concise summary of tool output
 */
function summarizeOutput(toolName: string, result: unknown): string {
	if (!result) {
		return "No output";
	}

	// Handle different result types
	if (typeof result === "string") {
		return truncate(result, MAX_SUMMARY_LENGTH);
	}

	if (typeof result !== "object") {
		return truncate(String(result), MAX_SUMMARY_LENGTH);
	}

	const resultObj = result as Record<string, unknown>;

	// Tool-specific output formatting
	if (toolName === "Read" && resultObj.content) {
		const content = String(resultObj.content);
		const lines = content.split("\n").length;
		return truncate(`${lines} lines: ${content}`, MAX_SUMMARY_LENGTH);
	}

	if (toolName === "Edit" || toolName === "Write") {
		if (resultObj.success) {
			return "Success";
		}
		if (resultObj.message) {
			return truncate(String(resultObj.message), MAX_SUMMARY_LENGTH);
		}
	}

	if (toolName === "Bash") {
		const parts: string[] = [];
		if (resultObj.exit_code !== undefined) {
			parts.push(`Exit code: ${resultObj.exit_code}`);
		}
		if (resultObj.stdout) {
			parts.push(truncate(String(resultObj.stdout), 300));
		}
		if (resultObj.stderr) {
			parts.push(`stderr: ${truncate(String(resultObj.stderr), 100)}`);
		}
		return truncate(parts.join("\n"), MAX_SUMMARY_LENGTH);
	}

	if (toolName === "Grep" && resultObj.files) {
		const files = resultObj.files as string[];
		return truncate(
			`Found ${files.length} files: ${files.slice(0, 5).join(", ")}`,
			MAX_SUMMARY_LENGTH,
		);
	}

	if (toolName === "Glob" && Array.isArray(resultObj)) {
		return truncate(`Found ${resultObj.length} files`, MAX_SUMMARY_LENGTH);
	}

	// Generic fallback: stringify and truncate
	try {
		return truncate(JSON.stringify(result), MAX_SUMMARY_LENGTH);
	} catch {
		return truncate(String(result), MAX_SUMMARY_LENGTH);
	}
}

/**
 * Extract files that were read from the tool event
 */
function extractFilesRead(
	toolName: string,
	input: Record<string, unknown>,
): string[] {
	const files: string[] = [];

	if (toolName === "Read" && input.file_path) {
		files.push(String(input.file_path));
	}

	return files;
}

/**
 * Extract files that were modified from the tool event
 */
function extractFilesModified(
	toolName: string,
	input: Record<string, unknown>,
): string[] {
	const files: string[] = [];

	if ((toolName === "Edit" || toolName === "Write") && input.file_path) {
		files.push(String(input.file_path));
	}

	return files;
}

/**
 * Capture tool use event and store as observation
 *
 * This is the main entry point called by the PostToolUse hook.
 * It extracts relevant information from the tool event and stores
 * it using the memory storage layer.
 */
export async function captureToolUse(event: ToolUseEvent): Promise<void> {
	// Skip if memory is disabled
	if (!isMemoryEnabled()) {
		return;
	}

	// Skip if no session ID (shouldn't happen in practice)
	if (!event.session_id) {
		return;
	}

	const observation: RawObservation = {
		id: generateId(),
		session_id: event.session_id,
		timestamp: Date.now(),
		tool: event.tool_name,
		input_summary: summarizeInput(event.tool_name, event.tool_input),
		output_summary: summarizeOutput(event.tool_name, event.tool_result),
		files_read: extractFilesRead(event.tool_name, event.tool_input),
		files_modified: extractFilesModified(event.tool_name, event.tool_input),
	};

	const store = getMemoryStore();
	store.appendObservation(event.session_id, observation);
}
