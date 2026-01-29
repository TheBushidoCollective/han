/**
 * Hook Test Command
 *
 * Runs hooks with simulated Claude Code input to help debug hook failures.
 * Can test hooks from both Han plugins and Claude Code settings.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { Box, render, Text } from "ink";
import React, { useEffect, useState } from "react";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	getSettingsPaths,
	type MarketplaceConfig,
	readSettingsFile,
	type SettingsScope,
} from "../../config/claude-settings.ts";
import {
	getHookEvents,
	loadPluginConfig,
	type PluginHookDefinition,
} from "../../hooks/index.ts";

/**
 * Hook entry from Claude Code settings (legacy format)
 */
interface LegacyHookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

/**
 * Unified hook representation for testing
 */
interface TestableHook {
	source: "settings" | "plugin";
	sourcePath: string;
	pluginName?: string;
	marketplace?: string;
	scope?: SettingsScope;
	hookType: string;
	name: string;
	command: string;
	timeout?: number;
	type: "command" | "prompt";
}

/**
 * Test execution result
 */
interface TestResult {
	hook: TestableHook;
	success: boolean;
	exitCode: number | null;
	stdout: string;
	stderr: string;
	duration: number;
	timedOut: boolean;
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

	if (pluginName === "core") {
		potentialPaths.push(join(marketplaceRoot, "core"));
	}

	for (const path of potentialPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

function resolveToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
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

	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

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
 * Collect all hooks from Claude Code settings
 */
function collectSettingsHooks(): TestableHook[] {
	const hooks: TestableHook[] = [];

	for (const { scope, path } of getSettingsPaths()) {
		// Check settings.json for hooks
		const settings = readSettingsFile(path);
		if (settings?.hooks) {
			for (const [hookType, hookGroups] of Object.entries(
				settings.hooks as Record<string, unknown>,
			)) {
				if (!Array.isArray(hookGroups)) continue;

				for (const group of hookGroups) {
					if (
						typeof group === "object" &&
						group !== null &&
						"hooks" in group &&
						Array.isArray(group.hooks)
					) {
						for (let i = 0; i < group.hooks.length; i++) {
							const h = group.hooks[i] as LegacyHookEntry;
							hooks.push({
								source: "settings",
								sourcePath: path,
								scope,
								hookType,
								name: `settings-${hookType}-${i + 1}`,
								command: h.command || h.prompt || "",
								timeout: h.timeout,
								type: h.type,
							});
						}
					}
				}
			}
		}

		// Also check hooks.json
		const hooksJsonPath = path.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		if (hooksJsonPath !== path && existsSync(hooksJsonPath)) {
			try {
				const content = readFileSync(hooksJsonPath, "utf-8");
				const hooksJson = JSON.parse(content) as Record<string, unknown>;
				const hooksObj =
					hooksJson.hooks && typeof hooksJson.hooks === "object"
						? (hooksJson.hooks as Record<string, unknown>)
						: hooksJson;

				for (const [hookType, hookGroups] of Object.entries(hooksObj)) {
					if (!Array.isArray(hookGroups)) continue;

					for (const group of hookGroups) {
						if (
							typeof group === "object" &&
							group !== null &&
							"hooks" in group &&
							Array.isArray(group.hooks)
						) {
							for (let i = 0; i < group.hooks.length; i++) {
								const h = group.hooks[i] as LegacyHookEntry;
								hooks.push({
									source: "settings",
									sourcePath: hooksJsonPath,
									scope,
									hookType,
									name: `hooks-json-${hookType}-${i + 1}`,
									command: h.command || h.prompt || "",
									timeout: h.timeout,
									type: h.type,
								});
							}
						}
					}
				}
			} catch {
				// Invalid JSON, skip
			}
		}
	}

	return hooks;
}

/**
 * Collect all hooks from Han plugins
 */
function collectPluginHooks(): TestableHook[] {
	const hooks: TestableHook[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginRoot) continue;

		const config = loadPluginConfig(pluginRoot, false);
		if (!config?.hooks) continue;

		for (const [hookName, hookDef] of Object.entries(config.hooks)) {
			const events = getHookEvents(hookDef as PluginHookDefinition);
			for (const event of events) {
				hooks.push({
					source: "plugin",
					sourcePath: pluginRoot,
					pluginName,
					marketplace,
					hookType: event,
					name: hookName,
					command: (hookDef as PluginHookDefinition).command,
					type: "command",
				});
			}
		}
	}

	return hooks;
}

/**
 * Generate example stdin payload like Claude Code would send.
 * Based on official Claude Code hook documentation.
 */
function generateStdinPayload(hookType: string): string {
	const sessionId = `test-session-${Date.now()}`;
	const transcriptPath = `~/.claude/projects/test-project/${sessionId}.jsonl`;

	// Common fields for all hooks
	const basePayload: Record<string, unknown> = {
		session_id: sessionId,
		transcript_path: transcriptPath,
		cwd: process.cwd(),
		permission_mode: "default",
		hook_event_name: hookType,
	};

	// Add hook-specific fields per Claude Code documentation
	switch (hookType) {
		case "PreToolUse":
			basePayload.tool_name = "Write";
			basePayload.tool_input = {
				file_path: "/tmp/test-file.txt",
				content: "test content",
			};
			basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
			break;

		case "PostToolUse":
			basePayload.tool_name = "Write";
			basePayload.tool_input = {
				file_path: "/tmp/test-file.txt",
				content: "test content",
			};
			basePayload.tool_response = {
				filePath: "/tmp/test-file.txt",
				success: true,
			};
			basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
			break;

		case "PostToolUseFailure":
			basePayload.tool_name = "Bash";
			basePayload.tool_input = {
				command: "exit 1",
				description: "Test failing command",
			};
			basePayload.tool_response = {
				exit_code: 1,
				stderr: "Command failed",
			};
			basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
			break;

		case "PermissionRequest":
			basePayload.tool_name = "Bash";
			basePayload.tool_input = {
				command: "rm -rf /tmp/test",
				description: "Test permission request",
			};
			basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
			break;

		case "UserPromptSubmit":
			basePayload.prompt = "Test prompt for hook execution";
			break;

		case "Stop":
			basePayload.stop_hook_active = false;
			break;

		case "SubagentStart":
			basePayload.agent_id = `agent-${Date.now()}`;
			basePayload.agent_type = "Explore";
			break;

		case "SubagentStop":
			basePayload.stop_hook_active = false;
			basePayload.agent_id = `agent-${Date.now()}`;
			basePayload.agent_transcript_path = `${transcriptPath}/subagents/agent-${Date.now()}.jsonl`;
			break;

		case "SessionStart":
			basePayload.source = "startup";
			basePayload.model = "claude-sonnet-4-20250514";
			break;

		case "SessionEnd":
			basePayload.reason = "exit";
			break;

		case "PreCompact":
			basePayload.trigger = "manual";
			basePayload.custom_instructions = "";
			break;

		case "Setup":
			basePayload.trigger = "init";
			break;

		case "Notification":
			basePayload.message = "Claude needs your permission";
			basePayload.notification_type = "permission_prompt";
			break;
	}

	return JSON.stringify(basePayload, null, 2);
}

/**
 * Execute a single hook and return the result
 */
async function executeHook(
	hook: TestableHook,
	stdinPayload: string,
): Promise<TestResult> {
	const startTime = Date.now();

	// Prompt hooks are just text, not executed
	if (hook.type === "prompt") {
		return {
			hook,
			success: true,
			exitCode: 0,
			stdout: `[Prompt hook - text output only]\n${hook.command}`,
			stderr: "",
			duration: 0,
			timedOut: false,
		};
	}

	return new Promise((resolve) => {
		const configDir = getClaudeConfigDir();
		const claudeBinDir = join(configDir, "bin");
		const pathSeparator = process.platform === "win32" ? ";" : ":";
		const enhancedPath = `${claudeBinDir}${pathSeparator}${process.env.PATH || ""}`;

		// Resolve CLAUDE_PLUGIN_ROOT in the command
		const pluginRoot = hook.sourcePath;
		const resolvedCommand = hook.command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);

		const child = spawn(resolvedCommand, {
			shell: "/bin/sh",
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: configDir,
				CLAUDE_PLUGIN_ROOT: pluginRoot,
				CLAUDE_PROJECT_DIR: process.cwd(),
				PATH: enhancedPath,
			},
		});

		// Write stdin payload
		if (child.stdin) {
			child.stdin.write(stdinPayload);
			child.stdin.end();
		}

		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timeoutMs = (hook.timeout || 30) * 1000;

		const timeoutHandle = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			clearTimeout(timeoutHandle);
			const duration = Date.now() - startTime;
			resolve({
				hook,
				success: code === 0 && !timedOut,
				exitCode: code,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				duration,
				timedOut,
			});
		});

		child.on("error", (error) => {
			clearTimeout(timeoutHandle);
			const duration = Date.now() - startTime;
			resolve({
				hook,
				success: false,
				exitCode: null,
				stdout: "",
				stderr: error.message,
				duration,
				timedOut: false,
			});
		});
	});
}

/**
 * UI Component for test results
 */
interface TestUIProps {
	hooks: TestableHook[];
	results: Map<string, TestResult>;
	currentHook: TestableHook | null;
	showPayload: boolean;
	stdinPayload: string;
	isComplete: boolean;
}

const TestResultDisplay: React.FC<{ result: TestResult }> = ({ result }) => {
	const statusColor = result.success ? "green" : "red";
	const statusIcon = result.success ? "✓" : "✗";

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={statusColor} bold>
					{statusIcon}
				</Text>
				<Text> </Text>
				<Text color={result.hook.source === "plugin" ? "cyan" : "yellow"}>
					{result.hook.source === "plugin"
						? `${result.hook.pluginName}/${result.hook.name}`
						: `settings/${result.hook.name}`}
				</Text>
				<Text dimColor> ({result.duration}ms)</Text>
				{result.timedOut && <Text color="red"> [TIMEOUT]</Text>}
				{result.exitCode !== null && result.exitCode !== 0 && (
					<Text color="red"> [exit {result.exitCode}]</Text>
				)}
			</Box>

			{/* Command */}
			<Box marginLeft={3}>
				<Text dimColor>Command: </Text>
				<Text color="gray">{result.hook.command.slice(0, 60)}</Text>
				{result.hook.command.length > 60 && <Text color="gray">...</Text>}
			</Box>

			{/* Stdout */}
			{result.stdout && (
				<Box marginLeft={3} flexDirection="column">
					<Text dimColor>stdout:</Text>
					<Box marginLeft={2}>
						<Text color="white">
							{result.stdout.slice(0, 500)}
							{result.stdout.length > 500 ? "..." : ""}
						</Text>
					</Box>
				</Box>
			)}

			{/* Stderr */}
			{result.stderr && (
				<Box marginLeft={3} flexDirection="column">
					<Text color="red">stderr:</Text>
					<Box marginLeft={2}>
						<Text color="red">
							{result.stderr.slice(0, 500)}
							{result.stderr.length > 500 ? "..." : ""}
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

const HookTestUI: React.FC<TestUIProps> = ({
	hooks,
	results,
	currentHook,
	showPayload,
	stdinPayload,
	isComplete,
}) => {
	const passed = Array.from(results.values()).filter((r) => r.success).length;
	const failed = Array.from(results.values()).filter((r) => !r.success).length;

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>
				{"═".repeat(60)}
			</Text>
			<Text bold>
				HOOK TEST - Simulating Claude Code Hook Execution
			</Text>
			<Text bold>
				{"═".repeat(60)}
			</Text>

			{showPayload && (
				<Box flexDirection="column" marginTop={1}>
					<Text dimColor>Stdin payload sent to hooks:</Text>
					<Box marginLeft={2}>
						<Text color="gray">{stdinPayload}</Text>
					</Box>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					Testing {hooks.length} hook(s)...{" "}
					{currentHook && !isComplete && (
						<Text color="yellow">
							Running: {currentHook.pluginName || "settings"}/{currentHook.name}
						</Text>
					)}
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1}>
				{Array.from(results.values()).map((result) => (
					<TestResultDisplay
						key={`${result.hook.source}-${result.hook.hookType}-${result.hook.name}`}
						result={result}
					/>
				))}
			</Box>

			{isComplete && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold>
						{"─".repeat(60)}
					</Text>
					<Box>
						<Text>
							Results:{" "}
							<Text color="green" bold>
								{passed} passed
							</Text>
							,{" "}
							<Text color={failed > 0 ? "red" : "gray"} bold>
								{failed} failed
							</Text>
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

/**
 * Main test runner
 */
async function runHookTest(
	hookType?: string,
	options: { payload?: boolean; command?: string } = {},
): Promise<void> {
	const settingsHooks = collectSettingsHooks();
	const pluginHooks = collectPluginHooks();
	const allHooks = [...settingsHooks, ...pluginHooks];

	// Filter by hook type if specified
	let hooksToTest = hookType
		? allHooks.filter(
				(h) => h.hookType.toLowerCase() === hookType.toLowerCase(),
			)
		: allHooks;

	// Filter by specific command if specified
	if (options.command) {
		hooksToTest = hooksToTest.filter((h) =>
			h.command.includes(options.command!),
		);
	}

	if (hooksToTest.length === 0) {
		console.log("No hooks found matching criteria.");
		if (hookType) {
			console.log(`Hook type: ${hookType}`);
		}
		if (options.command) {
			console.log(`Command filter: ${options.command}`);
		}
		console.log("\nAvailable hook types:");
		const types = [...new Set(allHooks.map((h) => h.hookType))].sort();
		for (const t of types) {
			const count = allHooks.filter((h) => h.hookType === t).length;
			console.log(`  ${t}: ${count} hook(s)`);
		}
		return;
	}

	// Generate stdin payload
	const testHookType = hookType || hooksToTest[0]?.hookType || "SessionStart";
	const stdinPayload = generateStdinPayload(testHookType);

	// Check if we have a TTY for interactive UI
	const isTTY = process.stdin.isTTY && process.stdout.isTTY;

	if (isTTY) {
		// Interactive mode with Ink UI
		await runWithUI(hooksToTest, stdinPayload, options.payload ?? false);
	} else {
		// Non-interactive mode
		await runWithConsole(hooksToTest, stdinPayload, options.payload ?? false);
	}
}

async function runWithUI(
	hooks: TestableHook[],
	stdinPayload: string,
	showPayload: boolean,
): Promise<void> {
	return new Promise((resolve) => {
		const results = new Map<string, TestResult>();
		let currentHook: TestableHook | null = null;
		let isComplete = false;

		const { rerender, unmount } = render(
			<HookTestUI
				hooks={hooks}
				results={results}
				currentHook={currentHook}
				showPayload={showPayload}
				stdinPayload={stdinPayload}
				isComplete={isComplete}
			/>,
		);

		const handleSigInt = () => {
			unmount();
			process.exit(130);
		};
		process.on("SIGINT", handleSigInt);

		(async () => {
			let hasFailures = false;

			for (const hook of hooks) {
				currentHook = hook;
				rerender(
					<HookTestUI
						hooks={hooks}
						results={results}
						currentHook={currentHook}
						showPayload={showPayload}
						stdinPayload={stdinPayload}
						isComplete={isComplete}
					/>,
				);

				const result = await executeHook(hook, stdinPayload);
				const key = `${hook.source}-${hook.hookType}-${hook.name}`;
				results.set(key, result);

				if (!result.success) {
					hasFailures = true;
				}

				rerender(
					<HookTestUI
						hooks={hooks}
						results={results}
						currentHook={currentHook}
						showPayload={showPayload}
						stdinPayload={stdinPayload}
						isComplete={isComplete}
					/>,
				);
			}

			isComplete = true;
			currentHook = null;
			rerender(
				<HookTestUI
					hooks={hooks}
					results={results}
					currentHook={currentHook}
					showPayload={showPayload}
					stdinPayload={stdinPayload}
					isComplete={isComplete}
				/>,
			);

			setTimeout(() => {
				process.off("SIGINT", handleSigInt);
				unmount();
				resolve();
				process.exit(hasFailures ? 1 : 0);
			}, 100);
		})();
	});
}

async function runWithConsole(
	hooks: TestableHook[],
	stdinPayload: string,
	showPayload: boolean,
): Promise<void> {
	console.log("═".repeat(60));
	console.log("HOOK TEST - Simulating Claude Code Hook Execution");
	console.log("═".repeat(60));

	if (showPayload) {
		console.log("\nStdin payload sent to hooks:");
		console.log(stdinPayload);
	}

	console.log(`\nTesting ${hooks.length} hook(s)...\n`);

	let passed = 0;
	let failed = 0;

	for (const hook of hooks) {
		const result = await executeHook(hook, stdinPayload);
		const statusIcon = result.success ? "✓" : "✗";
		const source =
			hook.source === "plugin"
				? `${hook.pluginName}/${hook.name}`
				: `settings/${hook.name}`;

		console.log(`${statusIcon} ${source} (${result.duration}ms)`);
		console.log(`  Command: ${hook.command.slice(0, 80)}${hook.command.length > 80 ? "..." : ""}`);

		if (result.stdout) {
			console.log("  stdout:", result.stdout.slice(0, 200));
		}
		if (result.stderr) {
			console.log("  stderr:", result.stderr.slice(0, 200));
		}
		if (result.timedOut) {
			console.log("  [TIMEOUT]");
		}
		if (result.exitCode !== null && result.exitCode !== 0) {
			console.log(`  [exit ${result.exitCode}]`);
		}
		console.log();

		if (result.success) {
			passed++;
		} else {
			failed++;
		}
	}

	console.log("─".repeat(60));
	console.log(`Results: ${passed} passed, ${failed} failed`);

	process.exit(failed > 0 ? 1 : 0);
}

export function registerHookTest(hookCommand: Command): void {
	hookCommand
		.command("test [hookType]")
		.description(
			"Test hooks by running them with simulated Claude Code input.\n" +
				"Shows all hooks (Han plugins + Claude Code settings) and their actual output.\n\n" +
				"This helps debug hook failures by running hooks exactly as Claude Code would.\n\n" +
				"Examples:\n" +
				"  han hook test                    # Test all hooks\n" +
				"  han hook test SessionStart       # Test only SessionStart hooks\n" +
				"  han hook test Stop --payload     # Show the stdin payload sent to hooks\n" +
				"  han hook test --command \"han\"    # Test hooks containing 'han' in command",
		)
		.option("--payload", "Show the stdin JSON payload sent to hooks")
		.option(
			"--command <substring>",
			"Filter to hooks whose command contains this string",
		)
		.action(
			(
				hookType: string | undefined,
				options: { payload?: boolean; command?: string },
			) => {
				runHookTest(hookType, options);
			},
		);
}
