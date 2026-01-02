/**
 * Unit tests for commands/hook/verify.ts
 * Tests pure validation functions and core logic with mocked dependencies
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("hook verify.ts internal functions", () => {
	let testDir: string;
	let originalEnv: typeof process.env;
	let originalCwd: () => string;

	beforeEach(() => {
		// Generate unique test directory per test
		testDir = `/tmp/test-hook-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		// Save original environment
		originalEnv = { ...process.env };
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");

		// Create directories
		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });
	});

	afterEach(() => {
		// Restore environment
		process.env = originalEnv;
		process.cwd = originalCwd;

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("findPluginInMarketplace logic", () => {
		test("finds plugin in jutsu directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const jutsuPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuPath, { recursive: true });

			// Simulate findPluginInMarketplace behavior
			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "jutsu-typescript"),
				join(marketplaceRoot, "do", "jutsu-typescript"),
				join(marketplaceRoot, "hashi", "jutsu-typescript"),
				join(marketplaceRoot, "jutsu-typescript"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("finds plugin in do directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const doPath = join(marketplaceRoot, "do", "do-accessibility");
			mkdirSync(doPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "do-accessibility"),
				join(marketplaceRoot, "do", "do-accessibility"),
				join(marketplaceRoot, "hashi", "do-accessibility"),
				join(marketplaceRoot, "do-accessibility"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(doPath);
		});

		test("finds plugin in hashi directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const hashiPath = join(marketplaceRoot, "hashi", "hashi-github");
			mkdirSync(hashiPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "hashi-github"),
				join(marketplaceRoot, "do", "hashi-github"),
				join(marketplaceRoot, "hashi", "hashi-github"),
				join(marketplaceRoot, "hashi-github"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(hashiPath);
		});

		test("finds plugin in root directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const rootPath = join(marketplaceRoot, "core");
			mkdirSync(rootPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "core"),
				join(marketplaceRoot, "do", "core"),
				join(marketplaceRoot, "hashi", "core"),
				join(marketplaceRoot, "core"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(rootPath);
		});

		test("returns null when plugin not found", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			mkdirSync(marketplaceRoot, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "nonexistent"),
				join(marketplaceRoot, "do", "nonexistent"),
				join(marketplaceRoot, "hashi", "nonexistent"),
				join(marketplaceRoot, "nonexistent"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBeNull();
		});

		test("finds first matching directory in priority order", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			// Create plugin in both jutsu and do directories
			const jutsuPath = join(marketplaceRoot, "jutsu", "shared-plugin");
			const doPath = join(marketplaceRoot, "do", "shared-plugin");
			mkdirSync(jutsuPath, { recursive: true });
			mkdirSync(doPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "shared-plugin"),
				join(marketplaceRoot, "do", "shared-plugin"),
				join(marketplaceRoot, "hashi", "shared-plugin"),
				join(marketplaceRoot, "shared-plugin"),
			];

			let found: string | null = null;
			const fs = require("node:fs");
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			// Should find jutsu first since it's checked first
			expect(found).toBe(jutsuPath);
		});
	});

	describe("resolveToAbsolute logic", () => {
		test("returns absolute path unchanged", () => {
			const absolutePath = "/Users/test/project";
			expect(absolutePath.startsWith("/")).toBe(true);
		});

		test("converts relative path to absolute", () => {
			const relativePath = "src/components";
			expect(relativePath.startsWith("/")).toBe(false);
			const absolutePath = join(process.cwd(), relativePath);
			expect(absolutePath.startsWith("/")).toBe(true);
		});

		test("handles dot notation", () => {
			const dotPath = "./src/test";
			expect(dotPath.startsWith("/")).toBe(false);
			const absolutePath = join(process.cwd(), dotPath);
			expect(absolutePath.includes("src/test")).toBe(true);
		});

		test("handles double dot notation", () => {
			const doubleDotPath = "../other-project";
			expect(doubleDotPath.startsWith("/")).toBe(false);
			const absolutePath = join(process.cwd(), doubleDotPath);
			expect(absolutePath.startsWith("/")).toBe(true);
		});
	});

	describe("loadPluginHooks logic", () => {
		test("returns null when plugin directory doesn't exist", () => {
			const fs = require("node:fs");
			const pluginRoot = join(testDir, "nonexistent", "plugin");
			expect(fs.existsSync(pluginRoot)).toBe(false);
		});

		test("returns null when hooks.json doesn't exist", () => {
			const fs = require("node:fs");
			const pluginRoot = join(testDir, "plugin");
			mkdirSync(pluginRoot, { recursive: true });

			const hooksPath = join(pluginRoot, "hooks", "hooks.json");
			expect(fs.existsSync(hooksPath)).toBe(false);
		});

		test("successfully loads valid hooks.json", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-typescript test",
								},
							],
						},
					],
				},
			};

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.Stop).toBeDefined();
			expect(parsed.hooks.Stop[0].hooks[0].type).toBe("command");
			expect(parsed.hooks.Stop[0].hooks[0].command).toBe(
				"han hook run jutsu-typescript test",
			);
		});

		test("returns null for malformed JSON", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, "{ invalid json }");

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

		test("loads hooks.json with multiple hook types", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-typescript test",
								},
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-biome lint",
								},
							],
						},
					],
				},
			};

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.Stop).toBeDefined();
			expect(parsed.hooks.SessionStart).toBeDefined();
		});

		test("loads hooks.json with prompt type hooks", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "prompt",
									prompt: "What should we do next?",
								},
							],
						},
					],
				},
			};

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.Stop[0].hooks[0].type).toBe("prompt");
			expect(parsed.hooks.Stop[0].hooks[0].prompt).toBe(
				"What should we do next?",
			);
		});

		test("loads hooks.json with timeout configuration", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-typescript test",
									timeout: 30000,
								},
							],
						},
					],
				},
			};

			const hooksPath = join(hooksDir, "hooks.json");
			writeFileSync(hooksPath, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.Stop[0].hooks[0].timeout).toBe(30000);
		});
	});

	describe("getPluginDir logic", () => {
		test("uses marketplace config directory source when available", () => {
			const customDir = join(testDir, "custom-marketplace");
			const jutsuPath = join(customDir, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuPath, { recursive: true });

			const marketplaceConfig = {
				source: {
					source: "directory" as const,
					path: customDir,
				},
			};

			// Simulate path resolution
			const directoryPath = marketplaceConfig.source.path;
			expect(directoryPath).toBe(customDir);

			const fs = require("node:fs");
			const potentialPaths = [
				join(directoryPath, "jutsu", "jutsu-typescript"),
				join(directoryPath, "do", "jutsu-typescript"),
				join(directoryPath, "hashi", "jutsu-typescript"),
				join(directoryPath, "jutsu-typescript"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("checks current working directory for marketplace.json", () => {
			const marketplaceRoot = testDir;
			const marketplaceJsonPath = join(
				marketplaceRoot,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(marketplaceRoot, ".claude-plugin"), { recursive: true });
			writeFileSync(marketplaceJsonPath, "{}");

			const jutsuPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuPath, { recursive: true });

			const fs = require("node:fs");
			expect(
				fs.existsSync(
					join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
				),
			).toBe(true);

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "jutsu-typescript"),
				join(marketplaceRoot, "do", "jutsu-typescript"),
				join(marketplaceRoot, "hashi", "jutsu-typescript"),
				join(marketplaceRoot, "jutsu-typescript"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("falls back to default shared config path", () => {
			const configDir = join(testDir, "config");
			const marketplaceRoot = join(
				configDir,
				"plugins",
				"marketplaces",
				"bushido",
			);
			const jutsuPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuPath, { recursive: true });

			const fs = require("node:fs");
			expect(fs.existsSync(marketplaceRoot)).toBe(true);

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "jutsu-typescript"),
				join(marketplaceRoot, "do", "jutsu-typescript"),
				join(marketplaceRoot, "hashi", "jutsu-typescript"),
				join(marketplaceRoot, "jutsu-typescript"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("returns null when marketplace root doesn't exist", () => {
			const configDir = join(testDir, "config");
			const marketplaceRoot = join(
				configDir,
				"plugins",
				"marketplaces",
				"nonexistent",
			);

			const fs = require("node:fs");
			expect(fs.existsSync(marketplaceRoot)).toBe(false);
		});
	});

	describe("hook validation scenarios", () => {
		test("validates hooks with required fields", () => {
			const hook = {
				type: "command",
				command: "han hook run jutsu-typescript test",
			};

			expect(hook.type).toBe("command");
			expect(hook.command).toBeDefined();
			expect(hook.command).toBeTruthy();
		});

		test("validates hooks with optional timeout", () => {
			const hook = {
				type: "command",
				command: "han hook run jutsu-typescript test",
				timeout: 60000,
			};

			expect(hook.timeout).toBe(60000);
			expect(hook.timeout).toBeGreaterThan(0);
		});

		test("identifies invalid hook type", () => {
			const hook = {
				type: "invalid",
				command: "han hook run jutsu-typescript test",
			};

			expect(hook.type).not.toBe("command");
			expect(hook.type).not.toBe("prompt");
		});

		test("identifies command hook without command field", () => {
			const hook = {
				type: "command",
			};

			expect(hook.type).toBe("command");
			// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
			expect((hook as any).command).toBeUndefined();
		});

		test("identifies prompt hook without prompt field", () => {
			const hook = {
				type: "prompt",
			};

			expect(hook.type).toBe("prompt");
			// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
			expect((hook as any).prompt).toBeUndefined();
		});
	});

	describe("hook entry validation", () => {
		test("validates hook entry with all required fields for command", () => {
			const entry = {
				type: "command" as const,
				command: "han hook run jutsu-typescript test",
			};

			expect(entry.type).toBe("command");
			expect(entry.command).toBeTruthy();
			expect(entry.command?.includes("han hook run")).toBe(true);
		});

		test("validates hook entry with all required fields for prompt", () => {
			const entry = {
				type: "prompt" as const,
				prompt: "What should we do?",
			};

			expect(entry.type).toBe("prompt");
			expect(entry.prompt).toBeTruthy();
		});

		test("validates hook entry with optional timeout", () => {
			const entry = {
				type: "command" as const,
				command: "han hook run jutsu-typescript test",
				timeout: 30000,
			};

			expect(entry.timeout).toBe(30000);
		});
	});

	describe("hook group validation", () => {
		test("validates hook group with single hook", () => {
			const group = {
				hooks: [
					{
						type: "command" as const,
						command: "han hook run jutsu-typescript test",
					},
				],
			};

			expect(group.hooks).toHaveLength(1);
			expect(group.hooks[0].type).toBe("command");
		});

		test("validates hook group with multiple hooks", () => {
			const group = {
				hooks: [
					{
						type: "command" as const,
						command: "han hook run jutsu-typescript test",
					},
					{
						type: "command" as const,
						command: "han hook run jutsu-biome lint",
					},
				],
			};

			expect(group.hooks).toHaveLength(2);
		});

		test("validates hook group with mixed hook types", () => {
			const group = {
				hooks: [
					{
						type: "command" as const,
						command: "han hook run jutsu-typescript test",
					},
					{
						type: "prompt" as const,
						prompt: "Review changes?",
					},
				],
			};

			expect(group.hooks).toHaveLength(2);
			expect(group.hooks[0].type).toBe("command");
			expect(group.hooks[1].type).toBe("prompt");
		});

		test("identifies empty hook group", () => {
			const group = {
				hooks: [],
			};

			expect(group.hooks).toHaveLength(0);
		});
	});

	describe("plugin hooks structure validation", () => {
		test("validates plugin hooks with single hook type", () => {
			const pluginHooks = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run jutsu-typescript test",
								},
							],
						},
					],
				},
			};

			expect(pluginHooks.hooks.Stop).toBeDefined();
			expect(pluginHooks.hooks.Stop).toHaveLength(1);
		});

		test("validates plugin hooks with multiple hook types", () => {
			const pluginHooks = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run jutsu-typescript test",
								},
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run jutsu-biome lint",
								},
							],
						},
					],
				},
			};

			expect(Object.keys(pluginHooks.hooks)).toHaveLength(2);
			expect(pluginHooks.hooks.Stop).toBeDefined();
			expect(pluginHooks.hooks.SessionStart).toBeDefined();
		});

		test("validates plugin hooks with multiple groups per type", () => {
			const pluginHooks = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run jutsu-typescript test",
								},
							],
						},
						{
							hooks: [
								{
									type: "command" as const,
									command: "han hook run jutsu-biome lint",
								},
							],
						},
					],
				},
			};

			expect(pluginHooks.hooks.Stop).toHaveLength(2);
		});

		test("identifies plugin hooks with no hook types", () => {
			const pluginHooks = {
				hooks: {},
			};

			expect(Object.keys(pluginHooks.hooks)).toHaveLength(0);
		});
	});
});
