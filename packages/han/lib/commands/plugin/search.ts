import type { Command } from "commander";
import { searchPlugins } from "../../plugin-search.ts";

export function registerPluginSearch(pluginCommand: Command): void {
	pluginCommand
		.command("search [query]")
		.description("Search for plugins in the Han marketplace")
		.action(async (query: string | undefined) => {
			try {
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
