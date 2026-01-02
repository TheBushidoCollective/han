import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
	formatValidationErrors,
	validatePluginConfig,
	validateUserConfig,
} from "../config/config-validator.ts";
import { getPluginHookSettings } from "../config/han-settings.ts";
import { getPluginNameFromRoot } from "../shared/index.ts";
import { findDirectoriesWithMarkers } from "./hook-cache.ts";

/**
 * Hook dependency declaration
 * Allows a hook to depend on another plugin's hook to run first
 */
export interface HookDependency {
	/** The plugin name that provides the dependency hook */
	plugin: string;
	/** The hook name within the dependency plugin */
	hook: string;
	/**
	 * If true, skip this dependency if the plugin is not installed.
	 * If false (default), fail with an error if the plugin is missing.
	 */
	optional?: boolean;
}

/**
 * Plugin hook configuration (from han-plugin.yml)
 */
export interface PluginHookDefinition {
	dirsWith?: string[];
	dirTest?: string;
	command: string;
	/**
	 * Human-readable description of what this hook does.
	 * Used for documentation and website display.
	 */
	description?: string;
	/**
	 * Glob patterns relative to each target directory.
	 * When --cache is enabled, the hook will only run if files matching
	 * these patterns have changed since the last successful execution.
	 */
	ifChanged?: string[];
	/**
	 * Maximum time in milliseconds to wait for output before considering
	 * the hook as hanging. If no output is received within this period,
	 * the hook will be terminated and reported as failed.
	 * Default: no idle timeout (only overall timeout applies)
	 */
	idleTimeout?: number;
	/**
	 * Guidance tip shown when this hook fails repeatedly.
	 * Should include the MCP tool name to use for this hook.
	 * Example: "Use the `jutsu_biome_lint` MCP tool before marking complete."
	 */
	tip?: string;
	/**
	 * Dependencies on other plugin hooks.
	 * These hooks will be run (or waited on) before this hook executes.
	 * Dependencies must be within the same hook type (Stop→Stop, etc.)
	 */
	dependsOn?: HookDependency[];
}

/**
 * YAML hook dependency with snake_case keys
 * (from han-plugin.yml)
 */
interface YamlHookDependency {
	plugin: string;
	hook: string;
	optional?: boolean;
}

/**
 * YAML plugin hook definition with snake_case keys
 * (from han-plugin.yml)
 */
interface YamlPluginHookDefinition {
	dirs_with?: string[];
	dir_test?: string;
	command: string;
	description?: string;
	if_changed?: string[];
	idle_timeout?: number;
	tip?: string;
	depends_on?: YamlHookDependency[];
}

/**
 * Memory configuration in plugin config
 *
 * Convention-based: provider name derived from plugin name,
 * script always at memory-provider.ts
 */
export interface PluginMemoryConfig {
	/** MCP tools the memory agent is allowed to use */
	allowed_tools?: string[];
	/** System prompt for the memory extraction agent */
	system_prompt?: string;
}

/**
 * YAML plugin config structure (from han-plugin.yml)
 */
interface YamlPluginConfig {
	name?: string;
	version?: string;
	description?: string;
	keywords?: string[];
	hooks: Record<string, YamlPluginHookDefinition>;
	memory?: PluginMemoryConfig;
}

/**
 * Convert YAML snake_case hook definition to camelCase
 */
function convertYamlHook(
	yamlHook: YamlPluginHookDefinition,
): PluginHookDefinition {
	return {
		command: yamlHook.command,
		...(yamlHook.dirs_with && { dirsWith: yamlHook.dirs_with }),
		...(yamlHook.dir_test && { dirTest: yamlHook.dir_test }),
		...(yamlHook.description && { description: yamlHook.description }),
		...(yamlHook.if_changed && { ifChanged: yamlHook.if_changed }),
		...(yamlHook.idle_timeout !== undefined && {
			idleTimeout: yamlHook.idle_timeout,
		}),
		...(yamlHook.tip && { tip: yamlHook.tip }),
		...(yamlHook.depends_on && { dependsOn: yamlHook.depends_on }),
	};
}

/**
 * Convert YAML plugin config to standard PluginConfig
 */
function convertYamlPluginConfig(yamlConfig: YamlPluginConfig): PluginConfig {
	const hooks: Record<string, PluginHookDefinition> = {};
	for (const [hookName, hookDef] of Object.entries(yamlConfig.hooks)) {
		hooks[hookName] = convertYamlHook(hookDef);
	}
	return {
		hooks,
		...(yamlConfig.memory && { memory: yamlConfig.memory }),
	};
}

export interface PluginConfig {
	hooks: Record<string, PluginHookDefinition>;
	memory?: PluginMemoryConfig;
}

/**
 * User override configuration (from han-config.yml in target directories)
 */
export interface UserHookOverride {
	enabled?: boolean;
	command?: string;
	/**
	 * Additional glob patterns for change detection.
	 * These patterns are merged with (added to) the plugin's ifChanged patterns.
	 */
	if_changed?: string[];
	/**
	 * Override the idle timeout in milliseconds.
	 * Set to 0 or false to disable idle timeout checking.
	 */
	idle_timeout?: number | false;
}

export interface UserConfig {
	[pluginName: string]: {
		[hookName: string]: UserHookOverride;
	};
}

/**
 * Resolved hook configuration after merging plugin defaults with user overrides
 */
export interface ResolvedHookConfig {
	enabled: boolean;
	command: string;
	directory: string;
	/**
	 * Glob patterns for change detection (from ifChanged in han-plugin.yml)
	 */
	ifChanged?: string[];
	/**
	 * Maximum time in milliseconds to wait for output before considering
	 * the hook as hanging. undefined means no idle timeout.
	 */
	idleTimeout?: number;
}

/**
 * Load plugin config from han-plugin.yml at the plugin root
 * @param pluginRoot - The plugin directory, typically from CLAUDE_PLUGIN_ROOT env var
 * @param validate - Whether to validate the config (default: true)
 */
export function loadPluginConfig(
	pluginRoot: string,
	validate = true,
): PluginConfig | null {
	const yamlPath = join(pluginRoot, "han-plugin.yml");
	if (!existsSync(yamlPath)) {
		return null;
	}

	try {
		const content = readFileSync(yamlPath, "utf-8");
		const yamlConfig = YAML.parse(content) as YamlPluginConfig;

		if (!yamlConfig?.hooks) {
			console.error(`Invalid plugin config at ${yamlPath}: missing 'hooks'`);
			return null;
		}

		const config = convertYamlPluginConfig(yamlConfig);

		if (validate) {
			const result = validatePluginConfig(config);
			if (!result.valid) {
				console.error(formatValidationErrors(yamlPath, result));
				return null;
			}
		}

		return config;
	} catch (error) {
		console.error(`Error loading plugin config from ${yamlPath}:`, error);
		return null;
	}
}

/**
 * YAML user config structure with nested plugins.hooks format
 * (from han.yml)
 */
interface YamlUserConfig {
	hooks?: {
		enabled?: boolean;
		checkpoints?: boolean;
	};
	plugins?: {
		[pluginName: string]: {
			hooks?: {
				[hookName: string]: UserHookOverride;
			};
		};
	};
}

/**
 * Extract UserConfig from new YAML format with nested plugins.hooks structure
 */
function extractUserConfigFromYaml(
	yamlConfig: YamlUserConfig,
): UserConfig | null {
	if (!yamlConfig.plugins) {
		return null;
	}

	const userConfig: UserConfig = {};

	for (const [pluginName, pluginData] of Object.entries(yamlConfig.plugins)) {
		if (pluginData.hooks) {
			userConfig[pluginName] = pluginData.hooks;
		}
	}

	return Object.keys(userConfig).length > 0 ? userConfig : null;
}

/**
 * Load user override config from han.yml or han-config.yml in a directory
 * Checks for han.yml (new format) first, then falls back to han-config.yml (legacy)
 * @param directory - The directory containing the config file
 * @param validate - Whether to validate the config (default: true)
 */
export function loadUserConfig(
	directory: string,
	validate = true,
): UserConfig | null {
	// Try han.yml first (new format with nested plugins.hooks structure)
	const newConfigPath = join(directory, "han.yml");
	if (existsSync(newConfigPath)) {
		try {
			const content = readFileSync(newConfigPath, "utf-8");
			const yamlConfig = YAML.parse(content) as YamlUserConfig;

			// Extract user config from the plugins section
			const userConfig = extractUserConfigFromYaml(yamlConfig);
			if (userConfig && validate) {
				const result = validateUserConfig(userConfig);
				if (!result.valid) {
					console.error(formatValidationErrors(newConfigPath, result));
					// Don't return null for user config - just warn and continue
				}
			}
			return userConfig;
		} catch (error) {
			console.error(`Error loading user config from ${newConfigPath}:`, error);
			return null;
		}
	}

	// Fall back to han-config.yml (legacy flat format)
	const legacyConfigPath = join(directory, "han-config.yml");
	if (!existsSync(legacyConfigPath)) {
		return null;
	}

	try {
		const content = readFileSync(legacyConfigPath, "utf-8");
		const config = YAML.parse(content);

		if (validate) {
			const result = validateUserConfig(config);
			if (!result.valid) {
				console.error(formatValidationErrors(legacyConfigPath, result));
				// Don't return null for user config - just warn and continue
				// This allows partial overrides to work even if some fields are invalid
			}
		}

		return config as UserConfig;
	} catch (error) {
		console.error(`Error loading user config from ${legacyConfigPath}:`, error);
		return null;
	}
}

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	return findDirectoriesWithMarkers(rootDir, markerPatterns);
}

/**
 * Run test command silently in directory (returns true if exit code 0)
 */
function testDirCommand(dir: string, cmd: string): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Merge plugin and user ifChanged patterns.
 * User patterns are added to plugin defaults, with duplicates removed.
 */
function mergeIfChangedPatterns(
	pluginPatterns?: string[],
	userPatterns?: string[],
): string[] | undefined {
	if (!pluginPatterns && !userPatterns) {
		return undefined;
	}

	const merged = new Set<string>();

	// Add plugin patterns first
	if (pluginPatterns) {
		for (const pattern of pluginPatterns) {
			merged.add(pattern);
		}
	}

	// Add user patterns (these extend the defaults)
	if (userPatterns) {
		for (const pattern of userPatterns) {
			merged.add(pattern);
		}
	}

	return Array.from(merged);
}

/**
 * Get hook configurations for target directories
 */
export function getHookConfigs(
	pluginRoot: string,
	hookName: string,
	projectRoot: string,
): ResolvedHookConfig[] {
	const pluginConfig = loadPluginConfig(pluginRoot);

	if (!pluginConfig) {
		return [];
	}

	const hookDef = pluginConfig.hooks[hookName];

	if (!hookDef) {
		return [];
	}

	const pluginName = getPluginNameFromRoot(pluginRoot);

	// Helper to resolve config for a directory
	// Uses full precedence chain: global → project → local → root → directory
	const resolveConfigForDir = (dir: string): ResolvedHookConfig => {
		// Get settings from the full han.yml precedence chain
		const globalSettings = getPluginHookSettings(pluginName, hookName, dir);

		// Also check legacy directory-specific han-config.yml (for backwards compat)
		const legacyConfig = loadUserConfig(dir);
		const legacyOverride = legacyConfig?.[pluginName]?.[hookName];

		// Merge: global settings take precedence over legacy per-directory config
		const userOverride = {
			...legacyOverride,
			...globalSettings,
		};

		// Resolve idle timeout: user override takes precedence
		// User can set to false/0 to disable, or a number to override
		let idleTimeout: number | undefined;
		if (
			userOverride?.idle_timeout === false ||
			userOverride?.idle_timeout === 0
		) {
			idleTimeout = undefined; // Disabled
		} else if (typeof userOverride?.idle_timeout === "number") {
			idleTimeout = userOverride.idle_timeout;
		} else {
			idleTimeout = hookDef.idleTimeout;
		}

		return {
			enabled: userOverride?.enabled !== false,
			command: userOverride?.command || hookDef.command,
			directory: dir,
			ifChanged: mergeIfChangedPatterns(
				hookDef.ifChanged,
				userOverride?.if_changed,
			),
			idleTimeout,
		};
	};

	// No dirsWith specified - run in project root only
	if (!hookDef.dirsWith || hookDef.dirsWith.length === 0) {
		return [resolveConfigForDir(projectRoot)];
	}

	// Find directories and filter with dirTest if specified
	const directories = findDirectoriesWithMarker(projectRoot, hookDef.dirsWith);
	const configs: ResolvedHookConfig[] = [];

	for (const dir of directories) {
		// Filter with dirTest if specified
		if (hookDef.dirTest && !testDirCommand(dir, hookDef.dirTest)) {
			continue;
		}

		configs.push(resolveConfigForDir(dir));
	}

	return configs;
}

/**
 * Get hook definition from plugin config
 */
export function getHookDefinition(
	pluginRoot: string,
	hookName: string,
): PluginHookDefinition | null {
	const pluginConfig = loadPluginConfig(pluginRoot);

	if (!pluginConfig) {
		return null;
	}

	return pluginConfig.hooks[hookName] || null;
}

/**
 * List all available hooks from plugin config
 */
export function listAvailableHooks(pluginRoot: string): string[] {
	const pluginConfig = loadPluginConfig(pluginRoot);

	if (!pluginConfig) {
		return [];
	}

	return Object.keys(pluginConfig.hooks);
}
