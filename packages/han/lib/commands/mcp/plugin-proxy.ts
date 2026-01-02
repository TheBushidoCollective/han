/**
 * Plugin MCP Proxy
 *
 * Implements dual-mode MCP handling for hashi plugins:
 * - When orchestrator is ENABLED: Returns a stub MCP with no tools (Han manages all tools)
 * - When orchestrator is DISABLED: Proxies to the actual MCP server defined in han-plugin.yml
 *
 * This allows Claude Code to use plugins via `han mcp {plugin-name} {mcp-name}`
 * and Han decides whether to proxy or stub based on orchestrator configuration.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import YAML from "yaml";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../config/index.ts";
import { getOrchestratorConfig } from "./orchestrator.ts";
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
	type?: string;
	url?: string;
}

/**
 * Han plugin config structure from han-plugin.yml
 */
interface HanPluginConfig {
	mcp_servers?: Record<string, McpServerDef>;
	hooks?: Record<string, unknown>;
	memory?: Record<string, unknown>;
	agents?: Record<string, unknown>;
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/**
 * Get plugin directory for a given plugin name
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
 * Find plugin directory by name
 */
function findPluginDir(pluginName: string): string | null {
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	const marketplace = plugins.get(pluginName);
	if (!marketplace) {
		return null;
	}

	const marketplaceConfig = marketplaces.get(marketplace);
	return getPluginDir(pluginName, marketplace, marketplaceConfig);
}

/**
 * Get MCP config for a specific plugin and server name
 */
function getMcpConfig(
	pluginName: string,
	mcpName: string,
): McpServerDef | null {
	const pluginDir = findPluginDir(pluginName);
	if (!pluginDir) {
		return null;
	}

	const config = loadHanPluginConfig(pluginDir);
	if (!config?.mcp_servers) {
		return null;
	}

	// Find the server by name
	for (const [serverKey, server] of Object.entries(config.mcp_servers)) {
		if (server.name === mcpName || serverKey === mcpName) {
			return server;
		}
	}

	return null;
}

/**
 * Send a JSON-RPC response to stdout
 */
function sendResponse(response: JsonRpcResponse): void {
	const json = JSON.stringify(response);
	process.stdout.write(`${json}\n`);
}

/**
 * Start stub MCP server (orchestrator enabled mode)
 *
 * Returns a minimal MCP server with no tools.
 * Han's orchestrator manages all tools instead.
 */
async function startStubServer(
	pluginName: string,
	mcpName: string,
): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		terminal: false,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const request = JSON.parse(line) as JsonRpcRequest;

			let result: unknown;

			switch (request.method) {
				case "initialize":
					result = {
						protocolVersion: "2024-11-05",
						capabilities: {
							tools: {},
						},
						serverInfo: {
							name: `han-stub-${mcpName}`,
							version: "1.0.0",
						},
						instructions: `This MCP server (${pluginName}/${mcpName}) is managed by Han's orchestrator. Tools are exposed through the main Han MCP server. Do not call this server directly.`,
					};
					break;

				case "initialized":
					result = {};
					break;

				case "ping":
					result = {};
					break;

				case "tools/list":
					// Return empty tools list - Han's orchestrator provides all tools
					result = { tools: [] };
					break;

				case "tools/call":
					// Reject all tool calls - should use Han's orchestrator
					result = {
						content: [
							{
								type: "text",
								text: `Tool calls are managed by Han's orchestrator. Use the main Han MCP server instead of ${pluginName}/${mcpName} directly.`,
							},
						],
						isError: true,
					};
					break;

				default:
					throw {
						code: -32601,
						message: `Method not found: ${request.method}`,
					};
			}

			if (request.id !== undefined) {
				sendResponse({
					jsonrpc: "2.0",
					id: request.id,
					result,
				});
			}
		} catch (error) {
			const errorObj =
				typeof error === "object" && error !== null && "code" in error
					? (error as { code: number; message: string })
					: { code: -32603, message: String(error) };

			sendResponse({
				jsonrpc: "2.0",
				error: errorObj,
			});
		}
	}
}

/**
 * Start proxy MCP server (orchestrator disabled mode)
 *
 * Spawns the actual MCP server from han-plugin.yml
 * and proxies all stdio traffic between Claude Code and the backend.
 */
async function startProxyServer(mcpConfig: McpServerDef): Promise<void> {
	if (!mcpConfig.command) {
		console.error(`Error: MCP server ${mcpConfig.name} has no command defined`);
		process.exit(1);
	}

	// Build environment for the child process
	const childEnv = {
		...process.env,
		...(mcpConfig.env || {}),
	};

	// Spawn the actual MCP server
	const child: ChildProcess = spawn(mcpConfig.command, mcpConfig.args || [], {
		stdio: ["pipe", "pipe", "inherit"],
		env: childEnv,
		shell: true,
	});

	// Handle child process errors
	child.on("error", (err) => {
		console.error(`Failed to start MCP server: ${err.message}`);
		process.exit(1);
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});

	// Proxy stdin from parent to child
	if (child.stdin) {
		process.stdin.pipe(child.stdin);
	}

	// Proxy stdout from child to parent
	if (child.stdout) {
		child.stdout.pipe(process.stdout);
	}

	// Handle parent process signals
	process.on("SIGINT", () => {
		child.kill("SIGINT");
	});

	process.on("SIGTERM", () => {
		child.kill("SIGTERM");
	});
}

/**
 * Main entry point for plugin MCP proxy
 *
 * @param pluginName - The plugin name (e.g., "hashi-github")
 * @param mcpName - The MCP server name (e.g., "github")
 */
export async function startPluginMcpProxy(
	pluginName: string,
	mcpName: string,
): Promise<void> {
	// Check orchestrator config
	const orchestratorConfig = getOrchestratorConfig();

	if (orchestratorConfig.enabled) {
		// Orchestrator is enabled - return stub server
		// Han's orchestrator manages all tools, so this MCP exposes nothing
		await startStubServer(pluginName, mcpName);
	} else {
		// Orchestrator is disabled - proxy to actual MCP
		const mcpConfig = getMcpConfig(pluginName, mcpName);

		if (!mcpConfig) {
			console.error(
				`Error: MCP server "${mcpName}" not found for plugin "${pluginName}"`,
			);
			console.error("Check that:");
			console.error(`  1. Plugin "${pluginName}" is installed`);
			console.error(
				`  2. han-plugin.yml exists and defines mcp.name: ${mcpName}`,
			);
			process.exit(1);
		}

		await startProxyServer(mcpConfig);
	}
}
