import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPluginConfig, type PluginConfig } from "../../hook-config.js";
import { runConfiguredHook } from "../../validate.js";

export interface PluginTool {
	name: string;
	description: string;
	pluginName: string;
	hookName: string;
	pluginRoot: string;
}

interface MarketplaceSource {
	source: "directory" | "git" | "github";
	path?: string;
	url?: string;
	repo?: string;
}

interface MarketplaceConfig {
	source: MarketplaceSource;
}

interface ClaudeSettings {
	extraKnownMarketplaces?: Record<string, MarketplaceConfig>;
	enabledPlugins?: Record<string, boolean>;
}

/**
 * Get Claude config directory
 */
function getClaudeConfigDir(): string {
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
 * Read settings from a file
 */
function readSettings(path: string): ClaudeSettings | null {
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
 * Get all enabled plugins and marketplace configurations from all settings scopes
 */
function getEnabledPluginsAndMarketplaces(): {
	plugins: Map<string, string>;
	marketplaces: Map<string, MarketplaceConfig>;
} {
	const plugins = new Map<string, string>();
	const marketplaces = new Map<string, MarketplaceConfig>();

	// Read user settings first (lowest priority)
	const configDir = getClaudeConfigDir();
	if (configDir) {
		const userSettingsPath = join(configDir, "settings.json");
		const userSettings = readSettings(userSettingsPath);
		if (userSettings) {
			if (userSettings.extraKnownMarketplaces) {
				for (const [name, config] of Object.entries(
					userSettings.extraKnownMarketplaces,
				)) {
					marketplaces.set(name, config);
				}
			}
			if (userSettings.enabledPlugins) {
				for (const [key, enabled] of Object.entries(
					userSettings.enabledPlugins,
				)) {
					if (enabled && key.includes("@")) {
						const [pluginName, marketplace] = key.split("@");
						plugins.set(pluginName, marketplace);
					}
				}
			}
		}
	}

	// Read project settings (overrides user)
	const projectSettingsPath = join(process.cwd(), ".claude", "settings.json");
	const projectSettings = readSettings(projectSettingsPath);
	if (projectSettings) {
		if (projectSettings.extraKnownMarketplaces) {
			for (const [name, config] of Object.entries(
				projectSettings.extraKnownMarketplaces,
			)) {
				marketplaces.set(name, config);
			}
		}
		if (projectSettings.enabledPlugins) {
			for (const [key, enabled] of Object.entries(
				projectSettings.enabledPlugins,
			)) {
				if (enabled && key.includes("@")) {
					const [pluginName, marketplace] = key.split("@");
					plugins.set(pluginName, marketplace);
				}
			}
		}
	}

	// Read local settings (highest priority, can override)
	const localSettingsPath = join(
		process.cwd(),
		".claude",
		"settings.local.json",
	);
	const localSettings = readSettings(localSettingsPath);
	if (localSettings) {
		if (localSettings.extraKnownMarketplaces) {
			for (const [name, config] of Object.entries(
				localSettings.extraKnownMarketplaces,
			)) {
				marketplaces.set(name, config);
			}
		}
		if (localSettings.enabledPlugins) {
			for (const [key, enabled] of Object.entries(
				localSettings.enabledPlugins,
			)) {
				if (enabled && key.includes("@")) {
					const [pluginName, marketplace] = key.split("@");
					plugins.set(pluginName, marketplace);
				} else if (!enabled && key.includes("@")) {
					const [pluginName] = key.split("@");
					plugins.delete(pluginName);
				}
			}
		}
	}

	return { plugins, marketplaces };
}

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	const potentialPaths = [
		join(marketplaceRoot, "jutsu", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "hashi", pluginName),
		join(marketplaceRoot, pluginName),
	];

	for (const path of potentialPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
function resolvePathToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
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
 * Generate a human-readable description for a hook tool
 */
function generateToolDescription(
	pluginName: string,
	hookName: string,
	pluginConfig: PluginConfig,
): string {
	const hookDef = pluginConfig.hooks[hookName];
	if (!hookDef) {
		return `Run ${hookName} for ${pluginName}`;
	}

	// Build a description based on the hook definition
	const parts: string[] = [];

	// Describe what the hook does based on its name
	const actionMap: Record<string, string> = {
		test: "Run tests",
		lint: "Run linter",
		format: "Check formatting",
		typecheck: "Run type checking",
		compile: "Compile code",
		build: "Build project",
	};

	const action = actionMap[hookName] || `Run ${hookName}`;
	parts.push(action);

	// Add context about the plugin
	const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
	parts.push(`for ${technology}`);

	// Add info about where it runs
	if (hookDef.dirsWith && hookDef.dirsWith.length > 0) {
		parts.push(`(in directories with ${hookDef.dirsWith.join(" or ")})`);
	}

	// Add the actual command for reference
	parts.push(`- runs: ${hookDef.command}`);

	return parts.join(" ");
}

/**
 * Discover all plugin tools from installed plugins
 */
export function discoverPluginTools(): PluginTool[] {
	const tools: PluginTool[] = [];
	const { plugins, marketplaces } = getEnabledPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginRoot) {
			continue;
		}

		// Load plugin config to discover hooks
		const pluginConfig = loadPluginConfig(pluginRoot, false);
		if (!pluginConfig || !pluginConfig.hooks) {
			continue;
		}

		// Create a tool for each hook
		for (const hookName of Object.keys(pluginConfig.hooks)) {
			const toolName = `${pluginName}_${hookName}`.replace(/-/g, "_");

			tools.push({
				name: toolName,
				description: generateToolDescription(pluginName, hookName, pluginConfig),
				pluginName,
				hookName,
				pluginRoot,
			});
		}
	}

	return tools;
}

export interface ExecuteToolOptions {
	verbose?: boolean;
	failFast?: boolean;
	directory?: string;
}

export interface ExecuteToolResult {
	success: boolean;
	output: string;
}

/**
 * Execute a plugin tool
 */
export async function executePluginTool(
	tool: PluginTool,
	options: ExecuteToolOptions,
): Promise<ExecuteToolResult> {
	const { verbose = false, failFast = true, directory } = options;

	// Capture console output
	const outputLines: string[] = [];
	const originalLog = console.log;
	const originalError = console.error;

	console.log = (...args) => {
		outputLines.push(args.join(" "));
		if (verbose) {
			originalLog.apply(console, args);
		}
	};
	console.error = (...args) => {
		outputLines.push(args.join(" "));
		if (verbose) {
			originalError.apply(console, args);
		}
	};

	let success = true;

	try {
		// Set CLAUDE_PLUGIN_ROOT for the hook
		process.env.CLAUDE_PLUGIN_ROOT = tool.pluginRoot;

		// Use runConfiguredHook but catch the exit
		const originalExit = process.exit;
		let exitCode = 0;

		process.exit = ((code?: number) => {
			exitCode = code ?? 0;
			throw new Error(`__EXIT_${exitCode}__`);
		}) as never;

		try {
			await runConfiguredHook({
				pluginName: tool.pluginName,
				hookName: tool.hookName,
				failFast,
				cache: true, // Always use caching for MCP
				only: directory,
				verbose, // Pass through verbose mode
			});
		} catch (e) {
			const error = e as Error;
			if (error.message?.startsWith("__EXIT_")) {
				exitCode = Number.parseInt(error.message.replace("__EXIT_", "").replace("__", ""), 10);
			} else {
				throw e;
			}
		} finally {
			process.exit = originalExit;
		}

		success = exitCode === 0;
	} catch (error) {
		success = false;
		outputLines.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}

	return {
		success,
		output: outputLines.join("\n") || (success ? "Success" : "Failed"),
	};
}
