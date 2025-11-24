import {
	getInstalledPlugins,
	readOrCreateSettings,
	writeSettings,
} from "./shared.js";

/**
 * Uninstall a specific plugin from Claude settings
 */
export async function uninstallPlugin(
	pluginName: string,
	scope: "project" | "local" = "project",
): Promise<void> {
	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Uninstalling ${pluginName} from ./.claude/${filename}...\n`);

	// Check if plugin is installed
	if (!currentPlugins.includes(pluginName)) {
		console.log(`⚠️  Plugin "${pluginName}" is not installed`);
		return;
	}

	// Remove plugin from enabled plugins
	if (settings.enabledPlugins) {
		const pluginKey = `${pluginName}@han`;
		// biome-ignore lint/performance/noDelete: need to remove the key from the object
		delete settings.enabledPlugins[pluginKey];

		// If no plugins left, remove the enabledPlugins object entirely
		if (Object.keys(settings.enabledPlugins).length === 0) {
			delete settings.enabledPlugins;
		}
	}

	writeSettings(settings, scope);

	console.log(`✓ Uninstalled plugin: ${pluginName}`);
	console.log("\n⚠️  Please restart Claude Code to apply changes");
}
