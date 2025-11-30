import type { Command } from "commander";

export function registerPluginUninstall(pluginCommand: Command): void {
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

				const { uninstallPlugins } = await import("../../plugin-uninstall.js");
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
}
