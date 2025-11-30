import type { Command } from "commander";

export function registerPluginSearch(pluginCommand: Command): void {
	pluginCommand
		.command("search [query]")
		.description("Search for plugins in the Han marketplace")
		.action(async (query: string | undefined) => {
			try {
				const { searchPlugins } = await import("../../plugin-search.js");
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
}
