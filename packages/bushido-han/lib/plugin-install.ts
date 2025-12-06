import {
	ensureClaudeDirectory,
	ensureDispatchHooks,
	fetchMarketplace,
	getInstalledPlugins,
	getSettingsFilename,
	HAN_MARKETPLACE_REPO,
	type InstallScope,
	type MarketplacePlugin,
	readOrCreateSettings,
	removeInvalidPlugins,
	writeSettings,
} from "./shared.js";

/**
 * Show available plugins grouped by category
 */
function showAvailablePlugins(marketplacePlugins: MarketplacePlugin[]): void {
	console.error("Available plugins:");

	const jutsus = marketplacePlugins
		.filter((p) => p.name.startsWith("jutsu-"))
		.map((p) => p.name);
	const dos = marketplacePlugins
		.filter((p) => p.name.startsWith("do-"))
		.map((p) => p.name);
	const hashis = marketplacePlugins
		.filter((p) => p.name.startsWith("hashi-"))
		.map((p) => p.name);
	const others = marketplacePlugins
		.filter(
			(p) =>
				!p.name.startsWith("jutsu-") &&
				!p.name.startsWith("do-") &&
				!p.name.startsWith("hashi-"),
		)
		.map((p) => p.name);

	if (others.length > 0) {
		console.error(`  Core: ${others.join(", ")}`);
	}
	if (jutsus.length > 0) {
		console.error(`  Jutsus: ${jutsus.join(", ")}`);
	}
	if (dos.length > 0) {
		console.error(`  Dōs: ${dos.join(", ")}`);
	}
	if (hashis.length > 0) {
		console.error(`  Hashis: ${hashis.join(", ")}`);
	}

	console.error("\nTip: Use 'han plugin search <query>' to find plugins.");
}

/**
 * Install one or more plugins to Claude settings
 */
export async function installPlugins(
	pluginNames: string[],
	scope: InstallScope = "user",
): Promise<void> {
	if (pluginNames.length === 0) {
		console.error("Error: No plugin names provided.");
		process.exit(1);
	}

	// Always include bushido plugin as a dependency
	const pluginsToInstall = new Set(pluginNames);
	pluginsToInstall.add("bushido");

	ensureClaudeDirectory(scope);

	// Validate plugins exist in marketplace
	console.log("Validating plugins against marketplace...\n");
	const marketplacePlugins = await fetchMarketplace();

	if (marketplacePlugins.length === 0) {
		console.error(
			"Error: Could not fetch marketplace. Please check your internet connection.",
		);
		process.exit(1);
	}

	const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

	// Check all plugins are valid, or search for similar ones
	const invalidPlugins = Array.from(pluginsToInstall).filter(
		(p) => !validPluginNames.has(p),
	);

	if (invalidPlugins.length > 0) {
		// If there's only one invalid plugin, try to search for it
		if (invalidPlugins.length === 1 && pluginNames.length === 1) {
			const query = invalidPlugins[0];
			const searchResults = await searchForPlugin(query, marketplacePlugins);

			if (searchResults.length === 0) {
				console.error(`Error: No plugins found matching "${query}"\n`);
				showAvailablePlugins(marketplacePlugins);
				process.exit(1);
			}

			// If exact match found after normalization, use it
			const exactMatch = searchResults.find(
				(p) => p.name.toLowerCase() === query.toLowerCase(),
			);
			if (exactMatch && searchResults.length === 1) {
				console.log(`✓ Found exact match: ${exactMatch.name}\n`);
				pluginsToInstall.delete(query);
				pluginsToInstall.add(exactMatch.name);
			} else {
				// Show interactive selector
				console.log(
					`Plugin "${query}" not found. Searching for similar plugins...\n`,
				);
				const { showPluginSelector } = await import(
					"./plugin-selector-wrapper.js"
				);
				const selectedPlugins = await showPluginSelector(
					searchResults,
					[],
					marketplacePlugins,
				);

				if (selectedPlugins.length === 0) {
					console.log("Installation cancelled.");
					process.exit(0);
				}

				// Replace the invalid plugin with selected ones
				pluginsToInstall.delete(query);
				for (const plugin of selectedPlugins) {
					pluginsToInstall.add(plugin);
				}
			}
		} else {
			console.error(
				`Error: Plugin(s) not found in Han marketplace: ${invalidPlugins.join(", ")}\n`,
			);
			showAvailablePlugins(marketplacePlugins);
			process.exit(1);
		}
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

	const filename = getSettingsFilename(scope);
	console.log(`Installing to ${filename}...\n`);

	// Add Han marketplace if not already added
	if (!settings?.extraKnownMarketplaces?.han) {
		settings.extraKnownMarketplaces = {
			...settings.extraKnownMarketplaces,
			han: { source: { source: "github", repo: HAN_MARKETPLACE_REPO } },
		};
		console.log("✓ Added Han marketplace");
	}

	const installed: string[] = [];
	const alreadyInstalled: string[] = [];

	for (const pluginName of pluginsToInstall) {
		if (currentPlugins.includes(pluginName)) {
			alreadyInstalled.push(pluginName);
		} else {
			settings.enabledPlugins = {
				...settings.enabledPlugins,
				[`${pluginName}@han`]: true,
			};
			installed.push(pluginName);
		}
	}

	writeSettings(settings, scope);

	if (installed.length > 0) {
		console.log(
			`✓ Installed ${installed.length} plugin(s): ${installed.join(", ")}`,
		);
	}
	if (alreadyInstalled.length > 0) {
		console.log(`⚠️  Already installed: ${alreadyInstalled.join(", ")}`);
	}

	// Ensure dispatch hooks are configured in global settings
	// This is a workaround for Claude Code bug #12151
	ensureDispatchHooks();

	if (installed.length > 0) {
		console.log("\n⚠️  Please restart Claude Code to load the new plugin(s)");
	}
}

/**
 * Install a specific plugin to Claude settings (convenience wrapper)
 */
export async function installPlugin(
	pluginName: string,
	scope: InstallScope = "user",
): Promise<void> {
	return installPlugins([pluginName], scope);
}

/**
 * Search for plugins matching a query
 */
function searchForPlugin(
	query: string,
	allPlugins: MarketplacePlugin[],
): MarketplacePlugin[] {
	const lowerQuery = query.toLowerCase();
	return allPlugins.filter((plugin) => {
		const nameMatch = plugin.name.toLowerCase().includes(lowerQuery);
		const descMatch = plugin.description?.toLowerCase().includes(lowerQuery);
		const keywordMatch = plugin.keywords?.some((k) =>
			k.toLowerCase().includes(lowerQuery),
		);
		const categoryMatch = plugin.category?.toLowerCase().includes(lowerQuery);
		return nameMatch || descMatch || keywordMatch || categoryMatch;
	});
}
