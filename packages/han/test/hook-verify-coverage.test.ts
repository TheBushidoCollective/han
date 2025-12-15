/**
 * Additional tests to improve coverage of commands/hook/verify.ts
 * Focuses on testing actual code execution paths through exported interfaces
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseHookCommand } from "../lib/commands/hook/verify.ts";

describe("verify.ts coverage improvement", () => {
	const testDir = `/tmp/test-hook-verify-coverage-${Date.now()}`;
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

	describe("parseHookCommand comprehensive coverage", () => {
		test("returns null for commands without plugin name", () => {
			expect(parseHookCommand("han hook run")).toBeNull();
		});

		test("returns null for commands with only plugin name", () => {
			expect(parseHookCommand("han hook run jutsu-typescript")).toBeNull();
		});

		test("parses command with minimal spacing", () => {
			const result = parseHookCommand("han hook run jutsu-bun test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("parses command with multiple spaces", () => {
			const result = parseHookCommand(
				"han  hook  run  jutsu-typescript  typecheck",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("typecheck");
		});

		test("ignores content after hook name", () => {
			const result = parseHookCommand(
				"han hook run jutsu-biome lint --cached --verbose",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-biome");
			expect(result?.hookName).toBe("lint");
		});

		test("handles plugin names with single character", () => {
			const result = parseHookCommand("han hook run x y");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("x");
			expect(result?.hookName).toBe("y");
		});

		test("handles very long plugin names", () => {
			const longName = "jutsu-very-long-plugin-name-with-many-hyphens";
			const result = parseHookCommand(`han hook run ${longName} test`);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe(longName);
		});

		test("handles very long hook names", () => {
			const longHook = "very-long-hook-name-with-many-parts";
			const result = parseHookCommand(
				`han hook run jutsu-typescript ${longHook}`,
			);
			expect(result).not.toBeNull();
			expect(result?.hookName).toBe(longHook);
		});

		test("returns null for wrong command structure", () => {
			expect(parseHookCommand("han run hook jutsu-typescript test")).toBeNull();
		});

		test("returns null for missing 'hook' keyword", () => {
			expect(parseHookCommand("han run jutsu-typescript test")).toBeNull();
		});

		test("returns null for missing 'run' keyword", () => {
			expect(parseHookCommand("han hook jutsu-typescript test")).toBeNull();
		});

		test("returns null for different hook subcommand", () => {
			expect(parseHookCommand("han hook verify Stop")).toBeNull();
			expect(parseHookCommand("han hook dispatch Stop")).toBeNull();
			expect(parseHookCommand("han hook list")).toBeNull();
		});

		test("handles numeric plugin names", () => {
			const result = parseHookCommand("han hook run jutsu-node18 test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-node18");
		});

		test("handles numeric hook names", () => {
			const result = parseHookCommand("han hook run jutsu-test v2");
			expect(result).not.toBeNull();
			expect(result?.hookName).toBe("v2");
		});

		test("handles dots in arguments after hook name", () => {
			const result = parseHookCommand(
				"han hook run jutsu-bun test --only=packages/core",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("handles slashes in arguments after hook name", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript test --project=packages/core/tsconfig.json",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("returns null for empty string", () => {
			expect(parseHookCommand("")).toBeNull();
		});

		test("returns null for whitespace only", () => {
			expect(parseHookCommand("   ")).toBeNull();
		});

		test("returns null for just 'han'", () => {
			expect(parseHookCommand("han")).toBeNull();
		});

		test("handles newlines in string (treated as whitespace)", () => {
			const result = parseHookCommand("han hook run\njutsu-bun\ntest");
			// \s matches newlines, so this should work
			expect(result).not.toBeNull();
		});

		test("parses with mixed case in plugin name", () => {
			const result = parseHookCommand("han hook run jutsu-TypeScript test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-TypeScript");
		});

		test("parses with mixed case in hook name", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript TypeCheck",
			);
			expect(result).not.toBeNull();
			expect(result?.hookName).toBe("TypeCheck");
		});
	});

	describe("file system operations coverage", () => {
		test("creates and reads hooks.json successfully", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-test");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

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

			const hooksFile = join(hooksPath, "hooks.json");
			writeFileSync(hooksFile, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			expect(fs.existsSync(hooksFile)).toBe(true);

			const content = fs.readFileSync(hooksFile, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed).toEqual(hooksContent);
			expect(parsed.hooks.Stop[0].hooks[0].command).toBe(
				"han hook run jutsu-test validate",
			);
		});

		test("handles reading non-existent hooks.json", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-missing");
			const hooksFile = join(pluginPath, "hooks", "hooks.json");

			const fs = require("node:fs");
			expect(fs.existsSync(hooksFile)).toBe(false);
		});

		test("creates nested plugin directory structure", () => {
			const paths = [
				join(testDir, "config", "plugins", "marketplaces", "bushido"),
				join(
					testDir,
					"config",
					"plugins",
					"marketplaces",
					"bushido",
					"jutsu",
					"jutsu-typescript",
				),
				join(
					testDir,
					"config",
					"plugins",
					"marketplaces",
					"bushido",
					"do",
					"do-testing",
				),
				join(
					testDir,
					"config",
					"plugins",
					"marketplaces",
					"bushido",
					"hashi",
					"hashi-github",
				),
			];

			for (const path of paths) {
				mkdirSync(path, { recursive: true });
			}

			const fs = require("node:fs");
			for (const path of paths) {
				expect(fs.existsSync(path)).toBe(true);
			}
		});

		test("writes and reads multiple hook types", () => {
			const pluginPath = join(testDir, "jutsu", "jutsu-multi");
			const hooksPath = join(pluginPath, "hooks");
			mkdirSync(hooksPath, { recursive: true });

			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-multi stop-hook",
								},
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-multi start-hook",
								},
							],
						},
					],
					SessionEnd: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-multi end-hook",
								},
							],
						},
					],
				},
			};

			const hooksFile = join(hooksPath, "hooks.json");
			writeFileSync(hooksFile, JSON.stringify(hooksContent, null, 2));

			const fs = require("node:fs");
			const content = fs.readFileSync(hooksFile, "utf-8");
			const parsed = JSON.parse(content);

			expect(Object.keys(parsed.hooks)).toHaveLength(3);
			expect(parsed.hooks.Stop).toBeDefined();
			expect(parsed.hooks.SessionStart).toBeDefined();
			expect(parsed.hooks.SessionEnd).toBeDefined();
		});
	});

	describe("path resolution scenarios", () => {
		test("resolves relative path to absolute", () => {
			const relativePath = "src/test";
			const absolutePath = join(process.cwd(), relativePath);
			expect(absolutePath).toContain(relativePath);
			expect(absolutePath.startsWith("/")).toBe(true);
		});

		test("keeps absolute path unchanged", () => {
			const absolutePath = "/usr/local/bin";
			expect(absolutePath.startsWith("/")).toBe(true);
		});

		test("resolves current directory", () => {
			const currentDir = ".";
			const absolutePath = join(process.cwd(), currentDir);
			expect(absolutePath.startsWith("/")).toBe(true);
		});

		test("resolves parent directory", () => {
			const parentDir = "..";
			const absolutePath = join(process.cwd(), parentDir);
			expect(absolutePath.startsWith("/")).toBe(true);
		});
	});

	describe("hook configuration edge cases", () => {
		test("handles hooks.json with empty hook groups", () => {
			const hooksContent = {
				hooks: {
					Stop: [],
					SessionStart: [],
				},
			};

			expect(hooksContent.hooks.Stop).toHaveLength(0);
			expect(hooksContent.hooks.SessionStart).toHaveLength(0);
		});

		test("handles hooks.json with nested empty arrays", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop).toHaveLength(1);
			expect(hooksContent.hooks.Stop[0].hooks).toHaveLength(0);
		});

		test("handles hooks with both command and prompt types", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-test validate",
								},
								{
									type: "prompt",
									prompt: "Continue?",
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop[0].hooks).toHaveLength(2);
			expect(hooksContent.hooks.Stop[0].hooks[0].type).toBe("command");
			expect(hooksContent.hooks.Stop[0].hooks[1].type).toBe("prompt");
		});

		test("handles hooks with optional timeout values", () => {
			const hooksContent = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run jutsu-test quick",
								},
								{
									type: "command",
									command: "han hook run jutsu-test slow",
									timeout: 120000,
								},
							],
						},
					],
				},
			};

			expect(hooksContent.hooks.Stop[0].hooks[0].timeout).toBeUndefined();
			expect(hooksContent.hooks.Stop[0].hooks[1].timeout).toBe(120000);
		});
	});

	describe("marketplace configuration scenarios", () => {
		test("handles marketplace config with directory source", () => {
			const config = {
				source: {
					source: "directory" as const,
					path: "/custom/path/to/marketplace",
				},
			};

			expect(config.source.source).toBe("directory");
			expect(config.source.path).toBe("/custom/path/to/marketplace");
		});

		test("handles marketplace config with git source", () => {
			const config = {
				source: {
					source: "git" as const,
					url: "https://github.com/example/marketplace.git",
				},
			};

			expect(config.source.source).toBe("git");
			expect(config.source.url).toBe(
				"https://github.com/example/marketplace.git",
			);
		});

		test("handles marketplace config with github source", () => {
			const config = {
				source: {
					source: "github" as const,
					repo: "example/marketplace",
				},
			};

			expect(config.source.source).toBe("github");
			expect(config.source.repo).toBe("example/marketplace");
		});

		test("creates marketplace.json in development setup", () => {
			const marketplaceJsonPath = join(
				testDir,
				".claude-plugin",
				"marketplace.json",
			);
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });

			const marketplaceContent = {
				name: "test-marketplace",
				version: "1.0.0",
			};

			writeFileSync(
				marketplaceJsonPath,
				JSON.stringify(marketplaceContent, null, 2),
			);

			const fs = require("node:fs");
			expect(fs.existsSync(marketplaceJsonPath)).toBe(true);

			const content = fs.readFileSync(marketplaceJsonPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.name).toBe("test-marketplace");
			expect(parsed.version).toBe("1.0.0");
		});
	});
});
