import type { Command } from "commander";

export function registerPluginInstall(pluginCommand: Command): void {
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
						const { install } = await import("../../install.js");
						await install(scope as "project" | "local");
					} else if (pluginNames.length > 0) {
						const { installPlugins } = await import("../../plugin-install.js");
						await installPlugins(pluginNames, scope as "project" | "local");
					} else {
						const { installInteractive } = await import("../../install.js");
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
}
