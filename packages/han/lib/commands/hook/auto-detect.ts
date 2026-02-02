/**
 * Auto-detect and install Han plugins based on file changes.
 *
 * This hook runs on PostToolUse for Edit/Write tools and checks if the
 * modified file's directory tree matches any uninstalled Han plugin's
 * dirs_with patterns. If a match is found, the plugin is automatically
 * installed to the project scope.
 *
 * This is a FAST, deterministic check - no AI involved.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { getClaudeConfigDir } from "../../config/claude-settings.ts";
import {
	loadPluginDetection,
	type PluginWithDetection,
} from "../../marker-detection.ts";
import { getMarketplacePlugins } from "../../marketplace-cache.ts";
import { getInstalledPlugins, isDebugMode } from "../../shared.ts";

/**
 * ANSI color codes for CLI output
 */
const colors = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	magenta: "\x1b[35m",
};

/**
 * Hook payload structure from Claude Code stdin
 */
interface PostToolUsePayload {
	session_id?: string;
	tool_name?: string;
	tool_input?: {
		file_path?: string;
		path?: string;
		content?: string;
		old_string?: string;
		new_string?: string;
	};
}

/**
 * File-modifying tools that trigger auto-detection
 */
const FILE_MODIFYING_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

/**
 * Check if a pattern exists in a directory
 */
function patternExistsInDir(dir: string, pattern: string): boolean {
	// Handle exact file/directory match
	const fullPath = join(dir, pattern);
	return existsSync(fullPath);
}

/**
 * Track which plugins we've already suggested this session to avoid spam
 */
const suggestedPluginsThisSession = new Set<string>();

/**
 * Get the path to the session-specific suggested plugins file
 */
function getSuggestedPluginsPath(sessionId: string): string {
	const configDir = getClaudeConfigDir() || join(process.env.HOME || "", ".claude");
	return join(configDir, "han", "suggested-plugins", `${sessionId}.json`);
}

/**
 * Load suggested plugins for a session from disk
 */
function loadSuggestedPlugins(sessionId: string): Set<string> {
	try {
		const filePath = getSuggestedPluginsPath(sessionId);
		if (existsSync(filePath)) {
			const data = JSON.parse(readFileSync(filePath, "utf-8"));
			return new Set(data.plugins || []);
		}
	} catch {
		// Ignore errors
	}
	return new Set();
}

/**
 * Save suggested plugins for a session to disk
 */
function saveSuggestedPlugins(sessionId: string, plugins: Set<string>): void {
	try {
		const filePath = getSuggestedPluginsPath(sessionId);
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(filePath, JSON.stringify({ plugins: Array.from(plugins) }));
	} catch {
		// Ignore errors
	}
}

/**
 * Check if a plugin matches a directory based on its dirs_with patterns
 */
function pluginMatchesDirectory(
	plugin: PluginWithDetection,
	directory: string,
): boolean {
	const detection = plugin.detection;
	if (!detection?.dirsWith || detection.dirsWith.length === 0) {
		return false;
	}

	// Check if any dirs_with pattern exists in this directory
	for (const pattern of detection.dirsWith) {
		if (patternExistsInDir(directory, pattern)) {
			return true;
		}
	}

	return false;
}

/**
 * Walk up the directory tree from a file path and find matching plugins
 */
function findMatchingPlugins(
	filePath: string,
	plugins: PluginWithDetection[],
	installedPlugins: Set<string>,
): Array<{ plugin: PluginWithDetection; matchedDir: string }> {
	const matches: Array<{ plugin: PluginWithDetection; matchedDir: string }> = [];

	// Start from the file's directory
	let currentDir = dirname(filePath);
	const projectRoot = process.cwd();

	// Walk up the directory tree until we reach the project root or filesystem root
	while (currentDir.length >= projectRoot.length && currentDir !== "/") {
		for (const plugin of plugins) {
			// Skip already installed plugins
			if (installedPlugins.has(plugin.name)) {
				continue;
			}

			// Skip plugins without detection criteria
			if (!plugin.detection?.dirsWith) {
				continue;
			}

			// Check if this plugin matches the current directory
			if (pluginMatchesDirectory(plugin, currentDir)) {
				// Check if we haven't already matched this plugin
				if (!matches.some((m) => m.plugin.name === plugin.name)) {
					matches.push({ plugin, matchedDir: currentDir });
				}
			}
		}

		// Move up one directory
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			break; // Reached filesystem root
		}
		currentDir = parentDir;
	}

	return matches;
}

/**
 * Install a plugin using Claude CLI to project scope.
 * This ensures the plugin is properly cloned from the marketplace.
 */
function installPlugin(pluginName: string): boolean {
	try {
		// Use claude plugin install with project scope
		// This properly clones the marketplace and enables the plugin
		execSync(`claude plugin install ${pluginName}@han --scope project`, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 60000, // 60 second timeout for cloning
		});

		return true;
	} catch (error) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} Failed to install plugin ${pluginName}: ${error}`,
			);
		}
		return false;
	}
}

/**
 * Read stdin payload from Claude Code
 */
function readStdinPayload(): PostToolUsePayload | null {
	try {
		if (process.stdin.isTTY) {
			return null;
		}
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as PostToolUsePayload;
		}
	} catch {
		// stdin not available or empty
	}
	return null;
}

/**
 * Main auto-detect function
 */
export async function autoDetect(): Promise<void> {
	// Read payload from stdin
	const payload = readStdinPayload();

	if (!payload) {
		if (isDebugMode()) {
			console.error(`${colors.dim}[auto-detect]${colors.reset} No stdin payload`);
		}
		return;
	}

	// Check if this is a file-modifying tool
	const toolName = payload.tool_name;
	if (!toolName || !FILE_MODIFYING_TOOLS.has(toolName)) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} Tool ${toolName} is not a file-modifying tool`,
			);
		}
		return;
	}

	// Get the file path from tool input
	const filePath = payload.tool_input?.file_path || payload.tool_input?.path;
	if (!filePath) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} No file_path in tool_input`,
			);
		}
		return;
	}

	const sessionId = payload.session_id || "unknown";

	// Load previously suggested plugins for this session
	const previouslySuggested = loadSuggestedPlugins(sessionId);
	for (const plugin of previouslySuggested) {
		suggestedPluginsThisSession.add(plugin);
	}

	if (isDebugMode()) {
		console.error(
			`${colors.dim}[auto-detect]${colors.reset} Checking file: ${colors.cyan}${filePath}${colors.reset}`,
		);
	}

	// Get marketplace plugins with detection criteria
	let marketplacePlugins;
	try {
		const result = await getMarketplacePlugins(false);
		marketplacePlugins = result.plugins;
	} catch (error) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} Failed to get marketplace: ${error}`,
			);
		}
		return;
	}

	// Load detection criteria from cached han-plugin.yml files
	const pluginsWithDetection = loadPluginDetection(marketplacePlugins);

	// Get currently installed plugins (from all scopes)
	const userPlugins = getInstalledPlugins("user");
	const projectPlugins = getInstalledPlugins("project");
	const localPlugins = getInstalledPlugins("local");
	const installedPlugins = new Set([
		...userPlugins,
		...projectPlugins,
		...localPlugins,
	]);

	// Find plugins that match the modified file's directory tree
	const matches = findMatchingPlugins(
		filePath,
		pluginsWithDetection,
		installedPlugins,
	);

	if (matches.length === 0) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} No matching plugins found`,
			);
		}
		return;
	}

	// Filter out plugins we've already suggested this session
	const newMatches = matches.filter(
		(m) => !suggestedPluginsThisSession.has(m.plugin.name),
	);

	if (newMatches.length === 0) {
		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} All matching plugins already suggested this session`,
			);
		}
		return;
	}

	// Auto-install the matched plugins
	const installed: string[] = [];
	for (const { plugin, matchedDir } of newMatches) {
		// Mark as suggested regardless of install success
		suggestedPluginsThisSession.add(plugin.name);

		if (isDebugMode()) {
			console.error(
				`${colors.dim}[auto-detect]${colors.reset} Match: ${colors.magenta}${plugin.name}${colors.reset} (${plugin.detection?.dirsWith?.join(", ")}) in ${matchedDir}`,
			);
		}

		if (installPlugin(plugin.name)) {
			installed.push(plugin.name);
		}
	}

	// Save suggested plugins for this session
	saveSuggestedPlugins(sessionId, suggestedPluginsThisSession);

	// Output message for the agent
	if (installed.length > 0) {
		console.log(
			`\n${colors.green}✓ Auto-installed Han plugin(s):${colors.reset} ${installed.join(", ")}`,
		);
		console.log(
			`${colors.dim}These plugins were detected based on files in your project.${colors.reset}`,
		);
		console.log(
			`${colors.yellow}Note: Restart Claude Code to load the new plugins, or continue - they'll be active next session.${colors.reset}\n`,
		);
	}
}

/**
 * Register the auto-detect command
 */
export function registerHookAutoDetect(hookCommand: Command): void {
	hookCommand
		.command("auto-detect")
		.description(
			"Auto-detect and install Han plugins based on file changes.\n\n" +
				"This hook runs on PostToolUse for Edit/Write tools and checks if the\n" +
				"modified file's directory tree matches any uninstalled Han plugin's\n" +
				"dirs_with patterns. If a match is found, the plugin is automatically\n" +
				"installed to the project scope.",
		)
		.action(async () => {
			await autoDetect();
		});
}
