/**
 * Direct tests for exported internal functions in commands/hook/verify.ts
 * These tests directly call the exported functions to achieve maximum coverage
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	findPluginInMarketplace,
	getPluginDir,
	loadPluginHooks,
	parseHookCommand,
	registerHookVerify,
	resolveToAbsolute,
} from "../lib/commands/hook/verify.ts";

describe("verify.ts direct function tests", () => {
	const testDir = `/tmp/test-hook-verify-direct-${Date.now()}`;
	let originalEnv: typeof process.env;
	let originalCwd: () => string;

	beforeEach(() => {
		originalEnv = { ...process.env };
		originalCwd = process.cwd;

		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");

		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });

		// Mock cwd
		process.cwd = () => testDir;
	});

	afterEach(() => {
		process.env = originalEnv;
		process.cwd = originalCwd;
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("findPluginInMarketplace", () => {
		test("finds plugin in jutsu directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const jutsuPath = join(marketplaceRoot, "jutsu", "jutsu-test");
			mkdirSync(jutsuPath, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "jutsu-test");
			expect(result).toBe(jutsuPath);
		});

		test("finds plugin in do directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const doPath = join(marketplaceRoot, "do", "do-test");
			mkdirSync(doPath, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "do-test");
			expect(result).toBe(doPath);
		});

		test("finds plugin in hashi directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const hashiPath = join(marketplaceRoot, "hashi", "hashi-test");
			mkdirSync(hashiPath, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "hashi-test");
			expect(result).toBe(hashiPath);
		});

		test("finds plugin in root directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const rootPath = join(marketplaceRoot, "core");
			mkdirSync(rootPath, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "core");
			expect(result).toBe(rootPath);
		});

		test("returns null when plugin not found", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			mkdirSync(marketplaceRoot, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "nonexistent");
			expect(result).toBeNull();
		});

		test("finds first matching directory (jutsu has priority)", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const jutsuPath = join(marketplaceRoot, "jutsu", "shared");
			const doPath = join(marketplaceRoot, "do", "shared");
			mkdirSync(jutsuPath, { recursive: true });
			mkdirSync(doPath, { recursive: true });

			const result = findPluginInMarketplace(marketplaceRoot, "shared");
			expect(result).toBe(jutsuPath);
		});
	});

	describe("resolveToAbsolute", () => {
		test("returns absolute path unchanged", () => {
			const absolutePath = "/usr/local/bin";
			const result = resolveToAbsolute(absolutePath);
			expect(result).toBe(absolutePath);
		});

		test("converts relative path to absolute", () => {
			const relativePath = "src/test";
			const result = resolveToAbsolute(relativePath);
			expect(result).toBe(join(testDir, relativePath));
		});

		test("handles dot notation", () => {
			const dotPath = "./src/test";
			const result = resolveToAbsolute(dotPath);
			expect(result).toContain("src/test");
		});

		test("handles parent directory notation", () => {
			const parentPath = "../other";
			const result = resolveToAbsolute(parentPath);
			expect(result).toContain("other");
		});
	});

	describe("getPluginDir", () => {
		test("falls through when dev marketplace exists but plugin not in it", () => {
			// Create marketplace.json but no plugin
			const marketplaceJsonPath = join(
				testDir,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });
			writeFileSync(marketplaceJsonPath, "{}");

			// Create plugin in default location instead
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-fallthrough");
			mkdirSync(pluginPath, { recursive: true });

			const result = getPluginDir("jutsu-fallthrough", "bushido", undefined);
			expect(result).toBe(pluginPath);
		});

		test("finds plugin with directory source (absolute path)", () => {
			const customDir = join(testDir, "custom");
			const pluginPath = join(customDir, "jutsu", "jutsu-custom");
			mkdirSync(pluginPath, { recursive: true });

			const config = {
				source: {
					source: "directory" as const,
					path: customDir,
				},
			};

			const result = getPluginDir("jutsu-custom", "custom", config);
			expect(result).toBe(pluginPath);
		});

		test("finds plugin with directory source (relative path)", () => {
			const customDir = "custom";
			const absoluteCustomDir = join(testDir, customDir);
			const pluginPath = join(absoluteCustomDir, "do", "do-custom");
			mkdirSync(pluginPath, { recursive: true });

			const config = {
				source: {
					source: "directory" as const,
					path: customDir,
				},
			};

			const result = getPluginDir("do-custom", "custom", config);
			expect(result).toBe(pluginPath);
		});

		test("returns null when directory source path doesn't have plugin", () => {
			const customDir = join(testDir, "custom");
			mkdirSync(customDir, { recursive: true });

			const config = {
				source: {
					source: "directory" as const,
					path: customDir,
				},
			};

			const result = getPluginDir("nonexistent", "custom", config);
			// Should fall through to check development marketplace
			expect(result).toBeNull();
		});

		test("finds plugin in development marketplace (cwd)", () => {
			// Create marketplace.json in cwd
			const marketplaceJsonPath = join(
				testDir,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });
			writeFileSync(marketplaceJsonPath, "{}");

			// Create plugin
			const pluginPath = join(testDir, "jutsu", "jutsu-dev");
			mkdirSync(pluginPath, { recursive: true });

			const result = getPluginDir("jutsu-dev", "dev", undefined);
			expect(result).toBe(pluginPath);
		});

		test("finds plugin in default config directory", () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-default");
			mkdirSync(pluginPath, { recursive: true });

			const result = getPluginDir("jutsu-default", "bushido", undefined);
			expect(result).toBe(pluginPath);
		});

		test("returns null when marketplace root doesn't exist", () => {
			const result = getPluginDir("jutsu-test", "nonexistent", undefined);
			expect(result).toBeNull();
		});

		test("returns null when config directory is not set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;

			const result = getPluginDir("jutsu-test", "bushido", undefined);
			expect(result).toBeNull();
		});
	});

	describe("loadPluginHooks", () => {
		test("loads valid hooks.json from default marketplace", () => {
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

			const result = loadPluginHooks("jutsu-test", "bushido", undefined);
			expect(result).not.toBeNull();
			expect(result?.hooks.hooks.Stop).toBeDefined();
			expect(result?.pluginRoot).toBe(pluginPath);
		});

		test("returns null when plugin directory doesn't exist", () => {
			const result = loadPluginHooks("nonexistent", "bushido", undefined);
			expect(result).toBeNull();
		});

		test("returns null when hooks.json doesn't exist", () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-no-hooks");
			mkdirSync(pluginPath, { recursive: true });

			const result = loadPluginHooks("jutsu-no-hooks", "bushido", undefined);
			expect(result).toBeNull();
		});

		test("returns null for malformed JSON", () => {
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

			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			const result = loadPluginHooks("jutsu-bad", "bushido", undefined);
			expect(result).toBeNull();
		});

		test("loads hooks.json with multiple hook types", () => {
			const marketplaceRoot = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-multi");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{ type: "command", command: "han hook run jutsu-multi stop" },
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{ type: "command", command: "han hook run jutsu-multi start" },
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksContent, null, 2),
			);

			const result = loadPluginHooks("jutsu-multi", "bushido", undefined);
			expect(result).not.toBeNull();
			expect(result?.hooks.hooks.Stop).toBeDefined();
			expect(result?.hooks.hooks.SessionStart).toBeDefined();
		});

		test("loads hooks.json with custom directory source", () => {
			const customDir = join(testDir, "custom");
			const pluginPath = join(customDir, "hashi", "hashi-custom");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run hashi-custom sync",
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

			const config = {
				source: {
					source: "directory" as const,
					path: customDir,
				},
			};

			const result = loadPluginHooks("hashi-custom", "custom", config);
			expect(result).not.toBeNull();
			expect(result?.hooks.hooks.Stop[0].hooks[0].command).toContain(
				"hashi-custom",
			);
		});
	});

	describe("parseHookCommand", () => {
		test("parses standard hook command", () => {
			const result = parseHookCommand("han hook run jutsu-typescript test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("returns null for invalid command", () => {
			expect(parseHookCommand("npm run test")).toBeNull();
			expect(parseHookCommand("han plugin install jutsu-test")).toBeNull();
			expect(parseHookCommand("")).toBeNull();
		});

		test("parses command with extra arguments", () => {
			const result = parseHookCommand("han hook run jutsu-biome lint --cached");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-biome");
			expect(result?.hookName).toBe("lint");
		});

		test("handles various whitespace", () => {
			const result = parseHookCommand("han  hook  run  jutsu-bun  test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("returns null for incomplete command", () => {
			expect(parseHookCommand("han hook run jutsu-test")).toBeNull();
			expect(parseHookCommand("han hook run")).toBeNull();
		});
	});

	describe("registerHookVerify", () => {
		test("registers verify command with proper configuration", () => {
			let commandName = "";
			let commandDescription = "";
			let actionFn: ((hookType: string) => void) | null = null;

			const mockCommand = {
				command: (name: string) => {
					commandName = name;
					return mockCommand;
				},
				description: (desc: string) => {
					commandDescription = desc;
					return mockCommand;
				},
				action: (fn: (hookType: string) => void) => {
					actionFn = fn;
					return mockCommand;
				},
			};

			registerHookVerify(mockCommand as never);

			expect(commandName).toBe("verify <hookType>");
			expect(commandDescription).toContain("Verify that all hooks");
			expect(commandDescription).toContain("Example: han hook verify Stop");
			expect(actionFn).not.toBeNull();
			expect(typeof actionFn).toBe("function");
		});
	});
});
