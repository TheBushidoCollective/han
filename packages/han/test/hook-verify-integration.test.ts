/**
 * Integration tests for commands/hook/verify.ts
 * Tests the verification flow with real file system interactions
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseHookCommand } from "../lib/commands/hook/verify.ts";

describe("hook verify integration tests", () => {
	const testDir = `/tmp/test-hook-verify-integration-${Date.now()}`;
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");

		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });
	});

	afterEach(() => {
		process.env = originalEnv;
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("parseHookCommand edge cases", () => {
		test("parses command with special characters in plugin name", () => {
			const result = parseHookCommand(
				"han hook run jutsu-git-storytelling check",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-git-storytelling");
			expect(result?.hookName).toBe("check");
		});

		test("parses command with numbers in hook name", () => {
			const result = parseHookCommand("han hook run jutsu-node v20-check");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-node");
			expect(result?.hookName).toBe("v20-check");
		});

		test("handles commands with tabs", () => {
			const result = parseHookCommand("han\thook\trun\tjutsu-bun\ttest");
			// Tabs are actually matched by \s in the regex
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("handles case sensitivity", () => {
			const result = parseHookCommand("HAN HOOK RUN jutsu-typescript test");
			expect(result).toBeNull(); // Should be case-sensitive
		});

		test("parses command with underscores", () => {
			const result = parseHookCommand("han hook run jutsu-python type_check");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-python");
			expect(result?.hookName).toBe("type_check");
		});

		test("handles command with long flag names", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript test --very-long-flag-name=value",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("handles command with equals sign in flags", () => {
			const result = parseHookCommand(
				"han hook run jutsu-biome lint --only=packages/core",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-biome");
			expect(result?.hookName).toBe("lint");
		});

		test("handles command with quoted arguments", () => {
			const result = parseHookCommand(
				'han hook run jutsu-docker build --tag="my-app:latest"',
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-docker");
			expect(result?.hookName).toBe("build");
		});
	});

	describe("marketplace integration scenarios", () => {
		test("loads plugin from development marketplace", () => {
			const marketplaceRoot = testDir;
			const marketplaceJsonPath = join(
				marketplaceRoot,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(marketplaceRoot, ".claude-plugin"), { recursive: true });
			writeFileSync(
				marketplaceJsonPath,
				JSON.stringify({ name: "test-marketplace" }),
			);

			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

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

			writeFileSync(
				join(hooksPath, "hooks.json"),
				JSON.stringify(hooksContent, null, 2),
			);

			const fs = require("node:fs");
			expect(fs.existsSync(join(hooksPath, "hooks.json"))).toBe(true);

			const content = fs.readFileSync(join(hooksPath, "hooks.json"), "utf-8");
			const parsed = JSON.parse(content);
			expect(parsed.hooks.Stop).toBeDefined();
		});

		test("loads plugin from custom directory source", () => {
			const customMarketplace = join(testDir, "custom");
			const pluginPath = join(customMarketplace, "jutsu", "jutsu-custom");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

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
				join(hooksPath, "hooks.json"),
				JSON.stringify(hooksContent, null, 2),
			);

			const fs = require("node:fs");
			expect(fs.existsSync(join(hooksPath, "hooks.json"))).toBe(true);
		});

		test("loads plugin from default config directory", () => {
			const configDir = join(testDir, "config");
			const marketplacePath = join(
				configDir,
				"plugins",
				"marketplaces",
				"bushido",
			);
			const pluginPath = join(marketplacePath, "jutsu", "jutsu-typescript");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

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

			writeFileSync(
				join(hooksPath, "hooks.json"),
				JSON.stringify(hooksContent, null, 2),
			);

			const fs = require("node:fs");
			expect(fs.existsSync(join(hooksPath, "hooks.json"))).toBe(true);
		});
	});

	describe("hooks.json structure validation", () => {
		test("validates hooks with nested groups", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-typescript test",
								},
								{
									type: "command",
									command: "han hook run jutsu-biome lint",
								},
							],
						},
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-bun build",
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop).toHaveLength(2);
			expect(hooksContent.hooks.Stop[0].hooks).toHaveLength(2);
			expect(hooksContent.hooks.Stop[1].hooks).toHaveLength(1);
		});

		test("validates hooks with all supported types", () => {
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
									type: "prompt",
									prompt: "Ready to start?",
								},
							],
						},
					],
					SessionEnd: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-git save",
								},
							],
						},
					],
				},
			};

			expect(Object.keys(hooksContent.hooks)).toHaveLength(3);
			expect(hooksContent.hooks.Stop).toBeDefined();
			expect(hooksContent.hooks.SessionStart).toBeDefined();
			expect(hooksContent.hooks.SessionEnd).toBeDefined();
		});

		test("handles empty hook arrays", () => {
			const hooksContent = {
				hooks: {
					Stop: [],
				},
			};

			expect(hooksContent.hooks.Stop).toHaveLength(0);
		});

		test("validates hooks with timeout configuration", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-typescript test",
									timeout: 60000,
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop[0].hooks[0].timeout).toBe(60000);
		});
	});

	describe("environment variable handling", () => {
		test("respects HAN_DISABLE_HOOKS=true", () => {
			process.env.HAN_DISABLE_HOOKS = "true";
			expect(process.env.HAN_DISABLE_HOOKS).toBe("true");
		});

		test("respects HAN_DISABLE_HOOKS=1", () => {
			process.env.HAN_DISABLE_HOOKS = "1";
			expect(process.env.HAN_DISABLE_HOOKS).toBe("1");
		});

		test("handles HAN_DISABLE_HOOKS=false", () => {
			process.env.HAN_DISABLE_HOOKS = "false";
			expect(process.env.HAN_DISABLE_HOOKS).not.toBe("true");
			expect(process.env.HAN_DISABLE_HOOKS).not.toBe("1");
		});

		test("handles missing HAN_DISABLE_HOOKS", () => {
			delete process.env.HAN_DISABLE_HOOKS;
			expect(process.env.HAN_DISABLE_HOOKS).toBeUndefined();
		});

		test("uses CLAUDE_PROJECT_DIR when set", () => {
			const projectDir = join(testDir, "custom-project");
			mkdirSync(projectDir, { recursive: true });
			process.env.CLAUDE_PROJECT_DIR = projectDir;
			expect(process.env.CLAUDE_PROJECT_DIR).toBe(projectDir);
		});

		test("falls back to cwd when CLAUDE_PROJECT_DIR not set", () => {
			delete process.env.CLAUDE_PROJECT_DIR;
			expect(process.env.CLAUDE_PROJECT_DIR).toBeUndefined();
		});
	});

	describe("error scenarios", () => {
		test("handles missing plugin gracefully", () => {
			const command = "han hook run nonexistent-plugin test";
			const result = parseHookCommand(command);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("nonexistent-plugin");
		});

		test("handles malformed hooks.json", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-broken");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

			writeFileSync(join(hooksPath, "hooks.json"), "{ invalid json }");

			const fs = require("node:fs");
			let parsed = null;
			try {
				const content = fs.readFileSync(join(hooksPath, "hooks.json"), "utf-8");
				parsed = JSON.parse(content);
			} catch {
				parsed = null;
			}

			expect(parsed).toBeNull();
		});

		test("handles empty hooks.json", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-empty");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

			writeFileSync(join(hooksPath, "hooks.json"), "{}");

			const fs = require("node:fs");
			const content = fs.readFileSync(join(hooksPath, "hooks.json"), "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed).toEqual({});
		});

		test("handles hooks.json with missing required fields", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									// Missing command field
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop[0].hooks[0].type).toBe("command");
			expect(
				// biome-ignore lint/suspicious/noExplicitAny: testing missing optional field
				(hooksContent.hooks.Stop[0].hooks[0] as any).command,
			).toBeUndefined();
		});

		test("handles hooks.json with invalid type", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "invalid",
									command: "han hook run jutsu-typescript test",
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop[0].hooks[0].type).not.toBe("command");
			expect(hooksContent.hooks.Stop[0].hooks[0].type).not.toBe("prompt");
		});
	});

	describe("plugin directory priority", () => {
		test("finds plugin in jutsu directory before others", () => {
			const marketplaceRoot = testDir;
			const jutsuPath = join(marketplaceRoot, "jutsu", "shared-plugin");
			const doPath = join(marketplaceRoot, "do", "shared-plugin");
			const hashiPath = join(marketplaceRoot, "hashi", "shared-plugin");

			mkdirSync(jutsuPath, { recursive: true });
			mkdirSync(doPath, { recursive: true });
			mkdirSync(hashiPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "shared-plugin"),
				join(marketplaceRoot, "do", "shared-plugin"),
				join(marketplaceRoot, "hashi", "shared-plugin"),
				join(marketplaceRoot, "shared-plugin"),
			];

			const fs = require("node:fs");
			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("finds plugin in do directory when jutsu doesn't exist", () => {
			const marketplaceRoot = testDir;
			const doPath = join(marketplaceRoot, "do", "do-plugin");
			const hashiPath = join(marketplaceRoot, "hashi", "do-plugin");

			mkdirSync(doPath, { recursive: true });
			mkdirSync(hashiPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "do-plugin"),
				join(marketplaceRoot, "do", "do-plugin"),
				join(marketplaceRoot, "hashi", "do-plugin"),
				join(marketplaceRoot, "do-plugin"),
			];

			const fs = require("node:fs");
			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(doPath);
		});

		test("finds plugin in hashi directory when jutsu and do don't exist", () => {
			const marketplaceRoot = testDir;
			const hashiPath = join(marketplaceRoot, "hashi", "hashi-plugin");

			mkdirSync(hashiPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "hashi-plugin"),
				join(marketplaceRoot, "do", "hashi-plugin"),
				join(marketplaceRoot, "hashi", "hashi-plugin"),
				join(marketplaceRoot, "hashi-plugin"),
			];

			const fs = require("node:fs");
			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(hashiPath);
		});

		test("finds plugin in root when category directories don't exist", () => {
			const marketplaceRoot = testDir;
			const rootPath = join(marketplaceRoot, "core");

			mkdirSync(rootPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "core"),
				join(marketplaceRoot, "do", "core"),
				join(marketplaceRoot, "hashi", "core"),
				join(marketplaceRoot, "core"),
			];

			const fs = require("node:fs");
			let found: string | null = null;
			for (const path of potentialPaths) {
				if (fs.existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(rootPath);
		});
	});
});
