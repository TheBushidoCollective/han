import type { Command } from "commander";
import { registerHookContext } from "./context.ts";
import { registerHookDispatch } from "./dispatch.ts";
import { registerInjectSubagentContext } from "./inject-subagent-context.ts";
import { registerHookList } from "./list.ts";
import { registerHookOrchestrate } from "./orchestrate.ts";
import { createReferenceCommand } from "./reference/index.ts";
import { registerHookRun } from "./run.ts";
import { registerHookWait } from "./wait.ts";

/**
 * Check if we're in a TTY environment where ink-based commands can work.
 * ink can hang during import in non-TTY environments (CI, piped processes, etc.)
 */
function isTTY(): boolean {
	return Boolean(process.stdout.isTTY);
}

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
	const hookCommand = program.command("hook").description("Hook utilities");

	registerHookContext(hookCommand);
	registerHookDispatch(hookCommand);
	registerInjectSubagentContext(hookCommand);
	registerHookList(hookCommand);
	registerHookOrchestrate(hookCommand);
	registerHookRun(hookCommand);
	registerHookWait(hookCommand);
	hookCommand.addCommand(createReferenceCommand());

	// Only register ink-based commands in TTY environments
	// ink can hang during import in non-TTY environments (CI, piped processes)
	if (isTTY()) {
		// Dynamic import to avoid loading ink at startup
		import("./explain.tsx").then(({ registerHookExplain }) => {
			registerHookExplain(hookCommand);
		});
		import("./test.tsx").then(({ registerHookTest }) => {
			registerHookTest(hookCommand);
		});
	}
}
