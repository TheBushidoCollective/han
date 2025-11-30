import type { Command } from "commander";
import { registerHookRun } from "./run.js";
import { registerHookTest } from "./test.js";

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
	const hookCommand = program.command("hook").description("Hook utilities");

	registerHookRun(hookCommand);
	registerHookTest(hookCommand);
}
