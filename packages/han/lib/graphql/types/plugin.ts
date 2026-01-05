/**
 * GraphQL Plugin types
 *
 * Represents installed plugin data.
 */

import {
	getInstalledPlugins,
	getPluginCategories,
	getPluginStats,
	getPluginsByScope,
	type InstalledPlugin,
	type PluginScope,
	removePlugin,
	togglePlugin,
} from "../../api/plugins.ts";
import { builder } from "../builder.ts";

/**
 * Plugin scope enum
 */
export const PluginScopeEnum = builder.enumType("PluginScope", {
	values: ["USER", "PROJECT", "LOCAL"] as const,
	description: "Scope where plugin is installed",
});

/**
 * Plugin type ref
 */
const PluginRef = builder.objectRef<InstalledPlugin>("Plugin");

/**
 * Plugin type implementation
 */
export const PluginType = PluginRef.implement({
	description: "An installed plugin",
	fields: (t) => ({
		id: t.id({
			description: "Plugin ID",
			resolve: (p) =>
				Buffer.from(`Plugin:${p.name}@${p.marketplace}`).toString("base64"),
		}),
		name: t.exposeString("name", {
			description: "Plugin name",
		}),
		marketplace: t.exposeString("marketplace", {
			description: "Marketplace the plugin is from",
		}),
		scope: t.field({
			type: PluginScopeEnum,
			description: "Installation scope",
			resolve: (p) => p.scope.toUpperCase() as "USER" | "PROJECT" | "LOCAL",
		}),
		enabled: t.exposeBoolean("enabled", {
			description: "Whether the plugin is enabled",
		}),
		category: t.string({
			description: "Plugin category based on naming convention",
			resolve: (p) => {
				if (p.name.startsWith("jutsu-")) return "jutsu";
				if (p.name.startsWith("do-")) return "do";
				if (p.name.startsWith("hashi-")) return "hashi";
				if (
					p.name === "core" ||
					p.name === "bushido" ||
					p.name.startsWith("core:")
				)
					return "core";
				return "other";
			},
		}),
	}),
});

/**
 * Plugin stats type
 */
interface PluginStatsData {
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
 * Plugin category count type
 */
interface PluginCategoryData {
	category: string;
	count: number;
}

const PluginCategoryRef =
	builder.objectRef<PluginCategoryData>("PluginCategory");

export const PluginCategoryType = PluginCategoryRef.implement({
	description: "Plugin count by category",
	fields: (t) => ({
		category: t.exposeString("category", {
			description: "Category name",
		}),
		count: t.exposeInt("count", {
			description: "Number of plugins in this category",
		}),
	}),
});

/**
 * Get all installed plugins
 */
export function getAllPlugins(): InstalledPlugin[] {
	return getInstalledPlugins();
}

/**
 * Get plugins by scope
 */
export function queryPluginsByScope(scope: string): InstalledPlugin[] {
	const normalizedScope = scope.toLowerCase() as PluginScope;
	return getPluginsByScope(normalizedScope);
}

/**
 * Get plugin statistics
 */
export function queryPluginStats(): PluginStatsData {
	return getPluginStats();
}

/**
 * Get plugin categories
 */
export function queryPluginCategories(): PluginCategoryData[] {
	const categories = getPluginCategories();
	return Object.entries(categories)
		.filter(([, count]) => count > 0)
		.map(([category, count]) => ({ category, count }));
}

/**
 * Toggle plugin enabled state
 */
export function togglePluginEnabled(
	name: string,
	marketplace: string,
	scope: string,
	enabled: boolean,
): boolean {
	const normalizedScope = scope.toLowerCase() as PluginScope;
	return togglePlugin(name, marketplace, normalizedScope, enabled);
}

/**
 * Remove a plugin from settings
 */
export function removePluginFromSettings(
	name: string,
	marketplace: string,
	scope: string,
): boolean {
	const normalizedScope = scope.toLowerCase() as PluginScope;
	return removePlugin(name, marketplace, normalizedScope);
}
