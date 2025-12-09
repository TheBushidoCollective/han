import type { Command } from "commander";
import { testHooks } from "../../hook-test.ts";

export function registerHookTest(hookCommand: Command): void {
	hookCommand
		.command("test")
		.description("Validate hook configurations for all installed plugins")
		.option("--execute", "Execute hooks to verify they run successfully")
		.option("--verbose", "Show detailed output for all hooks")
		.action(async (options: { execute?: boolean; verbose?: boolean }) => {
			try {
				await testHooks({
					execute: options.execute,
					verbose: options.verbose,
				});
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error during hook testing:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}
