import Table from "cli-table3";
import type { MarketplacePlugin } from "./shared.js";
import { fetchMarketplace } from "./shared.js";

/**
 * Search for plugins in the Han marketplace
 */
export async function searchPlugins(query?: string): Promise<void> {
	console.log("🔍 Searching Han marketplace...\n");

	// Fetch all plugins from marketplace
	const plugins = await fetchMarketplace();

	if (plugins.length === 0) {
		console.error(
			"❌ Could not fetch plugins. Please check your internet connection.",
		);
		process.exit(1);
	}

	// Filter plugins based on query
	let filteredPlugins = plugins;
	if (query) {
		const lowerQuery = query.toLowerCase();
		filteredPlugins = plugins.filter((plugin) => {
			// Search in name, description, keywords, and category
			const nameMatch = plugin.name.toLowerCase().includes(lowerQuery);
			const descMatch = plugin.description?.toLowerCase().includes(lowerQuery);
			const keywordMatch = plugin.keywords?.some((k) =>
				k.toLowerCase().includes(lowerQuery),
			);
			const categoryMatch = plugin.category?.toLowerCase().includes(lowerQuery);
			return nameMatch || descMatch || keywordMatch || categoryMatch;
		});
	}

	if (filteredPlugins.length === 0) {
		console.log(`No plugins found matching "${query}"`);
		return;
	}

	// Display results in a table
	const table = new Table({
		head: ["Name", "Category", "Description"],
		colWidths: [30, 15, 60],
		wordWrap: true,
		style: {
			head: ["cyan", "bold"],
		},
	});

	for (const plugin of filteredPlugins) {
		table.push([
			plugin.name,
			plugin.category || "",
			plugin.description || "",
		]);
	}

	console.log(table.toString());
	console.log(
		`\n✓ Found ${filteredPlugins.length} plugin(s)${query ? ` matching "${query}"` : ""}`,
	);
	console.log(
		'\nTo install a plugin, run: han plugin install <plugin-name>\nExample: han plugin install bushido',
	);
}
