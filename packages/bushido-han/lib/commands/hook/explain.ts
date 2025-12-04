import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	getSettingsPaths,
	type MarketplaceConfig,
	readSettingsFile,
	type SettingsScope,
} from "../../claude-settings.js";

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

interface HookSource {
	source: string;
	scope?: SettingsScope;
	pluginName?: string;
	marketplace?: string;
	hookType: string;
	hooks: HookEntry[];
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
 * Format a hook entry for display
 */
function formatHook(hook: HookEntry, indent: string): string {
	const lines: string[] = [];

	lines.push(`${indent}Type: ${hook.type}`);

	if (hook.command) {
		// Truncate long commands
		const cmd =
			hook.command.length > 80
				? `${hook.command.substring(0, 77)}...`
				: hook.command;
		lines.push(`${indent}Command: ${cmd}`);
	}

	if (hook.prompt) {
		// Show first line of prompt
		const firstLine = hook.prompt.split("\n")[0];
		const truncated =
			firstLine.length > 60 ? `${firstLine.substring(0, 57)}...` : firstLine;
		lines.push(`${indent}Prompt: ${truncated}`);
	}

	if (hook.timeout) {
		lines.push(`${indent}Timeout: ${hook.timeout}ms`);
	}

	return lines.join("\n");
}

/**
 * Explain all configured hooks
 */
function explainHooks(hookType?: string, showAll = false): void {
	const settingsHooks = getSettingsHooks();
	const pluginHooks = getPluginHooks();

	// By default, only show Han plugin hooks. Use --all to include settings hooks.
	const allHooks = showAll ? [...settingsHooks, ...pluginHooks] : pluginHooks;

	// Filter by hook type if specified
	const filteredHooks = hookType
		? allHooks.filter(
				(h) => h.hookType.toLowerCase() === hookType.toLowerCase(),
			)
		: allHooks;

	if (filteredHooks.length === 0) {
		if (hookType) {
			console.log(`No hooks found for type: ${hookType}`);
		} else {
			console.log("No hooks configured.");
		}
		return;
	}

	// Group by hook type
	const byType = new Map<string, HookSource[]>();
	for (const hook of filteredHooks) {
		const existing = byType.get(hook.hookType) || [];
		existing.push(hook);
		byType.set(hook.hookType, existing);
	}

	// Sort hook types
	const sortedTypes = Array.from(byType.keys()).sort();

	console.log("=".repeat(60));
	console.log("CONFIGURED HOOKS");
	console.log("=".repeat(60));

	for (const type of sortedTypes) {
		const hooks = byType.get(type);
		if (!hooks) continue;

		console.log(`\n## ${type}`);
		console.log("-".repeat(40));

		for (const source of hooks) {
			if (source.pluginName) {
				console.log(`\n  Plugin: ${source.pluginName}@${source.marketplace}`);
				console.log(`  Path: ${source.source}`);
			} else {
				console.log(`\n  Settings: ${source.scope}`);
				console.log(`  Path: ${source.source}`);
			}

			for (let i = 0; i < source.hooks.length; i++) {
				console.log(`\n    Hook ${i + 1}:`);
				console.log(formatHook(source.hooks[i], "      "));
			}
		}
	}

	console.log(`\n${"=".repeat(60)}`);

	// Summary
	const commandHooks = filteredHooks.flatMap((h) =>
		h.hooks.filter((e) => e.type === "command"),
	);
	const promptHooks = filteredHooks.flatMap((h) =>
		h.hooks.filter((e) => e.type === "prompt"),
	);

	console.log("\nSUMMARY:");
	console.log(`  Total hook sources: ${filteredHooks.length}`);
	console.log(`  Command hooks: ${commandHooks.length}`);
	console.log(`  Prompt hooks: ${promptHooks.length}`);
	console.log(`  Hook types: ${sortedTypes.join(", ") || "none"}`);

	// Note about dispatch
	console.log("\nNOTE:");
	console.log(
		"  - Command hooks execute shell commands and can block (return non-zero exit)",
	);
	console.log(
		"  - Prompt hooks inject text into context (cannot block, handled by Claude Code)",
	);
	console.log(
		"  - The 'han hook dispatch' command only runs command hooks, not prompt hooks",
	);
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
