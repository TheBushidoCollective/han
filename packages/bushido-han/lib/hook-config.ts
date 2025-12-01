import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { globbyStream } from "globby";
import YAML from "yaml";

// Try to load native module for better performance
// Falls back to JavaScript implementation if not available
let nativeModule: typeof import("../../han-native") | null = null;

/**
 * Try to load the native module from various locations:
 * 1. Same directory as the executable (for platform packages)
 * 2. Relative path from source (for development)
 */
function tryLoadNativeModule(): typeof import("../../han-native") | null {
	const possiblePaths = [
		// For compiled binary: .node file next to executable
		join(dirname(process.execPath), "han-native.node"),
		// For development: relative path from lib
		join(dirname(new URL(import.meta.url).pathname), "../../han-native"),
	];

	for (const modulePath of possiblePaths) {
		try {
			if (modulePath.endsWith(".node")) {
				// Direct .node file loading
				if (existsSync(modulePath)) {
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					return require(modulePath) as typeof import("../../han-native");
				}
			} else {
				// Package directory loading
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				return require(modulePath) as typeof import("../../han-native");
			}
		} catch {
			// Continue to next path
		}
	}
	return null;
}

nativeModule = tryLoadNativeModule();

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
 * Stream directories containing marker files (respects nested .gitignore files)
 * Yields directories one at a time for early exit on fail-fast
 * Uses native module for better performance when available
 */
async function* streamDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): AsyncGenerator<string> {
	// Use native module if available (much faster, synchronous but yields for compatibility)
	if (nativeModule) {
		const directories = nativeModule.findDirectoriesWithMarkers(
			rootDir,
			markerPatterns,
		);
		for (const dir of directories) {
			yield dir;
		}
		return;
	}

	// JavaScript fallback
	const globPatterns = markerPatterns.map((pattern) => `**/${pattern}`);
	const seenDirs = new Set<string>();

	for await (const match of globbyStream(globPatterns, {
		cwd: rootDir,
		gitignore: true,
		ignore: [".git/**"],
		absolute: true,
		onlyFiles: true,
	})) {
		const dir = dirname(match.toString());
		if (!seenDirs.has(dir)) {
			seenDirs.add(dir);
			yield dir;
		}
	}
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
 * Stream hook configurations for target directories
 * Yields configs one at a time for early exit on fail-fast
 */
export async function* streamHookConfigs(
	pluginRoot: string,
	hookName: string,
	projectRoot: string,
): AsyncGenerator<ResolvedHookConfig> {
	const pluginConfig = loadPluginConfig(pluginRoot);

	if (!pluginConfig) {
		return;
	}

	const hookDef = pluginConfig.hooks[hookName];

	if (!hookDef) {
		return;
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
		yield resolveConfigForDir(projectRoot);
		return;
	}

	// Stream directories and yield configs as they're found
	for await (const dir of streamDirectoriesWithMarker(
		projectRoot,
		hookDef.dirsWith,
	)) {
		// Filter with dirTest if specified
		if (hookDef.dirTest && !testDirCommand(dir, hookDef.dirTest)) {
			continue;
		}

		yield resolveConfigForDir(dir);
	}
}

/**
 * Resolve hook configurations for all target directories
 * @deprecated Use streamHookConfigs for better performance with fail-fast
 */
export async function resolveHookConfigs(
	pluginRoot: string,
	hookName: string,
	projectRoot: string,
): Promise<ResolvedHookConfig[]> {
	const configs: ResolvedHookConfig[] = [];
	for await (const config of streamHookConfigs(
		pluginRoot,
		hookName,
		projectRoot,
	)) {
		configs.push(config);
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
