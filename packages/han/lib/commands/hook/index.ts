import type { Command } from "commander";
import { registerHookContext } from "./context.ts";
import { registerHookDispatch } from "./dispatch.ts";
import { registerHookExplain } from "./explain.tsx";
import { registerHookOrchestrate } from "./orchestrate.ts";
import { createReferenceCommand } from "./reference/index.ts";
import { registerHookRun } from "./run.ts";
import { registerHookWait } from "./wait.ts";

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
	const hookCommand = program.command("hook").description("Hook utilities");

	registerHookContext(hookCommand);
	registerHookDispatch(hookCommand);
	registerHookExplain(hookCommand);
	registerHookOrchestrate(hookCommand);
	registerHookRun(hookCommand);
	registerHookWait(hookCommand);
	hookCommand.addCommand(createReferenceCommand());
}
