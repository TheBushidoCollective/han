import { existsSync } from "node:fs";
import Table from "cli-table3";
import {
	fetchMarketplace,
	getClaudeSettingsPath,
	getInstalledPlugins,
	type InstallScope,
	type MarketplacePlugin,
} from "../shared/index.ts";

interface PluginInfo {
	name: string;
	scope: string;
	description?: string;
	category?: string;
}

/**
 * List installed plugins from one or all scopes
 */
export async function listPlugins(scopeOption: string = "all"): Promise<void> {
	const scopes: InstallScope[] =
		scopeOption === "all"
			? ["user", "project", "local"]
			: [scopeOption as InstallScope];

	// Validate scope
	for (const scope of scopes) {
		if (scope !== "user" && scope !== "project" && scope !== "local") {
			console.error(
				'Error: --scope must be "user", "project", "local", or "all"',
			);
			process.exit(1);
		}
	}

	// Fetch marketplace data for descriptions
	console.log("Fetching plugin information...\n");
	const marketplacePlugins = await fetchMarketplace();
	const pluginInfoMap = new Map<string, MarketplacePlugin>();
	for (const plugin of marketplacePlugins) {
		pluginInfoMap.set(plugin.name, plugin);
	}

	// Collect plugins from each scope
	const allPlugins: PluginInfo[] = [];
	const scopeLabels = {
		user: "User (~/.claude)",
		project: "Project (.claude)",
		local: "Local (.claude, gitignored)",
	};

	for (const scope of scopes) {
		const settingsPath = getClaudeSettingsPath(scope);
		if (!existsSync(settingsPath)) {
			continue; // Skip non-existent settings files
		}

		const plugins = getInstalledPlugins(scope);
		for (const pluginName of plugins) {
			const marketplaceInfo = pluginInfoMap.get(pluginName);
			allPlugins.push({
				name: pluginName,
				scope: scopeLabels[scope],
				description: marketplaceInfo?.description,
				category: marketplaceInfo?.category,
			});
		}
	}

	if (allPlugins.length === 0) {
		console.log("No plugins installed.");
		console.log("\nTo install plugins, run: han plugin install <plugin-name>");
		console.log("Or use: han plugin install --auto");
		return;
	}

	// Display in a table
	const table = new Table({
		head: ["Plugin", "Scope", "Category", "Description"],
		colWidths: [25, 25, 15, 50],
		wordWrap: true,
		style: {
			head: ["cyan", "bold"],
		},
	});

	for (const plugin of allPlugins) {
		table.push([
			plugin.name,
			plugin.scope,
			plugin.category || "",
			plugin.description || "",
		]);
	}

	console.log(table.toString());
	console.log(`\n✓ Total: ${allPlugins.length} plugin(s) installed`);
}
