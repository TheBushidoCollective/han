/**
 * Settings Page Types
 *
 * Shared interfaces for settings page components.
 */

export interface SettingsFile {
	path: string;
	source: string;
	sourceLabel: string;
	exists: boolean;
	lastModified: string | null;
	type: string;
}

export interface ClaudeSettingsSummary {
	path: string;
	exists: boolean;
	lastModified: string | null;
	pluginCount: number;
	mcpServerCount: number;
	hasPermissions: boolean;
}

export interface HanConfigSummary {
	path: string;
	exists: boolean;
	lastModified: string | null;
	hooksEnabled: boolean;
	memoryEnabled: boolean;
	metricsEnabled: boolean;
	pluginConfigCount: number;
}

export interface McpServer {
	id: string;
	name: string;
	command: string | null;
	url: string | null;
	type: string;
	argCount: number;
	hasEnv: boolean;
}

export interface Permissions {
	allowedTools: string[];
	deniedTools: string[];
	additionalDirectories: string[];
}

export interface SettingsData {
	viewer: {
		settings: {
			claudeSettingsFiles: SettingsFile[];
			hanConfigFiles: SettingsFile[];
			claudeSettings: ClaudeSettingsSummary;
			hanConfig: HanConfigSummary;
			mcpServers: McpServer[];
			permissions: Permissions;
		};
	};
}

export type SettingsTab = "overview" | "files" | "mcp" | "permissions";
