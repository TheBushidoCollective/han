import { existsSync } from "node:fs";
import {
	detectPluginsByMarkers,
	loadPluginDetection,
} from "./marker-detection.ts";
import {
	fetchMarketplace,
	getClaudeSettingsPath,
	getInstalledPlugins,
	type InstallScope,
	type MarketplacePlugin,
} from "./shared.ts";

/**
 * Analyze gaps in the repository using marker-based detection
 * and display what plugins would add hooks for this codebase
 */
export async function analyzeGaps(): Promise<void> {
	console.log("Analyzing repository for plugin gaps...\n");

	try {
		// Fetch marketplace plugins
		const marketplacePlugins = await fetchMarketplace();

		// Load detection criteria from cached han-plugin.yml files
		console.log("Loading detection patterns from cached plugins...\n");
		const pluginsWithDetection = loadPluginDetection(marketplacePlugins);

		// Count plugins with detection data
		const withDetection = pluginsWithDetection.filter((p) => p.detection);
		console.log(
			`Found ${withDetection.length} plugins with detection patterns.\n`,
		);

		// Get installed plugins across all scopes
		const scopes: InstallScope[] = ["user", "project", "local"];
		const installedPluginNames = new Set<string>();

		for (const scope of scopes) {
			const settingsPath = getClaudeSettingsPath(scope);
			if (!existsSync(settingsPath)) continue;
			const plugins = getInstalledPlugins(scope);
			for (const plugin of plugins) {
				installedPluginNames.add(plugin);
			}
		}

		// Detect plugins using marker-based detection
		console.log("Scanning codebase for marker files...\n");
		const detectionResult = detectPluginsByMarkers(
			pluginsWithDetection,
			process.cwd(),
		);

		// Create lookup map for plugin metadata
		const pluginMap = new Map<string, MarketplacePlugin>();
		for (const plugin of marketplacePlugins) {
			pluginMap.set(plugin.name, plugin);
		}

		// Categorize detected plugins
		const detected: string[] = [];
		const missing: string[] = [];

		for (const pluginName of detectionResult.confident) {
			if (installedPluginNames.has(pluginName)) {
				detected.push(pluginName);
			} else {
				missing.push(pluginName);
			}
		}

		// Also check possible matches
		const possibleMissing: string[] = [];
		for (const pluginName of detectionResult.possible) {
			if (!installedPluginNames.has(pluginName)) {
				possibleMissing.push(pluginName);
			}
		}

		// Display results
		console.log("=".repeat(60));
		console.log("REPOSITORY GAP ANALYSIS");
		console.log("=".repeat(60));
		console.log();

		// Show detected and installed (good)
		if (detected.length > 0) {
			console.log("INSTALLED (hooks active for detected technologies):");
			for (const pluginName of detected) {
				const plugin = pluginMap.get(pluginName);
				const markers = detectionResult.details.get(pluginName);
				console.log(`  [x] ${pluginName}`);
				if (plugin?.description) {
					console.log(`      ${plugin.description}`);
				}
				if (markers && markers.length > 0) {
					console.log(
						`      Detected in: ${markers.slice(0, 3).join(", ")}${markers.length > 3 ? ` (+${markers.length - 3} more)` : ""}`,
					);
				}
				console.log();
			}
		}

		// Show detected but not installed (gaps)
		if (missing.length > 0) {
			console.log("-".repeat(60));
			console.log("GAPS (detected technologies without hooks):");
			console.log();
			for (const pluginName of missing) {
				const plugin = pluginMap.get(pluginName);
				const markers = detectionResult.details.get(pluginName);
				console.log(`  [ ] ${pluginName}`);
				if (plugin?.description) {
					console.log(`      ${plugin.description}`);
				}
				if (markers && markers.length > 0) {
					console.log(
						`      Detected in: ${markers.slice(0, 3).join(", ")}${markers.length > 3 ? ` (+${markers.length - 3} more)` : ""}`,
					);
				}
				console.log();
			}
		}

		// Show possible matches that aren't installed
		if (possibleMissing.length > 0) {
			console.log("-".repeat(60));
			console.log("POSSIBLE GAPS (marker files found, verification failed):");
			console.log();
			for (const pluginName of possibleMissing) {
				const plugin = pluginMap.get(pluginName);
				const markers = detectionResult.details.get(pluginName);
				console.log(`  [?] ${pluginName}`);
				if (plugin?.description) {
					console.log(`      ${plugin.description}`);
				}
				if (markers && markers.length > 0) {
					console.log(
						`      Detected in: ${markers.slice(0, 3).join(", ")}${markers.length > 3 ? ` (+${markers.length - 3} more)` : ""}`,
					);
				}
				console.log();
			}
		}

		// Summary
		console.log("=".repeat(60));
		console.log("SUMMARY");
		console.log("=".repeat(60));
		console.log();
		console.log(
			`Detected technologies:  ${detectionResult.confident.length + detectionResult.possible.length}`,
		);
		console.log(`Already covered:        ${detected.length}`);
		console.log(`Missing hooks:          ${missing.length}`);
		if (possibleMissing.length > 0) {
			console.log(`Possible gaps:          ${possibleMissing.length}`);
		}
		console.log();

		if (missing.length > 0) {
			console.log("To install missing plugins:");
			console.log(`  han plugin install ${missing.join(" ")}`);
			console.log();
			console.log("Or use auto-install:");
			console.log("  han plugin install --auto");
		} else if (detected.length === 0 && missing.length === 0) {
			console.log("No plugins detected via file markers.");
			console.log(
				"Your repository may use technologies without detection patterns,",
			);
			console.log("or the plugins don't have detection criteria defined.");
		} else {
			console.log(
				"All detected technologies are covered by installed plugins.",
			);
		}
		console.log();
	} catch (error) {
		console.error(
			"Error analyzing gaps:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}
