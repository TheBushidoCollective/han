import type { Command } from "commander";
import { runConfiguredHook, validate } from "../../validate.ts";

export function registerHookRun(hookCommand: Command): void {
	// Supports two formats:
	// 1. New format: han hook run <plugin-name> <hook-name> [--fail-fast] [--cached] [--only=<dir>]
	//    Uses plugin han-config.json to determine dirsWith and default command
	// 2. Legacy format: han hook run --dirs-with <file> -- <command>
	//    Explicit dirsWith and command specification
	hookCommand
		.command("run [args...]")
		.description(
			"Run a hook across directories.\n" +
				"New format: han hook run <plugin-name> <hook-name> [--fail-fast] [--cached] [--only=<dir>]\n" +
				"Legacy format: han hook run --dirs-with <file> -- <command>",
		)
		.option("--fail-fast", "Stop on first failure")
		.option(
			"--dirs-with <file>",
			"(Legacy) Only run in directories containing the specified file",
		)
		.option(
			"--test-dir <command>",
			"(Legacy) Only include directories where this command exits 0",
		)
		.option(
			"--cached",
			"Only run if files matching ifChanged patterns have changed since last successful run",
		)
		.option("--cache", "(Deprecated) Alias for --cached")
		.option(
			"--only <directory>",
			"Only run in the specified directory (for targeted re-runs after failures)",
		)
		.option(
			"--verbose",
			"Show full command output (also settable via HAN_HOOK_RUN_VERBOSE=1)",
		)
		.allowUnknownOption()
		.action(
			async (
				args: string[],
				options: {
					failFast?: boolean;
					dirsWith?: string;
					testDir?: string;
					cached?: boolean;
					cache?: boolean;
					only?: string;
					verbose?: boolean;
				},
			) => {
				// Allow global disable of all hooks via environment variable
				if (
					process.env.HAN_DISABLE_HOOKS === "true" ||
					process.env.HAN_DISABLE_HOOKS === "1"
				) {
					process.exit(0);
				}

				const separatorIndex = process.argv.indexOf("--");
				const isLegacyFormat = separatorIndex !== -1;

				// Determine verbose mode from option or environment variable
				const verbose =
					options.verbose ||
					process.env.HAN_HOOK_RUN_VERBOSE === "1" ||
					process.env.HAN_HOOK_RUN_VERBOSE === "true";

				// Support both --cached and --cache (deprecated alias)
				const useCache = options.cached || options.cache || false;

				if (isLegacyFormat) {
					const commandArgs = process.argv.slice(separatorIndex + 1);

					if (commandArgs.length === 0) {
						console.error(
							"Error: No command specified after --\n\nExample: han hook run --dirs-with package.json -- npm test",
						);
						process.exit(1);
					}

					const quotedArgs = commandArgs.map((arg) => {
						if (
							arg.includes(" ") ||
							arg.includes("&") ||
							arg.includes("|") ||
							arg.includes(";")
						) {
							return `'${arg.replace(/'/g, "'\\''")}'`;
						}
						return arg;
					});

					await validate({
						failFast: options.failFast || false,
						dirsWith: options.dirsWith || null,
						testDir: options.testDir || null,
						command: quotedArgs.join(" "),
						verbose,
					});
				} else {
					// New format: han hook run <plugin-name> <hook-name>
					const pluginName = args.length > 0 ? args[0] : undefined;
					const hookName = args.length > 1 ? args[1] : undefined;

					if (!pluginName || !hookName) {
						console.error(
							"Error: Plugin name and hook name are required.\n\n" +
								"Usage:\n" +
								"  New format:    han hook run <plugin-name> <hook-name> [--fail-fast] [--cached] [--only=<dir>]\n" +
								"  Legacy format: han hook run --dirs-with <file> -- <command>",
						);
						process.exit(1);
					}

					await runConfiguredHook({
						pluginName,
						hookName,
						failFast: options.failFast || false,
						cache: useCache,
						only: options.only,
						verbose,
					});
				}
			},
		);
}
