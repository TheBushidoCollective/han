/**
 * GraphQL PluginStats type
 *
 * Aggregate plugin statistics.
 */

import { getPluginStats } from "../../api/plugins.ts";
import { builder } from "../builder.ts";

/**
 * Plugin stats data interface
 */
export interface PluginStatsData {
	totalPlugins: number;
	userPlugins: number;
	projectPlugins: number;
	localPlugins: number;
	enabledPlugins: number;
}

const PluginStatsRef = builder.objectRef<PluginStatsData>("PluginStats");

export const PluginStatsType = PluginStatsRef.implement({
	description: "Aggregate plugin statistics",
	fields: (t) => ({
		totalPlugins: t.exposeInt("totalPlugins", {
			description: "Total number of installed plugins",
		}),
		userPlugins: t.exposeInt("userPlugins", {
			description: "Plugins installed at user scope",
		}),
		projectPlugins: t.exposeInt("projectPlugins", {
			description: "Plugins installed at project scope",
		}),
		localPlugins: t.exposeInt("localPlugins", {
			description: "Plugins installed at local scope",
		}),
		enabledPlugins: t.exposeInt("enabledPlugins", {
			description: "Number of enabled plugins",
		}),
	}),
});

/**
 * Get plugin statistics
 */
export function queryPluginStats(): PluginStatsData {
	return getPluginStats();
}
