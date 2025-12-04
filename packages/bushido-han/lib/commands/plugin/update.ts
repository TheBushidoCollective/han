import type { Command } from "commander";
import {
	getCacheAge,
	hasCachedMarketplace,
	updateMarketplaceCache,
} from "../../marketplace-cache.js";

/**
 * Register `han plugin update-marketplace` command
 */
export function registerPluginUpdateMarketplace(program: Command): void {
	program
		.command("update-marketplace")
		.description("Update the local marketplace cache from GitHub")
		.action(async () => {
			try {
				console.log("Fetching latest marketplace data from GitHub...");

				const plugins = await updateMarketplaceCache();

				console.log(`✓ Updated marketplace cache with ${plugins.length} plugins`);

				// Show age of previous cache if it existed
				if (hasCachedMarketplace()) {
					const age = getCacheAge();
					if (age !== null && age > 0) {
						const hours = Math.round(age * 10) / 10;
						console.log(
							`  Previous cache was ${hours} hour${hours !== 1 ? "s" : ""} old`,
						);
					}
				}

				// List some notable plugins
				const categories = new Set(
					plugins.map((p) => p.category).filter((c): c is string => !!c),
				);
				console.log(`\nAvailable categories: ${Array.from(categories).join(", ")}`);
				console.log(
					`\nRun \`han plugin install --auto\` to get AI-recommended plugins`,
				);
			} catch (error) {
				console.error("Failed to update marketplace cache:");
				console.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});
}
