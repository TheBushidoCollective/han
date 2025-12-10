/**
 * Tests for exported helper functions in commands/hook/dispatch.ts
 * These are pure functions that can be tested without side effects
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	deriveHookName,
	resolveToAbsolute,
} from "../lib/commands/hook/dispatch.ts";

describe("commands/hook/dispatch.ts helper functions", () => {
	describe("resolveToAbsolute", () => {
		const originalCwd = process.cwd;

		beforeEach(() => {
			process.cwd = () => "/home/user/project";
		});

		afterEach(() => {
			process.cwd = originalCwd;
		});

		test("returns absolute path unchanged", () => {
			expect(resolveToAbsolute("/absolute/path")).toBe("/absolute/path");
		});

		test("resolves relative path against cwd", () => {
			expect(resolveToAbsolute("relative/path")).toBe(
				"/home/user/project/relative/path",
			);
		});

		test("handles single file name", () => {
			expect(resolveToAbsolute("file.txt")).toBe("/home/user/project/file.txt");
		});

		test("handles dot-prefixed relative paths", () => {
			expect(resolveToAbsolute("./src/index.ts")).toBe(
				"/home/user/project/src/index.ts",
			);
		});

		test("handles parent directory references", () => {
			// join normalizes paths, resolving .. relative to the cwd
			expect(resolveToAbsolute("../other/file.ts")).toBe(
				"/home/user/other/file.ts",
			);
		});
	});

	describe("deriveHookName", () => {
		test("extracts hook name from markdown file path", () => {
			expect(deriveHookName("cat hooks/metrics-tracking.md", "jutsu-bun")).toBe(
				"metrics-tracking",
			);
		});

		test("extracts hook name from han hook reference command", () => {
			expect(
				deriveHookName(
					"npx han hook reference hooks/professional-honesty.md",
					"core",
				),
			).toBe("professional-honesty");
		});

		test("extracts hook name from shell script path", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal ${} in hook paths
			const hookPath = "${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh";
			expect(deriveHookName(hookPath, "jutsu-git")).toBe("pre-push-check");
		});

		test("extracts hook name from complex command with markdown", () => {
			expect(
				deriveHookName(
					"han hook reference hooks/tdd-workflow.md --must-read-first 'TDD required'",
					"jutsu-tdd",
				),
			).toBe("tdd-workflow");
		});

		test("extracts hook name from shell script with arguments", () => {
			expect(deriveHookName("hooks/validate-config.sh --verbose", "core")).toBe(
				"validate-config",
			);
		});

		test("falls back to plugin name when no hook file pattern found", () => {
			expect(deriveHookName("echo hello", "my-plugin")).toBe("my-plugin");
		});

		test("falls back to plugin name for npm commands", () => {
			expect(deriveHookName("npm run test", "jutsu-npm")).toBe("jutsu-npm");
		});

		test("falls back to plugin name for complex shell commands", () => {
			expect(
				deriveHookName(
					"if [ -f package.json ]; then npm test; fi",
					"jutsu-test",
				),
			).toBe("jutsu-test");
		});

		test("handles hyphenated hook names", () => {
			expect(
				deriveHookName("cat hooks/my-complex-hook-name.md", "plugin"),
			).toBe("my-complex-hook-name");
		});

		test("handles numeric characters in hook names", () => {
			expect(deriveHookName("cat hooks/hook-v2-config.md", "plugin")).toBe(
				"hook-v2-config",
			);
		});
	});
});
