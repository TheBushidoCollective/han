import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../claude-settings.ts";
import { checkForChanges } from "../../hook-cache.ts";
import { getHookConfigs } from "../../hook-config.ts";

/**
 * Hook definition from hooks.json
 */
interface HookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

interface HookGroup {
	hooks: HookEntry[];
}

interface PluginHooks {
	hooks: Record<string, HookGroup[]>;
}

/**
 * Find plugin in a marketplace root directory
 * @internal - Exported for testing
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
 * @internal - Exported for testing
 */
export function resolveToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 * @internal - Exported for testing
 */
export function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	// If marketplace config specifies a directory source, use that path
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolveToAbsolute(directoryPath);
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
 * Load a plugin's hooks.json
 * @internal - Exported for testing
 */
export function loadPluginHooks(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): { hooks: PluginHooks; pluginRoot: string } | null {
	const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);
	if (!pluginRoot) {
		return null;
	}

	const hooksPath = join(pluginRoot, "hooks", "hooks.json");
	if (!existsSync(hooksPath)) {
		return null;
	}

	try {
		const content = readFileSync(hooksPath, "utf-8");
		return {
			hooks: JSON.parse(content) as PluginHooks,
			pluginRoot,
		};
	} catch {
		return null;
	}
}

/**
 * Parse a hook command to extract plugin name and hook name
 * Example: "han hook run jutsu-typescript test"
 * Returns: { pluginName: "jutsu-typescript", hookName: "test" }
 */
export function parseHookCommand(
	command: string,
): { pluginName: string; hookName: string } | null {
	// Match: han hook run <plugin-name> <hook-name>
	const match = command.match(/han\s+hook\s+run\s+(\S+)\s+(\S+)/);
	if (match) {
		return {
			pluginName: match[1],
			hookName: match[2],
		};
	}
	return null;
}

/**
 * Verify that all hooks of a specific type have been run and are cached
 * @internal - Exported for testing
 */
export function verifyHooks(hookType: string): number {
	// Allow global disable of all hooks via environment variable
	if (
		process.env.HAN_DISABLE_HOOKS === "true" ||
		process.env.HAN_DISABLE_HOOKS === "1"
	) {
		process.exit(0);
	}

	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();
	const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	const staleHooks: Array<{ plugin: string; hook: string; reason: string }> =
		[];
	let totalHooks = 0;

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const result = loadPluginHooks(pluginName, marketplace, marketplaceConfig);

		if (!result?.hooks?.hooks?.[hookType]) {
			continue;
		}

		const { hooks: pluginHooks } = result;
		const hookGroups = pluginHooks.hooks[hookType];

		for (const group of hookGroups) {
			for (const hook of group.hooks) {
				// Only verify command hooks
				if (hook.type === "command" && hook.command) {
					totalHooks++;

					// Parse the command to extract plugin name and hook name
					const parsed = parseHookCommand(hook.command);
					if (!parsed) {
						// Can't verify hooks we can't parse
						continue;
					}

					const { pluginName: targetPlugin, hookName: targetHook } = parsed;

					// Get the plugin's han-plugin.yml to find the hook configuration
					const targetPluginRoot = getPluginDir(
						targetPlugin,
						marketplace,
						marketplaceConfig,
					);
					if (!targetPluginRoot) {
						staleHooks.push({
							plugin: targetPlugin,
							hook: targetHook,
							reason: "Plugin not found",
						});
						continue;
					}

					// Load hook configs to get ifChanged patterns
					const configs = getHookConfigs(
						targetPluginRoot,
						targetHook,
						projectDir,
					);

					// Check each config (directory) for cache status
					for (const config of configs) {
						if (config.ifChanged && config.ifChanged.length > 0) {
							// Check if cache is stale
							const hasChanges = checkForChanges(
								targetPlugin,
								targetHook,
								config.directory,
								config.ifChanged,
								targetPluginRoot,
							);

							if (hasChanges) {
								staleHooks.push({
									plugin: targetPlugin,
									hook: targetHook,
									reason: `Files changed in ${config.directory}`,
								});
							}
						}
					}
				}
			}
		}
	}

	// Report results
	if (staleHooks.length === 0) {
		if (totalHooks === 0) {
			console.log(`No ${hookType} hooks found to verify`);
			return 0;
		}
		console.log(`✅ All ${totalHooks} ${hookType} hooks are cached`);
		return 0;
	}

	console.error(`❌ ${staleHooks.length} hook(s) need to be run:\n`);
	for (const { plugin, hook, reason } of staleHooks) {
		console.error(`  ${plugin}:${hook} - ${reason}`);
	}
	console.error(`\nRun: han hook dispatch ${hookType}`);
	return 1;
}

export function registerHookVerify(hookCommand: Command): void {
	hookCommand
		.command("verify <hookType>")
		.description(
			"Verify that all hooks of a specific type have been run and are cached.\n" +
				"Exits 0 if all hooks are cached, non-zero if any hooks need to be run.\n\n" +
				"Example: han hook verify Stop",
		)
		.action((hookType: string) => {
			const exitCode = verifyHooks(hookType);
			process.exit(exitCode);
		});
}
