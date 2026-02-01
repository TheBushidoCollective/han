import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { getHanBinary } from "../../config/han-settings.ts";
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
 * Check if stdin has data available.
 */
function hasStdinData(): boolean {
	try {
		if (process.stdin.isTTY) {
			return false;
		}
		// Try to stat stdin fd
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		return stat.isFile() || stat.isFIFO() || stat.isSocket();
	} catch {
		// stdin may be a pipe that doesn't support fstat
		// Try reading anyway
		return !process.stdin.isTTY;
	}
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
 * Gather context from SubagentPrompt hooks via han hook orchestrate.
 * Returns the combined output from all SubagentPrompt hooks.
 */
function gatherSubagentContext(projectDir: string): string {
	try {
		// Use configured han binary (respects han.yml hanBinary setting for dev)
		const hanBinary = getHanBinary() || "han";
		const command = `${hanBinary} hook orchestrate SubagentPrompt`;

		if (isDebugMode()) {
			console.error(
				`[inject-subagent-context] Running: ${command}`,
			);
		}

		const result = execSync(command, {
			encoding: "utf-8",
			timeout: 10000,
			cwd: projectDir,
			stdio: ["pipe", "pipe", "pipe"],
			shell: "/bin/bash",
			env: {
				...process.env,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		});

		// Extract just the stdout content (skip stderr which contains progress info)
		const stdout = result.trim();

		if (isDebugMode()) {
			console.error(
				`[inject-subagent-context] SubagentPrompt output: ${stdout.slice(0, 200)}...`,
			);
		}

		return stdout;
	} catch (error: unknown) {
		if (isDebugMode()) {
			const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || "";
			console.error(
				`[inject-subagent-context] SubagentPrompt orchestrate error: ${stderr}`,
			);
		}
		return "";
	}
}

/**
 * Inject subagent context into Task and Skill tool prompts.
 *
 * This is a PreToolUse hook that intercepts Task and Skill tool calls and prepends
 * context gathered from SubagentPrompt hooks to the prompt/arguments parameter.
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
	// Check for the opening tag with newline to avoid false positives
	if (originalValue.includes("<subagent-context>\n")) {
		if (isDebugMode()) {
			console.error(
				"[inject-subagent-context] Already has context injected, exiting",
			);
		}
		process.exit(0);
	}

	// Gather context from SubagentPrompt hooks
	const projectDir =
		process.env.CLAUDE_PROJECT_DIR || process.env.PWD || process.cwd();
	const contextOutput = gatherSubagentContext(projectDir);

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
				"Gathers context from SubagentPrompt hooks (defined by plugins like AI-DLC)\n" +
				"and prepends it to the tool's prompt/arguments parameter. This ensures\n" +
				"subagents and skills receive essential context from all enabled plugins.\n\n" +
				"Output format uses updatedInput to modify the tool parameters\n" +
				"without blocking execution.",
		)
		.action(async () => {
			await injectSubagentContext();
		});
}
