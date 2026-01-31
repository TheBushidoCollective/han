import type { Command } from "commander";
import { runMigration } from "../../migrate.ts";

/**
 * Register the `han plugin migrate` command.
 *
 * This command migrates old plugin names (e.g., `jutsu-typescript@han`) to
 * new short names (e.g., `typescript@han`) in all Claude settings files.
 *
 * The migration is idempotent - running it multiple times is safe.
 */
export function registerPluginMigrate(parent: Command): void {
	parent
		.command("migrate")
		.description("Migrate old plugin names to new short names in settings files")
		.option("-v, --verbose", "Show detailed output even when no changes made")
		.option("-s, --silent", "Suppress all output")
		.option(
			"-p, --project <path>",
			"Project path for project/local settings",
			process.cwd(),
		)
		.action((options) => {
			const modified = runMigration({
				projectPath: options.project,
				verbose: options.verbose,
				silent: options.silent,
			});

			if (!options.silent && !modified && !options.verbose) {
				console.log("No plugin names needed migration.");
			}
		});
}
