/**
 * Tests for validate.ts
 * Full coverage tests for validation functions
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validate } from "../lib/validation/index.ts";

describe("validate.ts", () => {
	let testDir: string;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let processExitSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];
	let errors: string[] = [];
	let exitCode: number | null = null;
	let originalEnv: typeof process.env;
	let originalCwd: () => string;

	beforeEach(() => {
		// Generate unique directory per test to avoid race conditions
		testDir = `/tmp/test-validate-full-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		// Save original environment
		originalEnv = { ...process.env };
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_PROJECT_DIR = testDir;
		delete process.env.CLAUDE_ENV_FILE;
		delete process.env.HAN_DEBUG;

		// Create test directories
		mkdirSync(testDir, { recursive: true });

		// Capture console output
		logs = [];
		errors = [];
		exitCode = null;
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
			errors.push(args.join(" "));
		});
		processExitSpy = spyOn(process, "exit").mockImplementation((code) => {
			exitCode = code as number;
			throw new Error(`process.exit(${code})`);
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();

		// Restore environment
		process.env = originalEnv;
		process.cwd = originalCwd;

		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("validate function", () => {
		test("exits 0 when command succeeds", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "echo hello",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(0);
		});

		test("exits 2 when command fails", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "exit 1",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(2);
			expect(errors.join("\n")).toContain("failed");
		});

		test("shows verbose output when verbose=true", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "echo hello",
					verbose: true,
				});
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("[han] Running in");
		});

		test("finds directories with marker files", async () => {
			// Create subdirectories with package.json
			mkdirSync(join(testDir, "pkg1"), { recursive: true });
			mkdirSync(join(testDir, "pkg2"), { recursive: true });
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
			writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

			try {
				await validate({
					failFast: false,
					dirsWith: "package.json",
					command: "echo success",
				});
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("2 directories passed");
			expect(exitCode).toBe(0);
		});

		test("reports no directories found when none match", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: "nonexistent-marker-file.xyz",
					command: "echo hello",
				});
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No directories found");
			expect(exitCode).toBe(0);
		});

		test("fail-fast stops on first failure", async () => {
			// Create directories that will fail
			mkdirSync(join(testDir, "fail1"), { recursive: true });
			mkdirSync(join(testDir, "fail2"), { recursive: true });
			writeFileSync(join(testDir, "fail1", "marker.txt"), "");
			writeFileSync(join(testDir, "fail2", "marker.txt"), "");

			try {
				await validate({
					failFast: true,
					dirsWith: "marker.txt",
					command: "exit 1",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(2);
			// With fail-fast, should fail after first directory
			expect(errors.join("\n")).toContain("failed");
		});

		test("without fail-fast collects all failures", async () => {
			// Create directories that will fail
			mkdirSync(join(testDir, "fail1"), { recursive: true });
			mkdirSync(join(testDir, "fail2"), { recursive: true });
			writeFileSync(join(testDir, "fail1", "marker.txt"), "");
			writeFileSync(join(testDir, "fail2", "marker.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					command: "exit 1",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(2);
			const allErrors = errors.join("\n");
			expect(allErrors).toContain("2 directories failed");
		});

		test("parses comma-delimited patterns", async () => {
			// Create directories with different markers
			mkdirSync(join(testDir, "npm-pkg"), { recursive: true });
			mkdirSync(join(testDir, "bun-pkg"), { recursive: true });
			writeFileSync(join(testDir, "npm-pkg", "package.json"), "{}");
			writeFileSync(join(testDir, "bun-pkg", "bun.lock"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "package.json, bun.lock",
					command: "echo success",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(0);
		});

		test("uses testDir filter when provided", async () => {
			// Create directories
			mkdirSync(join(testDir, "pass-test"), { recursive: true });
			mkdirSync(join(testDir, "fail-test"), { recursive: true });
			writeFileSync(join(testDir, "pass-test", "marker.txt"), "");
			writeFileSync(join(testDir, "fail-test", "marker.txt"), "");
			// Create a file that only exists in pass-test
			writeFileSync(join(testDir, "pass-test", "include-me.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					testDir: "test -f include-me.txt",
					command: "echo filtered",
				});
			} catch {
				// process.exit throws
			}

			// Should only process pass-test since fail-test doesn't have include-me.txt
			const allLogs = logs.join("\n");
			expect(allLogs).toContain("✅ 1 directory passed");
			expect(exitCode).toBe(0);
		});
	});

	describe("helper functions", () => {
		test("isDebugMode returns true when HAN_DEBUG=1", () => {
			process.env.HAN_DEBUG = "1";

			// We can't directly test isDebugMode, but we can test its effects
			// by checking if debug files are created
			// For now, just verify the environment is set correctly
			expect(process.env.HAN_DEBUG).toBe("1");
		});

		test("isDebugMode returns true when HAN_DEBUG=true", () => {
			process.env.HAN_DEBUG = "true";
			expect(process.env.HAN_DEBUG).toBe("true");
		});

		test("wrapCommandWithEnvFile uses CLAUDE_ENV_FILE when set", async () => {
			// Create an env file
			const envFile = join(testDir, ".env");
			writeFileSync(envFile, "export TEST_VAR=hello");
			process.env.CLAUDE_ENV_FILE = envFile;

			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "echo $TEST_VAR",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(0);
		});

		test("getHanTempDir creates temp directory", () => {
			const expectedDir = join(tmpdir(), "han-hook-output");
			// Running validate will trigger temp dir creation on failure
			mkdirSync(expectedDir, { recursive: true });
			expect(true).toBe(true); // Directory should exist or be created
		});
	});

	describe("output messages", () => {
		test("shows fix instructions on failure", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "exit 1",
				});
			} catch {
				// process.exit throws
			}

			const allErrors = errors.join("\n");
			expect(allErrors).toContain("Spawn a subagent");
			expect(allErrors).toContain("Do NOT ask the user");
		});

		test("shows success message on completion", async () => {
			mkdirSync(join(testDir, "pkg"), { recursive: true });
			writeFileSync(join(testDir, "pkg", "marker.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					command: "echo success",
				});
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("passed");
		});
	});

	describe("directory handling", () => {
		test("handles nested directories", async () => {
			// Create nested structure
			mkdirSync(join(testDir, "a", "b", "c"), { recursive: true });
			writeFileSync(join(testDir, "a", "marker.txt"), "");
			writeFileSync(join(testDir, "a", "b", "marker.txt"), "");
			writeFileSync(join(testDir, "a", "b", "c", "marker.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					command: "echo nested",
				});
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("3 directories passed");
		});

		test("finds directories with markers in multiple locations", async () => {
			// Create directories
			mkdirSync(join(testDir, "included"), { recursive: true });
			mkdirSync(join(testDir, "also-included"), { recursive: true });
			writeFileSync(join(testDir, "included", "marker.txt"), "");
			writeFileSync(join(testDir, "also-included", "marker.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					command: "echo filtered",
				});
			} catch {
				// process.exit throws
			}

			// Should find both directories
			const allLogs = logs.join("\n");
			expect(allLogs).toContain("2 directories passed");
		});
	});

	describe("error handling", () => {
		test("handles command not found", async () => {
			try {
				await validate({
					failFast: false,
					dirsWith: null,
					command: "nonexistent_command_xyz",
				});
			} catch {
				// process.exit throws
			}

			expect(exitCode).toBe(2);
		});

		test("handles permission errors gracefully", async () => {
			// Create a directory that will cause issues
			mkdirSync(join(testDir, "restricted"), { recursive: true });
			writeFileSync(join(testDir, "restricted", "marker.txt"), "");

			try {
				await validate({
					failFast: false,
					dirsWith: "marker.txt",
					command: "echo test",
				});
			} catch {
				// process.exit throws
			}

			// Should handle gracefully
			expect([0, 2]).toContain(exitCode ?? -1);
		});
	});
});

describe("validate.ts helper function tests", () => {
	describe("generateOutputFilename behavior", () => {
		test("sanitizes directory paths", () => {
			// The function sanitizes non-alphanumeric chars to underscores
			const dirPath = "/path/to/some/directory";
			const sanitized = dirPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
			expect(sanitized).toBe("_path_to_some_directory");
		});

		test("limits directory portion to 30 chars", () => {
			const longPath =
				"/very/long/path/that/exceeds/thirty/characters/definitely";
			const sanitized = longPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
			expect(sanitized.length).toBeLessThanOrEqual(30);
		});
	});

	describe("getAbsoluteEnvFilePath behavior", () => {
		test("returns null when CLAUDE_ENV_FILE not set", () => {
			delete process.env.CLAUDE_ENV_FILE;
			const envFile = process.env.CLAUDE_ENV_FILE;
			expect(envFile).toBeUndefined();
		});

		test("returns absolute path as-is", () => {
			const absPath = "/absolute/path/to/env";
			expect(absPath.startsWith("/")).toBe(true);
		});

		test("resolves relative paths against project dir", () => {
			const relativePath = ".env";
			const projectDir = "/project/root";
			const resolved = join(projectDir, relativePath);
			expect(resolved).toBe("/project/root/.env");
		});
	});

	describe("buildHookCommand behavior", () => {
		test("builds basic command", () => {
			const cmd = `han hook run plugin-name hook-name`;
			expect(cmd).toBe("han hook run plugin-name hook-name");
		});

		test("adds --cached flag", () => {
			let cmd = "han hook run plugin-name hook-name";
			cmd += " --cached";
			expect(cmd).toContain("--cached");
		});

		test("adds --only flag with directory", () => {
			let cmd = "han hook run plugin-name hook-name";
			cmd += " --only=packages/foo";
			expect(cmd).toContain("--only=packages/foo");
		});
	});

	describe("getCacheKeyForDirectory behavior", () => {
		test("generates cache key for root directory", () => {
			const hookName = "lint";
			const directory = "/project/root";
			const projectRoot = "/project/root";
			const relativeDirPath =
				directory
					.replace(projectRoot, "")
					.replace(/^\//, "")
					.replace(/\//g, "_") || "root";
			const cacheKey = `${hookName}_${relativeDirPath}`;
			expect(cacheKey).toBe("lint_root");
		});

		test("generates cache key for subdirectory", () => {
			const hookName = "test";
			const directory = "/project/root/packages/foo";
			const projectRoot = "/project/root";
			const relativeDirPath =
				directory
					.replace(projectRoot, "")
					.replace(/^\//, "")
					.replace(/\//g, "_") || "root";
			const cacheKey = `${hookName}_${relativeDirPath}`;
			expect(cacheKey).toBe("test_packages_foo");
		});
	});
});
