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

interface InstallResult {
	plugins?: string[];
	cancelled?: boolean;
	error?: Error;
}

/**
 * SDK-based auto-detect install command with Ink UI
 */
export async function install(
	scope: "project" | "local" = "project",
): Promise<void> {
	// Import Ink UI component dynamically to avoid issues with React
	const { InstallInteractive } = await import("./install-interactive.js");

	let resolveCompletion: ((result: InstallResult) => void) | undefined;

	const completionPromise = new Promise<InstallResult>((resolve) => {
		resolveCompletion = resolve;
	});

	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	console.log(`Installing to ./.claude/${filename}...\n`);

	const { unmount } = render(
		React.createElement(InstallInteractive, {
			detectPlugins: detectPluginsWithAgent,
			fetchMarketplace,
			onInstallComplete: (plugins: string[]) => {
				if (resolveCompletion) resolveCompletion({ plugins });
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
		const { added, removed } = syncPluginsToSettings(result.plugins, scope);
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
	}
}

/**
 * Interactive plugin selector (no auto-detect)
 */
export async function installInteractive(
	scope: "project" | "local" = "project",
): Promise<void> {
	const { PluginSelector } = await import("./plugin-selector.js");

	let resolveCompletion: ((result: { plugins?: string[]; cancelled?: boolean }) => void) | undefined;

	const completionPromise = new Promise<{ plugins?: string[]; cancelled?: boolean }>((resolve) => {
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
		const { added, removed } = syncPluginsToSettings(result.plugins, scope);
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
	}
}
