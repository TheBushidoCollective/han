import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../claude-settings.ts";
import { loadPluginConfig, type PluginConfig } from "../../hook-config.ts";
import { runConfiguredHook } from "../../validate.ts";

export interface PluginTool {
	name: string;
	description: string;
	pluginName: string;
	hookName: string;
	pluginRoot: string;
}

/**
 * Find plugin in a marketplace root directory
 */
export function findPluginInMarketplace(
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
export function resolvePathToAbsolute(path: string): string {
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
 * Generate a human-readable description for a hook tool with natural language examples
 */
export function generateToolDescription(
	pluginName: string,
	hookName: string,
	pluginConfig: PluginConfig,
): string {
	const hookDef = pluginConfig.hooks[hookName];
	const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
	const techDisplay = technology.charAt(0).toUpperCase() + technology.slice(1);

	// Rich descriptions with natural language trigger examples
	const descriptions: Record<
		string,
		(tech: string, display: string) => string
	> = {
		test: (tech, display) =>
			`Run ${display} tests. Triggers: "run the tests", "run ${tech} tests", "check if tests pass", "execute test suite"`,
		lint: (tech, display) =>
			`Lint ${display} code for issues and style violations. Triggers: "lint the code", "check for ${tech} issues", "run the linter", "check code quality"`,
		typecheck: (_tech, display) =>
			`Type-check ${display} code for type errors. Triggers: "check types", "run type checking", "verify types", "typescript check"`,
		format: (_tech, display) =>
			`Check and fix ${display} code formatting. Triggers: "format the code", "check formatting", "fix formatting", "run formatter"`,
		build: (_tech, display) =>
			`Build the ${display} project. Triggers: "build the project", "compile the code", "run the build"`,
		compile: (tech, display) =>
			`Compile ${display} code. Triggers: "compile the code", "run compilation", "build ${tech}"`,
	};

	const descFn = descriptions[hookName];
	let desc = descFn
		? descFn(technology, techDisplay)
		: `Run ${hookName} for ${techDisplay}. Triggers: "run ${hookName}", "${hookName} the ${technology} code"`;

	// Add context about where it runs
	if (hookDef?.dirsWith && hookDef.dirsWith.length > 0) {
		desc += `. Runs in directories containing: ${hookDef.dirsWith.join(", ")}`;
	}

	// Add the actual command for transparency
	if (hookDef?.command) {
		desc += `. Command: ${hookDef.command}`;
	}

	return desc;
}

/**
 * Discover all plugin tools from installed plugins
 */
export function discoverPluginTools(): PluginTool[] {
	const tools: PluginTool[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

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
				description: generateToolDescription(
					pluginName,
					hookName,
					pluginConfig,
				),
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
	cache?: boolean;
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
	const { verbose = false, failFast = true, directory, cache = true } = options;

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
				cache,
				only: directory,
				verbose,
			});
		} catch (e) {
			const error = e as Error;
			if (error.message?.startsWith("__EXIT_")) {
				exitCode = Number.parseInt(
					error.message.replace("__EXIT_", "").replace("__", ""),
					10,
				);
			} else {
				throw e;
			}
		} finally {
			process.exit = originalExit;
		}

		success = exitCode === 0;
	} catch (error) {
		success = false;
		outputLines.push(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}

	return {
		success,
		output: outputLines.join("\n") || (success ? "Success" : "Failed"),
	};
}
