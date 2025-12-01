import type { Command } from "commander";

export function registerHookRun(hookCommand: Command): void {
	// Supports two formats:
	// 1. New format: han hook run <hookName> [--fail-fast] [--stdin] [--cache]
	//    Uses plugin han-config.json to determine dirsWith and default command
	// 2. Legacy format: han hook run --dirs-with <file> -- <command>
	//    Explicit dirsWith and command specification
	hookCommand
		.command("run [hookNameOrArgs...]")
		.description(
			"Run a hook across directories.\n" +
				"New format: han hook run <hookName> [--fail-fast] [--cache]\n" +
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
			"--cache",
			"Only run if files matching ifChanged patterns have changed since last successful run",
		)
		.option(
			"--verbose",
			"Show full command output (also settable via HAN_HOOK_RUN_VERBOSE=1)",
		)
		.allowUnknownOption()
		.action(
			async (
				hookNameOrArgs: string[],
				options: {
					failFast?: boolean;
					dirsWith?: string;
					testDir?: string;
					cache?: boolean;
					verbose?: boolean;
				},
			) => {
				const hookName =
					hookNameOrArgs.length > 0 ? hookNameOrArgs[0] : undefined;
				const separatorIndex = process.argv.indexOf("--");
				const isLegacyFormat = separatorIndex !== -1;

				// Determine verbose mode from option or environment variable
				const verbose =
					options.verbose ||
					process.env.HAN_HOOK_RUN_VERBOSE === "1" ||
					process.env.HAN_HOOK_RUN_VERBOSE === "true";

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

					const { validate } = await import("../../validate.js");
					await validate({
						failFast: options.failFast || false,
						dirsWith: options.dirsWith || null,
						testDir: options.testDir || null,
						command: quotedArgs.join(" "),
						verbose,
					});
				} else {
					if (!hookName) {
						console.error(
							"Error: Hook name is required.\n\n" +
								"Usage:\n" +
								"  New format:    han hook run <hookName> [--fail-fast] [--cache]\n" +
								"  Legacy format: han hook run --dirs-with <file> -- <command>",
						);
						process.exit(1);
					}

					const { runConfiguredHook } = await import("../../validate.js");
					await runConfiguredHook({
						hookName,
						failFast: options.failFast || false,
						cache: options.cache || false,
						verbose,
					});
				}
			},
		);
}
