import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
	formatValidationErrors,
	validatePluginConfig,
	validateUserConfig,
} from "./config-validator.js";
import { findDirectoriesWithMarkers } from "./hook-cache.js";

/**
 * Plugin hook configuration (from han-config.json)
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
}

export interface PluginConfig {
	hooks: Record<string, PluginHookDefinition>;
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
	 * Glob patterns for change detection (from ifChanged in han-config.json)
	 */
	ifChanged?: string[];
	/**
	 * Maximum time in milliseconds to wait for output before considering
	 * the hook as hanging. undefined means no idle timeout.
	 */
	idleTimeout?: number;
}

/**
 * Load plugin config from han-config.json at the plugin root
 * @param pluginRoot - The plugin directory, typically from CLAUDE_PLUGIN_ROOT env var
 * @param validate - Whether to validate the config (default: true)
 */
export function loadPluginConfig(
	pluginRoot: string,
	validate = true,
): PluginConfig | null {
	const configPath = join(pluginRoot, "han-config.json");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);

		if (validate) {
			const result = validatePluginConfig(config);
			if (!result.valid) {
				console.error(formatValidationErrors(configPath, result));
				return null;
			}
		}

		return config as PluginConfig;
	} catch (error) {
		console.error(`Error loading plugin config from ${configPath}:`, error);
		return null;
	}
}

/**
 * Load user override config from han-config.yml in a directory
 * @param directory - The directory containing the han-config.yml file
 * @param validate - Whether to validate the config (default: true)
 */
export function loadUserConfig(
	directory: string,
	validate = true,
): UserConfig | null {
	const configPath = join(directory, "han-config.yml");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const config = YAML.parse(content);

		if (validate) {
			const result = validateUserConfig(config);
			if (!result.valid) {
				console.error(formatValidationErrors(configPath, result));
				// Don't return null for user config - just warn and continue
				// This allows partial overrides to work even if some fields are invalid
			}
		}

		return config as UserConfig;
	} catch (error) {
		console.error(`Error loading user config from ${configPath}:`, error);
		return null;
	}
}

/**
 * Extract plugin name from CLAUDE_PLUGIN_ROOT path
 * e.g., /path/to/jutsu-elixir -> jutsu-elixir
 */
export function getPluginNameFromRoot(pluginRoot: string): string {
	const parts = pluginRoot.split("/");
	return parts[parts.length - 1] || "";
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
	const resolveConfigForDir = (dir: string): ResolvedHookConfig => {
		const userConfig = loadUserConfig(dir);
		const userOverride = userConfig?.[pluginName]?.[hookName];

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
