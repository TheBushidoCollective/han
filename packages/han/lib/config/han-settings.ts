import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { getClaudeConfigDir, getProjectDir } from "./claude-settings.ts";

/**
 * Hook override settings for a specific plugin hook
 */
export interface HookOverride {
	enabled?: boolean;
	command?: string;
	if_changed?: string[];
	idle_timeout?: number | false;
}

/**
 * Plugin settings with nested hooks structure
 */
export interface PluginSettings {
	hooks?: {
		[hookName: string]: HookOverride;
	};
}

/**
 * Port configuration for Han services
 */
export interface PortConfig {
	coordinator?: number; // GraphQL coordinator daemon port
	browse?: number; // Browse UI server port
}

/**
 * Han configuration structure
 */
export interface HanConfig {
	/**
	 * Custom han binary command or path.
	 * Useful for development to run local version instead of installed binary.
	 * @example "bun run /path/to/han/packages/han/lib/main.ts"
	 * @example "/path/to/han"
	 * @default "han" (from PATH)
	 */
	hanBinary?: string;
	/**
	 * Port configuration for Han services.
	 * Ports are auto-allocated on first run to avoid conflicts
	 * with other Han instances using different CLAUDE_CONFIG_DIR.
	 */
	ports?: PortConfig;
	hooks?: {
		enabled?: boolean; // Master switch (default: true)
		checkpoints?: boolean; // Enable checkpoints (default: true)
		cache?: boolean; // Enable caching (default: true)
		fail_fast?: boolean; // Stop on first failure (default: true)
		transcript_filter?: boolean; // Session-scoped filtering (default: true when checkpoints enabled)
	};
	memory?: {
		enabled?: boolean; // Enable memory system (default: true)
	};
	metrics?: {
		enabled?: boolean; // Enable metrics tracking (default: true)
	};
	plugins?: {
		[pluginName: string]: PluginSettings;
	};
}

/**
 * Settings scope type
 * - user: ~/.claude/han.yml (global defaults)
 * - project: .claude/han.yml (team-shared project settings)
 * - local: .claude/han.local.yml (personal project-specific, gitignored)
 * - root: ./han.yml (project root config)
 * - directory: <dir>/han.yml (directory-specific)
 */
export type HanConfigScope =
	| "user"
	| "project"
	| "local"
	| "root"
	| "directory";

/**
 * Get Han config file paths in order of precedence (lowest to highest priority):
 * 1. User config (~/.claude/han.yml) - Personal global settings
 * 2. Project config (.claude/han.yml) - Team-shared project settings
 * 3. Local config (.claude/han.local.yml) - Personal project-specific, gitignored
 * 4. Root config (./han.yml) - Project root config
 *
 * Note: Directory-specific configs (dir/han.yml) are loaded separately via
 * getHanConfigPathsForDirectory() when resolving hooks for a specific directory.
 */
export function getHanConfigPaths(): Array<{
	scope: HanConfigScope;
	path: string;
}> {
	const paths: Array<{ scope: HanConfigScope; path: string }> = [];
	const configDir = getClaudeConfigDir();
	const projectDir = getProjectDir();

	// 1. User config (lowest priority)
	if (configDir) {
		paths.push({
			scope: "user",
			path: join(configDir, "han.yml"),
		});
	}

	// 2. Project config (team-shared)
	paths.push({
		scope: "project",
		path: join(projectDir, ".claude", "han.yml"),
	});

	// 3. Local config (personal project-specific, gitignored)
	paths.push({
		scope: "local",
		path: join(projectDir, ".claude", "han.local.yml"),
	});

	// 4. Root config (project root)
	paths.push({
		scope: "root",
		path: join(projectDir, "han.yml"),
	});

	return paths;
}

/**
 * Get Han config file paths for a specific directory.
 * Includes all base paths plus the directory-specific han.yml.
 * Precedence (lowest to highest):
 *   ~/.claude/han.yml < .claude/han.yml < .claude/han.local.yml < ./han.yml < dir/han.yml
 */
export function getHanConfigPathsForDirectory(directory: string): Array<{
	scope: HanConfigScope;
	path: string;
}> {
	const basePaths = getHanConfigPaths();
	const projectDir = getProjectDir();

	// If directory is different from project root, add directory-specific config
	if (directory !== projectDir) {
		basePaths.push({
			scope: "directory",
			path: join(directory, "han.yml"),
		});
	}

	return basePaths;
}

/**
 * Parse YAML file and return config or null if missing/invalid
 */
export function loadHanConfigFile(path: string): HanConfig | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		const config = YAML.parse(content);

		// Empty file returns null from YAML.parse, treat as empty object
		if (config === null || config === undefined) {
			return {};
		}

		return config as HanConfig;
	} catch {
		// Invalid YAML or read error - return null
		return null;
	}
}

/**
 * Deep merge plugin settings (hooks are merged individually)
 */
function mergePluginSettings(
	base: { [pluginName: string]: PluginSettings } | undefined,
	override: { [pluginName: string]: PluginSettings } | undefined,
): { [pluginName: string]: PluginSettings } {
	const result = { ...base };

	if (!override) {
		return result;
	}

	for (const [pluginName, pluginSettings] of Object.entries(override)) {
		if (!result[pluginName]) {
			result[pluginName] = pluginSettings;
		} else {
			// Merge hooks within the plugin
			result[pluginName] = {
				...result[pluginName],
				hooks: {
					...result[pluginName].hooks,
					...pluginSettings.hooks,
				},
			};
		}
	}

	return result;
}

/**
 * Merge configs from all scopes (later overrides earlier)
 * Precedence: user < project < local < root
 */
export function getMergedHanConfig(): HanConfig {
	const merged: HanConfig = {};

	for (const { path } of getHanConfigPaths()) {
		const config = loadHanConfigFile(path);
		if (config) {
			// hanBinary - later config wins
			if (config.hanBinary !== undefined) {
				merged.hanBinary = config.hanBinary;
			}

			// Merge ports section
			if (config.ports) {
				merged.ports = {
					...merged.ports,
					...config.ports,
				};
			}

			// Merge hooks section
			if (config.hooks) {
				merged.hooks = {
					...merged.hooks,
					...config.hooks,
				};
			}

			// Merge memory section
			if (config.memory) {
				merged.memory = {
					...merged.memory,
					...config.memory,
				};
			}

			// Merge metrics section
			if (config.metrics) {
				merged.metrics = {
					...merged.metrics,
					...config.metrics,
				};
			}

			// Merge plugins section
			if (config.plugins) {
				merged.plugins = mergePluginSettings(merged.plugins, config.plugins);
			}
		}
	}

	return merged;
}

/**
 * Get merged config including directory-specific settings
 * @param directory - The directory to get config for
 */
export function getMergedHanConfigForDirectory(directory: string): HanConfig {
	const merged: HanConfig = {};

	for (const { path } of getHanConfigPathsForDirectory(directory)) {
		const config = loadHanConfigFile(path);
		if (config) {
			// hanBinary - later config wins
			if (config.hanBinary !== undefined) {
				merged.hanBinary = config.hanBinary;
			}

			// Merge ports section
			if (config.ports) {
				merged.ports = {
					...merged.ports,
					...config.ports,
				};
			}

			// Merge hooks section
			if (config.hooks) {
				merged.hooks = {
					...merged.hooks,
					...config.hooks,
				};
			}

			// Merge memory section
			if (config.memory) {
				merged.memory = {
					...merged.memory,
					...config.memory,
				};
			}

			// Merge metrics section
			if (config.metrics) {
				merged.metrics = {
					...merged.metrics,
					...config.metrics,
				};
			}

			// Merge plugins section
			if (config.plugins) {
				merged.plugins = mergePluginSettings(merged.plugins, config.plugins);
			}
		}
	}

	return merged;
}

/**
 * Get plugin hook settings for a specific plugin and hook in a directory
 * Returns the merged hook override settings from all config scopes
 */
export function getPluginHookSettings(
	pluginName: string,
	hookName: string,
	directory?: string,
): HookOverride | undefined {
	const config = directory
		? getMergedHanConfigForDirectory(directory)
		: getMergedHanConfig();

	return config.plugins?.[pluginName]?.hooks?.[hookName];
}

/**
 * Check if hooks master switch is enabled (default: true)
 */
export function isHooksEnabled(): boolean {
	const config = getMergedHanConfig();
	return config.hooks?.enabled !== false;
}

/**
 * Check if checkpoints are enabled (default: true)
 * Note: If hooks are globally disabled, checkpoints are also disabled
 */
export function isCheckpointsEnabled(): boolean {
	const config = getMergedHanConfig();

	// If hooks are globally disabled, checkpoints are also disabled
	if (config.hooks?.enabled === false) {
		return false;
	}

	return config.hooks?.checkpoints !== false;
}

/**
 * Check if memory system is enabled (default: true)
 */
export function isMemoryEnabled(): boolean {
	const config = getMergedHanConfig();
	return config.memory?.enabled !== false;
}

/**
 * Check if metrics tracking is enabled (default: true)
 */
export function isMetricsEnabled(): boolean {
	const config = getMergedHanConfig();
	return config.metrics?.enabled !== false;
}

/**
 * Check if hook caching is enabled (default: true)
 * Note: If hooks are globally disabled, caching setting is irrelevant
 */
export function isCacheEnabled(): boolean {
	const config = getMergedHanConfig();

	// If hooks are globally disabled, cache setting doesn't matter
	if (config.hooks?.enabled === false) {
		return false;
	}

	return config.hooks?.cache !== false;
}

/**
 * Check if fail-fast mode is enabled (default: true)
 * When enabled, hooks stop on first failure.
 * Note: If hooks are globally disabled, fail_fast setting is irrelevant
 */
export function isFailFastEnabled(): boolean {
	const config = getMergedHanConfig();

	// If hooks are globally disabled, fail_fast setting doesn't matter
	if (config.hooks?.enabled === false) {
		return false;
	}

	return config.hooks?.fail_fast !== false;
}

/**
 * Check if transcript-based session filtering is enabled (default: true when checkpoints enabled)
 *
 * When enabled, stop hooks only run on files modified by THIS session,
 * preventing conflicts when multiple sessions work in the same tree.
 *
 * Note: If hooks or checkpoints are disabled, transcript filtering is also disabled.
 */
export function isTranscriptFilterEnabled(): boolean {
	const config = getMergedHanConfig();

	// If hooks are globally disabled, transcript filter doesn't apply
	if (config.hooks?.enabled === false) {
		return false;
	}

	// If checkpoints are disabled, transcript filter is also disabled
	// (they work together for session-scoped filtering)
	if (config.hooks?.checkpoints === false) {
		return false;
	}

	// Explicit setting takes precedence, otherwise default to true
	return config.hooks?.transcript_filter !== false;
}

/**
 * Get the han binary command to use.
 * Priority (highest to lowest):
 *   1. HAN_BINARY environment variable
 *   2. hanBinary in config files (han.yml)
 *   3. "han" (default, uses PATH)
 *
 * This allows development setups to use a local version of han.
 *
 * @example
 * // Via environment variable:
 * // HAN_BINARY="bun run /path/to/han/lib/main.ts" claude
 *
 * // Or in han.yml:
 * // hanBinary: "bun run /path/to/han/packages/han/lib/main.ts"
 *
 * const han = getHanBinary(); // "bun run /path/to/han/..."
 * execSync(`${han} hook dispatch SessionStart`);
 */
export function getHanBinary(): string {
	// Environment variable takes highest priority
	if (process.env.HAN_BINARY) {
		return process.env.HAN_BINARY;
	}

	const config = getMergedHanConfig();
	return config.hanBinary || "han";
}
