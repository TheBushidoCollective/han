import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../config/index.ts";
import { findPluginInMarketplace, resolvePathToAbsolute } from "./tools.ts";

/**
 * Represents a discovered capability from a hashi plugin
 */
export interface Capability {
	/** Plugin name (e.g., "hashi-github") */
	pluginName: string;
	/** Display name for the capability (e.g., "GitHub") */
	displayName: string;
	/** Category for grouping (e.g., "Git/GitHub", "Browser Automation") */
	category: CapabilityCategory;
	/** Brief description of what it can do */
	description: string;
	/** Keywords for matching user requests */
	keywords: string[];
	/** Example prompts that would use this capability */
	examples: string[];
}

/**
 * Capability categories for grouping related functionality
 */
export type CapabilityCategory =
	| "Git/GitHub"
	| "Browser Automation"
	| "Project Management"
	| "Documentation"
	| "Design"
	| "Monitoring"
	| "Other";

/**
 * Registry of discovered capabilities
 */
export interface CapabilityRegistry {
	/** All discovered capabilities */
	capabilities: Capability[];
	/** Capabilities grouped by category */
	byCategory: Map<CapabilityCategory, Capability[]>;
	/** Timestamp when the registry was built */
	builtAt: Date;
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
	keywords?: string[];
	mcpServers?: Record<string, PluginJsonMcpServer>;
}

/**
 * MCP capability definition from han-plugin.yml
 */
interface McpCapabilityDef {
	category: string;
	summary: string;
	examples?: string[];
}

/**
 * MCP server definition from han-plugin.yml
 */
interface McpServerDef {
	name: string;
	description?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: string;
	url?: string;
	capabilities?: McpCapabilityDef[];
	/** If true, tools from this MCP server are exposed through the main Han MCP server */
	expose?: boolean;
}

/**
 * Han plugin config structure from han-plugin.yml
 */
interface HanPluginConfig {
	/** MCP servers defined in han-plugin.yml */
	mcp_servers?: Record<string, McpServerDef>;
	hooks?: Record<string, unknown>;
	memory?: Record<string, unknown>;
	agents?: Record<string, unknown>;
}

/**
 * Category mappings based on keywords and plugin names
 */
const CATEGORY_MAPPINGS: Record<string, CapabilityCategory> = {
	// Git/GitHub related
	github: "Git/GitHub",
	gitlab: "Git/GitHub",
	git: "Git/GitHub",
	repository: "Git/GitHub",
	"pull-requests": "Git/GitHub",
	"merge-requests": "Git/GitHub",
	"code-search": "Git/GitHub",

	// Browser automation
	playwright: "Browser Automation",
	browser: "Browser Automation",
	automation: "Browser Automation",
	testing: "Browser Automation",

	// Project management
	linear: "Project Management",
	jira: "Project Management",
	clickup: "Project Management",
	"project-management": "Project Management",
	tasks: "Project Management",
	issues: "Project Management",
	tickets: "Project Management",

	// Documentation
	blueprints: "Documentation",
	documentation: "Documentation",
	"technical-docs": "Documentation",

	// Design
	figma: "Design",
	design: "Design",
	"design-to-code": "Design",
	"design-system": "Design",

	// Monitoring
	sentry: "Monitoring",
	monitoring: "Monitoring",
	observability: "Monitoring",
	errors: "Monitoring",
};

/**
 * Example prompts for each category
 */
const CATEGORY_EXAMPLES: Record<CapabilityCategory, string[]> = {
	"Git/GitHub": [
		"Create a PR with the current changes and request review from @alice",
		"Search for usages of the deprecated API across all repos",
		"Create an issue for the bug we discussed",
	],
	"Browser Automation": [
		"Test the login flow on staging and report any failures",
		"Take a screenshot of the homepage after the deploy",
		"Fill out the signup form and verify the confirmation email",
	],
	"Project Management": [
		"Create a task for implementing the new feature",
		"Mark the current issue as complete with a summary",
		"Find all high-priority tasks assigned to me",
	],
	Documentation: [
		"Update the architecture blueprint with the new service",
		"Create documentation for the API changes",
		"Search blueprints for authentication patterns",
	],
	Design: [
		"Get the component specs from the Figma file",
		"Export the design tokens for the button component",
		"Check if the implementation matches the design",
	],
	Monitoring: [
		"Find recent errors related to the payment service",
		"Check the error rate after the last deploy",
		"Get details on the latest performance issues",
	],
	Other: ["Use the available tools to complete the workflow"],
};

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
 * Determine the category for a plugin based on its keywords and name
 */
function determineCategory(
	pluginName: string,
	keywords: string[],
): CapabilityCategory {
	// Check keywords first
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase();
		if (CATEGORY_MAPPINGS[lowerKeyword]) {
			return CATEGORY_MAPPINGS[lowerKeyword];
		}
	}

	// Check plugin name
	const lowerName = pluginName.toLowerCase();
	for (const [key, category] of Object.entries(CATEGORY_MAPPINGS)) {
		if (lowerName.includes(key)) {
			return category;
		}
	}

	return "Other";
}

/**
 * Extract display name from plugin name (e.g., "hashi-github" -> "GitHub")
 */
function extractDisplayName(pluginName: string): string {
	const name = pluginName.replace(/^hashi-/, "");
	// Special cases for multi-word names
	const specialCases: Record<string, string> = {
		"playwright-mcp": "Playwright",
		github: "GitHub",
		gitlab: "GitLab",
		clickup: "ClickUp",
	};

	if (specialCases[name]) {
		return specialCases[name];
	}

	// Capitalize first letter
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
	// If marketplace config specifies a directory source, use that path
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

	// Check if we're in the marketplace repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

	// Fall back to the default shared config path
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		return null;
	}

	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);

	if (!existsSync(marketplaceRoot)) {
		return null;
	}

	return findPluginInMarketplace(marketplaceRoot, pluginName);
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
 * This is where MCP server definitions live (hidden from Claude Code)
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
 * Discover capabilities from installed hashi plugins
 * Reads MCP definitions from han-plugin.yml first, then falls back to plugin.json mcpServers
 */
export function discoverCapabilities(): CapabilityRegistry {
	const capabilities: Capability[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		// Only process hashi plugins
		if (!pluginName.startsWith("hashi-")) {
			continue;
		}

		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginDir = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginDir) {
			continue;
		}

		// Load plugin.json for metadata (keywords, description, and fallback mcpServers)
		const pluginJson = loadPluginJson(pluginDir);
		const keywords = pluginJson?.keywords || [];
		const displayName = extractDisplayName(pluginName);

		// Load han-plugin.yml for MCP definitions (managed by Han, not Claude Code)
		const hanConfig = loadHanPluginConfig(pluginDir);

		// Check if we have MCP definitions in han-plugin.yml
		if (hanConfig?.mcp_servers) {
			// Use capabilities from han-plugin.yml if defined
			for (const [_serverName, mcp] of Object.entries(hanConfig.mcp_servers)) {
				const mcpCapabilities = mcp.capabilities || [];

				if (mcpCapabilities.length > 0) {
					// Use explicitly defined capabilities from han-plugin.yml
					for (const cap of mcpCapabilities) {
						const category = (cap.category as CapabilityCategory) || "Other";
						capabilities.push({
							pluginName,
							displayName,
							category,
							description: cap.summary,
							keywords,
							examples: cap.examples || CATEGORY_EXAMPLES[category] || [],
						});
					}
				} else {
					// Fall back to auto-detection based on plugin name/keywords
					const category = determineCategory(pluginName, keywords);
					const description =
						mcp.description ||
						CAPABILITY_DESCRIPTIONS[pluginName] ||
						pluginJson?.description ||
						`${displayName} integration`;

					capabilities.push({
						pluginName,
						displayName,
						category,
						description,
						keywords,
						examples: CATEGORY_EXAMPLES[category] || CATEGORY_EXAMPLES.Other,
					});
				}
			}
		} else if (pluginJson?.mcpServers) {
			// Fall back to plugin.json mcpServers (for plugins without han-plugin.yml mcp section)
			const category = determineCategory(pluginName, keywords);
			const description =
				CAPABILITY_DESCRIPTIONS[pluginName] ||
				pluginJson?.description ||
				`${displayName} integration`;

			capabilities.push({
				pluginName,
				displayName,
				category,
				description,
				keywords,
				examples: CATEGORY_EXAMPLES[category] || CATEGORY_EXAMPLES.Other,
			});
		}
		// Skip plugins with neither han-plugin.yml mcp nor plugin.json mcpServers
	}

	// Group by category
	const byCategory = new Map<CapabilityCategory, Capability[]>();
	for (const capability of capabilities) {
		const existing = byCategory.get(capability.category) || [];
		existing.push(capability);
		byCategory.set(capability.category, existing);
	}

	return {
		capabilities,
		byCategory,
		builtAt: new Date(),
	};
}

/**
 * Generate a dynamic workflow tool description based on discovered capabilities
 */
export function generateWorkflowDescription(
	registry?: CapabilityRegistry,
): string {
	const reg = registry || discoverCapabilities();

	if (reg.capabilities.length === 0) {
		return "Execute complex workflows autonomously. No MCP capabilities currently available. Install hashi plugins to enable workflow automation.";
	}

	const lines: string[] = [
		"Execute complex workflows autonomously. Current capabilities:",
		"",
	];

	// Build capability list by category
	for (const [category, caps] of reg.byCategory.entries()) {
		const descriptions = caps.map((c) => c.description).join("; ");
		lines.push(`- ${category}: ${descriptions}`);
	}

	// Add examples section
	lines.push("");
	lines.push("Examples:");

	// Collect unique examples from all capabilities
	const allExamples = new Set<string>();
	for (const capability of reg.capabilities) {
		for (const example of capability.examples.slice(0, 1)) {
			allExamples.add(example);
		}
	}

	// Show up to 3 examples
	const exampleArray = Array.from(allExamples).slice(0, 3);
	for (const example of exampleArray) {
		lines.push(`- "${example}"`);
	}

	lines.push("");
	lines.push(
		"The agent will handle all intermediate steps and return a summary.",
	);

	return lines.join("\n");
}

/**
 * Find capabilities that match a given query
 */
export function findMatchingCapabilities(
	query: string,
	registry?: CapabilityRegistry,
): Capability[] {
	const reg = registry || discoverCapabilities();
	const lowerQuery = query.toLowerCase();

	const matches: Array<{ capability: Capability; score: number }> = [];

	for (const capability of reg.capabilities) {
		let score = 0;

		// Check display name
		if (capability.displayName.toLowerCase().includes(lowerQuery)) {
			score += 10;
		}

		// Check category
		if (capability.category.toLowerCase().includes(lowerQuery)) {
			score += 5;
		}

		// Check description
		if (capability.description.toLowerCase().includes(lowerQuery)) {
			score += 3;
		}

		// Check keywords
		for (const keyword of capability.keywords) {
			if (keyword.toLowerCase().includes(lowerQuery)) {
				score += 2;
			}
			if (lowerQuery.includes(keyword.toLowerCase())) {
				score += 2;
			}
		}

		if (score > 0) {
			matches.push({ capability, score });
		}
	}

	// Sort by score descending
	matches.sort((a, b) => b.score - a.score);

	return matches.map((m) => m.capability);
}

/**
 * Get a formatted summary of all capabilities for debugging
 */
export function getCapabilitySummary(registry?: CapabilityRegistry): string {
	const reg = registry || discoverCapabilities();

	if (reg.capabilities.length === 0) {
		return "No hashi plugins installed.";
	}

	const lines: string[] = [
		`Discovered ${reg.capabilities.length} capabilities:`,
		"",
	];

	for (const [category, caps] of reg.byCategory.entries()) {
		lines.push(`${category}:`);
		for (const cap of caps) {
			lines.push(`  - ${cap.displayName}: ${cap.description}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * MCP server configuration for Han to manage backend connections
 */
export interface McpServerConfig {
	/** Plugin name (e.g., "hashi-github") */
	pluginName: string;
	/** MCP server name (e.g., "github") */
	serverName: string;
	/** Server description */
	description: string;
	/** Command to start the server (for stdio transport) */
	command?: string;
	/** Command arguments */
	args?: string[];
	/** Environment variables */
	env?: Record<string, string>;
	/** HTTP transport type */
	type?: "http";
	/** HTTP URL (for http transport) */
	url?: string;
	/** If true, tools are exposed through the main Han MCP server */
	expose?: boolean;
}

/**
 * Discover all MCP server configurations from installed plugins
 * Han uses these to manage backend MCP connections (hidden from Claude Code)
 * Reads from han-plugin.yml first, then falls back to plugin.json mcpServers
 *
 * Processes:
 * - hashi-* plugins (single mcpServers: section)
 * - core plugin (mcpServers: section for multiple exposed servers)
 */
export function discoverMcpServers(): McpServerConfig[] {
	const servers: McpServerConfig[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		// Process hashi plugins and core plugin
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

		// Load han-plugin.yml for MCP definitions (primary source)
		const hanConfig = loadHanPluginConfig(pluginDir);

		// Check for mcp_servers in han-plugin.yml
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
			// Fall back to plugin.json mcpServers
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
 * Get MCP server config for a specific plugin
 */
export function getMcpServerConfig(pluginName: string): McpServerConfig | null {
	const servers = discoverMcpServers();
	return servers.find((s) => s.pluginName === pluginName) || null;
}

/**
 * Get all exposed MCP servers (those with expose: true)
 * These servers have their tools proxied through the main Han MCP server
 */
export function getExposedMcpServers(): McpServerConfig[] {
	return discoverMcpServers().filter((s) => s.expose === true);
}

/**
 * Backend capability interface for MCP orchestrator
 * Combines server config with capability metadata
 */
export interface BackendCapability {
	/** Plugin name (e.g., "hashi-github") */
	pluginName: string;
	/** MCP server ID (e.g., "github") */
	serverId: string;
	/** Server configuration */
	serverConfig: McpServerConfig;
	/** Capability category */
	category: CapabilityCategory;
	/** Brief summary of capabilities */
	summary: string;
	/** Keywords for matching */
	keywords: string[];
	/** Example prompts */
	examples: string[];
}

/**
 * Discover backends (alias for combined capability and server discovery)
 * Returns a unified view of available MCP backends with their capabilities
 */
export function discoverBackends(): BackendCapability[] {
	const registry = discoverCapabilities();
	const servers = discoverMcpServers();
	const backends: BackendCapability[] = [];

	// Build a map of servers by plugin name for quick lookup
	const serversByPlugin = new Map<string, McpServerConfig>();
	for (const server of servers) {
		serversByPlugin.set(server.pluginName, server);
	}

	// Combine capabilities with their server configs
	for (const cap of registry.capabilities) {
		const server = serversByPlugin.get(cap.pluginName);
		if (server) {
			backends.push({
				pluginName: cap.pluginName,
				serverId: server.serverName,
				serverConfig: server,
				category: cap.category,
				summary: cap.description,
				keywords: cap.keywords,
				examples: cap.examples,
			});
		}
	}

	return backends;
}

/**
 * Select backends relevant to a user intent
 * Alias for findMatchingCapabilities that returns BackendCapability[]
 */
export function selectBackendsForIntent(
	intent: string,
	backends?: BackendCapability[],
): BackendCapability[] {
	const allBackends = backends || discoverBackends();
	const lowerIntent = intent.toLowerCase();

	const matches: Array<{ backend: BackendCapability; score: number }> = [];

	for (const backend of allBackends) {
		let score = 0;

		// Check server ID / plugin name
		if (backend.serverId.toLowerCase().includes(lowerIntent)) {
			score += 10;
		}
		if (backend.pluginName.toLowerCase().includes(lowerIntent)) {
			score += 8;
		}

		// Check category
		if (backend.category.toLowerCase().includes(lowerIntent)) {
			score += 5;
		}

		// Check summary
		if (backend.summary.toLowerCase().includes(lowerIntent)) {
			score += 3;
		}

		// Check keywords
		for (const keyword of backend.keywords) {
			if (keyword.toLowerCase().includes(lowerIntent)) {
				score += 2;
			}
			if (lowerIntent.includes(keyword.toLowerCase())) {
				score += 2;
			}
		}

		// Check examples for context
		for (const example of backend.examples) {
			if (example.toLowerCase().includes(lowerIntent)) {
				score += 1;
			}
		}

		if (score > 0) {
			matches.push({ backend, score });
		}
	}

	// Sort by score descending and return top matches
	matches.sort((a, b) => b.score - a.score);

	return matches.map((m) => m.backend);
}
