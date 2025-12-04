import type { Command } from "commander";
import { registerPluginInstall } from "./install.js";
import { registerPluginSearch } from "./search.js";
import { registerPluginUninstall } from "./uninstall.js";
import { registerPluginUpdateMarketplace } from "./update.js";

/**
 * Register all plugin management commands under `han plugin`
 */
export function registerPluginCommands(program: Command): void {
	const pluginCommand = program
		.command("plugin")
		.description("Manage Han plugins");

	registerPluginInstall(pluginCommand);
	registerPluginUninstall(pluginCommand);
	registerPluginSearch(pluginCommand);
	registerPluginUpdateMarketplace(pluginCommand);
}
