import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Marketplace source configuration
 */
export interface MarketplaceSource {
	source: "directory" | "git" | "github";
	path?: string;
	url?: string;
	repo?: string;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
	source: MarketplaceSource;
}

/**
 * Claude Code settings structure
 */
export interface ClaudeSettings {
	extraKnownMarketplaces?: Record<string, MarketplaceConfig>;
	enabledPlugins?: Record<string, boolean>;
	hooks?: Record<string, unknown>;
}

/**
 * Settings file locations in order of precedence (lowest to highest priority):
 * 1. User settings (~/.claude/settings.json) - Personal global settings
 * 2. Project settings (.claude/settings.json) - Team-shared project settings
 * 3. Local settings (.claude/settings.local.json) - Personal project-specific settings
 * 4. Enterprise managed settings (managed-settings.json) - Cannot be overridden
 *
 * @see https://code.claude.com/docs/en/settings
 */
export type SettingsScope = "user" | "project" | "local" | "enterprise";

/**
 * Get Claude config directory (~/.claude)
 */
export function getClaudeConfigDir(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return process.env.CLAUDE_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		return "";
	}
	return join(homeDir, ".claude");
}

/**
 * Get git root directory for the current working directory
 */
export function getGitRoot(): string | null {
	try {
		const result = execSync("git rev-parse --show-toplevel", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result.trim();
	} catch {
		return null;
	}
}

/**
 * Get project directory (current working directory)
 */
export function getProjectDir(): string {
	return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Read settings from a file path
 */
export function readSettingsFile(path: string): ClaudeSettings | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Get all settings file paths in order of precedence (lowest to highest)
 * @param projectPath - Optional explicit project path (overrides cwd-based detection)
 */
export function getSettingsPaths(
	projectPath?: string,
): { scope: SettingsScope; path: string }[] {
	const paths: { scope: SettingsScope; path: string }[] = [];
	const configDir = getClaudeConfigDir();

	// Use explicit projectPath if provided, otherwise fall back to cwd-based detection
	const projectDir = projectPath || getProjectDir();
	const gitRoot = projectPath ? null : getGitRoot(); // Skip git root if explicit path provided

	// 1. User settings (lowest priority)
	if (configDir) {
		paths.push({
			scope: "user",
			path: join(configDir, "settings.json"),
		});
	}

	// 2. Git root project settings (if different from projectDir)
	// This handles running from subdirectories like packages/han
	// Skip if explicit projectPath was provided (caller knows the exact path)
	if (gitRoot && gitRoot !== projectDir) {
		paths.push({
			scope: "project",
			path: join(gitRoot, ".claude", "settings.json"),
		});
		paths.push({
			scope: "local",
			path: join(gitRoot, ".claude", "settings.local.json"),
		});
	}

	// 3. Project settings (team-shared)
	paths.push({
		scope: "project",
		path: join(projectDir, ".claude", "settings.json"),
	});

	// 4. Local settings (personal project-specific)
	paths.push({
		scope: "local",
		path: join(projectDir, ".claude", "settings.local.json"),
	});

	// 5. Enterprise managed settings (highest priority, cannot be overridden)
	if (configDir) {
		paths.push({
			scope: "enterprise",
			path: join(configDir, "managed-settings.json"),
		});
	}

	return paths;
}

/**
 * Merge enabled plugins from multiple settings files.
 * Higher priority settings override lower priority ones.
 * Setting a plugin to false explicitly disables it.
 */
function mergeEnabledPlugins(
	base: Map<string, string>,
	settings: ClaudeSettings,
): void {
	if (!settings.enabledPlugins) return;

	for (const [key, enabled] of Object.entries(settings.enabledPlugins)) {
		if (!key.includes("@")) continue;

		const [pluginName, marketplace] = key.split("@");
		if (enabled) {
			base.set(pluginName, marketplace);
		} else {
			// Explicitly disabled - remove from map
			base.delete(pluginName);
		}
	}
}

/**
 * Merge marketplace configurations from multiple settings files.
 * Higher priority settings override lower priority ones.
 */
function mergeMarketplaces(
	base: Map<string, MarketplaceConfig>,
	settings: ClaudeSettings,
): void {
	if (!settings.extraKnownMarketplaces) return;

	for (const [name, config] of Object.entries(
		settings.extraKnownMarketplaces,
	)) {
		base.set(name, config);
	}
}

/**
 * Get all enabled plugins and marketplace configurations from merged settings.
 *
 * Settings are merged in order of precedence:
 * 1. User settings (~/.claude/settings.json) - lowest priority
 * 2. Project settings (.claude/settings.json)
 * 3. Local settings (.claude/settings.local.json)
 * 4. Enterprise settings (managed-settings.json) - highest priority
 *
 * @param projectPath - Optional explicit project path for settings lookup
 * @see https://code.claude.com/docs/en/settings
 */
export function getMergedPluginsAndMarketplaces(projectPath?: string): {
	plugins: Map<string, string>;
	marketplaces: Map<string, MarketplaceConfig>;
} {
	const plugins = new Map<string, string>();
	const marketplaces = new Map<string, MarketplaceConfig>();

	// Process settings in order of precedence (lowest to highest)
	for (const { path } of getSettingsPaths(projectPath)) {
		const settings = readSettingsFile(path);
		if (settings) {
			mergeMarketplaces(marketplaces, settings);
			mergeEnabledPlugins(plugins, settings);
		}
	}

	return { plugins, marketplaces };
}

/**
 * Get merged settings from all scopes.
 * This performs a deep merge with higher priority settings overriding lower ones.
 */
export function getMergedSettings(): ClaudeSettings {
	const merged: ClaudeSettings = {};

	for (const { path } of getSettingsPaths()) {
		const settings = readSettingsFile(path);
		if (settings) {
			// Merge extraKnownMarketplaces
			if (settings.extraKnownMarketplaces) {
				merged.extraKnownMarketplaces = {
					...merged.extraKnownMarketplaces,
					...settings.extraKnownMarketplaces,
				};
			}

			// Merge enabledPlugins
			if (settings.enabledPlugins) {
				merged.enabledPlugins = {
					...merged.enabledPlugins,
					...settings.enabledPlugins,
				};
			}

			// Merge hooks
			if (settings.hooks) {
				merged.hooks = {
					...merged.hooks,
					...settings.hooks,
				};
			}
		}
	}

	return merged;
}
