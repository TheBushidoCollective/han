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
		.option("--stdin", "Read stdin and pass it to each subcommand")
		.option(
			"--cache",
			"Only run if files matching ifChanged patterns have changed since last successful run",
		)
		.allowUnknownOption()
		.action(
			async (
				hookNameOrArgs: string[],
				options: {
					failFast?: boolean;
					dirsWith?: string;
					testDir?: string;
					stdin?: boolean;
					cache?: boolean;
				},
			) => {
				const hookName =
					hookNameOrArgs.length > 0 ? hookNameOrArgs[0] : undefined;
				const separatorIndex = process.argv.indexOf("--");
				const isLegacyFormat = separatorIndex !== -1;

				let stdinData: string | null = null;
				if (options.stdin) {
					const chunks: Buffer[] = [];
					for await (const chunk of process.stdin) {
						chunks.push(chunk);
					}
					stdinData = Buffer.concat(chunks).toString("utf8");
				}

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
						stdinData,
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
						stdinData,
						cache: options.cache || false,
					});
				}
			},
		);
}
