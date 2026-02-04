/**
 * Repo Detail Page Utilities
 *
 * Helper functions for repo detail display.
 */

import type { Plugin } from "./types.ts";

/**
 * Get han.guru URL for a plugin
 */
export function getPluginUrl(plugin: Plugin): string {
	const { category, name } = plugin;
	return `https://han.guru/plugins/${category}/${name}/`;
}

/**
 * Category icons for plugins
 */
export const categoryIcons: Record<string, string> = {
	jutsu: "🎯",
	do: "🛤️",
	hashi: "🌉",
	core: "⛩️",
	other: "📦",
};

/**
 * Scope labels for display
 */
export const scopeLabels: Record<string, string> = {
	PROJECT: "Project",
	LOCAL: "Local",
};
