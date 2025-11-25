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
	.command("install [plugin-name]")
	.description("Install plugins interactively, or use --auto to auto-detect")
	.option("--auto", "Auto-detect and install recommended plugins")
	.option(
		"--scope <scope>",
		'Installation scope: "project" (.claude/settings.json) or "local" (.claude/settings.local.json)',
		"project",
	)
	.action(async (pluginName: string | undefined, options: { auto?: boolean; scope?: string }) => {
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
			} else if (pluginName) {
				// Install specific plugin
				const { installPlugin } = await import("./plugin-install.js");
				await installPlugin(pluginName, scope as "project" | "local");
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
	});

// Plugin uninstall subcommand
pluginCommand
	.command("uninstall <plugin-name>")
	.description("Uninstall a specific plugin")
	.option(
		"--scope <scope>",
		'Installation scope: "project" (.claude/settings.json) or "local" (.claude/settings.local.json)',
		"project",
	)
	.action(async (pluginName: string, options: { scope?: string }) => {
		try {
			const scope = options.scope || "project";
			if (scope !== "project" && scope !== "local") {
				console.error('Error: --scope must be either "project" or "local"');
				process.exit(1);
			}

			const { uninstallPlugin } = await import("./plugin-uninstall.js");
			await uninstallPlugin(pluginName, scope as "project" | "local");
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
const hookCommand = program
	.command("hook")
	.description("Hook utilities for monorepo validation");

// Hook run subcommand
hookCommand
	.command("run")
	.description("Run a command across directories")
	.option("--fail-fast", "Stop on first failure")
	.option(
		"--dirs-with <file>",
		"Only run in directories containing the specified file",
	)
	.argument("<command...>", "Command to run in each directory")
	.allowUnknownOption()
	.action(
		async (
			commandArgs: string[],
			options: { failFast?: boolean; dirsWith?: string },
		) => {
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
	.option(
		"--scope <scope>",
		'Installation scope: "project" or "local"',
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

// Alias: han validate -> han hook run
program
	.command("validate")
	.description("Alias for 'hook run'")
	.option("--fail-fast", "Stop on first failure")
	.option(
		"--dirs-with <file>",
		"Only run in directories containing the specified file",
	)
	.argument("<command...>", "Command to run in each directory")
	.allowUnknownOption()
	.action(
		async (
			commandArgs: string[],
			options: { failFast?: boolean; dirsWith?: string },
		) => {
			const { validate } = await import("./validate.js");
			validate({
				failFast: options.failFast || false,
				dirsWith: options.dirsWith || null,
				command: commandArgs.join(" "),
			});
		},
	);

program.parse();
