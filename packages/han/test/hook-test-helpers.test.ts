/**
 * Tests for exported helper functions in hook-test.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import { makeLiveOutputKey } from "../lib/hook-test.ts";

describe("hook-test.ts helper functions", () => {
	describe("makeLiveOutputKey", () => {
		test("creates key from hook type, plugin, and command", () => {
			const result = makeLiveOutputKey("SessionStart", "jutsu-typescript", "npx tsc");
			expect(result).toBe("SessionStart:jutsu-typescript:npx tsc");
		});

		test("handles hook type with all caps", () => {
			const result = makeLiveOutputKey("UserPromptSubmit", "core", "cat file.md");
			expect(result).toBe("UserPromptSubmit:core:cat file.md");
		});

		test("handles complex command strings", () => {
			const result = makeLiveOutputKey(
				"Stop",
				"jutsu-biome",
				"npx biome check --write --error-on-warnings",
			);
			expect(result).toBe(
				"Stop:jutsu-biome:npx biome check --write --error-on-warnings",
			);
		});

		test("handles plugin names with hyphens", () => {
			const result = makeLiveOutputKey(
				"PreToolUse",
				"jutsu-git-storytelling",
				"./check.sh",
			);
			expect(result).toBe("PreToolUse:jutsu-git-storytelling:./check.sh");
		});

		test("handles empty strings", () => {
			const result = makeLiveOutputKey("", "", "");
			expect(result).toBe("::");
		});

		test("handles commands with colons", () => {
			// Colons in command shouldn't break parsing because we know the format
			const result = makeLiveOutputKey(
				"Notification",
				"hashi-mcp",
				"echo 'time: now'",
			);
			expect(result).toBe("Notification:hashi-mcp:echo 'time: now'");
		});

		test("handles commands with newlines", () => {
			const result = makeLiveOutputKey(
				"SessionEnd",
				"core",
				"echo 'line1\nline2'",
			);
			expect(result).toBe("SessionEnd:core:echo 'line1\nline2'");
		});

		test("creates unique keys for different inputs", () => {
			const key1 = makeLiveOutputKey("Stop", "plugin-a", "cmd1");
			const key2 = makeLiveOutputKey("Stop", "plugin-a", "cmd2");
			const key3 = makeLiveOutputKey("Stop", "plugin-b", "cmd1");
			const key4 = makeLiveOutputKey("Start", "plugin-a", "cmd1");

			expect(new Set([key1, key2, key3, key4]).size).toBe(4);
		});
	});
});
