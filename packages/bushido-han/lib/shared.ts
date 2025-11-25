import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
	analyzeCodebase,
	type CodebaseStats,
	formatStatsForPrompt,
} from "./codebase-analyzer.js";

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

export function getClaudeSettingsPath(
	scope: "project" | "local" = "project",
): string {
	const filename = scope === "local" ? "settings.local.json" : "settings.json";
	return join(process.cwd(), ".claude", filename);
}

export function ensureClaudeDirectory(): void {
	const settingsPath = getClaudeSettingsPath();
	const claudeDir = join(settingsPath, "..");
	if (!existsSync(claudeDir)) {
		mkdirSync(claudeDir, { recursive: true });
	}
}

export function readOrCreateSettings(
	scope: "project" | "local" = "project",
): ClaudeSettings {
	const settingsPath = getClaudeSettingsPath(scope);

	if (existsSync(settingsPath)) {
		try {
			return JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
		} catch (_error) {
			console.error(
				`Error reading ${scope === "local" ? "settings.local.json" : "settings.json"}, creating new one`,
			);
			return {};
		}
	}

	return {};
}

export function writeSettings(
	settings: ClaudeSettings,
	scope: "project" | "local" = "project",
): void {
	const settingsPath = getClaudeSettingsPath(scope);
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Detect which scope(s) have Han marketplace configured
 * Returns array of scopes where Han is installed
 */
export function detectHanScopes(): Array<"project" | "local"> {
	const scopes: Array<"project" | "local"> = [];

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
export function getInstalledPlugins(
	scope: "project" | "local" = "project",
): string[] {
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
	scope: "project" | "local" = "project",
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
 * Read the base prompt from markdown file
 */
function getBasePrompt(): string {
	const promptPath = path.join(__dirname, "detect-plugins-prompt.md");
	return readFileSync(promptPath, "utf-8");
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
 * Build prompt with marketplace data and codebase stats injected
 */
function buildPromptWithMarketplace(
	plugins: MarketplacePlugin[],
	codebaseStats?: CodebaseStats,
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

	// Add codebase statistics if available
	if (codebaseStats && codebaseStats.totalFiles > 0) {
		prompt += `\n\n## CODEBASE STATISTICS (pre-computed)\n\n${formatStatsForPrompt(codebaseStats)}`;
	}

	// Add available plugins
	prompt += `\n## AVAILABLE PLUGINS IN MARKETPLACE\n\n${pluginList}`;

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

	// Build prompt with marketplace data and codebase stats
	const prompt = buildPromptWithMarketplace(marketplacePlugins, codebaseStats);
	const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

	// Define allowed tools - only read-only operations (no web_fetch needed)
	const allowedTools: string[] = ["read_file", "glob", "grep"];

	let responseContent = "";

	try {
		const agent = query({
			prompt,
			options: {
				model: "haiku",
				includePartialMessages: true,
				allowedTools,
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
 */
export async function fetchMarketplace(): Promise<MarketplacePlugin[]> {
	try {
		const response = await fetch(
			"https://raw.githubusercontent.com/TheBushidoCollective/han/refs/heads/main/.claude-plugin/marketplace.json",
		);
		if (!response.ok) {
			console.warn("Warning: Could not fetch marketplace.json");
			return [];
		}
		const marketplace = (await response.json()) as {
			plugins: MarketplacePlugin[];
		};
		return marketplace.plugins;
	} catch (_error) {
		console.warn("Warning: Could not fetch marketplace.json");
		return [];
	}
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
	const pluginPattern = /(buki-[\w-]+|do-[\w-]+|sensei-[\w-]+|bushido)/g;
	const matches = content.match(pluginPattern);
	if (matches) {
		// Ensure bushido is included and deduplicate
		const uniquePlugins = new Set([...matches, "bushido"]);
		return Array.from(uniquePlugins);
	}

	// Always return at least bushido
	return ["bushido"];
}
