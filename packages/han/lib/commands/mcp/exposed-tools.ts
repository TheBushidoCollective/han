/**
 * MCP Exposed Tools Discovery
 *
 * Discovers MCP servers with expose:true from installed plugins
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../config/claude-settings.ts";
import { findPluginInMarketplace, resolvePathToAbsolute } from "./tools.ts";

/**
 * MCP server definition from han-plugin.yml
 */
interface McpServerDef {
	name: string;
	description?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: "http";
	url?: string;
	expose?: boolean;
}

/**
 * Han plugin config structure from han-plugin.yml
 */
interface HanPluginConfig {
	mcp_servers?: Record<string, McpServerDef>;
}

/**
 * MCP server definition from plugin.json mcpServers
 */
interface PluginJsonMcpServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: "http";
	url?: string;
}

/**
 * Plugin JSON structure from .claude-plugin/plugin.json
 */
interface PluginJson {
	name: string;
	description?: string;
	mcpServers?: Record<string, PluginJsonMcpServer>;
}

/**
 * MCP server configuration
 */
export interface McpServerConfig {
	pluginName: string;
	serverName: string;
	description: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: "http";
	url?: string;
	expose?: boolean;
}

/**
 * Capability descriptions for each plugin type
 */
const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
	"hashi-github": "Create branches, commits, PRs, manage issues, code search",
	"hashi-gitlab": "Manage merge requests, issues, CI/CD pipelines, code search",
	"hashi-playwright-mcp":
		"Navigate pages, fill forms, take screenshots, test UIs",
	"hashi-linear": "Create and manage issues, track projects, update status",
	"hashi-jira": "Manage tickets, JQL search, update issue status",
	"hashi-clickup": "Manage tasks, workspaces, project tracking",
	"hashi-blueprints": "Search, read, and write technical blueprints",
	"hashi-figma": "Access design components, specs, and design systems",
	"hashi-sentry": "Track errors, monitor performance, manage incidents",
};

/**
 * Extract display name from plugin name (e.g., "hashi-github" -> "GitHub")
 */
function extractDisplayName(pluginName: string): string {
	const name = pluginName.replace(/^hashi-/, "");
	const specialCases: Record<string, string> = {
		"playwright-mcp": "Playwright",
		github: "GitHub",
		gitlab: "GitLab",
		clickup: "ClickUp",
	};

	if (specialCases[name]) {
		return specialCases[name];
	}

	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolvePathToAbsolute(directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) {
				return found;
			}
		}
	}

	return null;
}

/**
 * Load plugin.json from a plugin directory
 */
function loadPluginJson(pluginDir: string): PluginJson | null {
	const pluginJsonPath = join(pluginDir, ".claude-plugin", "plugin.json");
	if (!existsSync(pluginJsonPath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(pluginJsonPath, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Load han-plugin.yml from a plugin directory
 */
function loadHanPluginConfig(pluginDir: string): HanPluginConfig | null {
	const yamlPath = join(pluginDir, "han-plugin.yml");
	if (!existsSync(yamlPath)) {
		return null;
	}

	try {
		const content = readFileSync(yamlPath, "utf8");
		return YAML.parse(content) as HanPluginConfig;
	} catch {
		return null;
	}
}

/**
 * Discover all MCP server configurations from installed plugins
 */
export function discoverMcpServers(): McpServerConfig[] {
	const servers: McpServerConfig[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const isHashi = pluginName.startsWith("hashi-");
		const isCore = pluginName === "core";

		if (!isHashi && !isCore) {
			continue;
		}

		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginDir = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginDir) {
			continue;
		}

		const displayName = extractDisplayName(pluginName);
		const pluginJson = loadPluginJson(pluginDir);
		const hanConfig = loadHanPluginConfig(pluginDir);

		if (hanConfig?.mcp_servers) {
			for (const [serverName, mcp] of Object.entries(hanConfig.mcp_servers)) {
				servers.push({
					pluginName,
					serverName: mcp.name || serverName,
					description: mcp.description || `${serverName} integration`,
					command: mcp.command,
					args: mcp.args,
					env: mcp.env,
					type: mcp.type as "http" | undefined,
					url: mcp.url,
					expose: mcp.expose,
				});
			}
		} else if (pluginJson?.mcpServers) {
			for (const [serverName, serverDef] of Object.entries(
				pluginJson.mcpServers,
			)) {
				servers.push({
					pluginName,
					serverName,
					description:
						CAPABILITY_DESCRIPTIONS[pluginName] ||
						pluginJson.description ||
						`${displayName} integration`,
					command: serverDef.command,
					args: serverDef.args,
					env: serverDef.env,
					type: serverDef.type,
					url: serverDef.url,
				});
			}
		}
	}

	return servers;
}

/**
 * Get only MCP servers with expose: true
 */
export function getExposedMcpServers(): McpServerConfig[] {
	return discoverMcpServers().filter((s) => s.expose === true);
}
