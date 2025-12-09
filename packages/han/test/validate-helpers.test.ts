/**
 * Tests for exported helper functions in validate.ts
 * These are pure functions that can be tested without side effects
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	buildHookCommand,
	generateOutputFilename,
	getAbsoluteEnvFilePath,
	getCacheKeyForDirectory,
	getHanTempDir,
	isDebugMode,
	wrapCommandWithEnvFile,
	writeDebugFile,
	writeOutputFile,
} from "../lib/validate.ts";

describe("validate.ts helper functions", () => {
	describe("isDebugMode", () => {
		const originalDebug = process.env.HAN_DEBUG;

		afterEach(() => {
			if (originalDebug) {
				process.env.HAN_DEBUG = originalDebug;
			} else {
				delete process.env.HAN_DEBUG;
			}
		});

		test("returns false when HAN_DEBUG is not set", () => {
			delete process.env.HAN_DEBUG;
			expect(isDebugMode()).toBe(false);
		});

		test("returns true when HAN_DEBUG is '1'", () => {
			process.env.HAN_DEBUG = "1";
			expect(isDebugMode()).toBe(true);
		});

		test("returns true when HAN_DEBUG is 'true'", () => {
			process.env.HAN_DEBUG = "true";
			expect(isDebugMode()).toBe(true);
		});

		test("returns false when HAN_DEBUG is '0'", () => {
			process.env.HAN_DEBUG = "0";
			expect(isDebugMode()).toBe(false);
		});

		test("returns false when HAN_DEBUG is 'false'", () => {
			process.env.HAN_DEBUG = "false";
			expect(isDebugMode()).toBe(false);
		});

		test("returns false when HAN_DEBUG is empty string", () => {
			process.env.HAN_DEBUG = "";
			expect(isDebugMode()).toBe(false);
		});
	});

	describe("getHanTempDir", () => {
		test("returns path in system temp directory", () => {
			const result = getHanTempDir();
			expect(result).toContain(tmpdir());
			expect(result).toContain("han-hook-output");
		});

		test("creates the directory if it doesn't exist", () => {
			const result = getHanTempDir();
			expect(existsSync(result)).toBe(true);
		});

		test("returns consistent path on multiple calls", () => {
			const result1 = getHanTempDir();
			const result2 = getHanTempDir();
			expect(result1).toBe(result2);
		});
	});

	describe("generateOutputFilename", () => {
		test("includes hook name in filename", () => {
			const result = generateOutputFilename("lint", "/src/project");
			expect(result).toContain("lint");
		});

		test("includes sanitized directory in filename", () => {
			const result = generateOutputFilename("test", "/src/project");
			expect(result).toMatch(/test_.*_\d+/);
		});

		test("sanitizes special characters in directory", () => {
			const result = generateOutputFilename("build", "/path/to/my-project");
			expect(result).not.toContain("/");
			expect(result).not.toContain("-");
		});

		test("includes timestamp in filename", () => {
			const before = Date.now();
			const result = generateOutputFilename("compile", "/project");
			const after = Date.now();

			// Extract timestamp from filename
			const match = result.match(/_(\d+)$/);
			expect(match).not.toBeNull();
			const timestamp = Number.parseInt(match![1], 10);
			expect(timestamp).toBeGreaterThanOrEqual(before);
			expect(timestamp).toBeLessThanOrEqual(after);
		});

		test("handles long directory paths", () => {
			const longPath = "/very/long/path/that/goes/on/and/on/forever/project";
			const result = generateOutputFilename("test", longPath);
			// Should truncate to last 30 chars
			expect(result.length).toBeLessThan(100);
		});
	});

	describe("getAbsoluteEnvFilePath", () => {
		const originalEnvFile = process.env.CLAUDE_ENV_FILE;
		const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
		const originalCwd = process.cwd;

		afterEach(() => {
			if (originalEnvFile) {
				process.env.CLAUDE_ENV_FILE = originalEnvFile;
			} else {
				delete process.env.CLAUDE_ENV_FILE;
			}
			if (originalProjectDir) {
				process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
			} else {
				delete process.env.CLAUDE_PROJECT_DIR;
			}
			process.cwd = originalCwd;
		});

		test("returns null when CLAUDE_ENV_FILE is not set", () => {
			delete process.env.CLAUDE_ENV_FILE;
			expect(getAbsoluteEnvFilePath()).toBeNull();
		});

		test("returns absolute path unchanged", () => {
			process.env.CLAUDE_ENV_FILE = "/absolute/path/to/.env";
			expect(getAbsoluteEnvFilePath()).toBe("/absolute/path/to/.env");
		});

		test("resolves relative path against CLAUDE_PROJECT_DIR", () => {
			process.env.CLAUDE_ENV_FILE = ".env";
			process.env.CLAUDE_PROJECT_DIR = "/my/project";
			expect(getAbsoluteEnvFilePath()).toBe("/my/project/.env");
		});

		test("resolves relative path against cwd when PROJECT_DIR not set", () => {
			process.env.CLAUDE_ENV_FILE = "env/local.env";
			delete process.env.CLAUDE_PROJECT_DIR;
			process.cwd = () => "/current/working/dir";
			expect(getAbsoluteEnvFilePath()).toBe("/current/working/dir/env/local.env");
		});

		test("handles nested relative paths", () => {
			process.env.CLAUDE_ENV_FILE = "config/.env.local";
			process.env.CLAUDE_PROJECT_DIR = "/project";
			expect(getAbsoluteEnvFilePath()).toBe("/project/config/.env.local");
		});
	});

	describe("wrapCommandWithEnvFile", () => {
		const originalEnvFile = process.env.CLAUDE_ENV_FILE;
		const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;

		afterEach(() => {
			if (originalEnvFile) {
				process.env.CLAUDE_ENV_FILE = originalEnvFile;
			} else {
				delete process.env.CLAUDE_ENV_FILE;
			}
			if (originalProjectDir) {
				process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
			} else {
				delete process.env.CLAUDE_PROJECT_DIR;
			}
		});

		test("wraps with source when CLAUDE_ENV_FILE is set", () => {
			process.env.CLAUDE_ENV_FILE = "/path/to/.env";
			const result = wrapCommandWithEnvFile("npm test");
			expect(result).toContain("source");
			expect(result).toContain("/path/to/.env");
			expect(result).toContain("npm test");
		});

		test("wraps with login shell when CLAUDE_ENV_FILE is not set", () => {
			delete process.env.CLAUDE_ENV_FILE;
			const result = wrapCommandWithEnvFile("npm test");
			expect(result).toContain("/bin/bash -l -c");
			expect(result).toContain("npm test");
		});

		test("properly quotes command in login shell wrapper", () => {
			delete process.env.CLAUDE_ENV_FILE;
			const result = wrapCommandWithEnvFile('echo "hello world"');
			expect(result).toContain("/bin/bash -l -c");
			// Should be properly quoted/escaped
			expect(result).toMatch(/echo.*hello.*world/);
		});

		test("sources env file before command", () => {
			process.env.CLAUDE_ENV_FILE = "/env/file";
			const result = wrapCommandWithEnvFile("my-command");
			// Source should come before the command
			const sourceIndex = result.indexOf("source");
			const commandIndex = result.indexOf("my-command");
			expect(sourceIndex).toBeLessThan(commandIndex);
		});
	});

	describe("writeDebugFile", () => {
		let testDir: string;

		beforeEach(() => {
			const random = Math.random().toString(36).substring(2, 9);
			testDir = join(tmpdir(), `han-validate-test-${Date.now()}-${random}`);
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			if (testDir && existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		test("creates debug file with .debug.txt extension", () => {
			const basePath = join(testDir, "output");
			const result = writeDebugFile(basePath, {});
			expect(result).toBe(`${basePath}.debug.txt`);
			expect(existsSync(result)).toBe(true);
		});

		test("includes header and timestamp", () => {
			const basePath = join(testDir, "output");
			writeDebugFile(basePath, {});
			const content = readFileSync(`${basePath}.debug.txt`, "utf-8");
			expect(content).toContain("=== Han Hook Debug Info ===");
			expect(content).toContain("Timestamp:");
		});

		test("includes environment info", () => {
			const basePath = join(testDir, "output");
			writeDebugFile(basePath, {});
			const content = readFileSync(`${basePath}.debug.txt`, "utf-8");
			expect(content).toContain("NODE_VERSION:");
			expect(content).toContain("PLATFORM:");
			expect(content).toContain("CWD:");
		});

		test("includes custom info", () => {
			const basePath = join(testDir, "output");
			writeDebugFile(basePath, {
				hookName: "test",
				pluginName: "jutsu-bun",
				directory: "/project",
			});
			const content = readFileSync(`${basePath}.debug.txt`, "utf-8");
			expect(content).toContain("hookName");
			expect(content).toContain("test");
			expect(content).toContain("pluginName");
			expect(content).toContain("jutsu-bun");
		});
	});

	describe("writeOutputFile", () => {
		let testDir: string;

		beforeEach(() => {
			const random = Math.random().toString(36).substring(2, 9);
			testDir = join(tmpdir(), `han-validate-output-test-${Date.now()}-${random}`);
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			if (testDir && existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		test("creates output file with .output.txt extension", () => {
			const basePath = join(testDir, "output");
			const result = writeOutputFile(basePath, "test output");
			expect(result).toBe(`${basePath}.output.txt`);
			expect(existsSync(result)).toBe(true);
		});

		test("writes content to file", () => {
			const basePath = join(testDir, "output");
			writeOutputFile(basePath, "hello world\nline 2");
			const content = readFileSync(`${basePath}.output.txt`, "utf-8");
			expect(content).toBe("hello world\nline 2");
		});

		test("handles empty output", () => {
			const basePath = join(testDir, "empty");
			writeOutputFile(basePath, "");
			const content = readFileSync(`${basePath}.output.txt`, "utf-8");
			expect(content).toBe("");
		});

		test("handles large output", () => {
			const basePath = join(testDir, "large");
			const largeOutput = "x".repeat(100000);
			writeOutputFile(basePath, largeOutput);
			const content = readFileSync(`${basePath}.output.txt`, "utf-8");
			expect(content.length).toBe(100000);
		});
	});

	describe("getCacheKeyForDirectory", () => {
		test("creates cache key from hook name and directory", () => {
			const result = getCacheKeyForDirectory(
				"lint",
				"/project/src/components",
				"/project",
			);
			expect(result).toBe("lint_src_components");
		});

		test("handles root directory", () => {
			const result = getCacheKeyForDirectory("test", "/project", "/project");
			expect(result).toBe("test_root");
		});

		test("handles nested directory path", () => {
			const result = getCacheKeyForDirectory(
				"build",
				"/home/user/project/packages/core/lib",
				"/home/user/project",
			);
			expect(result).toBe("build_packages_core_lib");
		});

		test("handles single level subdirectory", () => {
			const result = getCacheKeyForDirectory("typecheck", "/project/src", "/project");
			expect(result).toBe("typecheck_src");
		});

		test("handles deeply nested paths", () => {
			const result = getCacheKeyForDirectory(
				"validate",
				"/root/a/b/c/d/e",
				"/root",
			);
			expect(result).toBe("validate_a_b_c_d_e");
		});

		test("strips leading slash from relative path", () => {
			const result = getCacheKeyForDirectory(
				"format",
				"/workspace/modules",
				"/workspace",
			);
			// Should not have double underscores or leading underscore
			expect(result).toBe("format_modules");
			expect(result).not.toContain("__");
		});
	});

	describe("buildHookCommand", () => {
		test("builds basic command without options", () => {
			const result = buildHookCommand("jutsu-typescript", "typecheck", {});
			expect(result).toBe("han hook run jutsu-typescript typecheck");
		});

		test("adds --cached flag when cached is true", () => {
			const result = buildHookCommand("jutsu-biome", "lint", { cached: true });
			expect(result).toBe("han hook run jutsu-biome lint --cached");
		});

		test("adds --only flag when only is specified", () => {
			const result = buildHookCommand("jutsu-bun", "test", {
				only: "packages/core",
			});
			expect(result).toBe("han hook run jutsu-bun test --only=packages/core");
		});

		test("combines --cached and --only flags", () => {
			const result = buildHookCommand("jutsu-typescript", "typecheck", {
				cached: true,
				only: "src",
			});
			expect(result).toBe(
				"han hook run jutsu-typescript typecheck --cached --only=src",
			);
		});

		test("does not add flags when options are false/undefined", () => {
			const result = buildHookCommand("do-testing", "validate", {
				cached: false,
				only: undefined,
			});
			expect(result).toBe("han hook run do-testing validate");
			expect(result).not.toContain("--cached");
			expect(result).not.toContain("--only");
		});

		test("handles plugin names with hyphens", () => {
			const result = buildHookCommand(
				"jutsu-git-storytelling",
				"check-commits",
				{},
			);
			expect(result).toBe(
				"han hook run jutsu-git-storytelling check-commits",
			);
		});

		test("handles hook names with hyphens", () => {
			const result = buildHookCommand("hashi-github", "create-pr", {
				cached: true,
			});
			expect(result).toBe("han hook run hashi-github create-pr --cached");
		});
	});
});
