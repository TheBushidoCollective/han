import type { Command } from "commander";
import { registerHookDispatch } from "./dispatch.ts";
import { registerHookExplain } from "./explain.tsx";
import { registerHookOrchestrate } from "./orchestrate.ts";
import { createReferenceCommand } from "./reference/index.ts";
import { registerHookRun } from "./run.ts";
import { registerSessionId } from "./session-id.ts";
import { registerHookTest } from "./test.ts";
import { registerHookVerify } from "./verify.ts";

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
	const hookCommand = program.command("hook").description("Hook utilities");

	registerHookDispatch(hookCommand);
	registerHookExplain(hookCommand);
	registerHookOrchestrate(hookCommand);
	registerHookRun(hookCommand);
	registerSessionId(hookCommand);
	registerHookTest(hookCommand);
	registerHookVerify(hookCommand);
	hookCommand.addCommand(createReferenceCommand());
}
