import {
	ensureClaudeDirectory,
	fetchMarketplace,
	getInstalledPlugins,
	HAN_MARKETPLACE_REPO,
	readOrCreateSettings,
	removeInvalidPlugins,
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

	// Validate plugin exists in marketplace
	console.log("Validating plugin against marketplace...\n");
	const marketplacePlugins = await fetchMarketplace();

	if (marketplacePlugins.length === 0) {
		console.error(
			"Error: Could not fetch marketplace. Please check your internet connection.",
		);
		process.exit(1);
	}

	const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

	if (!validPluginNames.has(pluginName)) {
		console.error(`Error: Plugin "${pluginName}" not found in Han marketplace.\n`);
		console.error("Available plugins:");

		// Group by category
		const bukis = marketplacePlugins
			.filter((p) => p.name.startsWith("buki-"))
			.map((p) => p.name);
		const dos = marketplacePlugins
			.filter((p) => p.name.startsWith("do-"))
			.map((p) => p.name);
		const senseis = marketplacePlugins
			.filter((p) => p.name.startsWith("sensei-"))
			.map((p) => p.name);
		const others = marketplacePlugins
			.filter(
				(p) =>
					!p.name.startsWith("buki-") &&
					!p.name.startsWith("do-") &&
					!p.name.startsWith("sensei-"),
			)
			.map((p) => p.name);

		if (others.length > 0) {
			console.error(`  Core: ${others.join(", ")}`);
		}
		if (bukis.length > 0) {
			console.error(`  Bukis: ${bukis.join(", ")}`);
		}
		if (dos.length > 0) {
			console.error(`  Dōs: ${dos.join(", ")}`);
		}
		if (senseis.length > 0) {
			console.error(`  Senseis: ${senseis.join(", ")}`);
		}

		console.error("\nTip: Use 'han plugin search <query>' to find plugins.");
		process.exit(1);
	}

	// Remove any invalid plugins that are no longer in the marketplace
	const removedPlugins = removeInvalidPlugins(validPluginNames, scope);
	if (removedPlugins.length > 0) {
		console.log(
			`✓ Removed ${removedPlugins.length} invalid plugin(s): ${removedPlugins.join(", ")}\n`,
		);
	}

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
