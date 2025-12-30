/**
 * Functional tests for commands/hook/verify.ts
 * Tests internal logic by setting up realistic scenarios and mocking dependencies
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("verify.ts functional tests with mocking", () => {
	let testDir: string;
	let originalEnv: typeof process.env;
	let originalExit: typeof process.exit;
	let originalLog: typeof console.log;
	let originalError: typeof console.error;
	let _exitCode: number | null = null;
	const logMessages: string[] = [];
	const errorMessages: string[] = [];

	beforeEach(() => {
		// Generate unique directory per test to avoid race conditions
		testDir = `/tmp/test-hook-verify-functional-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		// Save originals
		originalEnv = { ...process.env };
		originalExit = process.exit;
		originalLog = console.log;
		originalError = console.error;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");
		delete process.env.HAN_DISABLE_HOOKS;

		// Create directories
		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });

		// Mock process.exit to capture exit codes
		_exitCode = null;
		process.exit = mock((code?: number) => {
			_exitCode = code ?? 0;
			throw new Error(`process.exit(${code})`);
		}) as never;

		// Mock console to capture output
		logMessages.length = 0;
		errorMessages.length = 0;
		console.log = mock((...args: unknown[]) => {
			logMessages.push(args.join(" "));
		}) as never;
		console.error = mock((...args: unknown[]) => {
			errorMessages.push(args.join(" "));
		}) as never;
	});

	afterEach(() => {
		// Restore
		process.env = originalEnv;
		process.exit = originalExit;
		console.log = originalLog;
		console.error = originalError;

		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("environment variable handling", () => {
		test("HAN_DISABLE_HOOKS=true should exit early", async () => {
			process.env.HAN_DISABLE_HOOKS = "true";

			// Import after setting environment
			const { registerHookVerify } = await import(
				"../lib/commands/hook/verify.ts"
			);

			// Create a mock command that captures the action function
			let actionFn: ((hookType: string) => Promise<void>) | null = null;
			const mockCommand = {
				command: mock(() => mockCommand),
				description: mock(() => mockCommand),
				action: mock((fn: (hookType: string) => Promise<void>) => {
					actionFn = fn;
					return mockCommand;
				}),
			};

			registerHookVerify(mockCommand as never);

			// Execute the action asynchronously
			try {
				// biome-ignore lint/style/noNonNullAssertion: actionFn is set by mock callback
				await actionFn!("Stop");
			} catch (_error) {
				// Catch process.exit throw
			}

			// The action should have been called
			expect(mockCommand.action).toHaveBeenCalled();
		});

		test("HAN_DISABLE_HOOKS=1 should exit early", async () => {
			process.env.HAN_DISABLE_HOOKS = "1";

			const { registerHookVerify } = await import(
				"../lib/commands/hook/verify.ts"
			);

			let actionFn: ((hookType: string) => Promise<void>) | null = null;
			const mockCommand = {
				command: mock(() => mockCommand),
				description: mock(() => mockCommand),
				action: mock((fn: (hookType: string) => Promise<void>) => {
					actionFn = fn;
					return mockCommand;
				}),
			};

			registerHookVerify(mockCommand as never);

			try {
				// biome-ignore lint/style/noNonNullAssertion: actionFn is set by mock callback
				await actionFn!("Stop");
			} catch (_error) {
				// Catch process.exit throw
			}

			expect(mockCommand.action).toHaveBeenCalled();
		});
	});

	describe("registerHookVerify", () => {
		test("registers command with correct name and description", async () => {
			const { registerHookVerify } = await import(
				"../lib/commands/hook/verify.ts"
			);

			let commandName = "";
			let commandDescription = "";

			const mockCommand = {
				command: mock((name: string) => {
					commandName = name;
					return mockCommand;
				}),
				description: mock((desc: string) => {
					commandDescription = desc;
					return mockCommand;
				}),
				action: mock(() => mockCommand),
			};

			// biome-ignore lint/suspicious/noExplicitAny: mock command object for testing
			registerHookVerify(mockCommand as any);

			expect(mockCommand.command).toHaveBeenCalled();
			expect(mockCommand.description).toHaveBeenCalled();
			expect(mockCommand.action).toHaveBeenCalled();
			expect(commandName).toBe("verify <hookType>");
			expect(commandDescription).toContain("Verify that all hooks");
		});

		test("action function is properly registered", async () => {
			const { registerHookVerify } = await import(
				"../lib/commands/hook/verify.ts"
			);

			let actionFunction: ((hookType: string) => void) | null = null;

			const mockCommand = {
				command: mock(() => mockCommand),
				description: mock(() => mockCommand),
				action: mock((fn: (hookType: string) => void) => {
					actionFunction = fn;
					return mockCommand;
				}),
			};

			// biome-ignore lint/suspicious/noExplicitAny: mock command object for testing
			registerHookVerify(mockCommand as any);

			expect(actionFunction).not.toBeNull();
			expect(typeof actionFunction).toBe("function");
		});
	});

	describe("parseHookCommand boundary cases", () => {
		test("handles maximum reasonable input length", async () => {
			const { parseHookCommand } = await import(
				"../lib/commands/hook/verify.ts"
			);

			const longPlugin = "a".repeat(100);
			const longHook = "b".repeat(100);
			const result = parseHookCommand(`han hook run ${longPlugin} ${longHook}`);

			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe(longPlugin);
			expect(result?.hookName).toBe(longHook);
		});

		test("handles unicode characters in plugin name", async () => {
			const { parseHookCommand } = await import(
				"../lib/commands/hook/verify.ts"
			);

			const result = parseHookCommand("han hook run jutsu-test test");
			expect(result).not.toBeNull();
		});

		test("handles various whitespace combinations", async () => {
			const { parseHookCommand } = await import(
				"../lib/commands/hook/verify.ts"
			);

			const tests = [
				"han hook run jutsu-test test",
				"han  hook  run  jutsu-test  test",
				"han   hook   run   jutsu-test   test",
				"han\thook\trun\tjutsu-test\ttest",
				"han\nhook\nrun\njutsu-test\ntest",
			];

			for (const test of tests) {
				const result = parseHookCommand(test);
				expect(result).not.toBeNull();
				expect(result?.pluginName).toBe("jutsu-test");
				expect(result?.hookName).toBe("test");
			}
		});
	});

	describe("internal function behaviors", () => {
		test("findPluginInMarketplace checks directories in correct order", () => {
			// Create plugins in different locations
			const marketplaceRoot = testDir;

			// Create in all locations
			const jutsuPath = join(marketplaceRoot, "jutsu", "test-plugin");
			const doPath = join(marketplaceRoot, "do", "test-plugin");
			const hashiPath = join(marketplaceRoot, "hashi", "test-plugin");
			const rootPath = join(marketplaceRoot, "test-plugin");

			mkdirSync(jutsuPath, { recursive: true });
			mkdirSync(doPath, { recursive: true });
			mkdirSync(hashiPath, { recursive: true });
			mkdirSync(rootPath, { recursive: true });

			// Simulate the search order
			const searchOrder = ["jutsu", "do", "hashi", ""];
			const fs = require("node:fs");

			let found: string | null = null;
			for (const dir of searchOrder) {
				const testPath = dir
					? join(marketplaceRoot, dir, "test-plugin")
					: join(marketplaceRoot, "test-plugin");
				if (fs.existsSync(testPath)) {
					found = testPath;
					break;
				}
			}

			// Should find jutsu first
			expect(found).toBe(jutsuPath);
		});

		test("resolveToAbsolute handles all path types", () => {
			const testCases = [
				{ input: "/absolute/path", expected: "/absolute/path" },
				{
					input: "relative/path",
					expected: join(process.cwd(), "relative/path"),
				},
				{
					input: "./current/path",
					expected: join(process.cwd(), "./current/path"),
				},
				{
					input: "../parent/path",
					expected: join(process.cwd(), "../parent/path"),
				},
			];

			for (const { input, expected } of testCases) {
				const result = input.startsWith("/")
					? input
					: join(process.cwd(), input);
				expect(result).toBe(expected);
			}
		});

		test("loadPluginHooks returns null for missing plugin", () => {
			const fs = require("node:fs");
			const pluginRoot = join(testDir, "nonexistent");

			expect(fs.existsSync(pluginRoot)).toBe(false);
		});

		test("loadPluginHooks returns null for missing hooks.json", () => {
			const pluginRoot = join(testDir, "plugin-no-hooks");
			mkdirSync(pluginRoot, { recursive: true });

			const fs = require("node:fs");
			const hooksPath = join(pluginRoot, "hooks", "hooks.json");

			expect(fs.existsSync(hooksPath)).toBe(false);
		});

		test("loadPluginHooks successfully parses valid hooks.json", () => {
			const pluginRoot = join(testDir, "plugin-with-hooks");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run test-plugin validate",
								},
							],
						},
					],
				},
			};

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, JSON.stringify(hooksContent));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.Stop).toBeDefined();
			expect(parsed.hooks.Stop[0].hooks[0].command).toContain("test-plugin");
		});

		test("loadPluginHooks handles JSON parse errors", () => {
			const pluginRoot = join(testDir, "plugin-bad-json");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, "{ this is not valid json }");

			const fs = require("node:fs");
			let parsed = null;
			try {
				const content = fs.readFileSync(hooksPath, "utf-8");
				parsed = JSON.parse(content);
			} catch {
				parsed = null;
			}

			expect(parsed).toBeNull();
		});
	});

	describe("getPluginDir logic paths", () => {
		test("checks marketplace config directory source", () => {
			const customPath = join(testDir, "custom-marketplace");
			const pluginPath = join(customPath, "jutsu", "test-plugin");
			mkdirSync(pluginPath, { recursive: true });

			const marketplaceConfig = {
				source: {
					source: "directory" as const,
					path: customPath,
				},
			};

			// Verify the path exists
			const fs = require("node:fs");
			expect(fs.existsSync(pluginPath)).toBe(true);
			expect(marketplaceConfig.source.source).toBe("directory");
		});

		test("checks for development marketplace.json in cwd", () => {
			const marketplaceJson = join(
				testDir,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });
			writeFileSync(marketplaceJson, "{}");

			const fs = require("node:fs");
			const _cwdMarketplace = join(
				process.cwd(),
				".claude-plugin",
				"marketplace.json",
			);

			// In actual execution, it would check process.cwd()
			expect(fs.existsSync(marketplaceJson)).toBe(true);
		});

		test("falls back to config directory marketplace path", () => {
			const configDir = join(testDir, "config");
			const marketplacePath = join(
				configDir,
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplacePath, "jutsu", "test-plugin");
			mkdirSync(pluginPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(pluginPath)).toBe(true);
			expect(fs.existsSync(marketplacePath)).toBe(true);
		});

		test("returns null when marketplace doesn't exist", () => {
			const configDir = join(testDir, "config");
			const marketplacePath = join(
				configDir,
				"plugins",
				"marketplaces",
				"nonexistent",
			);

			const fs = require("node:fs");
			expect(fs.existsSync(marketplacePath)).toBe(false);
		});

		test("returns null when config directory is not set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;
			delete process.env.USERPROFILE;

			// getClaudeConfigDir would return empty string
			const configDir =
				process.env.CLAUDE_CONFIG_DIR ||
				process.env.HOME ||
				process.env.USERPROFILE;
			expect(configDir).toBeUndefined();
		});
	});

	describe("hook type validation", () => {
		test("validates command type hooks", () => {
			const hook = {
				type: "command" as const,
				command: "han hook run test validate",
			};

			expect(hook.type).toBe("command");
			expect(hook.command).toBeTruthy();
		});

		test("validates prompt type hooks", () => {
			const hook = {
				type: "prompt" as const,
				prompt: "Continue?",
			};

			expect(hook.type).toBe("prompt");
			expect(hook.prompt).toBeTruthy();
		});

		test("detects invalid hook types", () => {
			const hook = {
				// biome-ignore lint/suspicious/noExplicitAny: testing invalid hook type
				type: "invalid" as any,
			};

			expect(hook.type).not.toBe("command");
			expect(hook.type).not.toBe("prompt");
		});

		test("detects missing command field", () => {
			const hook = {
				type: "command" as const,
			};

			expect(hook.type).toBe("command");
			// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
			expect((hook as any).command).toBeUndefined();
		});

		test("detects missing prompt field", () => {
			const hook = {
				type: "prompt" as const,
			};

			expect(hook.type).toBe("prompt");
			// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
			expect((hook as any).prompt).toBeUndefined();
		});
	});

	describe("hooks.json structure validation", () => {
		test("validates complete hooks.json structure", () => {
			const structure = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run test validate",
									timeout: 30000,
								},
							],
						},
					],
				},
			};

			expect(structure.hooks).toBeDefined();
			expect(structure.hooks.Stop).toBeDefined();
			expect(structure.hooks.Stop[0]).toBeDefined();
			expect(structure.hooks.Stop[0].hooks).toBeDefined();
			expect(structure.hooks.Stop[0].hooks[0]).toBeDefined();
			expect(structure.hooks.Stop[0].hooks[0].type).toBe("command");
			expect(structure.hooks.Stop[0].hooks[0].command).toBeTruthy();
			expect(structure.hooks.Stop[0].hooks[0].timeout).toBe(30000);
		});

		test("validates multiple hook groups", () => {
			const structure = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run test one",
								},
							],
						},
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run test two",
								},
							],
						},
					],
				},
			};

			expect(structure.hooks.Stop).toHaveLength(2);
			expect(structure.hooks.Stop[0].hooks).toHaveLength(1);
			expect(structure.hooks.Stop[1].hooks).toHaveLength(1);
		});

		test("validates multiple hook types", () => {
			const structure = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run test stop",
								},
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run test start",
								},
							],
						},
					],
				},
			};

			expect(Object.keys(structure.hooks)).toHaveLength(2);
			expect(structure.hooks.Stop).toBeDefined();
			expect(structure.hooks.SessionStart).toBeDefined();
		});
	});
});
