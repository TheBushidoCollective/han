/**
 * GraphQL Plugin type
 *
 * Represents an installed plugin.
 */

import {
	getInstalledPlugins,
	getPluginsByScope,
	type InstalledPlugin,
	type PluginScope,
	removePlugin,
	togglePlugin,
} from "../../api/plugins.ts";
import { builder } from "../builder.ts";
import { PluginScopeEnum } from "./enums/plugin-scope.ts";

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
