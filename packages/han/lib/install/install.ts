import { render } from "ink";
import React from "react";
import { PluginSelector } from "../plugins/index.ts";
import {
	detectPluginsWithAgent,
	ensureClaudeDirectory,
	fetchMarketplace,
	getInstalledPlugins,
	getSettingsFilename,
	HAN_MARKETPLACE_REPO,
	type InstallScope,
	type MarketplacePlugin,
	readOrCreateSettings,
	writeSettings,
} from "../shared/index.ts";
import {
	detectPluginsByMarkers,
	loadPluginDetection,
} from "../validation/index.ts";
import { InstallInteractive } from "./install-interactive.tsx";

interface PluginChanges {
	added: string[];
	removed: string[];
	invalid: string[];
}

/**
 * Sync plugins to Claude settings - adds selected, removes deselected, and cleans invalid
 * Note: "core" is always installed and cannot be removed
 * Note: For user scope, we only add plugins and clean invalid ones (no removal of deselected)
 *       because user settings are shared across all projects
 */
function syncPluginsToSettings(
	selectedPlugins: string[],
	validPluginNames: Set<string>,
	scope: InstallScope = "user",
): PluginChanges {
	ensureClaudeDirectory(scope);

	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);
	const added: string[] = [];
	const removed: string[] = [];
	const invalid: string[] = [];

	// Always include core
	const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

	// Add Han marketplace to extraMarketplaces
	if (!settings?.extraKnownMarketplaces?.han) {
		settings.extraKnownMarketplaces = {
			...settings.extraKnownMarketplaces,
			han: { source: { source: "github", repo: HAN_MARKETPLACE_REPO } },
		};
	}

	// Add newly selected plugins (only if valid)
	for (const plugin of pluginsToInstall) {
		if (validPluginNames.has(plugin)) {
			if (!currentPlugins.includes(plugin)) {
				added.push(plugin);
			}
			settings.enabledPlugins = {
				...settings.enabledPlugins,
				[`${plugin}@han`]: true,
			};
		}
	}

	// For user scope: only clean invalid plugins (plugins might be needed for other projects)
	// For project/local scope: also remove deselected plugins
	for (const plugin of currentPlugins) {
		if (!validPluginNames.has(plugin)) {
			// Plugin is not in marketplace - remove it (invalid in any scope)
			invalid.push(plugin);
			if (settings.enabledPlugins) {
				delete settings.enabledPlugins[`${plugin}@han`];
			}
		} else if (
			scope !== "user" &&
			plugin !== "core" &&
			!selectedPlugins.includes(plugin)
		) {
			// Plugin was deselected (only for project/local scope)
			removed.push(plugin);
			if (settings.enabledPlugins) {
				delete settings.enabledPlugins[`${plugin}@han`];
			}
		}
	}

	writeSettings(settings, scope);

	return { added, removed, invalid };
}

interface InstallResult {
	plugins?: string[];
	marketplacePlugins?: MarketplacePlugin[];
	cancelled?: boolean;
	error?: Error;
}

interface InstallOptions {
	useAiAnalysis?: boolean;
}

/**
 * Auto-detect install command with marker detection and optional AI analysis
 *
 * When useAiAnalysis is true (default): runs both marker detection and AI analysis
 * When useAiAnalysis is false: runs only marker detection (instant results)
 */
export async function install(
	scope: InstallScope = "user",
	options: InstallOptions = {},
): Promise<void> {
	const { useAiAnalysis = true } = options;

	let resolveCompletion: ((result: InstallResult) => void) | undefined;

	const completionPromise = new Promise<InstallResult>((resolve) => {
		resolveCompletion = resolve;
	});

	const filename = getSettingsFilename(scope);
	console.log(`Installing to ${filename}...\n`);

	// Show existing plugins
	const existingPlugins = getInstalledPlugins(scope);
	const hanPlugins = existingPlugins.filter(
		(p) =>
			p.startsWith("jutsu-") ||
			p.startsWith("do-") ||
			p.startsWith("hashi-") ||
			p === "core" ||
			p === "bushido",
	);
	if (hanPlugins.length > 0) {
		console.log(`Currently installed: ${hanPlugins.join(", ")}\n`);
	}

	// Store marketplace plugins for validation after UI completes
	let marketplacePlugins: MarketplacePlugin[] = [];

	// Pre-fetch marketplace to run marker detection
	console.log("Scanning codebase for marker files...\n");
	marketplacePlugins = await fetchMarketplace();
	if (marketplacePlugins.length === 0) {
		console.error(
			"Could not fetch marketplace. Please check your internet connection.",
		);
		return;
	}

	// Load detection criteria from cached han-plugin.yml files
	const pluginsWithDetection = loadPluginDetection(marketplacePlugins);

	// Run marker detection first (instant)
	const markerDetection = detectPluginsByMarkers(
		pluginsWithDetection,
		process.cwd(),
	);

	// Show marker detection results
	if (markerDetection.confident.length > 0) {
		console.log(
			`Detected via file markers: ${markerDetection.confident.join(", ")}`,
		);
	}
	if (markerDetection.possible.length > 0) {
		console.log(`Possible matches: ${markerDetection.possible.join(", ")}`);
	}
	if (
		markerDetection.confident.length === 0 &&
		markerDetection.possible.length === 0
	) {
		console.log("No plugins detected via file markers.");
	}
	console.log("");

	// Combine marker-detected plugins (bushido always included)
	const markerDetectedPlugins = [
		...new Set([
			"bushido",
			...markerDetection.confident,
			...markerDetection.possible,
		]),
	];

	if (!useAiAnalysis) {
		// Skip AI analysis - go directly to plugin selector with marker results
		const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

		const { unmount } = render(
			React.createElement(PluginSelector, {
				detectedPlugins: markerDetectedPlugins,
				installedPlugins: existingPlugins,
				allPlugins: marketplacePlugins,
				onComplete: (plugins: string[]) => {
					if (resolveCompletion)
						resolveCompletion({ plugins, marketplacePlugins });
				},
				onCancel: () => {
					if (resolveCompletion) resolveCompletion({ cancelled: true });
				},
			}),
		);

		const result = await completionPromise;
		unmount();

		// Show results after UI is cleared
		if (result.cancelled) {
			console.log("\n⚠️  Installation cancelled");
		} else if (result.plugins) {
			const { added, removed, invalid } = syncPluginsToSettings(
				result.plugins,
				validPluginNames,
				scope,
			);
			showInstallResults(added, removed, invalid);
		}
		return;
	}

	// Use AI analysis - run InstallInteractive with marker results as starting point
	console.log("Starting AI analysis for additional recommendations...\n");

	const { unmount } = render(
		React.createElement(InstallInteractive, {
			detectPlugins: async (callbacks) => {
				// Wrap the AI detection to merge with marker results
				await detectPluginsWithAgent({
					...callbacks,
					onComplete: (aiPlugins: string[], fullText: string) => {
						// Merge AI results with marker detection results
						const mergedPlugins = [
							...new Set([...markerDetectedPlugins, ...aiPlugins]),
						];
						callbacks.onComplete(mergedPlugins, fullText);
					},
				});
			},
			fetchMarketplace: async () => {
				// Already fetched, return cached
				return marketplacePlugins;
			},
			installedPlugins: existingPlugins,
			onInstallComplete: (plugins: string[]) => {
				if (resolveCompletion)
					resolveCompletion({ plugins, marketplacePlugins });
			},
			onInstallError: (error: Error) => {
				if (resolveCompletion) resolveCompletion({ error });
			},
			onCancel: () => {
				if (resolveCompletion) resolveCompletion({ cancelled: true });
			},
		}),
	);

	const result = await completionPromise;
	unmount();

	// Show results after UI is cleared
	if (result.error) {
		throw result.error;
	} else if (result.cancelled) {
		console.log("\n⚠️  Installation cancelled");
	} else if (result.plugins) {
		const validPluginNames = new Set(
			(result.marketplacePlugins || []).map((p) => p.name),
		);
		const { added, removed, invalid } = syncPluginsToSettings(
			result.plugins,
			validPluginNames,
			scope,
		);
		showInstallResults(added, removed, invalid);
	}
}

/**
 * Display install results summary
 */
function showInstallResults(
	added: string[],
	removed: string[],
	invalid: string[],
): void {
	if (invalid.length > 0) {
		console.log(
			`\n✓ Removed ${invalid.length} invalid plugin(s): ${invalid.join(", ")}`,
		);
	}
	if (added.length > 0) {
		console.log(`\n✓ Added ${added.length} plugin(s): ${added.join(", ")}`);
	}
	if (removed.length > 0) {
		console.log(
			`\n✓ Removed ${removed.length} plugin(s): ${removed.join(", ")}`,
		);
	}
	if (added.length === 0 && removed.length === 0 && invalid.length === 0) {
		console.log("\n✓ No changes made");
	}
	console.log("\n⚠️  Please restart Claude Code to load the new plugins");
}

/**
 * Interactive plugin selector (no auto-detect)
 */
export async function installInteractive(
	scope: InstallScope = "user",
): Promise<void> {
	let resolveCompletion:
		| ((result: { plugins?: string[]; cancelled?: boolean }) => void)
		| undefined;

	const completionPromise = new Promise<{
		plugins?: string[];
		cancelled?: boolean;
	}>((resolve) => {
		resolveCompletion = resolve;
	});

	const filename = getSettingsFilename(scope);
	console.log(`Installing to ${filename}...\n`);

	// Fetch marketplace plugins
	const allPlugins = await fetchMarketplace();
	if (allPlugins.length === 0) {
		console.error(
			"Could not fetch marketplace. Please check your internet connection.",
		);
		return;
	}

	const validPluginNames = new Set(allPlugins.map((p) => p.name));

	// Get currently installed plugins
	const installedPlugins = getInstalledPlugins(scope);

	const { unmount } = render(
		React.createElement(PluginSelector, {
			detectedPlugins: installedPlugins,
			installedPlugins: installedPlugins,
			allPlugins,
			onComplete: (plugins: string[]) => {
				if (resolveCompletion) resolveCompletion({ plugins });
			},
			onCancel: () => {
				if (resolveCompletion) resolveCompletion({ cancelled: true });
			},
		}),
	);

	const result = await completionPromise;
	unmount();

	// Show results after UI is cleared
	if (result.cancelled) {
		console.log("\n⚠️  Installation cancelled");
	} else if (result.plugins) {
		const { added, removed, invalid } = syncPluginsToSettings(
			result.plugins,
			validPluginNames,
			scope,
		);
		showInstallResults(added, removed, invalid);
	}
}
