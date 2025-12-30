/**
 * GraphQL Settings types
 *
 * Represents configuration from all locations (user, project, local).
 */

import {
	getMcpServers,
	getPermissions,
	getSettingsSummary,
	type SettingsFile,
	type SettingsSummary,
} from "../../api/settings.ts";
import { builder } from "../builder.ts";

/**
 * Settings File type
 */
const SettingsFileRef = builder.objectRef<SettingsFile>("SettingsFile");

export const SettingsFileType = SettingsFileRef.implement({
	description: "A settings file with source information",
	fields: (t) => ({
		path: t.exposeString("path", {
			description: "Path to settings file",
		}),
		source: t.exposeString("source", {
			description: "Source location (user, project, local, root, directory)",
		}),
		sourceLabel: t.exposeString("sourceLabel", {
			description: "Human-readable source label",
		}),
		exists: t.exposeBoolean("exists", {
			description: "Whether the file exists",
		}),
		lastModified: t.string({
			nullable: true,
			description: "Last modification time",
			resolve: (s) => s.lastModified,
		}),
		type: t.exposeString("type", {
			description: "File type (claude or han)",
		}),
	}),
});

/**
 * Claude Settings Summary type
 */
interface ClaudeSettingsSummaryData {
	path: string;
	exists: boolean;
	lastModified: string | null;
	pluginCount: number;
	mcpServerCount: number;
	hasPermissions: boolean;
}

const ClaudeSettingsSummaryRef = builder.objectRef<ClaudeSettingsSummaryData>(
	"ClaudeSettingsSummary",
);

export const ClaudeSettingsSummaryType = ClaudeSettingsSummaryRef.implement({
	description: "Summary of Claude user settings",
	fields: (t) => ({
		path: t.exposeString("path", {
			description: "Path to settings file",
		}),
		exists: t.exposeBoolean("exists", {
			description: "Whether the settings file exists",
		}),
		lastModified: t.string({
			nullable: true,
			description: "Last modification time",
			resolve: (s) => s.lastModified,
		}),
		pluginCount: t.exposeInt("pluginCount", {
			description: "Number of enabled plugins",
		}),
		mcpServerCount: t.exposeInt("mcpServerCount", {
			description: "Number of configured MCP servers",
		}),
		hasPermissions: t.exposeBoolean("hasPermissions", {
			description: "Whether permissions are configured",
		}),
	}),
});

/**
 * Han Config Summary type
 */
interface HanConfigSummaryData {
	path: string;
	exists: boolean;
	lastModified: string | null;
	hooksEnabled: boolean;
	memoryEnabled: boolean;
	metricsEnabled: boolean;
	pluginConfigCount: number;
}

const HanConfigSummaryRef =
	builder.objectRef<HanConfigSummaryData>("HanConfigSummary");

export const HanConfigSummaryType = HanConfigSummaryRef.implement({
	description: "Summary of Han user configuration",
	fields: (t) => ({
		path: t.exposeString("path", {
			description: "Path to config file",
		}),
		exists: t.exposeBoolean("exists", {
			description: "Whether the config file exists",
		}),
		lastModified: t.string({
			nullable: true,
			description: "Last modification time",
			resolve: (s) => s.lastModified,
		}),
		hooksEnabled: t.exposeBoolean("hooksEnabled", {
			description: "Whether hooks are enabled",
		}),
		memoryEnabled: t.exposeBoolean("memoryEnabled", {
			description: "Whether memory is enabled",
		}),
		metricsEnabled: t.exposeBoolean("metricsEnabled", {
			description: "Whether metrics tracking is enabled",
		}),
		pluginConfigCount: t.exposeInt("pluginConfigCount", {
			description: "Number of plugins with custom configuration",
		}),
	}),
});

/**
 * MCP Server type
 */
interface McpServerData {
	name: string;
	command?: string;
	url?: string;
	type: string;
	argCount: number;
	hasEnv: boolean;
}

const McpServerRef = builder.objectRef<McpServerData>("McpServer");

export const McpServerType = McpServerRef.implement({
	description: "An MCP server configuration",
	fields: (t) => ({
		id: t.id({
			description: "Server ID",
			resolve: (s) => Buffer.from(`McpServer:${s.name}`).toString("base64"),
		}),
		name: t.exposeString("name", {
			description: "Server name",
		}),
		command: t.string({
			nullable: true,
			description: "Command to run the server",
			resolve: (s) => s.command ?? null,
		}),
		url: t.string({
			nullable: true,
			description: "URL for HTTP servers",
			resolve: (s) => s.url ?? null,
		}),
		type: t.exposeString("type", {
			description: "Server type (stdio or http)",
		}),
		argCount: t.exposeInt("argCount", {
			description: "Number of command arguments",
		}),
		hasEnv: t.exposeBoolean("hasEnv", {
			description: "Whether environment variables are configured",
		}),
	}),
});

/**
 * Permissions type
 */
interface PermissionsData {
	allowedTools: string[];
	deniedTools: string[];
	additionalDirectories: string[];
}

const PermissionsRef = builder.objectRef<PermissionsData>("Permissions");

export const PermissionsType = PermissionsRef.implement({
	description: "Claude permissions configuration",
	fields: (t) => ({
		allowedTools: t.stringList({
			description: "List of allowed tools",
			resolve: (p) => p.allowedTools,
		}),
		deniedTools: t.stringList({
			description: "List of denied tools",
			resolve: (p) => p.deniedTools,
		}),
		additionalDirectories: t.stringList({
			description: "Additional allowed directories",
			resolve: (p) => p.additionalDirectories,
		}),
	}),
});

/**
 * Settings Summary type (root for settings queries)
 */
const SettingsSummaryRef =
	builder.objectRef<SettingsSummary>("SettingsSummary");

export const SettingsSummaryType = SettingsSummaryRef.implement({
	description: "Settings summary with all configuration locations",
	fields: (t) => ({
		claudeSettingsFiles: t.field({
			type: [SettingsFileType],
			description: "All Claude settings files with source information",
			resolve: (s) => s.claudeSettingsFiles,
		}),
		hanConfigFiles: t.field({
			type: [SettingsFileType],
			description: "All Han config files with source information",
			resolve: (s) => s.hanConfigFiles,
		}),
		claudeSettings: t.field({
			type: ClaudeSettingsSummaryType,
			description: "Claude settings summary (legacy)",
			resolve: (s) => s.claudeSettings,
		}),
		hanConfig: t.field({
			type: HanConfigSummaryType,
			description: "Han configuration summary (legacy)",
			resolve: (s) => s.hanConfig,
		}),
		mcpServers: t.field({
			type: [McpServerType],
			description: "Configured MCP servers",
			resolve: () => getMcpServers(),
		}),
		permissions: t.field({
			type: PermissionsType,
			description: "Permissions configuration",
			resolve: () => getPermissions(),
		}),
	}),
});

/**
 * Query helpers
 */
export function querySettingsSummary(projectId?: string): SettingsSummary {
	return getSettingsSummary(projectId);
}

export function queryMcpServers(): McpServerData[] {
	return getMcpServers();
}

export function queryPermissions(): PermissionsData {
	return getPermissions();
}
