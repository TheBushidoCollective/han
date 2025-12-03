import { execSync } from "node:child_process";
import type { Command } from "commander";
import {
	getInstalledPlugins,
	HAN_MARKETPLACE_REPO,
} from "../../shared.js";

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
 * Fetch a plugin's hooks.json from GitHub
 */
async function fetchPluginHooks(pluginName: string): Promise<PluginHooks | null> {
	// Determine plugin path based on naming convention
	let pluginPath: string;
	if (pluginName.startsWith("jutsu-")) {
		pluginPath = `jutsu/${pluginName}`;
	} else if (pluginName.startsWith("do-")) {
		pluginPath = `do/${pluginName}`;
	} else if (pluginName.startsWith("hashi-")) {
		pluginPath = `hashi/${pluginName}`;
	} else {
		// Core plugins like 'bushido'
		pluginPath = pluginName;
	}

	const url = `https://raw.githubusercontent.com/${HAN_MARKETPLACE_REPO}/refs/heads/main/${pluginPath}/hooks/hooks.json`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			// No hooks.json for this plugin, that's fine
			return null;
		}
		return (await response.json()) as PluginHooks;
	} catch {
		// Network error or invalid JSON
		return null;
	}
}

/**
 * Get the GitHub raw URL base for a plugin
 */
function getPluginGitHubBase(pluginName: string): string {
	let pluginPath: string;
	if (pluginName.startsWith("jutsu-")) {
		pluginPath = `jutsu/${pluginName}`;
	} else if (pluginName.startsWith("do-")) {
		pluginPath = `do/${pluginName}`;
	} else if (pluginName.startsWith("hashi-")) {
		pluginPath = `hashi/${pluginName}`;
	} else {
		pluginPath = pluginName;
	}
	return `https://raw.githubusercontent.com/${HAN_MARKETPLACE_REPO}/refs/heads/main/${pluginPath}`;
}

/**
 * Execute a command hook and return its output
 */
function executeCommandHook(
	command: string,
	pluginName: string,
	timeout: number,
): string | null {
	try {
		// Replace ${CLAUDE_PLUGIN_ROOT} with GitHub raw URL for the plugin
		// This allows hooks that reference plugin files to still work
		const pluginBase = getPluginGitHubBase(pluginName);
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginBase,
		);

		const output = execSync(resolvedCommand, {
			encoding: "utf-8",
			timeout,
			stdio: ["pipe", "pipe", "pipe"],
			shell: "/bin/sh",
			cwd: process.cwd(),
		});

		return output.trim();
	} catch (error) {
		// Command failed
		const err = error as { stderr?: string; message?: string };
		return `[Error from ${pluginName}]: ${err.stderr || err.message || "Unknown error"}`;
	}
}

/**
 * Dispatch hooks of a specific type across all installed plugins
 */
async function dispatchHooks(hookType: string): Promise<void> {
	// Get installed plugins from both scopes
	const projectPlugins = getInstalledPlugins("project");
	const localPlugins = getInstalledPlugins("local");
	const installedPlugins = Array.from(new Set([...projectPlugins, ...localPlugins]));

	if (installedPlugins.length === 0) {
		// No plugins installed, nothing to dispatch
		return;
	}

	const outputs: string[] = [];

	// Process plugins in parallel for speed
	const results = await Promise.all(
		installedPlugins.map(async (pluginName) => {
			const pluginHooks = await fetchPluginHooks(pluginName);
			if (!pluginHooks?.hooks?.[hookType]) {
				return null;
			}

			const hookGroups = pluginHooks.hooks[hookType];
			const pluginOutputs: string[] = [];

			for (const group of hookGroups) {
				for (const hook of group.hooks) {
					if (hook.type === "command" && hook.command) {
						const output = executeCommandHook(
							hook.command,
							pluginName,
							hook.timeout || 30000,
						);
						if (output && !output.startsWith("[Skipped:")) {
							pluginOutputs.push(output);
						}
					} else if (hook.type === "prompt" && hook.prompt) {
						// Prompt hooks are output directly as context
						pluginOutputs.push(hook.prompt);
					}
				}
			}

			return pluginOutputs.length > 0 ? pluginOutputs : null;
		}),
	);

	// Collect all non-null outputs
	for (const result of results) {
		if (result) {
			outputs.push(...result);
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
				"This is a workaround for Claude Code bug #12151 where plugin hook output\n" +
				"is not passed to the agent. Add this to ~/.claude/settings.json:\n\n" +
				'  "hooks": {\n' +
				'    "UserPromptSubmit": [{"hooks": [{"type": "command",\n' +
				'      "command": "npx -y @thebushidocollective/han hook dispatch UserPromptSubmit"}]}],\n' +
				'    "SessionStart": [{"hooks": [{"type": "command",\n' +
				'      "command": "npx -y @thebushidocollective/han hook dispatch SessionStart"}]}]\n' +
				"  }",
		)
		.action(async (hookType: string) => {
			await dispatchHooks(hookType);
		});
}
