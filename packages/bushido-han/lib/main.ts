#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
);

const program = new Command();

program
	.name("han")
	.description("Utilities for The Bushido Collective's Han Code Marketplace")
	.version(packageJson.version);

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

// Plugin align subcommand
pluginCommand
	.command("align")
	.description(
		"Align plugins with current codebase state in Claude Code settings",
	)
	.option(
		"--scope <scope>",
		'Installation scope: "project" (.claude/settings.json), "local" (.claude/settings.local.json), or auto-detect if not specified',
	)
	.action(async (options: { scope?: string }) => {
		try {
			let scope: "project" | "local" | undefined;
			if (options.scope) {
				if (options.scope !== "project" && options.scope !== "local") {
					console.error('Error: --scope must be either "project" or "local"');
					process.exit(1);
				}
				scope = options.scope as "project" | "local";
			}
			const { align } = await import("./align.js");
			await align(scope);
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during alignment:",
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
hookCommand
	.command("run [ignored...]")
	.description(
		"Run a command across directories. Requires -- before command (e.g., han hook run --dirs-with package.json -- npm test)",
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
					"Error: Command must be specified after -- separator\n\nExample: han hook run --dirs-with package.json -- npm test",
				);
				process.exit(1);
			}

			const commandArgs = process.argv.slice(separatorIndex + 1);

			if (commandArgs.length === 0) {
				console.error(
					"Error: No command specified after --\n\nExample: han hook run --dirs-with package.json -- npm test",
				);
				process.exit(1);
			}

			const { validate } = await import("./validate.js");
			validate({
				failFast: options.failFast || false,
				dirsWith: options.dirsWith || null,
				command: commandArgs.join(" "),
			});
		},
	);

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

// Alias: han align -> han plugin align
program
	.command("align")
	.description("Alias for 'plugin align'")
	.option("--scope <scope>", 'Installation scope: "project" or "local"')
	.action(async (options: { scope?: string }) => {
		try {
			let scope: "project" | "local" | undefined;
			if (options.scope) {
				if (options.scope !== "project" && options.scope !== "local") {
					console.error('Error: --scope must be either "project" or "local"');
					process.exit(1);
				}
				scope = options.scope as "project" | "local";
			}
			const { align } = await import("./align.js");
			await align(scope);
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error during alignment:",
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
			validate({
				failFast: options.failFast || false,
				dirsWith: options.dirsWith || null,
				command: commandArgs.join(" "),
			});
		},
	);

program.parse();
