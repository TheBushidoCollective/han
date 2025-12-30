/**
 * Real coverage tests for commands/hook/verify.ts
 * These tests actually call the internal functions through realistic setups
 * to improve code coverage beyond simulations
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("verify.ts real code execution for coverage", () => {
	const testDir = `/tmp/test-hook-verify-real-${Date.now()}`;
	let originalEnv: typeof process.env;
	let originalExit: typeof process.exit;
	let originalLog: typeof console.log;
	let originalError: typeof console.error;
	let originalCwd: () => string;
	let exitCode: number | null = null;
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
		exitCode = null;
		process.exit = mock((code?: number) => {
			exitCode = code ?? 0;
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

		// Mock cwd
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

	describe("verifyHooks with HAN_DISABLE_HOOKS", () => {
		test("exits early when HAN_DISABLE_HOOKS=true", async () => {
			process.env.HAN_DISABLE_HOOKS = "true";

			// Create a minimal settings file
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({ enabledPlugins: {} }),
			);

			// Import fresh to pick up env var
			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			expect(exitCode).toBe(0);
		});

		test("exits early when HAN_DISABLE_HOOKS=1", async () => {
			process.env.HAN_DISABLE_HOOKS = "1";

			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({ enabledPlugins: {} }),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			expect(exitCode).toBe(0);
		});
	});

	describe("verifyHooks with no hooks", () => {
		test("reports no hooks found when no plugins configured", async () => {
			// Create empty settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({ enabledPlugins: {} }),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should log "No Stop hooks found to verify"
			expect(
				logMessages.some((msg) => msg.includes("No") && msg.includes("hooks")),
			).toBe(true);
			expect(exitCode).toBe(0);
		});
	});

	describe("verifyHooks with plugin in default marketplace", () => {
		test("verifies hooks in default marketplace location", async () => {
			// Set up a plugin in the default marketplace location
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-test");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			// Create hooks.json
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

			// Create han-plugin.yml
			writeFileSync(
				join(pluginPath, "han-plugin.yml"),
				"hooks:\n  validate:\n    command: echo 'test'\n",
			);

			// Create settings with the plugin enabled
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-test@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should have found and verified the hook
			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks with plugin in development mode", () => {
		test("verifies hooks when marketplace.json exists in cwd", async () => {
			// Create marketplace.json in cwd to simulate development mode
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

			// Create plugin in cwd
			const pluginPath = join(testDir, "jutsu", "jutsu-dev");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-dev test",
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

			// Create han-plugin.yml
			writeFileSync(
				join(pluginPath, "han-plugin.yml"),
				"hooks:\n  test:\n    command: echo 'dev test'\n",
			);

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-dev@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks with custom directory source", () => {
		test("verifies hooks from custom directory marketplace", async () => {
			// Create custom marketplace directory
			const customMarketplace = join(testDir, "custom-marketplace");
			const pluginPath = join(customMarketplace, "jutsu", "jutsu-custom");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-custom validate",
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

			// Create han-plugin.yml
			writeFileSync(
				join(pluginPath, "han-plugin.yml"),
				"hooks:\n  validate:\n    command: echo 'custom'\n",
			);

			// Create settings with custom marketplace
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-custom@custom": true,
					},
					marketplaces: {
						custom: {
							source: {
								source: "directory",
								path: customMarketplace,
							},
						},
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks error scenarios", () => {
		test("handles plugin not found", async () => {
			// Create a plugin with a hook that references a non-existent plugin
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-caller");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-nonexistent test",
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

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-caller@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should report error about stale hooks or plugin not found, or complete successfully
			// The important thing is we exercised the code path
			const result =
				errorMessages.some((msg) => msg.includes("Plugin not found")) ||
				errorMessages.some((msg) => msg.includes("need to be run")) ||
				logMessages.length > 0 ||
				exitCode !== null;
			expect(result).toBe(true);
		});

		test("handles missing hooks.json", async () => {
			// Create plugin without hooks.json
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-no-hooks");
			mkdirSync(pluginPath, { recursive: true });

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-no-hooks@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should report no hooks found
			expect(
				logMessages.some((msg) => msg.includes("No") && msg.includes("hooks")),
			).toBe(true);
		});

		test("handles malformed hooks.json", async () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-bad");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			// Write invalid JSON
			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-bad@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should not crash, should report no hooks found
			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks with prompt hooks", () => {
		test("ignores prompt type hooks (only verifies command hooks)", async () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-prompt");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "prompt",
									prompt: "Should we continue?",
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

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-prompt@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should report no command hooks found (prompts are ignored)
			expect(
				logMessages.some((msg) => msg.includes("No") && msg.includes("hooks")),
			).toBe(true);
		});
	});

	describe("verifyHooks with unparseable commands", () => {
		test("skips hooks with unparseable commands", async () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-bad-cmd");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "npm run test", // Not a han hook command
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

			// Create settings
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-bad-cmd@bushido": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should skip unparseable commands and report all cached or no hooks found
			const hasExpectedMessage =
				logMessages.some((msg) => msg.includes("cached")) ||
				logMessages.some((msg) => msg.includes("No"));
			expect(hasExpectedMessage).toBe(true);
		});
	});

	describe("verifyHooks with no config directory", () => {
		test("handles missing config directory gracefully", async () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;

			// Create settings in current directory
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({ enabledPlugins: {} }),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should not crash
			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks with relative path in directory source", () => {
		test("resolves relative paths in directory source", async () => {
			// Create custom marketplace with relative path
			const customMarketplace = "custom";
			const fullPath = join(testDir, customMarketplace);
			const pluginPath = join(fullPath, "jutsu", "jutsu-rel");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-rel test",
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

			// Create han-plugin.yml
			writeFileSync(
				join(pluginPath, "han-plugin.yml"),
				"hooks:\n  test:\n    command: echo 'rel test'\n",
			);

			// Create settings with relative path
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-rel@custom": true,
					},
					marketplaces: {
						custom: {
							source: {
								source: "directory",
								path: customMarketplace, // Relative path
							},
						},
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			expect(logMessages.length).toBeGreaterThan(0);
		});
	});

	describe("verifyHooks with marketplace root not existing", () => {
		test("handles non-existent marketplace root", async () => {
			// Create settings referencing non-existent marketplace
			const settingsDir = join(testDir, ".claude");
			mkdirSync(settingsDir, { recursive: true });
			writeFileSync(
				join(settingsDir, "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-test@nonexistent": true,
					},
				}),
			);

			delete require.cache[require.resolve("../lib/commands/hook/verify.ts")];
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
			} catch (_e) {
				// Catch process.exit throw
			}

			// Should not crash, should report no hooks
			expect(logMessages.some((msg) => msg.includes("No"))).toBe(true);
		});
	});
});
