import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { isDebugMode } from "../../shared.ts";

/**
 * PreToolUse hook payload structure from Claude Code
 */
interface PreToolUsePayload {
	session_id?: string;
	tool_name?: string;
	tool_input?: {
		prompt?: string;
		description?: string;
		subagent_type?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * PreToolUse hook output with updatedInput
 */
interface PreToolUseOutput {
	hookSpecificOutput: {
		hookEventName: "PreToolUse";
		updatedInput: Record<string, unknown>;
	};
}

/**
 * Read and parse stdin payload
 */
function readStdinPayload(): PreToolUsePayload | null {
	try {
		if (process.stdin.isTTY) {
			return null;
		}
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as PreToolUsePayload;
		}
	} catch {
		// stdin not available or invalid JSON
	}
	return null;
}

/**
 * Get the core plugin hooks directory
 */
function getCoreHooksDir(): string | null {
	// Try to find core plugin via common paths
	const possiblePaths = [
		// Development: relative to this file
		join(dirname(dirname(dirname(dirname(__dirname)))), "core", "hooks"),
		// Installed: ~/.claude/plugins/han/core/hooks
		join(process.env.HOME || "", ".claude", "plugins", "han", "core", "hooks"),
		// CLAUDE_PLUGIN_ROOT if set (when running as a hook)
		process.env.CLAUDE_PLUGIN_ROOT
			? join(dirname(process.env.CLAUDE_PLUGIN_ROOT), "core", "hooks")
			: null,
	].filter(Boolean) as string[];

	for (const p of possiblePaths) {
		if (existsSync(p)) {
			return p;
		}
	}
	return null;
}

/**
 * Gather subagent context directly from reference files.
 * Returns the combined content to inject.
 */
function gatherSubagentContext(): string {
	const hooksDir = getCoreHooksDir();
	if (!hooksDir) {
		if (isDebugMode()) {
			console.error("[inject-subagent-context] Could not find core hooks directory");
		}
		return "";
	}

	const contextParts: string[] = [];

	// Reference files to include for subagents
	const referenceFiles = [
		"no-time-estimates.md",
		"professional-honesty.md",
	];

	for (const file of referenceFiles) {
		const filePath = join(hooksDir, file);
		if (existsSync(filePath)) {
			try {
				const content = readFileSync(filePath, "utf-8").trim();
				if (content) {
					contextParts.push(content);
				}
			} catch (error) {
				if (isDebugMode()) {
					console.error(`[inject-subagent-context] Error reading ${file}: ${error}`);
				}
			}
		}
	}

	return contextParts.join("\n\n");
}

/**
 * Inject subagent context into Task and Skill tool prompts.
 *
 * This is a PreToolUse hook that intercepts Task and Skill tool calls and prepends
 * context to the prompt/arguments parameter.
 *
 * The output uses `updatedInput` to modify the tool parameters without
 * blocking the tool execution (no permissionDecision is set).
 */
async function injectSubagentContext(): Promise<void> {
	const payload = readStdinPayload();

	if (!payload) {
		if (isDebugMode()) {
			console.error("[inject-subagent-context] No stdin payload, exiting");
		}
		process.exit(0);
	}

	// Process Task and Skill tool calls
	const toolName = payload.tool_name;
	if (toolName !== "Task" && toolName !== "Skill") {
		if (isDebugMode()) {
			console.error(
				`[inject-subagent-context] Not a Task or Skill tool (got: ${toolName}), exiting`,
			);
		}
		process.exit(0);
	}

	const toolInput = payload.tool_input;

	// For Task tool, check prompt; for Skill tool, check arguments
	const targetField = toolName === "Task" ? "prompt" : "arguments";
	const originalValue = (toolInput?.[targetField] as string) || "";

	// Skip if no value to inject into
	if (!originalValue && toolName === "Task") {
		if (isDebugMode()) {
			console.error(`[inject-subagent-context] No ${targetField} in tool_input, exiting`);
		}
		process.exit(0);
	}

	// Skip if already has our injected context
	if (originalValue.includes("<subagent-context>\n")) {
		if (isDebugMode()) {
			console.error(
				"[inject-subagent-context] Already has context injected, exiting",
			);
		}
		process.exit(0);
	}

	// Gather context directly from reference files
	const contextOutput = gatherSubagentContext();

	if (!contextOutput) {
		if (isDebugMode()) {
			console.error(
				"[inject-subagent-context] No context gathered, exiting without modification",
			);
		}
		process.exit(0);
	}

	// Wrap gathered context in tags and prepend to value
	const wrappedContext = `<subagent-context>\n${contextOutput}\n</subagent-context>\n\n`;
	const modifiedValue = wrappedContext + originalValue;

	// Build updated input with modified field
	const updatedInput: Record<string, unknown> = { ...toolInput };
	updatedInput[targetField] = modifiedValue;

	// Output JSON with updatedInput
	// IMPORTANT: Do NOT set permissionDecision - it breaks updatedInput for Task tool
	const output: PreToolUseOutput = {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			updatedInput,
		},
	};

	console.log(JSON.stringify(output));

	if (isDebugMode()) {
		console.error(
			`[inject-subagent-context] Injected ${contextOutput.length} bytes of context into ${toolName}.${targetField}`,
		);
	}

	process.exit(0);
}

/**
 * Register the inject-subagent-context command
 */
export function registerInjectSubagentContext(hookCommand: Command): void {
	hookCommand
		.command("inject-subagent-context")
		.description(
			"PreToolUse hook that injects context into Task and Skill tool prompts.\n\n" +
				"Reads reference files from core/hooks/ (no-time-estimates.md, professional-honesty.md)\n" +
				"and prepends them to the tool's prompt/arguments parameter. This ensures\n" +
				"subagents and skills receive essential context.\n\n" +
				"Output format uses updatedInput to modify the tool parameters\n" +
				"without blocking execution.",
		)
		.action(async () => {
			await injectSubagentContext();
		});
}
