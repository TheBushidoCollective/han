/**
 * Memory Provider Discovery
 *
 * Discovers and loads memory providers from installed plugins.
 * Convention-based: plugins declare required MCP tools, everything else is derived.
 *
 * ```yaml
 * # han-plugin.yml
 * memory:
 *   tools:
 *     - mcp__plugin_hashi-github_github__list_pull_requests
 * ```
 *
 * Conventions:
 * - Provider name = plugin name (strip jutsu-/do-/hashi- prefix)
 * - Script location = memory-provider.ts in plugin root
 */

import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
} from "../claude-settings.ts";
import { loadPluginConfig } from "../hook-config.ts";
import type {
	ExtractedObservation,
	ExtractOptions,
	MemoryProvider,
	ObservationType,
} from "./types.ts";

/**
 * MCP client interface for calling tools
 */
export interface MCPClient {
	callTool(name: string, params: unknown): Promise<unknown>;
}

/**
 * Factory function signature for creating providers
 */
export type ProviderFactory = (
	mcpClient: MCPClient,
	availableTools: Set<string>,
) => MemoryProvider;

/**
 * MCP server configuration from plugin
 */
export interface PluginMcpConfig {
	/** MCP server name */
	name: string;
	/** Command to run */
	command: string;
	/** Command arguments */
	args?: string[];
	/** Environment variables */
	env?: Record<string, string>;
}

/**
 * Provider type - script-based or MCP-based
 */
export type ProviderType = "script" | "mcp";

/**
 * Discovered provider with metadata
 */
export interface DiscoveredProvider {
	/** Provider name (derived from plugin name) */
	name: string;
	/** Plugin that provides it */
	pluginName: string;
	/** Path to plugin root */
	pluginRoot: string;
	/** Provider type: 'script' for memory-provider.ts, 'mcp' for MCP server */
	type: ProviderType;
	/** Path to provider script (for script-based providers) */
	scriptPath?: string;
	/** MCP server config (for MCP-based providers) */
	mcpConfig?: PluginMcpConfig;
	/** MCP tools the memory agent is allowed to use */
	allowedTools: string[];
	/** System prompt for the memory extraction agent */
	systemPrompt?: string;
}

/**
 * Loaded provider ready for use
 */
export interface LoadedProvider {
	/** Provider name */
	name: string;
	/** The actual provider instance */
	provider: MemoryProvider;
	/** Plugin that provides it */
	pluginName: string;
}

/**
 * Derive provider name from plugin name
 * e.g., "hashi-github" -> "github", "jutsu-git" -> "git"
 */
function deriveProviderName(pluginName: string): string {
	return pluginName.replace(/^(jutsu|do|hashi)-/, "");
}

/**
 * Resolve a potentially relative marketplace path.
 * For directory sources with relative paths, resolve against project path.
 * @param directoryPath - The path to resolve
 * @param projectPath - Project path to resolve against (required for relative paths)
 */
function resolveMarketplacePath(
	directoryPath: string,
	projectPath?: string,
): string {
	if (isAbsolute(directoryPath)) {
		return directoryPath;
	}

	// Relative paths require projectPath
	if (projectPath) {
		return resolve(projectPath, directoryPath);
	}

	// No projectPath provided - can't resolve relative path
	console.error(
		`[Provider Discovery] Cannot resolve relative path "${directoryPath}" without projectPath`,
	);
	return directoryPath; // Return as-is, will fail to find
}

/**
 * Find plugin directory in marketplace structure
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	// Check category directories first
	const categories = ["jutsu", "do", "hashi"];
	for (const category of categories) {
		const categoryPath = join(marketplaceRoot, category, pluginName);
		if (existsSync(categoryPath)) {
			return categoryPath;
		}
	}

	// Check root level
	const rootPath = join(marketplaceRoot, pluginName);
	if (existsSync(rootPath)) {
		return rootPath;
	}

	return null;
}

/**
 * Discover all memory providers from installed plugins
 * @param projectPath - Optional project path for context-aware plugin discovery
 */
export async function discoverProviders(
	projectPath?: string,
): Promise<DiscoveredProvider[]> {
	const discovered: DiscoveredProvider[] = [];

	const configDir = getClaudeConfigDir();
	if (!configDir) {
		console.error("[Provider Discovery] No config dir found");
		return discovered;
	}

	// Get installed plugins and marketplace configs for the given project context
	const { plugins, marketplaces } =
		getMergedPluginsAndMarketplaces(projectPath);
	console.error(
		`[Provider Discovery] Found ${plugins.size} plugins:`,
		Array.from(plugins.keys()),
	);

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		let pluginRoot: string | null = null;

		// Resolve plugin directory
		if (marketplaceConfig?.source?.source === "directory") {
			const directoryPath = marketplaceConfig.source.path;
			if (directoryPath) {
				// Resolve relative paths against projectPath
				const resolvedPath = resolveMarketplacePath(directoryPath, projectPath);
				pluginRoot = findPluginInMarketplace(resolvedPath, pluginName);
			}
		}

		if (!pluginRoot) {
			// Try default marketplace path
			const marketplaceRoot = join(
				configDir,
				"plugins",
				"marketplaces",
				marketplace,
			);
			if (existsSync(marketplaceRoot)) {
				pluginRoot = findPluginInMarketplace(marketplaceRoot, pluginName);
			}
		}

		if (!pluginRoot) {
			console.error(`[Provider Discovery] No root found for ${pluginName}`);
			continue;
		}

		// Load plugin config
		const config = loadPluginConfig(pluginRoot, false);

		// Check for memory.allowed_tools (convention-based format)
		if (
			!config?.memory?.allowed_tools ||
			config.memory.allowed_tools.length === 0
		) {
			console.error(
				`[Provider Discovery] ${pluginName}: no memory.allowed_tools`,
			);
			continue;
		}

		console.error(
			`[Provider Discovery] ${pluginName}: found ${config.memory.allowed_tools.length} allowed tools`,
		);

		// Check for memory-provider.ts script (script-based provider)
		const scriptPath = join(pluginRoot, "memory-provider.ts");
		const hasScript = existsSync(scriptPath);

		if (hasScript) {
			// Script-based provider takes precedence
			discovered.push({
				name: deriveProviderName(pluginName),
				pluginName,
				pluginRoot,
				type: "script",
				scriptPath,
				allowedTools: config.memory.allowed_tools,
				systemPrompt: config.memory.system_prompt,
			});
			continue;
		}

		// Collect MCP servers from BOTH sources:
		// 1. Root mcp_servers - shared with MCP orchestrator AND memory
		// 2. memory.mcp_servers - memory-only MCP servers
		const allMcpServers: Record<string, PluginMcpConfig> = {};

		// Add root mcp_servers
		if (config.mcp_servers && typeof config.mcp_servers === "object") {
			for (const [serverKey, serverConfig] of Object.entries(
				config.mcp_servers,
			)) {
				const server = serverConfig as unknown as Record<string, unknown>;
				if (server.command && typeof server.command === "string") {
					allMcpServers[serverKey] = {
						name: (server.name as string) || serverKey,
						command: server.command,
						args: Array.isArray(server.args) ? server.args : undefined,
						env: (server.env as Record<string, string>) || undefined,
					};
				}
			}
		}

		// Add memory.mcp_servers (memory-only servers)
		if (
			config.memory.mcp_servers &&
			typeof config.memory.mcp_servers === "object"
		) {
			for (const [serverKey, serverConfig] of Object.entries(
				config.memory.mcp_servers,
			)) {
				const server = serverConfig as unknown as Record<string, unknown>;
				if (server.command && typeof server.command === "string") {
					allMcpServers[serverKey] = {
						name: (server.name as string) || serverKey,
						command: server.command,
						args: Array.isArray(server.args) ? server.args : undefined,
						env: (server.env as Record<string, string>) || undefined,
					};
				}
			}
		}

		// Create a provider for each MCP server that has matching allowed_tools
		for (const [serverKey, mcpConfig] of Object.entries(allMcpServers)) {
			// Find tools that belong to this server (mcp__<serverName>__<toolName>)
			const serverName = mcpConfig.name || serverKey;
			const serverTools = config.memory.allowed_tools.filter(
				(tool: string) =>
					tool.startsWith(`mcp__${serverName}__`) ||
					tool.startsWith(`mcp__${serverKey}__`),
			);

			if (serverTools.length > 0) {
				discovered.push({
					name: deriveProviderName(pluginName),
					pluginName,
					pluginRoot,
					type: "mcp",
					mcpConfig,
					allowedTools: serverTools,
					systemPrompt: config.memory.system_prompt,
				});
			}
		}

		// If no MCP servers found, log error
		if (Object.keys(allMcpServers).length === 0) {
			console.error(
				`Memory provider for ${pluginName} requires either memory-provider.ts or mcp_servers in han-plugin.yml`,
			);
		}
	}

	return discovered;
}

/**
 * Create an MCP-based memory provider
 *
 * This creates a provider that calls MCP tools directly.
 * The provider extracts data from the MCP server using the allowed tools.
 */
function createMcpBasedProvider(
	discovered: DiscoveredProvider,
	mcpClient: MCPClient,
): MemoryProvider {
	return {
		name: discovered.name,

		async isAvailable(): Promise<boolean> {
			// Check if at least one allowed tool is callable
			if (discovered.allowedTools.length === 0) {
				return false;
			}
			// Try calling the first tool to check availability
			try {
				await mcpClient.callTool(discovered.allowedTools[0], { limit: 1 });
				return true;
			} catch {
				return false;
			}
		},

		async extract(options: ExtractOptions): Promise<ExtractedObservation[]> {
			const observations: ExtractedObservation[] = [];
			const limit = options.limit || 50;

			for (const toolName of discovered.allowedTools) {
				try {
					const result = await mcpClient.callTool(toolName, {
						limit,
						since: options.since,
						authors: options.authors,
					});

					// Parse result and extract observations
					if (result && typeof result === "object") {
						const items = Array.isArray(result)
							? result
							: (result as { items?: unknown[] }).items;

						if (Array.isArray(items)) {
							for (const item of items) {
								const rawItem = item as Record<string, unknown>;
								const timestamp =
									typeof rawItem.timestamp === "number"
										? rawItem.timestamp
										: typeof rawItem.created_at === "string"
											? new Date(rawItem.created_at).getTime()
											: Date.now();

								// Filter by since option
								if (options.since && timestamp < options.since) {
									continue;
								}

								const author =
									(rawItem.author as string) ||
									(rawItem.user as string) ||
									"unknown";

								// Filter by authors option
								if (
									options.authors &&
									options.authors.length > 0 &&
									!options.authors.includes(author)
								) {
									continue;
								}

								// Determine observation type based on tool name
								let type: ObservationType = "commit";
								if (toolName.includes("pull_request")) {
									type = "pr";
								} else if (toolName.includes("issue")) {
									type = "issue";
								} else if (toolName.includes("review")) {
									type = "review";
								} else if (toolName.includes("discussion")) {
									type = "discussion";
								}

								observations.push({
									source: `${discovered.name}:${rawItem.id || Math.random().toString(36).slice(2)}`,
									type,
									timestamp,
									author,
									summary:
										(rawItem.title as string) ||
										(rawItem.summary as string) ||
										(rawItem.message as string) ||
										"",
									detail:
										(rawItem.description as string) ||
										(rawItem.body as string) ||
										"",
									files: (rawItem.files as string[]) || [],
									patterns: [],
								});
							}
						}
					}
				} catch {
					// Tool call failed - skip
				}
			}

			return observations.slice(0, limit);
		},
	};
}

/**
 * Load a provider from its script or MCP config
 */
export async function loadProviderScript(
	discovered: DiscoveredProvider,
	mcpClient: MCPClient,
	availableTools: Set<string>,
): Promise<LoadedProvider | null> {
	try {
		// Check if required tools are available
		const missingTools = discovered.allowedTools.filter(
			(tool) => !availableTools.has(tool),
		);
		if (missingTools.length > 0) {
			// Provider's dependencies not met - silently skip
			return null;
		}

		// Handle based on provider type
		if (discovered.type === "mcp") {
			// MCP-based provider - create directly
			const provider = createMcpBasedProvider(discovered, mcpClient);
			return {
				name: discovered.name,
				provider,
				pluginName: discovered.pluginName,
			};
		}

		// Script-based provider - dynamically import
		if (!discovered.scriptPath) {
			console.error(
				`Script-based provider missing scriptPath: ${discovered.pluginName}`,
			);
			return null;
		}

		const module = await import(discovered.scriptPath);

		// Look for createProvider factory function
		const factory: ProviderFactory | undefined = module.createProvider;
		if (typeof factory !== "function") {
			console.error(
				`Memory provider script missing 'createProvider' export: ${discovered.scriptPath}`,
			);
			return null;
		}

		// Create the provider instance
		const provider = factory(mcpClient, availableTools);

		return {
			name: discovered.name,
			provider,
			pluginName: discovered.pluginName,
		};
	} catch (error) {
		console.error(
			`Failed to load memory provider from ${discovered.pluginName}:`,
			error,
		);
		return null;
	}
}

/**
 * Discover and load all available memory providers
 * @param mcpClient - MCP client for calling tools
 * @param availableTools - Set of available tool names
 * @param projectPath - Optional project path for resolving relative marketplace paths
 */
export async function loadAllProviders(
	mcpClient: MCPClient,
	availableTools: Set<string>,
	projectPath?: string,
): Promise<LoadedProvider[]> {
	const discovered = await discoverProviders(projectPath);
	const loaded: LoadedProvider[] = [];

	for (const provider of discovered) {
		const loadedProvider = await loadProviderScript(
			provider,
			mcpClient,
			availableTools,
		);
		if (loadedProvider) {
			loaded.push(loadedProvider);
		}
	}

	return loaded;
}
