import type { Command } from "commander";

/**
 * Check if stdin has data available without blocking
 * Returns the stdin data if available, null otherwise
 */
async function tryReadStdin(): Promise<string | null> {
	// Check if stdin is a TTY (interactive terminal) - if so, no data to read
	if (process.stdin.isTTY) {
		return null;
	}

	// Set a short timeout to check for available data
	return new Promise((resolve) => {
		let data = "";
		let resolved = false;

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				process.stdin.removeAllListeners();
				process.stdin.pause();
				resolve(data || null);
			}
		}, 100); // 100ms timeout

		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});

		process.stdin.on("end", () => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				resolve(data || null);
			}
		});

		process.stdin.on("error", () => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				resolve(null);
			}
		});

		// Resume stdin to start reading
		process.stdin.resume();
	});
}

/**
 * Check if we're in a nested stop hook scenario
 * Claude Code sets stop_hook_active: true in stdin when a stop hook is already running
 */
function isStopHookActive(stdinData: string | null): boolean {
	if (!stdinData) return false;

	try {
		const parsed = JSON.parse(stdinData);
		return parsed.stop_hook_active === true;
	} catch {
		// Not JSON or invalid JSON - that's fine, just means it's not a Claude hook context
		return false;
	}
}

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
					stdin?: boolean;
					cache?: boolean;
					verbose?: boolean;
				},
			) => {
				// Always try to read stdin to check for stop_hook_active
				const stdinData = await tryReadStdin();

				// Check if we're in a nested stop hook - if so, exit immediately to prevent loops
				if (isStopHookActive(stdinData)) {
					process.exit(0);
				}

				const hookName =
					hookNameOrArgs.length > 0 ? hookNameOrArgs[0] : undefined;
				const separatorIndex = process.argv.indexOf("--");
				const isLegacyFormat = separatorIndex !== -1;

				// If --stdin was specified but we already read the data, use it
				// Otherwise, stdinData will be passed to subcommands if available

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
						stdinData,
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
						stdinData,
						cache: options.cache || false,
						verbose,
					});
				}
			},
		);
}
