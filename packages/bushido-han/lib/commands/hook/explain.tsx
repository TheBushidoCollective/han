import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { render } from "ink";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	getSettingsPaths,
	type MarketplaceConfig,
	readSettingsFile,
	type SettingsScope,
} from "../../claude-settings.js";
import { HookExplainUI, type HookSource } from "../../hook-explain-ui.js";

/**
 * Hook entry from Claude Code settings or plugin hooks.json
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
function resolveToAbsolute(path: string): string {
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
 */
function loadPluginHooks(
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
 * Parse hooks from a hooks object (either from settings.hooks or hooks.json)
 */
function parseHooksObject(
	hooksObj: Record<string, unknown>,
	source: string,
	scope?: SettingsScope,
): HookSource[] {
	const sources: HookSource[] = [];

	for (const [hookType, hookGroups] of Object.entries(hooksObj)) {
		if (!Array.isArray(hookGroups)) continue;

		for (const group of hookGroups) {
			if (
				typeof group === "object" &&
				group !== null &&
				"hooks" in group &&
				Array.isArray(group.hooks)
			) {
				sources.push({
					source,
					scope,
					hookType,
					hooks: group.hooks as HookEntry[],
				});
			}
		}
	}

	return sources;
}

/**
 * Get hooks from Claude Code settings files and hooks.json files
 */
function getSettingsHooks(): HookSource[] {
	const sources: HookSource[] = [];

	for (const { scope, path } of getSettingsPaths()) {
		// Check settings.json for hooks
		const settings = readSettingsFile(path);
		if (settings?.hooks) {
			sources.push(
				...parseHooksObject(
					settings.hooks as Record<string, unknown>,
					path,
					scope,
				),
			);
		}

		// Also check for hooks.json in the same directory
		const hooksJsonPath = path.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		if (hooksJsonPath !== path && existsSync(hooksJsonPath)) {
			try {
				const content = readFileSync(hooksJsonPath, "utf-8");
				const hooksJson = JSON.parse(content) as Record<string, unknown>;

				// hooks.json can have hooks at root level or under "hooks" key
				if (hooksJson.hooks && typeof hooksJson.hooks === "object") {
					sources.push(
						...parseHooksObject(
							hooksJson.hooks as Record<string, unknown>,
							hooksJsonPath,
							scope,
						),
					);
				} else {
					// Hooks directly at root level
					sources.push(...parseHooksObject(hooksJson, hooksJsonPath, scope));
				}
			} catch {
				// Invalid JSON, skip
			}
		}
	}

	return sources;
}

/**
 * Get hooks from installed Han plugins
 */
function getPluginHooks(): HookSource[] {
	const sources: HookSource[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const result = loadPluginHooks(pluginName, marketplace, marketplaceConfig);

		if (!result?.hooks?.hooks) continue;

		const { hooks: pluginHooks, pluginRoot } = result;

		for (const [hookType, hookGroups] of Object.entries(pluginHooks.hooks)) {
			for (const group of hookGroups) {
				sources.push({
					source: pluginRoot,
					pluginName,
					marketplace,
					hookType,
					hooks: group.hooks,
				});
			}
		}
	}

	return sources;
}

/**
 * Explain all configured hooks using Ink UI
 */
function explainHooks(hookType?: string, showAll = false): void {
	const settingsHooks = getSettingsHooks();
	const pluginHooks = getPluginHooks();

	// By default, only show Han plugin hooks. Use --all to include settings hooks.
	const allHooks = showAll ? [...settingsHooks, ...pluginHooks] : pluginHooks;

	// Filter by hook type if specified
	const filteredHooks: HookSource[] = hookType
		? allHooks.filter(
				(h) => h.hookType.toLowerCase() === hookType.toLowerCase(),
			)
		: allHooks;

	// Render the Ink UI component
	render(<HookExplainUI hooks={filteredHooks} showAll={showAll} />);
}

export function registerHookExplain(hookCommand: Command): void {
	hookCommand
		.command("explain [hookType]")
		.description(
			"Show comprehensive information about configured hooks.\n" +
				"By default, shows only Han plugin hooks.\n" +
				"Use --all to include hooks from Claude Code settings.\n\n" +
				"Examples:\n" +
				"  han hook explain           # Show Han plugin hooks\n" +
				"  han hook explain Stop      # Show only Stop hooks from Han plugins\n" +
				"  han hook explain --all     # Show all hooks including settings\n" +
				"  han hook explain Stop --all",
		)
		.option(
			"-a, --all",
			"Include hooks from Claude Code settings (not just Han plugins)",
		)
		.action((hookType: string | undefined, options: { all?: boolean }) => {
			explainHooks(hookType, options.all ?? false);
		});
}
