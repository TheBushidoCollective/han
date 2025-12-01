import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import YAML from "yaml";

const require = createRequire(import.meta.url);

/**
 * Load the native module from various locations:
 * 1. Same directory as the executable (for platform packages)
 * 2. Relative path from source (for development)
 * @throws Error if native module cannot be loaded
 */
function loadNativeModule(): typeof import("../../han-native") {
	const currentDir = dirname(new URL(import.meta.url).pathname);
	// Determine if we're in dist/lib or lib
	const isInDist = currentDir.includes("/dist/");
	const relativeToHanNative = isInDist ? "../../../han-native" : "../../han-native";

	const possiblePaths = [
		// For compiled binary: .node file next to executable
		join(dirname(process.execPath), "han-native.node"),
		// For development: relative path to han-native package
		join(currentDir, relativeToHanNative),
	];

	const errors: string[] = [];

	for (const modulePath of possiblePaths) {
		try {
			if (modulePath.endsWith(".node")) {
				// Direct .node file loading
				if (existsSync(modulePath)) {
					return require(modulePath) as typeof import("../../han-native");
				}
			} else {
				// Package directory loading
				return require(modulePath) as typeof import("../../han-native");
			}
		} catch (e) {
			errors.push(`${modulePath}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	throw new Error(
		`Failed to load han-native module. Tried:\n${errors.join("\n")}\n\n` +
			"This is a required dependency. Please ensure han is installed correctly.",
	);
}

const nativeModule = loadNativeModule();

/**
 * Plugin hook configuration (from han-config.json)
 */
export interface PluginHookDefinition {
	dirsWith?: string[];
	dirTest?: string;
	command: string;
	/**
	 * Glob patterns relative to each target directory.
	 * When --cache is enabled, the hook will only run if files matching
	 * these patterns have changed since the last successful execution.
	 */
	ifChanged?: string[];
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
}

/**
 * Load plugin config from han-config.json in the plugin root directory
 * @param pluginRoot - The plugin directory, typically from CLAUDE_PLUGIN_ROOT env var
 */
export function loadPluginConfig(pluginRoot: string): PluginConfig | null {
	const configPath = join(pluginRoot, "han-config.json");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		return JSON.parse(content) as PluginConfig;
	} catch (error) {
		console.error(`Error loading plugin config from ${configPath}:`, error);
		return null;
	}
}

/**
 * Load user override config from han-config.yml in a directory
 */
export function loadUserConfig(directory: string): UserConfig | null {
	const configPath = join(directory, "han-config.yml");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		return YAML.parse(content) as UserConfig;
	} catch (error) {
		console.error(`Error loading user config from ${configPath}:`, error);
		return null;
	}
}

/**
 * Extract plugin name from CLAUDE_PLUGIN_ROOT path
 * e.g., /path/to/buki-elixir -> buki-elixir
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
	return nativeModule.findDirectoriesWithMarkers(rootDir, markerPatterns);
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

		return {
			enabled: userOverride?.enabled !== false,
			command: userOverride?.command || hookDef.command,
			directory: dir,
			ifChanged: mergeIfChangedPatterns(
				hookDef.ifChanged,
				userOverride?.if_changed,
			),
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
