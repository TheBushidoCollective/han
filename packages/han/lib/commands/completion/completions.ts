/**
 * Dynamic completion data fetchers for shell completion.
 * Provides plugin names, hook names, and static option values.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { listAvailableHooks, loadPluginConfig } from "../../hook-config.ts";
import { getMarketplacePlugins } from "../../marketplace-cache.ts";
import { getInstalledPlugins } from "../../shared.ts";

export interface CompletionItem {
	value: string;
	description?: string;
}

/**
 * Get all available plugins from the marketplace
 */
export async function getPluginCompletions(): Promise<CompletionItem[]> {
	const { plugins } = await getMarketplacePlugins();
	return plugins.map((p) => ({
		value: p.name,
		description: p.description,
	}));
}

/**
 * Get installed plugins across all scopes
 */
export function getInstalledPluginCompletions(): CompletionItem[] {
	const scopes: Array<"user" | "project" | "local"> = [
		"user",
		"project",
		"local",
	];
	const seen = new Set<string>();
	const completions: CompletionItem[] = [];

	for (const scope of scopes) {
		const plugins = getInstalledPlugins(scope);
		for (const plugin of plugins) {
			if (!seen.has(plugin)) {
				seen.add(plugin);
				completions.push({ value: plugin });
			}
		}
	}

	return completions;
}

/**
 * Find plugin root directory from plugin name
 */
function findPluginRoot(pluginName: string): string | null {
	const homeDir = process.env.HOME || "";
	const configDir = process.env.CLAUDE_CONFIG_DIR || join(homeDir, ".claude");
	const marketplaceDir = join(configDir, "plugins", "marketplaces", "han");

	// Check common plugin directories
	const prefixes = ["jutsu", "do", "hashi", "core"];
	for (const prefix of prefixes) {
		const pluginPath = join(marketplaceDir, prefix, pluginName);
		if (existsSync(join(pluginPath, "han-plugin.yml"))) {
			return pluginPath;
		}
	}

	// Also check if we're in the han repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		for (const prefix of prefixes) {
			const pluginPath = join(cwd, prefix, pluginName);
			if (existsSync(join(pluginPath, "han-plugin.yml"))) {
				return pluginPath;
			}
		}
	}

	return null;
}

/**
 * Get hooks for a specific plugin
 */
export function getHookCompletions(pluginName: string): CompletionItem[] {
	const pluginRoot = findPluginRoot(pluginName);
	if (!pluginRoot) {
		return [];
	}

	const config = loadPluginConfig(pluginRoot, false);
	if (!config) {
		return [];
	}

	return Object.entries(config.hooks).map(([name, def]) => ({
		value: name,
		description: def.description,
	}));
}

/**
 * Get installed plugins that have hooks defined
 */
export function getPluginsWithHooks(): CompletionItem[] {
	const installed = getInstalledPluginCompletions();
	return installed.filter((plugin) => {
		const pluginRoot = findPluginRoot(plugin.value);
		if (!pluginRoot) return false;
		const hooks = listAvailableHooks(pluginRoot);
		return hooks.length > 0;
	});
}

// Static option completions
export const SCOPE_COMPLETIONS: CompletionItem[] = [
	{ value: "user", description: "User-level settings (~/.claude)" },
	{ value: "project", description: "Project settings (.claude)" },
	{ value: "local", description: "Local settings (.claude/local)" },
];

export const SCOPE_WITH_ALL_COMPLETIONS: CompletionItem[] = [
	...SCOPE_COMPLETIONS,
	{ value: "all", description: "All scopes" },
];

export const PERIOD_COMPLETIONS: CompletionItem[] = [
	{ value: "day", description: "Last 24 hours" },
	{ value: "week", description: "Last 7 days" },
	{ value: "month", description: "Last 30 days" },
];

export const TASK_TYPE_COMPLETIONS: CompletionItem[] = [
	{ value: "implementation", description: "New feature implementation" },
	{ value: "fix", description: "Bug fix" },
	{ value: "refactor", description: "Code refactoring" },
	{ value: "research", description: "Research task" },
];

export const LAYER_COMPLETIONS: CompletionItem[] = [
	{ value: "observations", description: "Session observations" },
	{ value: "summaries", description: "Session summaries" },
	{ value: "transcripts", description: "Full transcripts" },
	{ value: "team", description: "Team knowledge" },
];

export const SEVERITY_COMPLETIONS: CompletionItem[] = [
	{ value: "low", description: "Low severity" },
	{ value: "medium", description: "Medium severity" },
	{ value: "high", description: "High severity" },
];

export const SHELL_COMPLETIONS: CompletionItem[] = [
	{ value: "bash", description: "Bash shell" },
	{ value: "zsh", description: "Zsh shell" },
	{ value: "fish", description: "Fish shell" },
];

export const CHECKPOINT_TYPE_COMPLETIONS: CompletionItem[] = [
	{ value: "session", description: "Session checkpoint" },
	{ value: "agent", description: "Agent checkpoint" },
];

// Command structure for completion
export const COMMANDS: Record<string, string[]> = {
	"": [
		"plugin",
		"hook",
		"memory",
		"metrics",
		"checkpoint",
		"index",
		"mcp",
		"explain",
		"summary",
		"gaps",
		"completion",
	],
	plugin: ["install", "list", "uninstall", "search", "update"],
	hook: ["run", "dispatch", "explain", "test", "verify", "reference"],
	metrics: [
		"show",
		"session-start",
		"session-end",
		"session-current",
		"hook-exec",
		"session-context",
		"memory-context",
		"detect-patterns",
	],
	checkpoint: ["capture", "list", "clean"],
	index: ["run", "search", "status"],
	mcp: ["blueprints"],
};

/**
 * Get completions for the current command context
 */
export async function getCompletionsForContext(
	words: string[],
): Promise<CompletionItem[]> {
	// Remove "han" if it's the first word
	if (words[0] === "han") {
		words = words.slice(1);
	}

	const len = words.length;

	// No words yet - show top-level commands
	if (len === 0) {
		return COMMANDS[""].map((cmd) => ({ value: cmd }));
	}

	const firstWord = words[0];
	const secondWord = words[1];
	const thirdWord = words[2];

	// Check for option completions first
	const lastWord = words[len - 1];
	const prevWord = words[len - 2];

	// Handle option value completions
	if (prevWord === "--scope") {
		if (firstWord === "plugin" && secondWord === "list") {
			return SCOPE_WITH_ALL_COMPLETIONS;
		}
		return SCOPE_COMPLETIONS;
	}
	if (prevWord === "--period") {
		return PERIOD_COMPLETIONS;
	}
	if (prevWord === "--type") {
		if (firstWord === "checkpoint" && secondWord === "capture") {
			return CHECKPOINT_TYPE_COMPLETIONS;
		}
		return TASK_TYPE_COMPLETIONS;
	}
	if (prevWord === "--layer") {
		return LAYER_COMPLETIONS;
	}
	if (prevWord === "--min-severity") {
		return SEVERITY_COMPLETIONS;
	}

	// Top-level command completion
	if (len === 1 && !lastWord.startsWith("-")) {
		const topLevel = COMMANDS[""];
		return topLevel
			.filter((cmd) => cmd.startsWith(lastWord))
			.map((cmd) => ({ value: cmd }));
	}

	// Subcommand completion
	if (len === 2 && !lastWord.startsWith("-")) {
		const subcommands = COMMANDS[firstWord];
		if (subcommands) {
			return subcommands
				.filter((cmd) => cmd.startsWith(lastWord))
				.map((cmd) => ({ value: cmd }));
		}
	}

	// Special cases for dynamic completions
	if (firstWord === "plugin") {
		if (secondWord === "install" && len >= 3) {
			// Plugin names for installation
			const plugins = await getPluginCompletions();
			return plugins.filter((p) => p.value.startsWith(lastWord));
		}
	}

	if (firstWord === "hook" && secondWord === "run") {
		if (len === 3) {
			// Plugin names for hook run
			return getPluginsWithHooks().filter((p) => p.value.startsWith(lastWord));
		}
		if (len === 4 && thirdWord) {
			// Hook names for the selected plugin
			return getHookCompletions(thirdWord).filter((h) =>
				h.value.startsWith(lastWord),
			);
		}
	}

	if (firstWord === "completion" && len === 2) {
		return SHELL_COMPLETIONS.filter((s) => s.value.startsWith(lastWord));
	}

	return [];
}
