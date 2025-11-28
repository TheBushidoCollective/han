#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

// Version is injected at build time for binary builds, otherwise read from package.json
declare const __HAN_VERSION__: string | undefined;
const version = (() => {
	if (typeof __HAN_VERSION__ !== "undefined") {
		return __HAN_VERSION__;
	}
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packageJson = JSON.parse(
			readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
		);
		return packageJson.version;
	} catch {
		return "0.0.0-unknown";
	}
})();

const program = new Command();

program
	.name("han")
	.description("Utilities for The Bushido Collective's Han Code Marketplace")
	.version(version);

// Plugin command group
const pluginCommand = program
	.command("plugin")
	.description("Manage Han plugins");

// Plugin install subcommand
pluginCommand
	.command("install [plugin-names...]")
	.description("Install plugins interactively, or use --auto to auto-detect")
	.option("--auto", "Auto-detect and install recommended plugins")
	.option(
		"--scope <scope>",
		'Installation scope: "project" (.claude/settings.json) or "local" (.claude/settings.local.json)',
		"project",
	)
	.action(
		async (
			pluginNames: string[],
			options: { auto?: boolean; scope?: string },
		) => {
			try {
				const scope = options.scope || "project";
				if (scope !== "project" && scope !== "local") {
					console.error('Error: --scope must be either "project" or "local"');
					process.exit(1);
				}

				if (options.auto) {
					// Auto-detect plugins
					const { install } = await import("./install.js");
					await install(scope as "project" | "local");
				} else if (pluginNames.length > 0) {
					// Install specific plugin(s)
					const { installPlugins } = await import("./plugin-install.js");
					await installPlugins(pluginNames, scope as "project" | "local");
				} else {
					// Interactive mode - no auto-detect
					const { installInteractive } = await import("./install.js");
					await installInteractive(scope as "project" | "local");
				}
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error during plugin installation:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		},
	);

// Plugin uninstall subcommand
pluginCommand
	.command("uninstall <plugin-names...>")
	.description("Uninstall one or more plugins")
	.option(
		"--scope <scope>",
		'Installation scope: "project" (.claude/settings.json) or "local" (.claude/settings.local.json)',
		"project",
	)
	.action(async (pluginNames: string[], options: { scope?: string }) => {
		try {
			const scope = options.scope || "project";
			if (scope !== "project" && scope !== "local") {
				console.error('Error: --scope must be either "project" or "local"');
				process.exit(1);
			}

			const { uninstallPlugins } = await import("./plugin-uninstall.js");
			await uninstallPlugins(pluginNames, scope as "project" | "local");
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during plugin uninstallation:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

// Plugin search subcommand
pluginCommand
	.command("search [query]")
	.description("Search for plugins in the Han marketplace")
	.action(async (query: string | undefined) => {
		try {
			const { searchPlugins } = await import("./plugin-search.js");
			await searchPlugins(query);
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during plugin search:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

// Uninstall command
program
	.command("uninstall")
	.description("Remove Han marketplace and plugins")
	.action(async () => {
		const { uninstall } = await import("./uninstall.js");
		uninstall();
		process.exit(0);
	});

// Hook command group
const hookCommand = program.command("hook").description("Hook utilities");

// Hook run subcommand
// Supports two formats:
// 1. New format: han hook run <hookName> [--fail-fast] [--stdin]
//    Uses plugin config.json to determine dirsWith and default command
// 2. Legacy format: han hook run --dirs-with <file> -- <command>
//    Explicit dirsWith and command specification
hookCommand
	.command("run [hookNameOrArgs...]")
	.description(
		"Run a hook across directories.\n" +
			"New format: han hook run <hookName> [--fail-fast]\n" +
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
	.allowUnknownOption()
	.action(
		async (
			hookNameOrArgs: string[],
			options: {
				failFast?: boolean;
				dirsWith?: string;
				testDir?: string;
				stdin?: boolean;
			},
		) => {
			// Extract hookName from args (first non-flag argument)
			const hookName =
				hookNameOrArgs.length > 0 ? hookNameOrArgs[0] : undefined;
			// Detect format: check for -- separator (legacy) vs hookName (new)
			const separatorIndex = process.argv.indexOf("--");
			const isLegacyFormat = separatorIndex !== -1;

			// Read stdin if --stdin flag is present
			let stdinData: string | null = null;
			if (options.stdin) {
				const chunks: Buffer[] = [];
				for await (const chunk of process.stdin) {
					chunks.push(chunk);
				}
				stdinData = Buffer.concat(chunks).toString("utf8");
			}

			if (isLegacyFormat) {
				// Legacy format: han hook run --dirs-with package.json -- npm test
				const commandArgs = process.argv.slice(separatorIndex + 1);

				if (commandArgs.length === 0) {
					console.error(
						"Error: No command specified after --\n\nExample: han hook run --dirs-with package.json -- npm test",
					);
					process.exit(1);
				}

				// Quote arguments that contain spaces or special characters
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

				const { validate } = await import("./validate.js");
				await validate({
					failFast: options.failFast || false,
					dirsWith: options.dirsWith || null,
					testDir: options.testDir || null,
					command: quotedArgs.join(" "),
					stdinData,
				});
			} else {
				// New format: han hook run <hookName> [--fail-fast]
				if (!hookName) {
					console.error(
						"Error: Hook name is required.\n\n" +
							"Usage:\n" +
							"  New format:    han hook run <hookName> [--fail-fast]\n" +
							"  Legacy format: han hook run --dirs-with <file> -- <command>",
					);
					process.exit(1);
				}

				const { runConfiguredHook } = await import("./validate.js");
				await runConfiguredHook({
					hookName,
					failFast: options.failFast || false,
					stdinData,
				});
			}
		},
	);

// Hook test subcommand
hookCommand
	.command("test")
	.description("Validate hook configurations for all installed plugins")
	.option("--execute", "Execute hooks to verify they run successfully")
	.option("--verbose", "Show detailed output for all hooks")
	.action(async (options: { execute?: boolean; verbose?: boolean }) => {
		try {
			const { testHooks } = await import("./hook-test.js");
			await testHooks({ execute: options.execute, verbose: options.verbose });
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during hook testing:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

// ============================================
// Backwards compatibility aliases
// ============================================

// Alias: han install -> han plugin install --auto
program
	.command("install")
	.description("Alias for 'plugin install --auto'")
	.option(
		"--scope <scope>",
		'Installation scope: "project" or "local"',
		"project",
	)
	.action(async (options: { scope?: string }) => {
		try {
			const scope = options.scope || "project";
			if (scope !== "project" && scope !== "local") {
				console.error('Error: --scope must be either "project" or "local"');
				process.exit(1);
			}
			const { install } = await import("./install.js");
			await install(scope as "project" | "local");
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during installation:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

// Alias: han validate -> han hook run (deprecated)
program
	.command("validate [ignored...]")
	.description(
		"Alias for 'hook run'. Requires -- before command (e.g., han validate --dirs-with package.json -- npm test)",
	)
	.option("--fail-fast", "Stop on first failure")
	.option(
		"--dirs-with <file>",
		"Only run in directories containing the specified file",
	)
	.allowUnknownOption()
	.action(
		async (
			_ignored: string[],
			options: { failFast?: boolean; dirsWith?: string },
		) => {
			// Parse command from process.argv after --
			const separatorIndex = process.argv.indexOf("--");

			if (separatorIndex === -1) {
				console.error(
					"Error: Command must be specified after -- separator\n\nExample: han validate --dirs-with package.json -- npm test",
				);
				process.exit(1);
			}

			const commandArgs = process.argv.slice(separatorIndex + 1);

			if (commandArgs.length === 0) {
				console.error(
					"Error: No command specified after --\n\nExample: han validate --dirs-with package.json -- npm test",
				);
				process.exit(1);
			}

			const { validate } = await import("./validate.js");
			await validate({
				failFast: options.failFast || false,
				dirsWith: options.dirsWith || null,
				command: commandArgs.join(" "),
			});
		},
	);

program.parse();
