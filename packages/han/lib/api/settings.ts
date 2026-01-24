/**
 * Settings API
 *
 * Reads configuration from all locations following the precedence order.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { getClaudeConfigDir } from "../config/claude-settings.ts";

export interface ClaudeSettings {
	enabledPlugins: Record<string, boolean>;
	mcpServers: Record<string, McpServerConfig>;
	permissions: PermissionsConfig;
	other: Record<string, unknown>;
}

export interface McpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	type?: string;
}

export interface PermissionsConfig {
	allow?: string[];
	deny?: string[];
	additionalDirectories?: string[];
}

export interface HanConfig {
	hooks: HooksConfig;
	memory: MemoryConfig;
	metrics: MetricsConfig;
	plugins: Record<string, PluginConfig>;
}

export interface HooksConfig {
	enabled: boolean;
	checkpoints: boolean;
}

export interface MemoryConfig {
	enabled: boolean;
}

export interface MetricsConfig {
	enabled: boolean;
}

export interface PluginConfig {
	hooks?: Record<string, HookConfig>;
}

export interface HookConfig {
	enabled?: boolean;
	command?: string;
}

/**
 * Settings file with source information
 */
export interface SettingsFile {
	path: string;
	source: "user" | "project" | "local" | "root" | "directory";
	sourceLabel: string;
	exists: boolean;
	lastModified: string | null;
	type: "claude" | "han";
}

/**
 * Settings summary with all configuration locations
 */
export interface SettingsSummary {
	claudeSettingsFiles: SettingsFile[];
	hanConfigFiles: SettingsFile[];
	// Legacy fields for backward compatibility
	claudeSettings: {
		path: string;
		exists: boolean;
		lastModified: string | null;
		pluginCount: number;
		mcpServerCount: number;
		hasPermissions: boolean;
	};
	hanConfig: {
		path: string;
		exists: boolean;
		lastModified: string | null;
		hooksEnabled: boolean;
		memoryEnabled: boolean;
		metricsEnabled: boolean;
		pluginConfigCount: number;
	};
}

/**
 * Get user-level Claude settings path
 */
function getUserSettingsPath(): string {
	return join(getClaudeConfigDir(), "settings.json");
}

/**
 * Get user-level Han config path
 */
function getUserHanConfigPath(): string {
	return join(getClaudeConfigDir(), "han.yml");
}

/**
 * Read Claude settings.json
 */
export function readClaudeSettings(): ClaudeSettings | null {
	const path = getUserSettingsPath();
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;

		return {
			enabledPlugins: (parsed.enabledPlugins as Record<string, boolean>) || {},
			mcpServers: (parsed.mcpServers as Record<string, McpServerConfig>) || {},
			permissions: (parsed.permissions as PermissionsConfig) || {},
			other: Object.fromEntries(
				Object.entries(parsed).filter(
					([key]) =>
						!["enabledPlugins", "mcpServers", "permissions"].includes(key),
				),
			),
		};
	} catch {
		return null;
	}
}

/**
 * Read Han config (han.yml)
 */
export function readHanConfig(): HanConfig | null {
	const path = getUserHanConfigPath();
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		const parsed = parseYaml(content) as Record<string, unknown>;

		return {
			hooks: (parsed.hooks as HooksConfig) || {
				enabled: true,
				checkpoints: true,
			},
			memory: (parsed.memory as MemoryConfig) || { enabled: true },
			metrics: (parsed.metrics as MetricsConfig) || { enabled: true },
			plugins: (parsed.plugins as Record<string, PluginConfig>) || {},
		};
	} catch {
		return null;
	}
}

/**
 * Get file modification time
 */
function getLastModified(path: string): string | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const stats = statSync(path);
		return stats.mtime.toISOString();
	} catch {
		return null;
	}
}

/**
 * Get project path from project ID
 * The projectId is typically "org/repo" format (last 2 path components).
 * We need to resolve it to an actual path by looking at the projects directory.
 */
function getProjectPath(projectId?: string): string | null {
	if (!projectId) {
		return null;
	}

	// If it's already a full path, validate and return it
	if (projectId.startsWith("/") || projectId.match(/^[A-Z]:\\/)) {
		return existsSync(projectId) ? projectId : null;
	}

	// Try to find the project in Claude Code's projects directory
	// by matching against the encoded directory names
	const projectsPath = join(
		process.env.HOME || process.env.USERPROFILE || "",
		".claude",
		"projects",
	);

	if (!existsSync(projectsPath)) {
		return null;
	}

	// Look for a project directory that decodes to a path ending with this projectId
	try {
		const dirs = readdirSync(projectsPath);
		for (const dir of dirs) {
			const fullPath = join(projectsPath, dir);
			try {
				const stat = statSync(fullPath);
				if (!stat.isDirectory()) continue;

				// Decode the directory name back to a path
				const decodedPath = decodeProjectPath(dir);

				// Check if this path ends with the projectId
				// e.g., "/Volumes/dev/src/github.com/thebushidocollective/han" ends with "thebushidocollective/han"
				const pathParts = decodedPath.split("/").filter(Boolean);
				const lastTwo = pathParts.slice(-2).join("/");

				if (lastTwo === projectId) {
					// Found it! Return the decoded path
					return decodedPath;
				}
			} catch {
				// Skip this directory
			}
		}
	} catch {
		// Couldn't read projects directory
	}

	return null;
}

/**
 * Decode project path from directory name
 * (Simplified version from sessions.ts for settings use)
 */
function decodeProjectPath(dirName: string): string {
	// Basic decoding: replace dashes with slashes
	const rawName = dirName.startsWith("-") ? dirName.slice(1) : dirName;
	return `/${rawName.replace(/-/g, "/")}`;
}

/**
 * Get all Claude settings file locations
 */
function getClaudeSettingsFiles(projectPath?: string | null): SettingsFile[] {
	const files: SettingsFile[] = [];

	// User settings
	const userPath = getUserSettingsPath();
	files.push({
		path: userPath,
		source: "user",
		sourceLabel: "User",
		exists: existsSync(userPath),
		lastModified: getLastModified(userPath),
		type: "claude",
	});

	if (projectPath) {
		// Project settings
		const projectSettingsPath = join(projectPath, ".claude", "settings.json");
		files.push({
			path: projectSettingsPath,
			source: "project",
			sourceLabel: "Project",
			exists: existsSync(projectSettingsPath),
			lastModified: getLastModified(projectSettingsPath),
			type: "claude",
		});

		// Local settings (gitignored)
		const localSettingsPath = join(
			projectPath,
			".claude",
			"settings.local.json",
		);
		files.push({
			path: localSettingsPath,
			source: "local",
			sourceLabel: "Local",
			exists: existsSync(localSettingsPath),
			lastModified: getLastModified(localSettingsPath),
			type: "claude",
		});
	}

	return files;
}

/**
 * Get all Han config file locations
 */
function getHanConfigFiles(projectPath?: string | null): SettingsFile[] {
	const files: SettingsFile[] = [];

	// User global defaults
	const userPath = getUserHanConfigPath();
	files.push({
		path: userPath,
		source: "user",
		sourceLabel: "User",
		exists: existsSync(userPath),
		lastModified: getLastModified(userPath),
		type: "han",
	});

	if (projectPath) {
		// Project team settings (committed)
		const projectTeamPath = join(projectPath, ".claude", "han.yml");
		files.push({
			path: projectTeamPath,
			source: "project",
			sourceLabel: "Project",
			exists: existsSync(projectTeamPath),
			lastModified: getLastModified(projectTeamPath),
			type: "han",
		});

		// Local overrides (gitignored)
		const localPath = join(projectPath, ".claude", "han.local.yml");
		files.push({
			path: localPath,
			source: "local",
			sourceLabel: "Local",
			exists: existsSync(localPath),
			lastModified: getLastModified(localPath),
			type: "han",
		});

		// Project root config
		const rootPath = join(projectPath, "han.yml");
		files.push({
			path: rootPath,
			source: "root",
			sourceLabel: "Project Root",
			exists: existsSync(rootPath),
			lastModified: getLastModified(rootPath),
			type: "han",
		});

		// Note: Directory-specific settings (<dir>/han.yml) are not included
		// as they would require scanning the entire project tree
	}

	return files;
}

/**
 * Get settings summary for dashboard
 */
export function getSettingsSummary(projectId?: string): SettingsSummary {
	const claudePath = getUserSettingsPath();
	const hanPath = getUserHanConfigPath();

	const claudeSettings = readClaudeSettings();
	const hanConfig = readHanConfig();

	const projectPath = getProjectPath(projectId);

	return {
		claudeSettingsFiles: getClaudeSettingsFiles(projectPath),
		hanConfigFiles: getHanConfigFiles(projectPath),
		// Legacy fields for backward compatibility
		claudeSettings: {
			path: claudePath,
			exists: existsSync(claudePath),
			lastModified: getLastModified(claudePath),
			pluginCount: claudeSettings
				? Object.keys(claudeSettings.enabledPlugins).length
				: 0,
			mcpServerCount: claudeSettings
				? Object.keys(claudeSettings.mcpServers).length
				: 0,
			hasPermissions: claudeSettings
				? Object.keys(claudeSettings.permissions).length > 0
				: false,
		},
		hanConfig: {
			path: hanPath,
			exists: existsSync(hanPath),
			lastModified: getLastModified(hanPath),
			hooksEnabled: hanConfig?.hooks?.enabled ?? true,
			memoryEnabled: hanConfig?.memory?.enabled ?? true,
			metricsEnabled: hanConfig?.metrics?.enabled ?? true,
			pluginConfigCount: hanConfig ? Object.keys(hanConfig.plugins).length : 0,
		},
	};
}

/**
 * Get list of MCP servers
 */
export function getMcpServers(): Array<{
	name: string;
	command?: string;
	url?: string;
	type: string;
	argCount: number;
	hasEnv: boolean;
}> {
	const settings = readClaudeSettings();
	if (!settings) {
		return [];
	}

	return Object.entries(settings.mcpServers).map(([name, config]) => ({
		name,
		command: config.command,
		url: config.url,
		type: config.type || (config.url ? "http" : "stdio"),
		argCount: config.args?.length || 0,
		hasEnv: Object.keys(config.env || {}).length > 0,
	}));
}

/**
 * Get permissions configuration
 */
export function getPermissions(): {
	allowedTools: string[];
	deniedTools: string[];
	additionalDirectories: string[];
} {
	const settings = readClaudeSettings();
	if (!settings) {
		return {
			allowedTools: [],
			deniedTools: [],
			additionalDirectories: [],
		};
	}

	return {
		allowedTools: settings.permissions.allow || [],
		deniedTools: settings.permissions.deny || [],
		additionalDirectories: settings.permissions.additionalDirectories || [],
	};
}
