import { render } from "ink";
import React from "react";
import {
	detectPluginsWithAgent,
	ensureClaudeDirectory,
	fetchMarketplace,
	getInstalledPlugins,
	HAN_MARKETPLACE_REPO,
	readOrCreateSettings,
	writeSettings,
} from "./shared.js";

interface PluginChanges {
	added: string[];
	removed: string[];
}

/**
 * Sync plugins to Claude settings - adds selected and removes deselected
 */
function syncPluginsToSettings(
	selectedPlugins: string[],
	scope: "project" | "local" = "project",
): PluginChanges {
	ensureClaudeDirectory();

	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);
	const added: string[] = [];
	const removed: string[] = [];

	// Add Han marketplace to extraMarketplaces
	if (!settings?.extraKnownMarketplaces?.han) {
		settings.extraKnownMarketplaces = {
			...settings.extraKnownMarketplaces,
			han: { source: { source: "github", repo: HAN_MARKETPLACE_REPO } },
		};
	}

	// Add newly selected plugins
	for (const plugin of selectedPlugins) {
		if (!currentPlugins.includes(plugin)) {
			added.push(plugin);
		}
		settings.enabledPlugins = {
			...settings.enabledPlugins,
			[`${plugin}@han`]: true,
		};
	}

	// Remove deselected plugins
	for (const plugin of currentPlugins) {
		if (!selectedPlugins.includes(plugin)) {
			removed.push(plugin);
			if (settings.enabledPlugins) {
				delete settings.enabledPlugins[`${plugin}@han`];
			}
		}
	}

	writeSettings(settings, scope);

	return { added, removed };
}

/**
 * SDK-based auto-detect install command with Ink UI
 */
export async function install(
	scope: "project" | "local" = "project",
): Promise<void> {
	// Import Ink UI component dynamically to avoid issues with React
	const { InstallInteractive } = await import("./install-interactive.js");

	let resolveCompletion: (() => void) | undefined;
	let rejectCompletion: ((error: Error) => void) | undefined;
	let wasCancelled = false;

	const completionPromise = new Promise<void>((resolve, reject) => {
		resolveCompletion = resolve;
		rejectCompletion = reject;
	});

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Installing to ./.claude/${filename}...\n`);

	const { unmount } = render(
		React.createElement(InstallInteractive, {
			detectPlugins: detectPluginsWithAgent,
			fetchMarketplace,
			onInstallComplete: (plugins: string[]) => {
				const { added, removed } = syncPluginsToSettings(plugins, scope);
				if (added.length > 0) {
					console.log(`\n✓ Added ${added.length} plugin(s): ${added.join(", ")}`);
				}
				if (removed.length > 0) {
					console.log(`\n✓ Removed ${removed.length} plugin(s): ${removed.join(", ")}`);
				}
				if (added.length === 0 && removed.length === 0) {
					console.log("\n✓ No changes made");
				}
				console.log("\n⚠️  Please restart Claude Code to load the new plugins");
				if (resolveCompletion) resolveCompletion();
			},
			onInstallError: (error: Error) => {
				if (rejectCompletion) rejectCompletion(error);
			},
			onCancel: () => {
				wasCancelled = true;
				console.log("\n⚠️  Installation cancelled");
				if (resolveCompletion) resolveCompletion();
			},
		}),
	);

	try {
		await completionPromise;
		// Wait a moment for the UI to show completion message
		if (!wasCancelled) {
			await new Promise((resolve) => setTimeout(resolve, 1500));
		}
	} finally {
		unmount();
	}
}

/**
 * Interactive plugin selector (no auto-detect)
 */
export async function installInteractive(
	scope: "project" | "local" = "project",
): Promise<void> {
	const { PluginSelector } = await import("./plugin-selector.js");

	let resolveCompletion: (() => void) | undefined;
	let wasCancelled = false;

	const completionPromise = new Promise<void>((resolve) => {
		resolveCompletion = resolve;
	});

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Installing to ./.claude/${filename}...\n`);

	// Fetch marketplace plugins
	const allPlugins = await fetchMarketplace();
	if (allPlugins.length === 0) {
		console.error("Could not fetch marketplace. Please check your internet connection.");
		return;
	}

	// Get currently installed plugins
	const installedPlugins = getInstalledPlugins(scope);

	const { unmount } = render(
		React.createElement(PluginSelector, {
			detectedPlugins: installedPlugins,
			allPlugins,
			onComplete: (plugins: string[]) => {
				const { added, removed } = syncPluginsToSettings(plugins, scope);
				if (added.length > 0) {
					console.log(`\n✓ Added ${added.length} plugin(s): ${added.join(", ")}`);
				}
				if (removed.length > 0) {
					console.log(`\n✓ Removed ${removed.length} plugin(s): ${removed.join(", ")}`);
				}
				if (added.length === 0 && removed.length === 0) {
					console.log("\n✓ No changes made");
				}
				console.log("\n⚠️  Please restart Claude Code to load the new plugins");
				if (resolveCompletion) resolveCompletion();
			},
			onCancel: () => {
				wasCancelled = true;
				console.log("\n⚠️  Installation cancelled");
				if (resolveCompletion) resolveCompletion();
			},
		}),
	);

	try {
		await completionPromise;
		if (!wasCancelled) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	} finally {
		unmount();
	}
}
