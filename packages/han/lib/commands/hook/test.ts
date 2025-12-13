import type { Command } from "commander";
import { testHooks } from "../../hook-test.ts";

export function registerHookTest(hookCommand: Command): void {
	hookCommand
		.command("test")
		.description("Validate hook configurations for all installed plugins")
		.option("--execute", "Execute hooks to verify they run successfully")
		.option("--verbose", "Show detailed output for all hooks")
		.option(
			"--cache",
			"Enable caching during test execution (disabled by default for testing)",
		)
		.option(
			"--checkpoints",
			"Enable checkpoint filtering during test execution (disabled by default for testing)",
		)
		.option(
			"--no-fail-fast",
			"Continue testing all hooks even if some fail (default for test mode)",
		)
		.action(
			async (options: {
				execute?: boolean;
				verbose?: boolean;
				cache?: boolean;
				checkpoints?: boolean;
				failFast?: boolean;
			}) => {
				try {
					await testHooks({
						execute: options.execute,
						verbose: options.verbose,
						// Testing defaults: no caching, no checkpoints (fresh test runs)
						// Use --cache or --checkpoints to enable if needed
						cache: options.cache ?? false,
						checkpoints: options.checkpoints ?? false,
						// Testing defaults: no fail-fast (see all results)
						// Commander sets failFast=false when --no-fail-fast is used
						failFast: options.failFast ?? false,
					});
					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error during hook testing:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);
}
