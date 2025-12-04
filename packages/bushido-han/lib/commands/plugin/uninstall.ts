import type { Command } from "commander";
import type { InstallScope } from "../../shared.js";

export function registerPluginUninstall(pluginCommand: Command): void {
	pluginCommand
		.command("uninstall <plugin-names...>")
		.description("Uninstall one or more plugins")
		.option(
			"--scope <scope>",
			'Installation scope: "user" (~/.claude/settings.json), "project" (.claude/settings.json), or "local" (.claude/settings.local.json)',
			"user",
		)
		.action(async (pluginNames: string[], options: { scope?: string }) => {
			try {
				const scope = options.scope || "user";
				if (scope !== "user" && scope !== "project" && scope !== "local") {
					console.error('Error: --scope must be "user", "project", or "local"');
					process.exit(1);
				}

				const { uninstallPlugins } = await import("../../plugin-uninstall.js");
				await uninstallPlugins(pluginNames, scope as InstallScope);
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
