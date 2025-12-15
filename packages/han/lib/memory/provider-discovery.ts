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
import { join } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
} from "../claude-settings.ts";
import { loadPluginConfig } from "../hook-config.ts";
import type { MemoryProvider } from "./types.ts";

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
 * Discovered provider with metadata
 */
export interface DiscoveredProvider {
	/** Provider name (derived from plugin name) */
	name: string;
	/** Plugin that provides it */
	pluginName: string;
	/** Path to plugin root */
	pluginRoot: string;
	/** Path to provider script (always memory-provider.ts) */
	scriptPath: string;
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
 */
export async function discoverProviders(): Promise<DiscoveredProvider[]> {
	const discovered: DiscoveredProvider[] = [];

	const configDir = getClaudeConfigDir();
	if (!configDir) {
		return discovered;
	}

	// Get installed plugins and marketplace configs
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		let pluginRoot: string | null = null;

		// Resolve plugin directory
		if (marketplaceConfig?.source?.source === "directory") {
			const directoryPath = marketplaceConfig.source.path;
			if (directoryPath) {
				pluginRoot = findPluginInMarketplace(directoryPath, pluginName);
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

		if (!pluginRoot) continue;

		// Load plugin config
		const config = loadPluginConfig(pluginRoot, false);

		// Check for memory.allowed_tools (convention-based format)
		if (
			!config?.memory?.allowed_tools ||
			config.memory.allowed_tools.length === 0
		)
			continue;

		// Convention: script is always memory-provider.ts
		const scriptPath = join(pluginRoot, "memory-provider.ts");

		// Verify script exists
		if (!existsSync(scriptPath)) {
			console.error(
				`Memory provider script not found: ${scriptPath} (plugin: ${pluginName})`,
			);
			continue;
		}

		discovered.push({
			name: deriveProviderName(pluginName),
			pluginName,
			pluginRoot,
			scriptPath,
			allowedTools: config.memory.allowed_tools,
			systemPrompt: config.memory.system_prompt,
		});
	}

	return discovered;
}

/**
 * Load a provider from its script
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

		// Dynamically import the provider script
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
 */
export async function loadAllProviders(
	mcpClient: MCPClient,
	availableTools: Set<string>,
): Promise<LoadedProvider[]> {
	const discovered = await discoverProviders();
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
