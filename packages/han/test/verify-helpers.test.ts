/**
 * Tests for exported helper functions in commands/hook/verify.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import { parseHookCommand } from "../lib/commands/hook/verify.ts";

describe("commands/hook/verify.ts helper functions", () => {
	describe("parseHookCommand", () => {
		test("parses basic hook command", () => {
			const result = parseHookCommand("han hook run jutsu-typescript test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("parses hook command with flags", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript typecheck --fail-fast --cached",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("typecheck");
		});

		test("parses hook command with only flag", () => {
			const result = parseHookCommand(
				"han hook run jutsu-bun test --only=packages/core",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("parses hook command with different plugin names", () => {
			const cases = [
				{
					cmd: "han hook run jutsu-biome lint",
					plugin: "jutsu-biome",
					hook: "lint",
				},
				{
					cmd: "han hook run do-testing validate",
					plugin: "do-testing",
					hook: "validate",
				},
				{
					cmd: "han hook run hashi-github create-pr",
					plugin: "hashi-github",
					hook: "create-pr",
				},
				{ cmd: "han hook run core build", plugin: "core", hook: "build" },
			];

			for (const { cmd, plugin, hook } of cases) {
				const result = parseHookCommand(cmd);
				expect(result).not.toBeNull();
				expect(result?.pluginName).toBe(plugin);
				expect(result?.hookName).toBe(hook);
			}
		});

		test("handles extra whitespace", () => {
			const result = parseHookCommand("han  hook  run  jutsu-typescript  test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("returns null for invalid commands", () => {
			expect(parseHookCommand("")).toBeNull();
			expect(parseHookCommand("han")).toBeNull();
			expect(parseHookCommand("han hook")).toBeNull();
			expect(parseHookCommand("han hook run")).toBeNull();
			expect(parseHookCommand("han hook run jutsu-typescript")).toBeNull();
		});

		test("returns null for non-han commands", () => {
			expect(parseHookCommand("npm run test")).toBeNull();
			expect(parseHookCommand("bun test")).toBeNull();
			expect(parseHookCommand("node script.js")).toBeNull();
		});

		test("returns null for other han subcommands", () => {
			expect(
				parseHookCommand("han plugin install jutsu-typescript"),
			).toBeNull();
			expect(parseHookCommand("han plugin list")).toBeNull();
			expect(parseHookCommand("han explain")).toBeNull();
		});

		test("parses hook names with hyphens", () => {
			const result = parseHookCommand(
				"han hook run jutsu-git-storytelling check-commits",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-git-storytelling");
			expect(result?.hookName).toBe("check-commits");
		});

		test("parses hook command with verbose flag", () => {
			const result = parseHookCommand("han hook run jutsu-bun test --verbose");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("parses hook command with multiple flags", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript typecheck --cached --verbose --only=src",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("typecheck");
		});
	});
});
