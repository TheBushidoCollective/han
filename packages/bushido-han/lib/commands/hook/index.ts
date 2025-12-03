import type { Command } from "commander";
import { registerHookDispatch } from "./dispatch.js";
import { registerHookRun } from "./run.js";
import { registerHookTest } from "./test.js";

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
	const hookCommand = program.command("hook").description("Hook utilities");

	registerHookDispatch(hookCommand);
	registerHookRun(hookCommand);
	registerHookTest(hookCommand);
}
