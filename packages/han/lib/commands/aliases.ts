import type { Command } from "commander";
import { install } from "../install.ts";
import { uninstall } from "../uninstall.ts";
import { validate } from "../validate.ts";

/**
 * Register backwards compatibility command aliases
 */
export function registerAliasCommands(program: Command): void {
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

	// Alias: han uninstall -> remove Han marketplace and plugins
	program
		.command("uninstall")
		.description("Remove Han marketplace and plugins")
		.action(async () => {
			uninstall();
			process.exit(0);
		});

	// Alias: han validate -> han hook run (deprecated legacy format)
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

				await validate({
					failFast: options.failFast || false,
					dirsWith: options.dirsWith || null,
					command: commandArgs.join(" "),
				});
			},
		);
}
