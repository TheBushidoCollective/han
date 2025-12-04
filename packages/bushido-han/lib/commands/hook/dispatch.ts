import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	getSettingsPaths,
	type MarketplaceConfig,
	readSettingsFile,
} from "../../claude-settings.js";

/**
 * Read and parse stdin JSON payload from Claude Code hooks
 */
function readStdinPayload(): Record<string, unknown> | null {
	try {
		// Read stdin synchronously (file descriptor 0)
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin);
		}
	} catch {
		// stdin not available or not valid JSON - this is fine
	}
	return null;
}

// Cache the stdin payload so it's only read once
let cachedStdinPayload: Record<string, unknown> | null | undefined;
function getStdinPayload(): Record<string, unknown> | null {
	if (cachedStdinPayload === undefined) {
		cachedStdinPayload = readStdinPayload();
	}
	return cachedStdinPayload;
}

/**
 * Hook definition from hooks.json
 */
interface HookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

interface HookGroup {
	hooks: HookEntry[];
}

interface PluginHooks {
	hooks: Record<string, HookGroup[]>;
}

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	const potentialPaths = [
		join(marketplaceRoot, "jutsu", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "hashi", pluginName),
		join(marketplaceRoot, pluginName),
	];

	for (const path of potentialPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
function resolveToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	// If marketplace config specifies a directory source, use that path
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolveToAbsolute(directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) {
				return found;
			}
		}
	}

	// Check if we're in the marketplace repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

	// Fall back to the default shared config path
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		return null;
	}

	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);

	if (!existsSync(marketplaceRoot)) {
		return null;
	}

	return findPluginInMarketplace(marketplaceRoot, pluginName);
}

/**
 * Load a plugin's hooks.json
 */
function loadPluginHooks(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): { hooks: PluginHooks; pluginRoot: string } | null {
	const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);
	if (!pluginRoot) {
		return null;
	}

	const hooksPath = join(pluginRoot, "hooks", "hooks.json");
	if (!existsSync(hooksPath)) {
		return null;
	}

	try {
		const content = readFileSync(hooksPath, "utf-8");
		return {
			hooks: JSON.parse(content) as PluginHooks,
			pluginRoot,
		};
	} catch {
		return null;
	}
}

/**
 * Execute a command hook and return its output
 */
function executeCommandHook(
	command: string,
	pluginRoot: string,
	timeout: number,
): string | null {
	try {
		// Replace ${CLAUDE_PLUGIN_ROOT} with the actual local plugin path
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);

		// Extract session_id from stdin payload if available
		const stdinPayload = getStdinPayload();
		const sessionId =
			typeof stdinPayload?.session_id === "string"
				? stdinPayload.session_id
				: undefined;

		const output = execSync(resolvedCommand, {
			encoding: "utf-8",
			timeout,
			stdio: ["pipe", "pipe", "pipe"],
			shell: "/bin/sh",
			cwd: process.cwd(),
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginRoot,
				CLAUDE_PROJECT_DIR: process.cwd(),
				// Pass session_id for hook locking coordination
				...(sessionId ? { HAN_SESSION_ID: sessionId } : {}),
			},
		});

		return output.trim();
	} catch {
		// Command failed - silently skip errors for dispatch
		// (we don't want to block the agent on hook failures)
		return null;
	}
}

/**
 * Execute hooks from settings files (not from Han plugins)
 */
function dispatchSettingsHooks(hookType: string, outputs: string[]): void {
	for (const { path } of getSettingsPaths()) {
		// Check settings.json for hooks
		const settings = readSettingsFile(path);
		if (settings?.hooks) {
			const hookGroups = (settings.hooks as Record<string, unknown>)[hookType];
			if (Array.isArray(hookGroups)) {
				for (const group of hookGroups) {
					if (
						typeof group === "object" &&
						group !== null &&
						"hooks" in group &&
						Array.isArray(group.hooks)
					) {
						for (const hook of group.hooks as HookEntry[]) {
							if (hook.type === "command" && hook.command) {
								const output = executeCommandHook(
									hook.command,
									process.cwd(),
									hook.timeout || 30000,
								);
								if (output) {
									outputs.push(output);
								}
							}
						}
					}
				}
			}
		}

		// Also check for hooks.json in the same directory
		const hooksJsonPath = path.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		if (hooksJsonPath !== path && existsSync(hooksJsonPath)) {
			try {
				const content = readFileSync(hooksJsonPath, "utf-8");
				const hooksJson = JSON.parse(content) as Record<string, unknown>;

				// hooks.json can have hooks at root level or under "hooks" key
				const hooksObj =
					(hooksJson.hooks as Record<string, unknown>) ?? hooksJson;
				const hookGroups = hooksObj[hookType];

				if (Array.isArray(hookGroups)) {
					for (const group of hookGroups) {
						if (
							typeof group === "object" &&
							group !== null &&
							"hooks" in group &&
							Array.isArray(group.hooks)
						) {
							for (const hook of group.hooks as HookEntry[]) {
								if (hook.type === "command" && hook.command) {
									const output = executeCommandHook(
										hook.command,
										process.cwd(),
										hook.timeout || 30000,
									);
									if (output) {
										outputs.push(output);
									}
								}
							}
						}
					}
				}
			} catch {
				// Invalid JSON, skip
			}
		}
	}
}

/**
 * Dispatch hooks of a specific type across all installed plugins.
 * Uses merged settings from all scopes (user, project, local, enterprise).
 */
function dispatchHooks(hookType: string, includeSettings = false): void {
	const outputs: string[] = [];

	// Dispatch settings hooks if --all is specified
	if (includeSettings) {
		dispatchSettingsHooks(hookType, outputs);
	}

	// Dispatch Han plugin hooks
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const result = loadPluginHooks(pluginName, marketplace, marketplaceConfig);

		if (!result?.hooks?.hooks?.[hookType]) {
			continue;
		}

		const { hooks: pluginHooks, pluginRoot } = result;
		const hookGroups = pluginHooks.hooks[hookType];

		for (const group of hookGroups) {
			for (const hook of group.hooks) {
				// Only execute command hooks - prompt hooks are handled by Claude Code directly
				if (hook.type === "command" && hook.command) {
					const output = executeCommandHook(
						hook.command,
						pluginRoot,
						hook.timeout || 30000,
					);
					if (output) {
						outputs.push(output);
					}
				}
			}
		}
	}

	// Output aggregated results
	if (outputs.length > 0) {
		console.log(outputs.join("\n\n"));
	}
}

export function registerHookDispatch(hookCommand: Command): void {
	hookCommand
		.command("dispatch <hookType>")
		.description(
			"Dispatch hooks of a specific type across all installed Han plugins.\n" +
				"By default, only runs Han plugin hooks. Use --all to include settings hooks.\n\n" +
				"This is a workaround for Claude Code bug #12151 where plugin hook output\n" +
				"is not passed to the agent. Add this to ~/.claude/settings.json:\n\n" +
				'  "hooks": {\n' +
				'    "UserPromptSubmit": [{"hooks": [{"type": "command",\n' +
				'      "command": "npx -y @thebushidocollective/han hook dispatch UserPromptSubmit"}]}],\n' +
				'    "SessionStart": [{"hooks": [{"type": "command",\n' +
				'      "command": "npx -y @thebushidocollective/han hook dispatch SessionStart"}]}]\n' +
				"  }",
		)
		.option(
			"-a, --all",
			"Include hooks from Claude Code settings (not just Han plugins)",
		)
		.action((hookType: string, options: { all?: boolean }) => {
			dispatchHooks(hookType, options.all ?? false);
		});
}
