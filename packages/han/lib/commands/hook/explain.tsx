import { existsSync, readdirSync, readFileSync } from "node:fs";
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
} from "../../config/claude-settings.ts";
import {
	getHookEvents,
	HookExplainUI,
	type HookSource,
	loadPluginConfig,
	type PluginHookDefinition,
} from "../../hooks/index.ts";

/**
 * Claude Code plugin hooks.json format
 */
interface ClaudePluginHooksJson {
	description?: string;
	hooks?: Record<
		string,
		Array<{
			matcher?: string;
			hooks: Array<{
				type: "command" | "prompt";
				command?: string;
				prompt?: string;
				timeout?: number;
			}>;
		}>
	>;
}

/**
 * Hook entry from Claude Code settings (legacy format)
 */
interface LegacyHookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
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

	// Only add core path if we're actually looking for the core plugin
	if (pluginName === "core") {
		potentialPaths.push(join(marketplaceRoot, "core"));
	}

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
 * Parse legacy hooks from a hooks object (from settings.hooks)
 */
function parseLegacyHooksObject(
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
				// Convert legacy format to new format
				const hooks = (group.hooks as LegacyHookEntry[]).map((h) => ({
					command: h.command || h.prompt || "",
					description: h.type === "prompt" ? "Prompt hook" : undefined,
				}));

				sources.push({
					source,
					scope,
					hookType,
					hooks,
				});
			}
		}
	}

	return sources;
}

/**
 * Get hooks from Claude Code plugin hooks.json files
 * These are the actual hooks that Claude Code executes (e.g., han hook orchestrate commands)
 */
function getClaudePluginHooks(): HookSource[] {
	const sources: HookSource[] = [];
	const configDir = getClaudeConfigDir();
	if (!configDir) return sources;

	const pluginCacheDir = join(configDir, "plugins", "cache");
	if (!existsSync(pluginCacheDir)) return sources;

	// Iterate through marketplaces
	try {
		const marketplaces = readdirSync(pluginCacheDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);

		for (const marketplace of marketplaces) {
			const marketplaceDir = join(pluginCacheDir, marketplace);
			const plugins = readdirSync(marketplaceDir, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);

			for (const pluginName of plugins) {
				const pluginDir = join(marketplaceDir, pluginName);
				// Find the latest version directory
				const versions = readdirSync(pluginDir, { withFileTypes: true })
					.filter((d) => d.isDirectory())
					.map((d) => d.name)
					.sort()
					.reverse();

				if (versions.length === 0) continue;

				const latestVersion = versions[0];
				const hooksJsonPath = join(
					pluginDir,
					latestVersion,
					"hooks",
					"hooks.json",
				);

				if (!existsSync(hooksJsonPath)) continue;

				try {
					const content = readFileSync(hooksJsonPath, "utf-8");
					const hooksJson = JSON.parse(content) as ClaudePluginHooksJson;

					if (!hooksJson.hooks) continue;

					for (const [hookType, hookGroups] of Object.entries(
						hooksJson.hooks,
					)) {
						const hooks: Array<{
							name?: string;
							command: string;
							description?: string;
							matcher?: string;
						}> = [];

						for (const group of hookGroups) {
							for (const hook of group.hooks) {
								hooks.push({
									command: hook.command || hook.prompt || "",
									description:
										hook.type === "prompt" ? "Prompt hook" : undefined,
									matcher: group.matcher,
								});
							}
						}

						if (hooks.length > 0) {
							sources.push({
								source: hooksJsonPath,
								pluginName: `${pluginName}@${marketplace}`,
								hookType,
								hooks,
								isClaudePlugin: true,
							});
						}
					}
				} catch {
					// Invalid JSON, skip
				}
			}
		}
	} catch {
		// Directory read failed, skip
	}

	return sources;
}

/**
 * Get hooks from Claude Code settings files (legacy format)
 */
function getSettingsHooks(): HookSource[] {
	const sources: HookSource[] = [];

	for (const { scope, path } of getSettingsPaths()) {
		// Check settings.json for hooks
		const settings = readSettingsFile(path);
		if (settings?.hooks) {
			sources.push(
				...parseLegacyHooksObject(
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
						...parseLegacyHooksObject(
							hooksJson.hooks as Record<string, unknown>,
							hooksJsonPath,
							scope,
						),
					);
				} else {
					// Hooks directly at root level
					sources.push(
						...parseLegacyHooksObject(hooksJson, hooksJsonPath, scope),
					);
				}
			} catch {
				// Invalid JSON, skip
			}
		}
	}

	return sources;
}

/**
 * Get hooks from installed Han plugins (from han-plugin.yml)
 */
function getPluginHooks(): HookSource[] {
	const sources: HookSource[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginRoot) continue;

		const config = loadPluginConfig(pluginRoot, false);
		if (!config?.hooks) continue;

		// Group hooks by event type
		const hooksByEvent = new Map<
			string,
			Array<{ name: string; def: PluginHookDefinition }>
		>();

		for (const [hookName, hookDef] of Object.entries(config.hooks)) {
			const events = getHookEvents(hookDef);
			for (const event of events) {
				const existing = hooksByEvent.get(event) || [];
				existing.push({ name: hookName, def: hookDef });
				hooksByEvent.set(event, existing);
			}
		}

		// Create HookSource for each event type
		for (const [eventType, hooks] of hooksByEvent.entries()) {
			sources.push({
				source: pluginRoot,
				pluginName,
				marketplace,
				hookType: eventType,
				hooks: hooks.map(({ name, def }) => ({
					name,
					command: def.command,
					description: def.description,
					dirsWith: def.dirsWith,
					ifChanged: def.ifChanged,
					toolFilter: def.toolFilter,
					tip: def.tip,
					dependsOn: def.dependsOn,
				})),
			});
		}
	}

	return sources;
}

/**
 * Explain all configured hooks using Ink UI
 */
function explainHooks(hookType?: string, hanOnly = false): void {
	const claudePluginHooks = getClaudePluginHooks();
	const settingsHooks = getSettingsHooks();
	const pluginHooks = getPluginHooks();

	// By default, show all hooks (Claude plugin hooks first, then settings, then Han plugins).
	// Use --han-only to show only Han plugin hooks.
	const allHooks = hanOnly
		? pluginHooks
		: [...claudePluginHooks, ...settingsHooks, ...pluginHooks];

	// Filter by hook type if specified
	const filteredHooks: HookSource[] = hookType
		? allHooks.filter(
				(h) => h.hookType.toLowerCase() === hookType.toLowerCase(),
			)
		: allHooks;

	// Render the Ink UI component
	render(<HookExplainUI hooks={filteredHooks} showAll={!hanOnly} />);
}

export function registerHookExplain(hookCommand: Command): void {
	hookCommand
		.command("explain [hookType]")
		.description(
			"Show comprehensive information about configured hooks.\n" +
				"By default, shows ALL hooks (Han plugins + Claude Code settings).\n" +
				"Use --han-only to show only Han plugin hooks.\n\n" +
				"Examples:\n" +
				"  han hook explain           # Show all hooks (Han + settings)\n" +
				"  han hook explain Stop      # Show only Stop hooks from all sources\n" +
				"  han hook explain --han-only # Show only Han plugin hooks\n" +
				"  han hook explain Stop --han-only",
		)
		.option("--han-only", "Show only Han plugin hooks (exclude settings hooks)")
		.action((hookType: string | undefined, options: { hanOnly?: boolean }) => {
			explainHooks(hookType, options.hanOnly ?? false);
		});
}
