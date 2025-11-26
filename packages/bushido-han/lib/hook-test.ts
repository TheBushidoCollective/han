import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config as dotenvConfig } from "dotenv";
import { render } from "ink";
import React from "react";
import { HookTestUI } from "./hook-test-ui.js";

interface HookCommand {
	plugin: string;
	command: string;
	pluginDir: string;
	type: "command" | "prompt";
	timeout?: number;
}

interface HooksByType {
	[hookType: string]: HookCommand[];
}

interface ValidationResult {
	plugin: string;
	errors: string[];
}

interface HookResult {
	plugin: string;
	command: string;
	success: boolean;
	output: string[];
	isPrompt?: boolean;
	timedOut?: boolean;
}

interface MarketplaceSource {
	source: "directory" | "git" | "github";
	path?: string;
	url?: string;
	repo?: string;
}

interface MarketplaceConfig {
	source: MarketplaceSource;
}

interface ClaudeSettings {
	extraKnownMarketplaces?: Record<string, MarketplaceConfig>;
	enabledPlugins?: Record<string, boolean>;
}

// Valid hook event types according to Claude Code spec
const VALID_HOOK_TYPES = [
	"Notification",
	"PostToolUse",
	"PreCompact",
	"PreToolUse",
	"SessionEnd",
	"SessionStart",
	"Stop",
	"SubagentStop",
	"UserPromptSubmit",
];

/**
 * Execute a single hook command and collect output
 */
async function executeHookCommand(
	hook: HookCommand,
	hookType: string,
	verbose: boolean,
	claudeEnvVars: Record<string, string>,
): Promise<HookResult> {
	// Handle prompt type hooks - instant pass
	if (hook.type === "prompt") {
		return {
			plugin: hook.plugin,
			command: hook.command,
			success: true,
			output: [],
			isPrompt: true,
		};
	}

	return new Promise((resolve) => {
		const child = spawn(hook.command, {
			shell: true,
			env: {
				...process.env,
				...claudeEnvVars,
				CLAUDE_PLUGIN_ROOT: hook.pluginDir,
				CLAUDE_PROJECT_DIR: process.cwd(),
			},
		});

		const output: string[] = [];
		let timedOut = false;
		let timeoutHandle: NodeJS.Timeout | null = null;

		// Set up timeout if specified
		if (hook.timeout) {
			timeoutHandle = setTimeout(() => {
				timedOut = true;
				child.kill();
			}, hook.timeout);
		}

		child.stdout?.on("data", (data) => {
			const text = data.toString();
			const lines = text.split("\n").filter((l: string) => l.trim());
			for (const line of lines) {
				const formatted = `[${hook.plugin}/${hookType}] ${line}`;
				output.push(formatted);
				if (verbose) {
					process.stdout.write(`  ${formatted}\n`);
				}
			}
		});

		child.stderr?.on("data", (data) => {
			const text = data.toString();
			const lines = text.split("\n").filter((l: string) => l.trim());
			for (const line of lines) {
				const formatted = `[${hook.plugin}/${hookType}] ${line}`;
				output.push(formatted);
				if (verbose) {
					process.stderr.write(`  ${formatted}\n`);
				}
			}
		});

		child.on("close", (code) => {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			const success = code === 0 && !timedOut;
			resolve({
				plugin: hook.plugin,
				command: hook.command,
				success,
				output,
				timedOut,
			});
		});

		child.on("error", (error) => {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			resolve({
				plugin: hook.plugin,
				command: hook.command,
				success: false,
				output: [error.message],
			});
		});
	});
}

/**
 * Get Claude config directory
 */
function getClaudeConfigDir(): string {
	if (process.env.CLAUDE_CONFIG_DIR) {
		return process.env.CLAUDE_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		throw new Error("Could not determine home directory");
	}
	return join(homeDir, ".claude");
}

/**
 * Load environment variables from Claude config .env files
 * Order: user -> project -> local (later files override earlier)
 */
function loadClaudeEnvFiles(): Record<string, string> {
	const envVars: Record<string, string> = {};

	// 1. User config: ~/.claude/.env
	const userEnvPath = join(getClaudeConfigDir(), ".env");
	if (existsSync(userEnvPath)) {
		const result = dotenvConfig({ path: userEnvPath });
		if (result.parsed) {
			Object.assign(envVars, result.parsed);
		}
	}

	// 2. Project config: <project>/.claude/.env
	const projectEnvPath = join(process.cwd(), ".claude", ".env");
	if (existsSync(projectEnvPath)) {
		const result = dotenvConfig({ path: projectEnvPath });
		if (result.parsed) {
			Object.assign(envVars, result.parsed);
		}
	}

	// 3. Local config: <project>/.claude/.env.local
	const localEnvPath = join(process.cwd(), ".claude", ".env.local");
	if (existsSync(localEnvPath)) {
		const result = dotenvConfig({ path: localEnvPath });
		if (result.parsed) {
			Object.assign(envVars, result.parsed);
		}
	}

	return envVars;
}

/**
 * Read settings from a file
 */
function readSettings(path: string): ClaudeSettings | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (_error) {
		return null;
	}
}

/**
 * Get all enabled plugins and marketplace configurations from settings
 */
function getEnabledPluginsAndMarketplaces(): {
	plugins: Map<string, string>;
	marketplaces: Map<string, MarketplaceConfig>;
} {
	// Map of plugin name -> marketplace name
	const plugins = new Map<string, string>();
	// Map of marketplace name -> marketplace config
	const marketplaces = new Map<string, MarketplaceConfig>();

	// Read project settings
	const projectSettingsPath = join(process.cwd(), ".claude", "settings.json");
	const projectSettings = readSettings(projectSettingsPath);
	if (projectSettings) {
		// Collect marketplace configs
		if (projectSettings.extraKnownMarketplaces) {
			for (const [name, config] of Object.entries(
				projectSettings.extraKnownMarketplaces,
			)) {
				marketplaces.set(name, config);
			}
		}
		// Collect enabled plugins
		if (projectSettings.enabledPlugins) {
			for (const [key, enabled] of Object.entries(
				projectSettings.enabledPlugins,
			)) {
				if (enabled && key.includes("@")) {
					const [pluginName, marketplace] = key.split("@");
					plugins.set(pluginName, marketplace);
				}
			}
		}
	}

	// Read local settings (can override project settings)
	const localSettingsPath = join(
		process.cwd(),
		".claude",
		"settings.local.json",
	);
	const localSettings = readSettings(localSettingsPath);
	if (localSettings) {
		// Collect marketplace configs (override project)
		if (localSettings.extraKnownMarketplaces) {
			for (const [name, config] of Object.entries(
				localSettings.extraKnownMarketplaces,
			)) {
				marketplaces.set(name, config);
			}
		}
		// Collect enabled plugins (override project)
		if (localSettings.enabledPlugins) {
			for (const [key, enabled] of Object.entries(
				localSettings.enabledPlugins,
			)) {
				if (enabled && key.includes("@")) {
					const [pluginName, marketplace] = key.split("@");
					plugins.set(pluginName, marketplace);
				} else if (!enabled && key.includes("@")) {
					const [pluginName] = key.split("@");
					plugins.delete(pluginName);
				}
			}
		}
	}

	return { plugins, marketplaces };
}

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	// Try different plugin directory structures
	const potentialPaths = [
		join(marketplaceRoot, "buki", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "sensei", pluginName),
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
			const found = findPluginInMarketplace(directoryPath, pluginName);
			if (found) {
				return found;
			}
		}
	}

	// Check if we're in the marketplace repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		// We're in a marketplace repo, look for plugins here
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

	// Fall back to the default shared config path
	const configDir = getClaudeConfigDir();
	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);

	// Look in the marketplace directory
	if (!existsSync(marketplaceRoot)) {
		return null;
	}

	return findPluginInMarketplace(marketplaceRoot, pluginName);
}

/**
 * Collect and aggregate all hooks by type across all plugins
 */
function collectHooks(
	enabledPlugins: Map<string, string>,
	marketplaces: Map<string, MarketplaceConfig>,
): {
	hooksByType: HooksByType;
	validationResults: ValidationResult[];
} {
	const hooksByType: HooksByType = {};
	const validationResults: ValidationResult[] = [];

	for (const [pluginName, marketplace] of enabledPlugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginDir = getPluginDir(pluginName, marketplace, marketplaceConfig);
		if (!pluginDir) {
			validationResults.push({
				plugin: pluginName,
				errors: [
					`Could not find plugin directory for ${pluginName}@${marketplace}`,
				],
			});
			continue;
		}

		const hooksPath = join(pluginDir, "hooks", "hooks.json");
		if (!existsSync(hooksPath)) {
			continue; // Skip plugins without hooks
		}

		try {
			const hooksContent = readFileSync(hooksPath, "utf8");
			const hooksConfig = JSON.parse(hooksContent);

			if (!hooksConfig.hooks || typeof hooksConfig.hooks !== "object") {
				validationResults.push({
					plugin: pluginName,
					errors: ["Invalid hooks.json structure: missing 'hooks' object"],
				});
				continue;
			}

			const errors: string[] = [];

			// Collect hooks by type
			for (const hookType of Object.keys(hooksConfig.hooks)) {
				// Validate hook type
				if (!VALID_HOOK_TYPES.includes(hookType)) {
					errors.push(`Unknown event type '${hookType}'`);
					continue;
				}

				const hookConfig = hooksConfig.hooks[hookType];
				if (!Array.isArray(hookConfig)) {
					errors.push(`Hook type '${hookType}' must be an array`);
					continue;
				}

				// Extract hook commands
				for (const hook of hookConfig) {
					if (!hook.hooks || !Array.isArray(hook.hooks)) {
						errors.push(
							`Hook type '${hookType}' missing 'hooks' array in configuration`,
						);
						continue;
					}

					for (const individualHook of hook.hooks) {
						const hookTypeValue = individualHook.type;

						// Handle command type hooks
						if (hookTypeValue === "command") {
							if (
								!individualHook.command ||
								typeof individualHook.command !== "string"
							) {
								errors.push(
									`Hook type '${hookType}' has command hook with missing or invalid command`,
								);
							} else {
								// Validate -- separator for han hook run
								if (
									individualHook.command.includes("han hook run") &&
									!individualHook.command.includes(" -- ")
								) {
									errors.push(
										`Hook command uses 'han hook run' but missing '--' separator`,
									);
								}

								// Add to hooks by type
								if (!hooksByType[hookType]) {
									hooksByType[hookType] = [];
								}
								hooksByType[hookType].push({
									plugin: pluginName,
									command: individualHook.command,
									pluginDir,
									type: "command",
									timeout: individualHook.timeout,
								});
							}
						} else if (hookTypeValue === "prompt") {
							// Handle prompt type hooks
							if (!hooksByType[hookType]) {
								hooksByType[hookType] = [];
							}
							hooksByType[hookType].push({
								plugin: pluginName,
								command: individualHook.prompt || "",
								pluginDir,
								type: "prompt",
							});
						}
					}
				}
			}

			if (errors.length > 0) {
				validationResults.push({ plugin: pluginName, errors });
			}
		} catch (error: unknown) {
			validationResults.push({
				plugin: pluginName,
				errors: [
					`Failed to parse hooks.json: ${error instanceof Error ? error.message : String(error)}`,
				],
			});
		}
	}

	return { hooksByType, validationResults };
}

/**
 * Test all hooks in installed plugins
 */
export async function testHooks(options?: {
	execute?: boolean;
	verbose?: boolean;
}): Promise<void> {
	const executeHooks = options?.execute ?? false;
	const verbose = options?.verbose ?? false;

	if (!executeHooks) {
		// Validation-only mode (keep existing console output)
		await testHooksValidationOnly();
		return;
	}

	const { plugins: enabledPlugins, marketplaces } =
		getEnabledPluginsAndMarketplaces();

	if (enabledPlugins.size === 0) {
		console.log("No plugins installed");
		process.exit(0);
	}

	// Collect all hooks grouped by type
	const { hooksByType, validationResults } = collectHooks(
		enabledPlugins,
		marketplaces,
	);

	// Display validation results
	if (validationResults.length > 0) {
		console.log("\n❌ Validation Errors:\n");
		for (const result of validationResults) {
			console.error(`  ${result.plugin}:`);
			for (const error of result.errors) {
				console.error(`    - ${error}`);
			}
		}
		console.log();
		process.exit(1);
	}

	// Display what hooks were found
	const hookTypesFound = Object.keys(hooksByType).sort();
	if (hookTypesFound.length === 0) {
		console.log("No hooks configured in any installed plugins");
		process.exit(0);
	}

	// Execute hooks and render with Ink
	await executeHooksWithUI(hookTypesFound, hooksByType, verbose);
}

/**
 * Execute hooks with Ink UI
 */
async function executeHooksWithUI(
	hookTypesFound: string[],
	hooksByType: HooksByType,
	verbose: boolean,
): Promise<void> {
	return new Promise((_resolve) => {
		// Load environment variables from Claude config .env files
		const claudeEnvVars = loadClaudeEnvFiles();

		// Build hook structure first (hooksByType already contains HookCommand with type and timeout)
		const hookStructure = new Map<string, HookCommand[]>();
		for (const hookType of hookTypesFound) {
			hookStructure.set(hookType, hooksByType[hookType]);
		}

		const hookResults = new Map<string, HookResult[]>();
		let currentType: string | null = null;
		let isComplete = false;
		let hadFailures = false;

		const { rerender, unmount } = render(
			React.createElement(HookTestUI, {
				hookTypes: hookTypesFound,
				hookStructure,
				hookResults,
				currentType,
				isComplete,
				verbose,
			}),
		);

		// Execute hooks sequentially by type
		(async () => {
			for (const hookType of hookTypesFound) {
				const hooks = hooksByType[hookType];
				currentType = hookType;

				// Update UI to show current hook type
				rerender(
					React.createElement(HookTestUI, {
						hookTypes: hookTypesFound,
						hookStructure,
						hookResults,
						currentType,
						isComplete,
						verbose,
					}),
				);

				// Initialize results array for this hook type
				const results: HookResult[] = [];
				hookResults.set(hookType, results);

				// Run all hooks of this type in parallel, but update UI as each completes
				await Promise.all(
					hooks.map(async (hook) => {
						const result = await executeHookCommand(
							hook,
							hookType,
							verbose,
							claudeEnvVars,
						);
						results.push(result);

						// Check for failures
						if (!result.success) {
							hadFailures = true;
						}

						// Update UI immediately after each hook completes
						rerender(
							React.createElement(HookTestUI, {
								hookTypes: hookTypesFound,
								hookStructure,
								hookResults,
								currentType,
								isComplete,
								verbose,
							}),
						);
					}),
				);
			}

			// Mark as complete
			isComplete = true;
			currentType = null;

			// Final render
			rerender(
				React.createElement(HookTestUI, {
					hookTypes: hookTypesFound,
					hookStructure,
					hookResults,
					currentType,
					isComplete,
					verbose,
				}),
			);

			// Wait a bit for final render, then unmount
			setTimeout(() => {
				unmount();
				process.exit(hadFailures ? 1 : 0);
			}, 100);
		})();
	});
}

/**
 * Validation-only mode (no execution)
 */
async function testHooksValidationOnly(): Promise<void> {
	console.log("🔍 Validating hooks for installed plugins...\n");

	const { plugins: enabledPlugins, marketplaces } =
		getEnabledPluginsAndMarketplaces();

	if (enabledPlugins.size === 0) {
		console.log("No plugins installed");
		process.exit(0);
	}

	// Collect all hooks grouped by type
	const { hooksByType, validationResults } = collectHooks(
		enabledPlugins,
		marketplaces,
	);

	// Display validation results
	if (validationResults.length > 0) {
		console.log("\n❌ Validation Errors:\n");
		for (const result of validationResults) {
			console.error(`  ${result.plugin}:`);
			for (const error of result.errors) {
				console.error(`    - ${error}`);
			}
		}
		console.log();
		process.exit(1);
	}

	// Display what hooks were found
	const hookTypesFound = Object.keys(hooksByType);
	if (hookTypesFound.length === 0) {
		console.log("No hooks configured in any installed plugins");
		process.exit(0);
	}

	console.log("\nFound hooks:");
	for (const hookType of hookTypesFound.sort()) {
		const count = hooksByType[hookType].length;
		const plugins = [
			...new Set(hooksByType[hookType].map((h) => h.plugin)),
		].join(", ");
		console.log(`  ${hookType}: ${count} hook(s) from ${plugins}`);
	}
	console.log();

	console.log("✅ All hooks validated successfully");
	console.log("\nTip: Run with --execute to test hook execution\n");
	process.exit(0);
}
