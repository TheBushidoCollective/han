/**
 * Tests for exported helper functions in commands/hook/verify.ts
 */
import { describe, expect, test } from "bun:test";

import { parseHookCommand } from "../lib/commands/hook/verify.ts";

describe("hook/verify.ts helper functions", () => {
	describe("parseHookCommand", () => {
		test("parses basic hook command", () => {
			const result = parseHookCommand("han hook run jutsu-typescript test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("test");
		});

		test("parses hook command with flags", () => {
			const result = parseHookCommand(
				"han hook run jutsu-biome lint --fail-fast --cached",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-biome");
			expect(result?.hookName).toBe("lint");
		});

		test("parses hook command with extra whitespace", () => {
			const result = parseHookCommand("han  hook  run  jutsu-bun  test");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-bun");
			expect(result?.hookName).toBe("test");
		});

		test("returns null for non-han commands", () => {
			const result = parseHookCommand("npm run test");
			expect(result).toBeNull();
		});

		test("returns null for incomplete han commands", () => {
			const result = parseHookCommand("han hook run");
			expect(result).toBeNull();
		});

		test("returns null for han hook dispatch", () => {
			const result = parseHookCommand("han hook dispatch Stop");
			expect(result).toBeNull();
		});

		test("returns null for empty string", () => {
			const result = parseHookCommand("");
			expect(result).toBeNull();
		});

		test("parses command with hashi prefix plugin", () => {
			const result = parseHookCommand("han hook run hashi-github validate");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("hashi-github");
			expect(result?.hookName).toBe("validate");
		});

		test("parses command with do prefix plugin", () => {
			const result = parseHookCommand("han hook run do-accessibility check");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("do-accessibility");
			expect(result?.hookName).toBe("check");
		});

		test("parses command with core plugin", () => {
			const result = parseHookCommand("han hook run core validate");
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("core");
			expect(result?.hookName).toBe("validate");
		});

		test("handles command with only path", () => {
			const result = parseHookCommand("han hook run jutsu-typescript");
			expect(result).toBeNull();
		});

		test("handles other subcommands", () => {
			const result = parseHookCommand("han plugin install jutsu-typescript");
			expect(result).toBeNull();
		});

		test("parses command with verbose flag", () => {
			const result = parseHookCommand(
				"han hook run jutsu-typescript typecheck --verbose",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-typescript");
			expect(result?.hookName).toBe("typecheck");
		});

		test("parses command with directory flag", () => {
			const result = parseHookCommand(
				"han hook run jutsu-biome lint --only=packages/core",
			);
			expect(result).not.toBeNull();
			expect(result?.pluginName).toBe("jutsu-biome");
			expect(result?.hookName).toBe("lint");
		});
	});
});
