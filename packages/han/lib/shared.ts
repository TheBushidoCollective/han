import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { DETECT_PLUGINS_PROMPT } from "./build-info.generated.ts";
import {
	analyzeCodebase,
	type CodebaseStats,
	formatStatsForPrompt,
} from "./codebase-analyzer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HAN_MARKETPLACE_REPO = "thebushidocollective/han";

export type MarketplaceSource =
	| { source: "directory"; path: string }
	| { source: "git"; url: string }
	| { source: "github"; repo: string };
export type Marketplace = { source: MarketplaceSource };
export type Marketplaces = Record<string, Marketplace>;
export type Plugins = Record<string, boolean>;

export interface ClaudeSettings {
	extraKnownMarketplaces?: Marketplaces;
	enabledPlugins?: Plugins;
	[key: string]: unknown;
}

export interface AgentUpdate {
	type: "text" | "tool";
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
}

export interface DetectPluginsCallbacks {
	onUpdate: (update: AgentUpdate) => void;
	onComplete: (plugins: string[], fullText: string) => void;
	onError: (error: Error) => void;
}

export type InstallScope = "user" | "project" | "local";

export function getClaudeSettingsPath(scope: InstallScope = "user"): string {
	if (scope === "user") {
		return getGlobalClaudeSettingsPath();
	}
	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	return join(process.cwd(), ".claude", filename);
}

/**
 * Get path to global user Claude settings (~/.claude/settings.json)
 * Respects CLAUDE_CONFIG_DIR environment variable if set.
 */
export function getGlobalClaudeSettingsPath(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return join(process.env.CLAUDE_CONFIG_DIR, "settings.json");
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";
	return join(homeDir, ".claude", "settings.json");
}

/**
 * Read global Claude settings from ~/.claude/settings.json
 */
export function readGlobalSettings(): ClaudeSettings {
	const settingsPath = getGlobalClaudeSettingsPath();

	if (existsSync(settingsPath)) {
		try {
			return JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
		} catch (_error) {
			console.error("Error reading global settings.json, creating new one");
			return {};
		}
	}

	return {};
}

/**
 * Write global Claude settings to ~/.claude/settings.json
 */
export function writeGlobalSettings(settings: ClaudeSettings): void {
	const settingsPath = getGlobalClaudeSettingsPath();
	const claudeDir = join(settingsPath, "..");
	if (!existsSync(claudeDir)) {
		mkdirSync(claudeDir, { recursive: true });
	}
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Hook entry structure for Claude Code hooks
 */
export interface HookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

/**
 * Hook group structure
 */
export interface HookGroup {
	hooks: HookEntry[];
}

/**
 * Dispatch hook command template
 */
const DISPATCH_HOOK_COMMAND = "han hook dispatch";

/**
 * Ensure dispatch hooks are configured in global settings
 * This is a workaround for Claude Code bug #12151 where plugin hook output
 * is not passed to the agent.
 *
 * Also migrates old-style hooks that use `npx` to use `han` directly for faster execution.
 */
export function ensureDispatchHooks(): void {
	const settings = readGlobalSettings();

	// Initialize hooks if not present
	if (!settings.hooks) {
		settings.hooks = {};
	}

	const hooks = settings.hooks as Record<string, HookGroup[]>;
	let modified = false;

	// Check if dispatch hooks already exist for each hook type
	const hookTypes = ["UserPromptSubmit", "SessionStart"];

	for (const hookType of hookTypes) {
		const dispatchCommand = `${DISPATCH_HOOK_COMMAND} ${hookType}`;

		// Check if this hook type has any groups
		if (!hooks[hookType]) {
			hooks[hookType] = [];
		}

		// Migrate old-style npx hooks to direct han command
		for (const group of hooks[hookType]) {
			for (const hook of group.hooks || []) {
				if (
					hook.type === "command" &&
					hook.command?.includes("npx") &&
					hook.command?.includes("han hook dispatch")
				) {
					// Replace npx command with direct han command
					hook.command = dispatchCommand;
					modified = true;
				}
			}
		}

		// Check if dispatch hook already exists (after migration)
		const hasDispatchHook = hooks[hookType].some((group) =>
			group.hooks?.some(
				(hook) =>
					hook.type === "command" &&
					hook.command?.includes("han hook dispatch"),
			),
		);

		if (!hasDispatchHook) {
			// Add dispatch hook at the beginning
			hooks[hookType].unshift({
				hooks: [
					{
						type: "command",
						command: dispatchCommand,
						timeout: 30000,
					},
				],
			});
			modified = true;
		}
	}

	if (modified) {
		settings.hooks = hooks;
		writeGlobalSettings(settings);
		console.log("✓ Configured dispatch hooks in global settings");
	}
}

export function ensureClaudeDirectory(scope: InstallScope = "user"): void {
	const settingsPath = getClaudeSettingsPath(scope);
	const claudeDir = join(settingsPath, "..");
	if (!existsSync(claudeDir)) {
		mkdirSync(claudeDir, { recursive: true });
	}
}

export function readOrCreateSettings(
	scope: InstallScope = "user",
): ClaudeSettings {
	const settingsPath = getClaudeSettingsPath(scope);

	if (existsSync(settingsPath)) {
		try {
			return JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
		} catch (_error) {
			const filename = getSettingsFilename(scope);
			console.error(`Error reading ${filename}, creating new one`);
			return {};
		}
	}

	return {};
}

export function writeSettings(
	settings: ClaudeSettings,
	scope: InstallScope = "user",
): void {
	const settingsPath = getClaudeSettingsPath(scope);
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Get human-readable filename for a scope
 */
export function getSettingsFilename(scope: InstallScope): string {
	switch (scope) {
		case "user": {
			const configDir = process.env.CLAUDE_CONFIG_DIR || "~/.claude";
			return `${configDir}/settings.json`;
		}
		case "local":
			return ".claude/settings.local.json";
		case "project":
			return ".claude/settings.json";
	}
}

/**
 * Detect which scope(s) have Han marketplace configured
 * Returns array of scopes where Han is installed
 */
export function detectHanScopes(): InstallScope[] {
	const scopes: InstallScope[] = [];

	// Check user scope
	const userSettings = readOrCreateSettings("user");
	if (userSettings.extraKnownMarketplaces?.han) {
		scopes.push("user");
	}

	// Check project scope
	const projectSettings = readOrCreateSettings("project");
	if (projectSettings.extraKnownMarketplaces?.han) {
		scopes.push("project");
	}

	// Check local scope
	const localSettings = readOrCreateSettings("local");
	if (localSettings.extraKnownMarketplaces?.han) {
		scopes.push("local");
	}

	return scopes;
}

/**
 * Get currently installed Han plugins
 */
export function getInstalledPlugins(scope: InstallScope = "user"): string[] {
	const settings = readOrCreateSettings(scope);
	const enabledPlugins = settings.enabledPlugins || {};

	return Object.keys(enabledPlugins)
		.filter((key) => key.endsWith("@han") && enabledPlugins[key])
		.map((key) => key.replace("@han", ""));
}

/**
 * Remove plugins that are not in the marketplace
 * Returns the list of removed plugin names
 */
export function removeInvalidPlugins(
	validPluginNames: Set<string>,
	scope: InstallScope = "user",
): string[] {
	const settings = readOrCreateSettings(scope);
	const currentPlugins = getInstalledPlugins(scope);
	const removed: string[] = [];

	for (const plugin of currentPlugins) {
		if (!validPluginNames.has(plugin)) {
			removed.push(plugin);
			if (settings.enabledPlugins) {
				delete settings.enabledPlugins[`${plugin}@han`];
			}
		}
	}

	if (removed.length > 0) {
		writeSettings(settings, scope);
	}

	return removed;
}

/**
 * Get the base prompt - uses generated build-info in bundled mode, file read in development
 */
function getBasePrompt(): string {
	// In bundled mode, DETECT_PLUGINS_PROMPT is set by the build script
	if (DETECT_PLUGINS_PROMPT) {
		return DETECT_PLUGINS_PROMPT;
	}
	// Fallback for development mode (running via tsc)
	const promptPath = path.join(__dirname, "detect-plugins-prompt.md");
	return readFileSync(promptPath, "utf-8");
}

/**
 * Find the Claude CLI executable in PATH
 */
export function findClaudeExecutable(): string {
	try {
		const claudePath = execSync("which claude", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		if (claudePath) {
			return claudePath;
		}
	} catch {
		// Not found via which
	}

	// Fallback to common locations
	const commonPaths = [
		"/usr/local/bin/claude",
		"/opt/homebrew/bin/claude",
		join(process.env.HOME || "", ".local/bin/claude"),
	];

	for (const p of commonPaths) {
		if (existsSync(p)) {
			return p;
		}
	}

	throw new Error(
		"Claude CLI not found. Please install Claude Code: https://claude.ai/code",
	);
}

/**
 * Get the git remote origin URL for the current directory
 */
function getGitRemoteUrl(): string | null {
	try {
		const remoteUrl = execSync("git remote get-url origin", {
			cwd: process.cwd(),
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return remoteUrl || null;
	} catch {
		// Not a git repo or no remote configured
		return null;
	}
}

/**
 * Build prompt with marketplace data, codebase stats, and installed plugins injected
 */
function buildPromptWithMarketplace(
	plugins: MarketplacePlugin[],
	codebaseStats?: CodebaseStats,
	installedPlugins?: string[],
): string {
	const pluginList = plugins
		.map((p) => {
			const parts = [`- ${p.name}`];
			if (p.description) parts.push(`: ${p.description}`);
			if (p.keywords && p.keywords.length > 0) {
				parts.push(` [${p.keywords.join(", ")}]`);
			}
			return parts.join("");
		})
		.join("\n");

	// Start with base prompt from markdown
	let prompt = getBasePrompt();

	// Add git remote URL if available
	const gitRemoteUrl = getGitRemoteUrl();
	if (gitRemoteUrl) {
		prompt += `\n\n## GIT REPOSITORY\n\nRemote URL: ${gitRemoteUrl}`;
	}

	// Add currently installed plugins if available
	if (installedPlugins && installedPlugins.length > 0) {
		const installedList = installedPlugins
			.map((name) => {
				const plugin = plugins.find((p) => p.name === name);
				if (plugin) {
					const parts = [`- ${plugin.name}`];
					if (plugin.description) parts.push(`: ${plugin.description}`);
					return parts.join("");
				}
				return `- ${name}`;
			})
			.join("\n");
		prompt += `\n\n## CURRENTLY INSTALLED PLUGINS\n\n${installedList}\n\nThese plugins are currently installed. You should analyze why they were likely added and determine if they are still relevant for this codebase.`;
	}

	// Add codebase statistics if available
	if (codebaseStats && codebaseStats.totalFiles > 0) {
		prompt += `\n\n## CODEBASE STATISTICS (pre-computed)\n\n${formatStatsForPrompt(codebaseStats)}`;
	}

	// Add available plugins
	prompt += `\n\n## AVAILABLE PLUGINS IN MARKETPLACE\n\n${pluginList}`;

	prompt += `\n\nRemember: ONLY recommend plugins from the list above. Never recommend plugins that are not in this list.`;

	return prompt;
}

/**
 * Use Claude Agent SDK to intelligently analyze codebase and recommend plugins
 */
export async function detectPluginsWithAgent(
	callbacks: DetectPluginsCallbacks,
): Promise<void> {
	// Fetch marketplace first
	const marketplacePlugins = await fetchMarketplace();
	if (marketplacePlugins.length === 0) {
		callbacks.onError(
			new Error(
				"Could not fetch marketplace. Please check your internet connection.",
			),
		);
		return;
	}

	// Get currently installed plugins (from both project and local scopes)
	const projectPlugins = getInstalledPlugins("project");
	const localPlugins = getInstalledPlugins("local");
	const installedPlugins = Array.from(
		new Set([...projectPlugins, ...localPlugins]),
	);

	// Analyze codebase to get file statistics upfront
	let codebaseStats: CodebaseStats | undefined;
	try {
		callbacks.onUpdate({
			type: "text",
			content: "Analyzing codebase structure...",
		});
		codebaseStats = analyzeCodebase(process.cwd());
	} catch (_error) {
		console.warn(
			"Warning: Could not analyze codebase, proceeding without stats",
		);
	}

	// Build prompt with marketplace data, codebase stats, and installed plugins
	const prompt = buildPromptWithMarketplace(
		marketplacePlugins,
		codebaseStats,
		installedPlugins,
	);
	const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

	// Define allowed tools - only read-only operations (no web_fetch needed)
	const allowedTools: string[] = ["read_file", "glob", "grep"];

	let responseContent = "";

	try {
		const claudePath = findClaudeExecutable();
		const agent = query({
			prompt,
			options: {
				model: "haiku",
				includePartialMessages: true,
				allowedTools,
				pathToClaudeCodeExecutable: claudePath,
			},
		});

		// Collect all messages from the agent with live updates
		for await (const sdkMessage of agent) {
			if (sdkMessage.type === "assistant" && sdkMessage.message.content) {
				for (const block of sdkMessage.message.content) {
					if (block.type === "text") {
						// Send text updates
						callbacks.onUpdate({ type: "text", content: block.text });
						responseContent += block.text;
					} else if (block.type === "tool_use") {
						// Send tool usage updates with input details
						callbacks.onUpdate({
							type: "tool",
							content: `Using ${block.name}`,
							toolName: block.name,
							toolInput: block.input as Record<string, unknown>,
						});
					}
				}
			}
		}

		// Extract plugin recommendations from agent response
		const plugins = parsePluginRecommendations(responseContent);

		// Validate plugins against marketplace
		const validated: string[] = [];
		const invalid: string[] = [];

		for (const plugin of plugins) {
			if (validPluginNames.has(plugin)) {
				validated.push(plugin);
			} else {
				invalid.push(plugin);
			}
		}

		// Log warning if any invalid plugins were found
		if (invalid.length > 0) {
			console.warn(
				`Warning: Filtered out ${invalid.length} invalid plugin(s): ${invalid.join(", ")}`,
			);
		}

		const finalPlugins = validated.length > 0 ? validated : ["bushido"];

		callbacks.onComplete(finalPlugins, responseContent);
	} catch (error) {
		callbacks.onError(error as Error);
	}
}

export interface MarketplacePlugin {
	name: string;
	description?: string;
	keywords?: string[];
	category?: string;
}

/**
 * Fetch the marketplace to get list of available plugins
 * Uses cached data if available and fresh (< 24 hours old)
 * @param forceRefresh - If true, bypass cache and fetch from GitHub
 */
export async function fetchMarketplace(
	forceRefresh = false,
): Promise<MarketplacePlugin[]> {
	// Import statically at module level would create circular dependency
	// This is the one exception where we need dynamic import
	const { getMarketplacePlugins } = await import("./marketplace-cache.ts");

	try {
		const { plugins, fromCache } = await getMarketplacePlugins(forceRefresh);

		// Show cache status in verbose mode
		if (process.env.HAN_VERBOSE && fromCache) {
			console.log("Using cached marketplace data");
		}

		return plugins;
	} catch (_error) {
		console.warn("Warning: Could not fetch marketplace.json");
		return [];
	}
}

/**
 * Extract plugin name from plugin root path, handling versioned cache paths.
 *
 * Examples:
 * - /path/to/jutsu-elixir -> jutsu-elixir
 * - /path/to/jutsu-elixir/1.1.1 -> jutsu-elixir (versioned cache path)
 * - /path/to/plugins/marketplaces/han/jutsu/jutsu-typescript -> jutsu-typescript
 * - /path/to/plugins/marketplaces/han/core -> core
 */
export function getPluginNameFromRoot(pluginRoot: string): string {
	const parts = pluginRoot.split("/").filter(Boolean);
	const lastPart = parts[parts.length - 1] || "";

	// If last part looks like a version (semver pattern), use parent directory
	if (/^\d+\.\d+\.\d+/.test(lastPart) && parts.length >= 2) {
		return parts[parts.length - 2];
	}

	return lastPart;
}

/**
 * Parse plugin recommendations from agent response
 */
export function parsePluginRecommendations(content: string): string[] {
	// Try to find JSON array in the response
	const jsonMatch = content.match(/\[[\s\S]*?\]/);
	if (jsonMatch) {
		try {
			const plugins = JSON.parse(jsonMatch[0]) as unknown;
			if (Array.isArray(plugins)) {
				const stringPlugins = plugins.filter(
					(p): p is string => typeof p === "string",
				);
				// Always include bushido and deduplicate
				const uniquePlugins = new Set([...stringPlugins, "bushido"]);
				return Array.from(uniquePlugins);
			}
		} catch {
			// JSON parsing failed, fall through to regex matching
		}
	}

	// Fallback: look for plugin names mentioned
	const pluginPattern = /(jutsu-[\w-]+|do-[\w-]+|hashi-[\w-]+|bushido)/g;
	const matches = content.match(pluginPattern);
	if (matches) {
		// Ensure bushido is included and deduplicate
		const uniquePlugins = new Set([...matches, "bushido"]);
		return Array.from(uniquePlugins);
	}

	// Always return at least bushido
	return ["bushido"];
}
