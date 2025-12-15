import type { Command } from "commander";
import { runConfiguredHook, validate } from "../../validate.ts";

export function registerHookRun(hookCommand: Command): void {
	// Supports two formats:
	// 1. New format: han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]
	//    Uses plugin han-plugin.yml to determine dirsWith and default command
	// 2. Legacy format: han hook run --dirs-with <file> -- <command>
	//    Explicit dirsWith and command specification
	hookCommand
		.command("run [args...]")
		.description(
			"Run a hook across directories.\n" +
				"New format: han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]\n" +
				"Legacy format: han hook run --dirs-with <file> -- <command>",
		)
		.option(
			"--no-fail-fast",
			"Disable fail-fast - continue running even after failures",
		)
		.option("--fail-fast", "(Deprecated) Fail-fast is now the default behavior")
		.option(
			"--dirs-with <file>",
			"(Legacy) Only run in directories containing the specified file",
		)
		.option(
			"--test-dir <command>",
			"(Legacy) Only include directories where this command exits 0",
		)
		.option(
			"--no-cache",
			"Disable caching - run even if no files have changed since last successful run",
		)
		.option("--cached", "(Deprecated) Caching is now the default behavior")
		.option(
			"--only <directory>",
			"Only run in the specified directory (for targeted re-runs after failures)",
		)
		.option(
			"--verbose",
			"Show full command output (also settable via HAN_HOOK_RUN_VERBOSE=1)",
		)
		.option(
			"--checkpoint-type <type>",
			"Checkpoint type to filter against (session or agent)",
		)
		.option("--checkpoint-id <id>", "Checkpoint ID to filter against")
		.allowUnknownOption()
		.action(
			async (
				args: string[],
				options: {
					failFast?: boolean;
					dirsWith?: string;
					testDir?: string;
					cache?: boolean;
					cached?: boolean;
					only?: string;
					verbose?: boolean;
					checkpointType?: string;
					checkpointId?: string;
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

				// Settings resolution: CLI --no-X options explicitly disable features.
				// If not passed, validate.ts will use han.yml defaults and check env vars.
				// Commander sets cache=false when --no-cache is used, failFast=false when --no-fail-fast is used.
				const cacheOverride = options.cache === false ? false : undefined;
				const failFastOverride = options.failFast === false ? false : undefined;

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
						failFast: failFastOverride ?? true, // Legacy format defaults to fail-fast
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
								"  New format:    han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]\n" +
								"  Legacy format: han hook run --dirs-with <file> -- <command>",
						);
						process.exit(1);
					}

					// Read checkpoint info from options or environment variables
					const checkpointTypeRaw =
						options.checkpointType || process.env.HAN_CHECKPOINT_TYPE;
					const checkpointId =
						options.checkpointId || process.env.HAN_CHECKPOINT_ID;

					// Validate checkpoint options
					if (checkpointTypeRaw && !checkpointId) {
						console.error(
							"Error: --checkpoint-id is required when --checkpoint-type is set",
						);
						process.exit(1);
					}
					if (
						checkpointTypeRaw &&
						checkpointTypeRaw !== "session" &&
						checkpointTypeRaw !== "agent"
					) {
						console.error(
							"Error: --checkpoint-type must be 'session' or 'agent'",
						);
						process.exit(1);
					}

					// Type-safe checkpoint type
					const checkpointType: "session" | "agent" | undefined =
						checkpointTypeRaw === "session" || checkpointTypeRaw === "agent"
							? checkpointTypeRaw
							: undefined;

					await runConfiguredHook({
						pluginName,
						hookName,
						failFast: failFastOverride, // undefined = use han.yml default
						cache: cacheOverride, // undefined = use han.yml default
						only: options.only,
						verbose,
						checkpointType,
						checkpointId,
					});
				}
			},
		);
}
