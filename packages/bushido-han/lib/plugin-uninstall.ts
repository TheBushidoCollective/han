import {
	getInstalledPlugins,
	readOrCreateSettings,
	writeSettings,
} from "./shared.js";

/**
 * Uninstall one or more plugins from Claude settings
 */
export async function uninstallPlugins(
	pluginNames: string[],
	scope: "project" | "local" = "project",
): Promise<void> {
	if (pluginNames.length === 0) {
		console.error("Error: No plugin names provided.");
		process.exit(1);
	}

	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Uninstalling from ./.claude/${filename}...\n`);

	const uninstalled: string[] = [];
	const notInstalled: string[] = [];

	for (const pluginName of pluginNames) {
		if (!currentPlugins.includes(pluginName)) {
			notInstalled.push(pluginName);
		} else if (settings.enabledPlugins) {
			const pluginKey = `${pluginName}@han`;
			delete settings.enabledPlugins[pluginKey];
			uninstalled.push(pluginName);
		}
	}

	// If no plugins left, remove the enabledPlugins object entirely
	if (
		settings.enabledPlugins &&
		Object.keys(settings.enabledPlugins).length === 0
	) {
		delete settings.enabledPlugins;
	}

	writeSettings(settings, scope);

	if (uninstalled.length > 0) {
		console.log(
			`✓ Uninstalled ${uninstalled.length} plugin(s): ${uninstalled.join(", ")}`,
		);
	}
	if (notInstalled.length > 0) {
		console.log(`⚠️  Not installed: ${notInstalled.join(", ")}`);
	}
	if (uninstalled.length > 0) {
		console.log("\n⚠️  Please restart Claude Code to apply changes");
	}
}

/**
 * Uninstall a specific plugin from Claude settings (convenience wrapper)
 */
export async function uninstallPlugin(
	pluginName: string,
	scope: "project" | "local" = "project",
): Promise<void> {
	return uninstallPlugins([pluginName], scope);
}
