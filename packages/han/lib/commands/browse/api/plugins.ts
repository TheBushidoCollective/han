/**
 * Plugins API
 *
 * Reads installed plugin information from Claude settings.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type PluginScope = "user" | "project" | "local";

export interface InstalledPlugin {
	name: string;
	marketplace: string;
	scope: PluginScope;
	enabled: boolean;
}

export interface PluginStats {
	totalPlugins: number;
	userPlugins: number;
	projectPlugins: number;
	localPlugins: number;
	enabledPlugins: number;
}

/**
 * Get Claude config directory
 */
function getClaudeConfigDir(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return process.env.CLAUDE_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		throw new Error("Could not determine home directory");
	}
	return join(homeDir, ".claude");
}

/**
 * Get the settings file path for a specific scope
 */
function getSettingsPath(scope: PluginScope): string {
	const configDir = getClaudeConfigDir();

	switch (scope) {
		case "user":
			return join(configDir, "settings.json");
		case "project":
			return join(process.cwd(), ".claude", "settings.json");
		case "local":
			return join(process.cwd(), ".claude", "settings.local.json");
	}
}

/**
 * Read Claude settings from a file
 */
function readSettings(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Extract plugins from settings object
 */
function extractPlugins(
	settings: Record<string, unknown>,
	scope: PluginScope,
): InstalledPlugin[] {
	const plugins: InstalledPlugin[] = [];

	// Get enabled plugins
	const enabledPlugins =
		(settings.enabledPlugins as Record<string, boolean>) || {};

	for (const [key, enabled] of Object.entries(enabledPlugins)) {
		// Key format: plugin-name@marketplace
		const atIndex = key.lastIndexOf("@");
		if (atIndex === -1) {
			continue;
		}

		const name = key.slice(0, atIndex);
		const marketplace = key.slice(atIndex + 1);

		plugins.push({
			name,
			marketplace,
			scope,
			enabled: enabled === true,
		});
	}

	return plugins;
}

/**
 * Get installed plugins from all scopes
 */
export function getInstalledPlugins(): InstalledPlugin[] {
	const allPlugins: InstalledPlugin[] = [];
	const scopes: PluginScope[] = ["user", "project", "local"];

	for (const scope of scopes) {
		const path = getSettingsPath(scope);
		const settings = readSettings(path);

		if (settings) {
			const plugins = extractPlugins(settings, scope);
			allPlugins.push(...plugins);
		}
	}

	// Deduplicate by name (later scopes override earlier)
	const pluginMap = new Map<string, InstalledPlugin>();
	for (const plugin of allPlugins) {
		pluginMap.set(plugin.name, plugin);
	}

	return Array.from(pluginMap.values());
}

/**
 * Get plugins for a specific scope only
 */
export function getPluginsByScope(scope: PluginScope): InstalledPlugin[] {
	const path = getSettingsPath(scope);
	const settings = readSettings(path);

	if (!settings) {
		return [];
	}

	return extractPlugins(settings, scope);
}

/**
 * Get plugin statistics
 */
export function getPluginStats(): PluginStats {
	const userPlugins = getPluginsByScope("user");
	const projectPlugins = getPluginsByScope("project");
	const localPlugins = getPluginsByScope("local");

	const allPlugins = [...userPlugins, ...projectPlugins, ...localPlugins];

	return {
		totalPlugins: allPlugins.length,
		userPlugins: userPlugins.length,
		projectPlugins: projectPlugins.length,
		localPlugins: localPlugins.length,
		enabledPlugins: allPlugins.filter((p) => p.enabled).length,
	};
}

/**
 * Get plugin categories from installed plugins
 */
export function getPluginCategories(): Record<string, number> {
	const plugins = getInstalledPlugins();
	const categories: Record<string, number> = {
		jutsu: 0,
		do: 0,
		hashi: 0,
		core: 0,
		other: 0,
	};

	for (const plugin of plugins) {
		if (plugin.name.startsWith("jutsu-")) {
			categories.jutsu++;
		} else if (plugin.name.startsWith("do-")) {
			categories.do++;
		} else if (plugin.name.startsWith("hashi-")) {
			categories.hashi++;
		} else if (plugin.name === "core" || plugin.name.startsWith("core:")) {
			categories.core++;
		} else {
			categories.other++;
		}
	}

	return categories;
}

/**
 * Write settings to a file
 */
function writeSettings(path: string, settings: Record<string, unknown>): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(path, JSON.stringify(settings, null, 2));
}

/**
 * Toggle plugin enabled state
 */
export function togglePlugin(
	name: string,
	marketplace: string,
	scope: PluginScope,
	enabled: boolean,
): boolean {
	const path = getSettingsPath(scope);
	let settings = readSettings(path);

	if (!settings) {
		settings = {};
	}

	const enabledPlugins =
		(settings.enabledPlugins as Record<string, boolean>) || {};
	const key = `${name}@${marketplace}`;

	enabledPlugins[key] = enabled;
	settings.enabledPlugins = enabledPlugins;

	try {
		writeSettings(path, settings);
		return true;
	} catch (err) {
		console.error("Failed to toggle plugin:", err);
		return false;
	}
}

/**
 * Remove a plugin from settings
 */
export function removePlugin(
	name: string,
	marketplace: string,
	scope: PluginScope,
): boolean {
	const path = getSettingsPath(scope);
	const settings = readSettings(path);

	if (!settings) {
		return false;
	}

	const enabledPlugins =
		(settings.enabledPlugins as Record<string, boolean>) || {};
	const key = `${name}@${marketplace}`;

	if (!(key in enabledPlugins)) {
		return false;
	}

	delete enabledPlugins[key];
	settings.enabledPlugins = enabledPlugins;

	try {
		writeSettings(path, settings);
		return true;
	} catch (err) {
		console.error("Failed to remove plugin:", err);
		return false;
	}
}

/**
 * Get plugins for a specific project directory
 * Reads from both project and local scope settings for that directory
 */
export function getPluginsForProject(projectPath: string): InstalledPlugin[] {
	const allPlugins: InstalledPlugin[] = [];

	// Read project-scope settings
	const projectSettingsPath = join(projectPath, ".claude", "settings.json");
	const projectSettings = readSettings(projectSettingsPath);
	if (projectSettings) {
		allPlugins.push(...extractPlugins(projectSettings, "project"));
	}

	// Read local-scope settings
	const localSettingsPath = join(projectPath, ".claude", "settings.local.json");
	const localSettings = readSettings(localSettingsPath);
	if (localSettings) {
		allPlugins.push(...extractPlugins(localSettings, "local"));
	}

	// Deduplicate by name (local scope overrides project scope)
	const pluginMap = new Map<string, InstalledPlugin>();
	for (const plugin of allPlugins) {
		pluginMap.set(plugin.name, plugin);
	}

	return Array.from(pluginMap.values());
}

/**
 * Get plugin stats for a specific project directory
 */
export function getPluginStatsForProject(projectPath: string): PluginStats {
	const projectSettingsPath = join(projectPath, ".claude", "settings.json");
	const localSettingsPath = join(projectPath, ".claude", "settings.local.json");

	const projectSettings = readSettings(projectSettingsPath);
	const localSettings = readSettings(localSettingsPath);

	const projectPlugins = projectSettings
		? extractPlugins(projectSettings, "project")
		: [];
	const localPlugins = localSettings
		? extractPlugins(localSettings, "local")
		: [];

	const allPlugins = [...projectPlugins, ...localPlugins];

	return {
		totalPlugins: allPlugins.length,
		userPlugins: 0, // Not applicable for project-specific stats
		projectPlugins: projectPlugins.length,
		localPlugins: localPlugins.length,
		enabledPlugins: allPlugins.filter((p) => p.enabled).length,
	};
}
