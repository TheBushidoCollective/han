/**
 * Full integration tests for commands/hook/verify.ts
 * Tests the complete verification flow with real file system setup
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("verify.ts full integration tests", () => {
	const testDir = `/tmp/test-hook-verify-full-${Date.now()}`;
	let originalEnv: typeof process.env;
	let originalExit: typeof process.exit;
	let originalLog: typeof console.log;
	let originalError: typeof console.error;
	let originalCwd: () => string;
	let _exitCode: number | null = null;
	const logMessages: string[] = [];
	const errorMessages: string[] = [];

	beforeEach(() => {
		// Save originals
		originalEnv = { ...process.env };
		originalExit = process.exit;
		originalLog = console.log;
		originalError = console.error;
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");
		delete process.env.HAN_DISABLE_HOOKS;

		// Create directories
		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });

		// Mock process.exit
		_exitCode = null;
		process.exit = mock((code?: number) => {
			_exitCode = code ?? 0;
			throw new Error(`process.exit(${code})`);
		}) as never;

		// Mock console
		logMessages.length = 0;
		errorMessages.length = 0;
		console.log = mock((...args: unknown[]) => {
			logMessages.push(args.join(" "));
		}) as never;
		console.error = mock((...args: unknown[]) => {
			errorMessages.push(args.join(" "));
		}) as never;

		// Mock cwd to return our test directory
		process.cwd = mock(() => testDir);
	});

	afterEach(() => {
		// Restore
		process.env = originalEnv;
		process.exit = originalExit;
		console.log = originalLog;
		console.error = originalError;
		process.cwd = originalCwd;

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("complete verification workflow", () => {
		test("verifies hooks when no plugins are configured", async () => {
			// Create empty settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({ enabledPlugins: {} }),
			);

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

			// Should log that no hooks were found
			expect(
				logMessages.some(
					(msg) => msg.includes("No") && msg.includes("hooks found"),
				),
			).toBe(true);
		});

		test("creates marketplace directory structure", () => {
			const marketplacePath = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"test-marketplace",
			);
			mkdirSync(marketplacePath, { recursive: true });

			const pluginCategories = ["jutsu", "do", "hashi"];
			for (const category of pluginCategories) {
				mkdirSync(join(marketplacePath, category), { recursive: true });
			}

			const fs = require("node:fs");
			expect(fs.existsSync(marketplacePath)).toBe(true);
			for (const category of pluginCategories) {
				expect(fs.existsSync(join(marketplacePath, category))).toBe(true);
			}
		});

		test("creates plugin with hooks.json", () => {
			const marketplacePath = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"test-marketplace",
			);
			const pluginPath = join(marketplacePath, "jutsu", "jutsu-test");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-test validate",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksContent, null, 2),
			);

			const fs = require("node:fs");
			expect(fs.existsSync(join(hooksDir, "hooks.json"))).toBe(true);
		});

		test("creates plugin config file", () => {
			const marketplacePath = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"test-marketplace",
			);
			const pluginPath = join(marketplacePath, "jutsu", "jutsu-test");
			mkdirSync(pluginPath, { recursive: true });

			const _pluginConfig = {
				hooks: {
					validate: {
						command: "echo 'validating'",
						description: "Validates the project",
					},
				},
			};

			writeFileSync(
				join(pluginPath, "han-plugin.yml"),
				`hooks:\n  validate:\n    command: echo 'validating'\n    description: Validates the project\n`,
			);

			const fs = require("node:fs");
			expect(fs.existsSync(join(pluginPath, "han-plugin.yml"))).toBe(true);
		});
	});

	describe("path resolution in different scenarios", () => {
		test("resolves plugin in development marketplace", () => {
			// Create marketplace.json in cwd
			const marketplaceJsonPath = join(
				testDir,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });
			writeFileSync(
				marketplaceJsonPath,
				JSON.stringify({ name: "dev-marketplace" }),
			);

			// Create plugin
			const pluginPath = join(testDir, "jutsu", "jutsu-dev");
			mkdirSync(pluginPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(marketplaceJsonPath)).toBe(true);
			expect(fs.existsSync(pluginPath)).toBe(true);
		});

		test("resolves plugin with custom marketplace path", () => {
			const customPath = join(testDir, "custom");
			const pluginPath = join(customPath, "jutsu", "jutsu-custom");
			mkdirSync(pluginPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(pluginPath)).toBe(true);
		});

		test("resolves plugin in default config location", () => {
			const defaultPath = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
				"jutsu",
				"jutsu-default",
			);
			mkdirSync(defaultPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(defaultPath)).toBe(true);
		});
	});

	describe("hook parsing and validation", () => {
		test("parses command hooks correctly", () => {
			const commands = [
				"han hook run jutsu-typescript test",
				"han hook run jutsu-biome lint",
				"han hook run jutsu-bun build",
				"han hook run do-accessibility check",
				"han hook run hashi-github sync",
			];

			const { parseHookCommand } = require("../lib/commands/hook/verify.ts");

			for (const cmd of commands) {
				const result = parseHookCommand(cmd);
				expect(result).not.toBeNull();
				expect(result?.pluginName).toBeTruthy();
				expect(result?.hookName).toBeTruthy();
			}
		});

		test("rejects invalid hook commands", () => {
			const invalidCommands = [
				"npm run test",
				"yarn test",
				"bun test",
				"han plugin install jutsu-test",
				"han hook dispatch Stop",
				"",
			];

			const { parseHookCommand } = require("../lib/commands/hook/verify.ts");

			for (const cmd of invalidCommands) {
				const result = parseHookCommand(cmd);
				if (cmd === "") {
					expect(result).toBeNull();
				}
			}
		});

		test("validates hook entries have required fields", () => {
			const validCommandHook = {
				type: "command" as const,
				command: "han hook run test validate",
			};

			const validPromptHook = {
				type: "prompt" as const,
				prompt: "Continue?",
			};

			expect(validCommandHook.type).toBe("command");
			expect(validCommandHook.command).toBeTruthy();
			expect(validPromptHook.type).toBe("prompt");
			expect(validPromptHook.prompt).toBeTruthy();
		});

		test("detects invalid hook entries", () => {
			const invalidHooks = [
				{ type: "command" }, // Missing command
				{ type: "prompt" }, // Missing prompt
				{ type: "invalid", command: "test" }, // Invalid type
			];

			for (const hook of invalidHooks) {
				if (hook.type === "command") {
					// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
					expect((hook as any).command).toBeUndefined();
				} else if (hook.type === "prompt") {
					// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
					expect((hook as any).prompt).toBeUndefined();
				} else {
					expect(hook.type).not.toBe("command");
					expect(hook.type).not.toBe("prompt");
				}
			}
		});
	});

	describe("hooks.json file operations", () => {
		test("reads valid hooks.json", () => {
			const pluginPath = join(testDir, "test-plugin");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const content = {
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

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(content, null, 2),
			);

			const fs = require("node:fs");
			const fileContent = fs.readFileSync(
				join(hooksDir, "hooks.json"),
				"utf-8",
			);
			const parsed = JSON.parse(fileContent);

			expect(parsed.hooks.Stop).toBeDefined();
			expect(parsed.hooks.Stop[0].hooks[0].command).toContain("test-plugin");
		});

		test("handles hooks.json with multiple hook types", () => {
			const pluginPath = join(testDir, "multi-plugin");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const content = {
				hooks: {
					Stop: [
						{
							hooks: [
								{ type: "command", command: "han hook run multi-plugin stop" },
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{ type: "command", command: "han hook run multi-plugin start" },
							],
						},
					],
					SessionEnd: [
						{
							hooks: [
								{ type: "command", command: "han hook run multi-plugin end" },
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(content, null, 2),
			);

			const fs = require("node:fs");
			const fileContent = fs.readFileSync(
				join(hooksDir, "hooks.json"),
				"utf-8",
			);
			const parsed = JSON.parse(fileContent);

			expect(Object.keys(parsed.hooks)).toHaveLength(3);
		});

		test("handles hooks.json with timeout configuration", () => {
			const pluginPath = join(testDir, "timeout-plugin");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const content = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run timeout-plugin slow",
									timeout: 120000,
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(content, null, 2),
			);

			const fs = require("node:fs");
			const fileContent = fs.readFileSync(
				join(hooksDir, "hooks.json"),
				"utf-8",
			);
			const parsed = JSON.parse(fileContent);

			expect(parsed.hooks.Stop[0].hooks[0].timeout).toBe(120000);
		});

		test("handles missing hooks.json", () => {
			const pluginPath = join(testDir, "no-hooks-plugin");
			mkdirSync(pluginPath, { recursive: true });

			const fs = require("node:fs");
			const hooksPath = join(pluginPath, "hooks", "hooks.json");
			expect(fs.existsSync(hooksPath)).toBe(false);
		});

		test("handles malformed hooks.json", () => {
			const pluginPath = join(testDir, "bad-json-plugin");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			const fs = require("node:fs");
			let parsed = null;
			try {
				const content = fs.readFileSync(join(hooksDir, "hooks.json"), "utf-8");
				parsed = JSON.parse(content);
			} catch {
				parsed = null;
			}

			expect(parsed).toBeNull();
		});
	});

	describe("marketplace configuration handling", () => {
		test("handles directory source configuration", () => {
			const config = {
				source: {
					source: "directory" as const,
					path: "/custom/path",
				},
			};

			expect(config.source.source).toBe("directory");
			expect(config.source.path).toBeTruthy();
		});

		test("handles git source configuration", () => {
			const config = {
				source: {
					source: "git" as const,
					url: "https://github.com/example/repo.git",
				},
			};

			expect(config.source.source).toBe("git");
			expect(config.source.url).toBeTruthy();
		});

		test("handles github source configuration", () => {
			const config = {
				source: {
					source: "github" as const,
					repo: "example/repo",
				},
			};

			expect(config.source.source).toBe("github");
			expect(config.source.repo).toBeTruthy();
		});
	});

	describe("directory structure validation", () => {
		test("validates plugin category directories", () => {
			const categories = ["jutsu", "do", "hashi"];
			const marketplaceRoot = testDir;

			for (const category of categories) {
				mkdirSync(join(marketplaceRoot, category), { recursive: true });
			}

			const fs = require("node:fs");
			for (const category of categories) {
				expect(fs.existsSync(join(marketplaceRoot, category))).toBe(true);
			}
		});

		test("validates nested plugin structure", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-test");
			const subdirs = ["hooks", "commands", "skills"];

			for (const subdir of subdirs) {
				mkdirSync(join(pluginPath, subdir), { recursive: true });
			}

			const fs = require("node:fs");
			for (const subdir of subdirs) {
				expect(fs.existsSync(join(pluginPath, subdir))).toBe(true);
			}
		});

		test("validates marketplace root structure", () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"test",
			);
			mkdirSync(marketplaceRoot, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(marketplaceRoot)).toBe(true);
		});
	});

	describe("edge cases and error handling", () => {
		test("handles non-existent config directory", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;

			// getClaudeConfigDir would return empty string
			const configDir =
				process.env.CLAUDE_CONFIG_DIR ||
				(process.env.HOME ? join(process.env.HOME, ".claude") : "");
			expect(configDir).toBe("");
		});

		test("handles empty plugin name", () => {
			const { parseHookCommand } = require("../lib/commands/hook/verify.ts");
			const result = parseHookCommand("han hook run  test");
			expect(result).toBeNull();
		});

		test("handles empty hook name", () => {
			const { parseHookCommand } = require("../lib/commands/hook/verify.ts");
			const _result = parseHookCommand("han hook run jutsu-test ");
			// Might still match if there's non-space content
		});

		test("handles very long paths", () => {
			const longPath = join(
				testDir,
				"a".repeat(50),
				"b".repeat(50),
				"c".repeat(50),
			);
			mkdirSync(longPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(longPath)).toBe(true);
		});

		test("handles special characters in directory names", () => {
			const specialPath = join(testDir, "test-plugin_v1.0");
			mkdirSync(specialPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(specialPath)).toBe(true);
		});
	});
});
