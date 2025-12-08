import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "ink";
import React from "react";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "./claude-settings.js";
import { HookTestUI } from "./hook-test-ui.js";

/** Default timeout for hooks (30 seconds per Claude docs) */
const DEFAULT_HOOK_TIMEOUT = 30000;

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

/**
 * Live output state for streaming output to UI during execution
 */
export interface LiveOutputState {
	// Map of "hookType:plugin:command" -> output lines
	outputs: Map<string, string[]>;
	// Callback to trigger UI rerender
	onUpdate?: () => void;
}

/**
 * Create a key for the live output map
 */
export function makeLiveOutputKey(
	hookType: string,
	plugin: string,
	command: string,
): string {
	return `${hookType}:${plugin}:${command}`;
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
 * Execute a single hook command and collect output.
 * The command itself (e.g. han hook run) will source CLAUDE_ENV_FILE if set.
 */
async function executeHookCommand(
	hook: HookCommand,
	hookType: string,
	verbose: boolean,
	liveOutput?: LiveOutputState,
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

	// Create live output key and initialize if streaming is enabled
	const liveKey = liveOutput
		? makeLiveOutputKey(hookType, hook.plugin, hook.command)
		: null;
	if (liveOutput && liveKey) {
		liveOutput.outputs.set(liveKey, []);
	}

	return new Promise((resolve) => {
		// Add ~/.claude/bin to PATH for han binary access
		const configDir = getClaudeConfigDir();
		const claudeBinDir = join(configDir, "bin");
		const pathSeparator = process.platform === "win32" ? ";" : ":";
		const enhancedPath = `${claudeBinDir}${pathSeparator}${process.env.PATH || ""}`;

		const child = spawn(hook.command, {
			shell: true,
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: configDir,
				CLAUDE_PLUGIN_ROOT: hook.pluginDir,
				CLAUDE_PROJECT_DIR: process.cwd(),
				PATH: enhancedPath,
				// Enable verbose output for hook run commands during testing
				HAN_HOOK_RUN_VERBOSE: "1",
			},
		});

		const output: string[] = [];
		let timedOut = false;
		let timeoutHandle: NodeJS.Timeout | null = null;

		// Set up timeout (use default if not specified)
		const timeout = hook.timeout ?? DEFAULT_HOOK_TIMEOUT;
		timeoutHandle = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeout);

		child.stdout?.on("data", (data) => {
			const text = data.toString();
			const lines = text.split("\n").filter((l: string) => l.trim());
			for (const line of lines) {
				const formatted = `[${hook.plugin}/${hookType}] ${line}`;
				output.push(formatted);
				if (verbose) {
					process.stdout.write(`  ${formatted}\n`);
				}
				// Stream to live output
				if (liveOutput && liveKey) {
					const liveLines = liveOutput.outputs.get(liveKey) || [];
					liveLines.push(formatted);
					liveOutput.outputs.set(liveKey, liveLines);
					liveOutput.onUpdate?.();
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
				// Stream to live output
				if (liveOutput && liveKey) {
					const liveLines = liveOutput.outputs.get(liveKey) || [];
					liveLines.push(formatted);
					liveOutput.outputs.set(liveKey, liveLines);
					liveOutput.onUpdate?.();
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
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	// Try different plugin directory structures
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
		getMergedPluginsAndMarketplaces();

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

	// Check if we have a TTY with raw mode support for interactive UI
	const isTTY = process.stdin.isTTY && process.stdout.isTTY;

	if (isTTY) {
		// Execute hooks with interactive UI
		await executeHooksWithUI(hookTypesFound, hooksByType, verbose);
	} else {
		// Execute hooks with simple console output (non-interactive mode)
		await executeHooksWithConsole(hookTypesFound, hooksByType, verbose);
	}
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
		// Build hook structure first (hooksByType already contains HookCommand with type and timeout)
		const hookStructure = new Map<string, HookCommand[]>();
		for (const hookType of hookTypesFound) {
			hookStructure.set(hookType, hooksByType[hookType]);
		}

		const hookResults = new Map<string, HookResult[]>();
		let currentType: string | null = null;
		let isComplete = false;
		let hadFailures = false;

		// Create live output state for streaming
		const liveOutput: LiveOutputState = {
			outputs: new Map(),
		};

		// Throttle rerenders to prevent overwhelming Ink
		let rerenderPending = false;
		let lastRerenderTime = 0;
		const RERENDER_THROTTLE_MS = 50; // Max 20 rerenders per second

		// Helper to trigger rerender (throttled for live output, immediate for state changes)
		const doRerender = (immediate = false) => {
			const now = Date.now();
			const timeSinceLastRerender = now - lastRerenderTime;

			if (immediate || timeSinceLastRerender >= RERENDER_THROTTLE_MS) {
				lastRerenderTime = now;
				rerenderPending = false;
				rerender(
					React.createElement(HookTestUI, {
						hookTypes: hookTypesFound,
						hookStructure,
						hookResults,
						currentType,
						isComplete,
						verbose,
						liveOutput,
					}),
				);
			} else if (!rerenderPending) {
				// Schedule a rerender for later
				rerenderPending = true;
				setTimeout(() => {
					if (rerenderPending) {
						doRerender(true);
					}
				}, RERENDER_THROTTLE_MS - timeSinceLastRerender);
			}
		};

		// Set up live output callback (throttled)
		liveOutput.onUpdate = () => doRerender(false);

		const { rerender, unmount } = render(
			React.createElement(HookTestUI, {
				hookTypes: hookTypesFound,
				hookStructure,
				hookResults,
				currentType,
				isComplete,
				verbose,
				liveOutput,
			}),
		);

		// Handle Ctrl+C gracefully
		const handleSigInt = () => {
			unmount();
			process.exit(130); // Standard exit code for SIGINT
		};
		process.on("SIGINT", handleSigInt);

		// Execute hooks sequentially by type
		(async () => {
			try {
				for (const hookType of hookTypesFound) {
					const hooks = hooksByType[hookType];
					currentType = hookType;

					// Update UI to show current hook type (immediate)
					doRerender(true);

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
								liveOutput,
							);
							results.push(result);

							// Check for failures
							if (!result.success) {
								hadFailures = true;
							}

							// Update UI immediately after each hook completes
							doRerender(true);
						}),
					);
				}

				// Mark as complete
				isComplete = true;
				currentType = null;

				// Final render (immediate)
				doRerender(true);

				// Wait a bit for final render, then unmount
				setTimeout(() => {
					process.off("SIGINT", handleSigInt);
					unmount();
					process.exit(hadFailures ? 1 : 0);
				}, 100);
			} catch (error) {
				// If something goes wrong, make sure we clean up and show the error
				process.off("SIGINT", handleSigInt);
				unmount();
				console.error("\n\nHook test crashed:", error);
				process.exit(1);
			}
		})();
	});
}

/**
 * Execute hooks with simple console output (for non-TTY environments)
 */
async function executeHooksWithConsole(
	hookTypesFound: string[],
	hooksByType: HooksByType,
	verbose: boolean,
): Promise<void> {
	console.log("🔍 Running hook tests...\n");

	let hadFailures = false;
	const allResults: Map<string, HookResult[]> = new Map();

	// Execute hooks sequentially by type
	for (const hookType of hookTypesFound) {
		const hooks = hooksByType[hookType];
		const hookCount = hooks.length;

		process.stdout.write(`${hookType}: `);

		// Run all hooks of this type in parallel
		const results = await Promise.all(
			hooks.map((hook) => executeHookCommand(hook, hookType, verbose)),
		);

		allResults.set(hookType, results);

		const passed = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		if (failed > 0) {
			hadFailures = true;
			console.log(`✗ ${passed}/${hookCount} passed`);
		} else {
			console.log(`✓ ${passed}/${hookCount} passed`);
		}
	}

	console.log();

	// Show failed hook output
	for (const [hookType, results] of allResults.entries()) {
		const failedResults = results.filter((r) => !r.success);
		if (failedResults.length === 0) continue;

		console.log(`\n❌ Failed hooks in ${hookType}:`);
		for (const result of failedResults) {
			console.log(`  ✗ ${result.plugin}: ${result.command}`);
			if (result.timedOut) {
				console.log("    (timeout)");
			}
			if (result.output.length > 0) {
				for (const line of result.output.slice(0, 10)) {
					console.log(`    ${line}`);
				}
				if (result.output.length > 10) {
					console.log(`    ... and ${result.output.length - 10} more lines`);
				}
			}
		}
	}

	// Summary
	console.log();
	if (hadFailures) {
		console.log("❌ Some hooks failed execution");
	} else {
		console.log("✅ All hooks executed successfully");
	}

	process.exit(hadFailures ? 1 : 0);
}

/**
 * Validation-only mode (no execution)
 */
async function testHooksValidationOnly(): Promise<void> {
	console.log("🔍 Validating hooks for installed plugins...\n");

	const { plugins: enabledPlugins, marketplaces } =
		getMergedPluginsAndMarketplaces();

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
