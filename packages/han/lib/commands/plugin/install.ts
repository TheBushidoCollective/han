import type { Command } from "commander";
import { install, installInteractive } from "../../install.ts";
import { installPlugins } from "../../plugin-install.ts";
import type { InstallScope } from "../../shared.ts";

export function registerPluginInstall(pluginCommand: Command): void {
	pluginCommand
		.command("install [plugin-names...]")
		.description("Install plugins interactively, or use --auto to auto-detect")
		.option("--auto", "Auto-detect and install recommended plugins")
		.option(
			"--scope <scope>",
			'Installation scope: "user" (~/.claude/settings.json), "project" (.claude/settings.json), or "local" (.claude/settings.local.json)',
			"user",
		)
		.action(
			async (
				pluginNames: string[],
				options: { auto?: boolean; scope?: string },
			) => {
				try {
					const scope = options.scope || "user";
					if (scope !== "user" && scope !== "project" && scope !== "local") {
						console.error(
							'Error: --scope must be "user", "project", or "local"',
						);
						process.exit(1);
					}

					if (options.auto) {
						await install(scope as InstallScope);
					} else if (pluginNames.length > 0) {
						await installPlugins(pluginNames, scope as InstallScope);
					} else {
						await installInteractive(scope as InstallScope);
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
}
