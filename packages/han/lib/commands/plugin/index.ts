import type { Command } from "commander";
import { registerPluginInstall } from "./install.ts";
import { registerPluginList } from "./list.ts";
import { registerPluginSearch } from "./search.ts";
import { registerPluginUninstall } from "./uninstall.ts";
import { registerPluginUpdateMarketplace } from "./update.ts";

/**
 * Register all plugin management commands under `han plugin`
 */
export function registerPluginCommands(program: Command): void {
	const pluginCommand = program
		.command("plugin")
		.description("Manage Han plugins");

	registerPluginInstall(pluginCommand);
	registerPluginList(pluginCommand);
	registerPluginUninstall(pluginCommand);
	registerPluginSearch(pluginCommand);
	registerPluginUpdateMarketplace(pluginCommand);
}
