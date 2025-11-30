import type { Command } from "commander";
import { registerPluginInstall } from "./install.js";
import { registerPluginSearch } from "./search.js";
import { registerPluginUninstall } from "./uninstall.js";

export function registerPluginCommands(program: Command): void {
	const pluginCommand = program
		.command("plugin")
		.description("Manage Han plugins");

	registerPluginInstall(pluginCommand);
	registerPluginUninstall(pluginCommand);
	registerPluginSearch(pluginCommand);
}
