import {
	ensureClaudeDirectory,
	getInstalledPlugins,
	HAN_MARKETPLACE_REPO,
	readOrCreateSettings,
	writeSettings,
} from "./shared.js";

/**
 * Install a specific plugin to Claude settings
 */
export async function installPlugin(
	pluginName: string,
	scope: "project" | "local" = "project",
): Promise<void> {
	ensureClaudeDirectory();

	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Installing ${pluginName} to ./.claude/${filename}...\n`);

	// Add Han marketplace if not already added
	if (!settings?.extraKnownMarketplaces?.han) {
		settings.extraKnownMarketplaces = {
			...settings.extraKnownMarketplaces,
			han: { source: { source: "github", repo: HAN_MARKETPLACE_REPO } },
		};
		console.log("✓ Added Han marketplace");
	}

	// Check if plugin is already installed
	if (currentPlugins.includes(pluginName)) {
		console.log(`\n⚠️  Plugin "${pluginName}" is already installed`);
		return;
	}

	// Add plugin to enabled plugins
	settings.enabledPlugins = {
		...settings.enabledPlugins,
		[`${pluginName}@han`]: true,
	};

	writeSettings(settings, scope);

	console.log(`✓ Installed plugin: ${pluginName}`);
	console.log("\n⚠️  Please restart Claude Code to load the new plugin");
}
