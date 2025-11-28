import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { globby } from "globby";
import YAML from "yaml";

/**
 * Plugin hook configuration (from han-config.json)
 */
export interface PluginHookDefinition {
	dirsWith?: string[];
	dirTest?: string;
	command: string;
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
 * Find directories containing marker files using globby (respects nested .gitignore files)
 */
async function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): Promise<string[]> {
	const globPatterns = markerPatterns.map((pattern) => `**/${pattern}`);

	const matches = await globby(globPatterns, {
		cwd: rootDir,
		gitignore: true,
		ignore: [".git/**"],
		absolute: true,
		onlyFiles: true,
	});

	const dirs = [...new Set(matches.map((file) => dirname(file)))];
	return dirs;
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
 * Resolve hook configurations for all target directories
 */
export async function resolveHookConfigs(
	pluginRoot: string,
	hookName: string,
	projectRoot: string,
): Promise<ResolvedHookConfig[]> {
	const pluginConfig = loadPluginConfig(pluginRoot);

	if (!pluginConfig) {
		return [];
	}

	const hookDef = pluginConfig.hooks[hookName];

	if (!hookDef) {
		return [];
	}

	const pluginName = getPluginNameFromRoot(pluginRoot);

	// Find target directories
	let targetDirs: string[];

	if (!hookDef.dirsWith || hookDef.dirsWith.length === 0) {
		// No dirsWith specified - run in project root only
		targetDirs = [projectRoot];
	} else {
		// Find all directories matching the dirsWith patterns
		targetDirs = await findDirectoriesWithMarker(projectRoot, hookDef.dirsWith);
	}

	// Filter directories using dirTest command if specified
	if (hookDef.dirTest && targetDirs.length > 0) {
		targetDirs = targetDirs.filter((dir) =>
			testDirCommand(dir, hookDef.dirTest as string),
		);
	}

	const configs: ResolvedHookConfig[] = [];

	for (const dir of targetDirs) {
		// Load user overrides for this directory
		const userConfig = loadUserConfig(dir);
		const userOverride = userConfig?.[pluginName]?.[hookName];

		// Resolve enabled status (default: true)
		const enabled = userOverride?.enabled !== false;

		// Resolve command (user override or plugin default)
		const command = userOverride?.command || hookDef.command;

		configs.push({
			enabled,
			command,
			directory: dir,
		});
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
