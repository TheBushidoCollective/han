/**
 * MCP Exposed Tools Discovery
 *
 * Discovers MCP servers with expose:true from installed plugins
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { getMergedPluginsAndMarketplaces } from '../../config/claude-settings.ts';
import { getPluginDir } from '../../hooks/plugin-discovery.ts';
import { getShortPluginName } from '../../plugin-aliases.ts';

/**
 * MCP server definition from han-plugin.yml
 */
interface McpServerDef {
  name: string;
  description?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'http';
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
  type?: 'http';
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
  type?: 'http';
  url?: string;
  expose?: boolean;
}

/**
 * Capability descriptions keyed by short plugin name.
 *
 * Plugins are named after their directory (`github`), but installs made before
 * the rename still carry the prefixed alias (`hashi-github`) in settings, so
 * lookups go through the short name.
 */
const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  github: 'Create branches, commits, PRs, manage issues, code search',
  gitlab: 'Manage merge requests, issues, CI/CD pipelines, code search',
  'playwright-mcp': 'Navigate pages, fill forms, take screenshots, test UIs',
  linear: 'Create and manage issues, track projects, update status',
  jira: 'Manage tickets, JQL search, update issue status',
  clickup: 'Manage tasks, workspaces, project tracking',
  blueprints: 'Search, read, and write technical blueprints',
  figma: 'Access design components, specs, and design systems',
  sentry: 'Track errors, monitor performance, manage incidents',
  notion: 'Search pages and databases, create and update content',
  canva: 'Create and edit designs, export assets',
  'agent-sop': 'Look up and apply standard operating procedures',
};

/**
 * Extract display name from a plugin name, tolerating the legacy `hashi-`
 * prefix that older installs still record (`hashi-github` -> `GitHub`).
 */
function extractDisplayName(pluginName: string): string {
  const name = getShortPluginName(pluginName);
  const specialCases: Record<string, string> = {
    'playwright-mcp': 'Playwright',
    github: 'GitHub',
    gitlab: 'GitLab',
    clickup: 'ClickUp',
  };

  if (specialCases[name]) {
    return specialCases[name];
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Load plugin.json from a plugin directory
 */
function loadPluginJson(pluginDir: string): PluginJson | null {
  const pluginJsonPath = join(pluginDir, '.claude-plugin', 'plugin.json');
  if (!existsSync(pluginJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load han-plugin.yml from a plugin directory
 */
function loadHanPluginConfig(pluginDir: string): HanPluginConfig | null {
  const yamlPath = join(pluginDir, 'han-plugin.yml');
  if (!existsSync(yamlPath)) {
    return null;
  }

  try {
    const content = readFileSync(yamlPath, 'utf8');
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
          type: mcp.type as 'http' | undefined,
          url: mcp.url,
          expose: mcp.expose,
        });
      }
    } else if (pluginJson?.mcpServers) {
      for (const [serverName, serverDef] of Object.entries(
        pluginJson.mcpServers
      )) {
        servers.push({
          pluginName,
          serverName,
          description:
            CAPABILITY_DESCRIPTIONS[getShortPluginName(pluginName)] ||
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
