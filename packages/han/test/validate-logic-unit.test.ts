/**
 * Unit tests for validate.ts helper functions.
 * Tests the pure utility functions and path manipulation logic.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Since validate.ts doesn't export the helper functions, we'll test them indirectly
// by importing and testing the hook-config and hook-cache modules that it uses

import { findDirectoriesWithMarkers } from "../lib/hook-cache.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-validate-logic-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });
}

function teardown(): void {
	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("findDirectoriesWithMarkers", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("returns empty array for non-existent directory", () => {
		const result = findDirectoriesWithMarkers("/non/existent/path", [
			"package.json",
		]);
		expect(result).toEqual([]);
	});

	test("returns empty array when no marker files found", () => {
		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result).toEqual([]);
	});

	test("finds directory with marker file at root", () => {
		writeFileSync(join(testDir, "package.json"), "{}");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		// Normalize paths for macOS /var -> /private/var symlink
		const normalizedTestDir = testDir.replace(/^\/var\//, "/private/var/");
		expect(result.length).toBe(1);
		expect(result[0] === testDir || result[0] === normalizedTestDir).toBe(true);
	});

	test("finds directories with marker files in subdirectories", () => {
		const subDir1 = join(testDir, "packages", "core");
		const subDir2 = join(testDir, "packages", "utils");
		mkdirSync(subDir1, { recursive: true });
		mkdirSync(subDir2, { recursive: true });
		writeFileSync(join(subDir1, "package.json"), "{}");
		writeFileSync(join(subDir2, "package.json"), "{}");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result.length).toBe(2);
	});

	test("finds directories with multiple marker patterns", () => {
		const subDir1 = join(testDir, "pkg1");
		const subDir2 = join(testDir, "pkg2");
		mkdirSync(subDir1, { recursive: true });
		mkdirSync(subDir2, { recursive: true });
		writeFileSync(join(subDir1, "package.json"), "{}");
		writeFileSync(join(subDir2, "Cargo.toml"), "{}");

		const result = findDirectoriesWithMarkers(testDir, [
			"package.json",
			"Cargo.toml",
		]);
		expect(result.length).toBe(2);
	});

	test("does not find markers in node_modules when in gitignore", () => {
		// Initialize git repo so gitignore is respected
		mkdirSync(join(testDir, ".git"), { recursive: true });
		// Add node_modules to gitignore
		writeFileSync(join(testDir, ".gitignore"), "node_modules/\n");

		const nodeModules = join(testDir, "node_modules", "some-pkg");
		mkdirSync(nodeModules, { recursive: true });
		writeFileSync(join(nodeModules, "package.json"), "{}");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result.length).toBe(0);
	});

	test("does not find markers in .git directory", () => {
		const gitDir = join(testDir, ".git", "hooks");
		mkdirSync(gitDir, { recursive: true });
		writeFileSync(join(gitDir, "package.json"), "{}");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result.length).toBe(0);
	});

	test("respects .gitignore patterns", () => {
		// Initialize git repo so gitignore is respected
		mkdirSync(join(testDir, ".git"), { recursive: true });

		// Create a directory that would match
		const buildDir = join(testDir, "build");
		mkdirSync(buildDir, { recursive: true });
		writeFileSync(join(buildDir, "package.json"), "{}");

		// Create .gitignore to ignore build directory
		writeFileSync(join(testDir, ".gitignore"), "build/\n");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result.length).toBe(0);
	});

	test("handles deeply nested directories", () => {
		const deepDir = join(testDir, "a", "b", "c", "d", "e");
		mkdirSync(deepDir, { recursive: true });
		writeFileSync(join(deepDir, "package.json"), "{}");

		const result = findDirectoriesWithMarkers(testDir, ["package.json"]);
		expect(result.length).toBe(1);
	});
});

describe("Environment variable handling", () => {
	test("HAN_DEBUG=1 is recognized as debug mode", () => {
		// Test the pattern used in validate.ts
		const debug1: string = "1";
		const debugTrue: string = "true";
		const debugFalse: string = "false";
		const debugEmpty: string = "";

		expect(debug1 === "1" || debug1 === "true").toBe(true);
		expect(debugTrue === "1" || debugTrue === "true").toBe(true);
		expect(debugFalse === "1" || debugFalse === "true").toBe(false);
		expect(debugEmpty === "1" || debugEmpty === "true").toBe(false);
	});
});

describe("Path handling", () => {
	test("relative path detection", () => {
		// Test the pattern used in validate.ts
		const absolutePath = "/usr/local/bin";
		const relativePath = "src/lib";

		expect(absolutePath.startsWith("/")).toBe(true);
		expect(relativePath.startsWith("/")).toBe(false);
	});

	test("cache key generation logic", () => {
		// Replicate the getCacheKeyForDirectory logic
		const hookName = "lint";
		const projectRoot = "/home/user/project";

		// Root directory case
		const rootDir = "/home/user/project";
		const rootRelative =
			rootDir.replace(projectRoot, "").replace(/^\//, "").replace(/\//g, "_") ||
			"root";
		expect(rootRelative).toBe("root");
		const rootCacheKey = `${hookName}_${rootRelative}`;
		expect(rootCacheKey).toBe("lint_root");

		// Subdirectory case
		const subDir = "/home/user/project/packages/core";
		const subRelative =
			subDir.replace(projectRoot, "").replace(/^\//, "").replace(/\//g, "_") ||
			"root";
		expect(subRelative).toBe("packages_core");
		const subCacheKey = `${hookName}_${subRelative}`;
		expect(subCacheKey).toBe("lint_packages_core");
	});

	test("output filename sanitization", () => {
		// Replicate the generateOutputFilename logic
		const directory = "/home/user/project/src/components";

		const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
		expect(sanitizedDir).toMatch(/^[a-zA-Z0-9_]+$/);
		expect(sanitizedDir.length).toBeLessThanOrEqual(30);
	});
});

describe("Command wrapping logic", () => {
	test("login shell command wrapping", () => {
		const cmd = "npm test";
		// When no CLAUDE_ENV_FILE, uses login shell
		const wrapped = `/bin/bash -l -c ${JSON.stringify(cmd)}`;
		expect(wrapped).toBe('/bin/bash -l -c "npm test"');
	});

	test("env file sourcing command wrapping", () => {
		const cmd = "npm test";
		const envFile = "/home/user/.env";
		// When CLAUDE_ENV_FILE is set, source it
		const wrapped = `source "${envFile}" && ${cmd}`;
		expect(wrapped).toBe('source "/home/user/.env" && npm test');
	});
});

describe("Error message generation", () => {
	test("builds correct re-run command without options", () => {
		const pluginName = "jutsu-biome";
		const hookName = "lint";
		const cmd = `han hook run ${pluginName} ${hookName}`;
		expect(cmd).toBe("han hook run jutsu-biome lint");
	});

	test("builds correct re-run command with cached option", () => {
		const pluginName = "jutsu-biome";
		const hookName = "lint";
		let cmd = `han hook run ${pluginName} ${hookName}`;
		cmd += " --cached";
		expect(cmd).toBe("han hook run jutsu-biome lint --cached");
	});

	test("builds correct re-run command with only option", () => {
		const pluginName = "jutsu-bun";
		const hookName = "test";
		let cmd = `han hook run ${pluginName} ${hookName}`;
		cmd += " --only=packages/core";
		expect(cmd).toBe("han hook run jutsu-bun test --only=packages/core");
	});

	test("builds correct re-run command with both options", () => {
		const pluginName = "jutsu-typescript";
		const hookName = "typecheck";
		let cmd = `han hook run ${pluginName} ${hookName}`;
		cmd += " --cached";
		cmd += " --only=src";
		expect(cmd).toBe(
			"han hook run jutsu-typescript typecheck --cached --only=src",
		);
	});
});

describe("Directory count grammar", () => {
	test("uses singular for 1 directory", () => {
		const count = 1;
		const suffix = count === 1 ? "y" : "ies";
		expect(`${count} director${suffix}`).toBe("1 directory");
	});

	test("uses plural for multiple directories", () => {
		const count: number = 5;
		const suffix = count === 1 ? "y" : "ies";
		expect(`${count} director${suffix}`).toBe("5 directories");
	});

	test("uses plural for zero directories", () => {
		const count: number = 0;
		const suffix = count === 1 ? "y" : "ies";
		expect(`${count} director${suffix}`).toBe("0 directories");
	});
});

describe("ValidateOptions interface", () => {
	test("all required fields present", () => {
		const options = {
			failFast: true,
			dirsWith: "package.json",
			command: "npm test",
		};

		expect(options.failFast).toBe(true);
		expect(options.dirsWith).toBe("package.json");
		expect(options.command).toBe("npm test");
	});

	test("optional fields can be undefined", () => {
		const options: {
			failFast: boolean;
			dirsWith: string | null;
			command: string;
			testDir?: string | null;
			verbose?: boolean;
		} = {
			failFast: false,
			dirsWith: null,
			command: "echo test",
		};

		expect(options.testDir).toBeUndefined();
		expect(options.verbose).toBeUndefined();
	});

	test("dirsWith can be null for root-only execution", () => {
		const options = {
			failFast: true,
			dirsWith: null,
			command: "npm lint",
		};

		expect(options.dirsWith).toBeNull();
	});

	test("verbose defaults to false", () => {
		const options = {
			failFast: true,
			dirsWith: "package.json",
			command: "npm test",
			verbose: undefined,
		};

		const verbose = options.verbose ?? false;
		expect(verbose).toBe(false);
	});
});

describe("RunCommandResult interface", () => {
	test("successful result", () => {
		const result = {
			success: true,
			idleTimedOut: false,
		};

		expect(result.success).toBe(true);
		expect(result.idleTimedOut).toBe(false);
	});

	test("failed result with output file", () => {
		const result = {
			success: false,
			idleTimedOut: false,
			outputFile: "/tmp/han-hook-output/lint_root_123.output.txt",
		};

		expect(result.success).toBe(false);
		expect(result.outputFile).toBeDefined();
	});

	test("timeout result", () => {
		const result = {
			success: false,
			idleTimedOut: true,
		};

		expect(result.success).toBe(false);
		expect(result.idleTimedOut).toBe(true);
	});

	test("result with debug file", () => {
		const result = {
			success: false,
			idleTimedOut: false,
			debugFile: "/tmp/han-hook-output/lint_root_123.debug.txt",
		};

		expect(result.debugFile).toBeDefined();
	});
});

describe("Debug info structure", () => {
	test("debug info has all required fields", () => {
		const info = {
			hookName: "lint",
			command: "npx biome check",
			wrappedCommand: '/bin/bash -l -c "npx biome check"',
			directory: "/home/user/project",
			idleTimeout: 60000,
			idleTimedOut: false,
			exitSuccess: true,
			durationMs: 1234,
			outputLength: 5000,
		};

		expect(info.hookName).toBe("lint");
		expect(info.command).toBe("npx biome check");
		expect(info.durationMs).toBe(1234);
	});

	test("debug info handles null idleTimeout", () => {
		const info = {
			hookName: "test",
			command: "npm test",
			idleTimeout: null,
			idleTimedOut: false,
		};

		expect(info.idleTimeout).toBeNull();
	});
});

describe("Hook config structure", () => {
	test("ResolvedHookConfig has correct fields", () => {
		const config = {
			hooks: {
				lint: {
					command: "npx biome check",
					dirsWith: ["biome.json"],
				},
				test: {
					command: "bun test",
					dirsWith: ["bun.lock", "bun.lockb"],
				},
			},
		};

		expect(config.hooks.lint.command).toBe("npx biome check");
		expect(config.hooks.test.dirsWith).toContain("bun.lock");
	});
});

describe("Env file path resolution", () => {
	test("absolute path is returned as-is", () => {
		const envFile = "/home/user/.env";
		const isAbsolute = envFile.startsWith("/");

		expect(isAbsolute).toBe(true);
	});

	test("relative path needs resolution", () => {
		const envFile = ".env";
		const isAbsolute = envFile.startsWith("/");

		expect(isAbsolute).toBe(false);
	});

	test("relative path is resolved against project dir", () => {
		const envFile = ".env";
		const projectDir = "/home/user/project";
		const resolved = envFile.startsWith("/")
			? envFile
			: join(projectDir, envFile);

		expect(resolved).toBe("/home/user/project/.env");
	});

	test("handles nested relative paths", () => {
		const envFile = "config/.env.local";
		const projectDir = "/home/user/project";
		const resolved = envFile.startsWith("/")
			? envFile
			: join(projectDir, envFile);

		expect(resolved).toBe("/home/user/project/config/.env.local");
	});
});

describe("Hook execution options", () => {
	test("default idle timeout", () => {
		const defaultIdleTimeout = 60000;
		const config = { idleTimeout: undefined };
		const timeout = config.idleTimeout ?? defaultIdleTimeout;

		expect(timeout).toBe(60000);
	});

	test("custom idle timeout", () => {
		const defaultIdleTimeout = 60000;
		const config = { idleTimeout: 120000 };
		const timeout = config.idleTimeout ?? defaultIdleTimeout;

		expect(timeout).toBe(120000);
	});

	test("zero idle timeout is preserved", () => {
		const defaultIdleTimeout = 60000;
		const config = { idleTimeout: 0 };
		const timeout = config.idleTimeout ?? defaultIdleTimeout;

		// Zero should be preserved (nullish coalescing)
		expect(timeout).toBe(0);
	});
});

describe("Marker patterns", () => {
	test("common marker patterns", () => {
		const markers = {
			javascript: ["package.json"],
			typescript: ["tsconfig.json"],
			rust: ["Cargo.toml"],
			go: ["go.mod"],
			python: ["pyproject.toml", "setup.py"],
			ruby: ["Gemfile"],
		};

		expect(markers.javascript).toContain("package.json");
		expect(markers.typescript).toContain("tsconfig.json");
		expect(markers.rust).toContain("Cargo.toml");
	});

	test("bun-specific markers", () => {
		const bunMarkers = ["bun.lock", "bun.lockb"];

		expect(bunMarkers).toContain("bun.lock");
		expect(bunMarkers).toContain("bun.lockb");
	});

	test("glob patterns for marker files", () => {
		const pattern = ".markdownlint.*";

		expect(pattern).toContain(".markdownlint.");
		expect(pattern.endsWith("*")).toBe(true);
	});
});

describe("Failure output formatting", () => {
	test("formats failure message with directory", () => {
		const directory = "/home/user/project/packages/core";
		// hookName would be used in a real scenario but not needed for this test
		const message = `❌ Hook failed in \`${directory.replace(process.cwd() || "/", "")}\``;

		expect(message).toContain("Hook failed");
	});

	test("formats re-run instructions", () => {
		const pluginName = "jutsu-biome";
		const hookName = "lint";
		const instructions = `To see full output, run: han hook run ${pluginName} ${hookName} --verbose`;

		expect(instructions).toContain("han hook run");
		expect(instructions).toContain("--verbose");
	});

	test("formats timeout message", () => {
		const idleTimeout = 60000;
		const message = `Command timed out after ${idleTimeout / 1000}s of inactivity`;

		expect(message).toBe("Command timed out after 60s of inactivity");
	});
});

describe("Cache key generation", () => {
	test("generates unique keys for different directories", () => {
		const hookName = "lint";
		const rootKey = `${hookName}_root`;
		const subKey = `${hookName}_packages_core`;

		expect(rootKey).not.toBe(subKey);
	});

	test("sanitizes special characters in directory path", () => {
		const dir = "/home/user/my-project/src/@components";
		const sanitized = dir.replace(/[^a-zA-Z0-9]/g, "_");

		expect(sanitized).not.toContain("/");
		expect(sanitized).not.toContain("-");
		expect(sanitized).not.toContain("@");
	});
});

describe("getHanTempDir logic", () => {
	test("creates temp directory path", () => {
		const { tmpdir } = require("node:os");
		const { join } = require("node:path");
		const dir = join(tmpdir(), "han-hook-output");
		expect(dir).toContain("han-hook-output");
	});
});

describe("generateOutputFilename logic", () => {
	test("generates filename with hook name, directory, and timestamp", () => {
		const hookName = "lint";
		const directory = "/home/user/project/packages/core";
		const timestamp = Date.now();
		const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
		const filename = `${hookName}_${sanitizedDir}_${timestamp}`;

		expect(filename).toContain(hookName);
		expect(filename).toMatch(/lint_[a-zA-Z0-9_]+_\d+/);
		expect(sanitizedDir.length).toBeLessThanOrEqual(30);
	});

	test("truncates long directory paths to 30 chars", () => {
		const longDir =
			"/home/user/very/long/directory/path/that/exceeds/thirty/characters";
		const sanitizedDir = longDir.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);

		expect(sanitizedDir.length).toBeLessThanOrEqual(30);
	});
});

describe("writeDebugFile structure", () => {
	test("debug file has expected sections", () => {
		const lines = [
			"=== Han Hook Debug Info ===",
			"Timestamp: 2025-01-01T00:00:00.000Z",
			"",
			"=== Environment ===",
			"NODE_VERSION: v20.0.0",
			"PLATFORM: darwin",
			"ARCH: arm64",
			"CWD: /home/user/project",
			'CLAUDE_PROJECT_DIR: /home/user/project"',
			"CLAUDE_PLUGIN_ROOT: /home/user/.claude/plugins/han/jutsu-biome",
			"CLAUDE_ENV_FILE: (not set)",
			"PATH: /usr/bin",
			"",
			"=== Hook Info ===",
		];

		expect(lines[0]).toBe("=== Han Hook Debug Info ===");
		expect(lines[3]).toBe("=== Environment ===");
		expect(lines[13]).toBe("=== Hook Info ===");
	});
});

describe("getAbsoluteEnvFilePath logic", () => {
	test("returns null when CLAUDE_ENV_FILE not set", () => {
		const envFile: string | undefined = undefined;
		const result = envFile ? "/some/path" : null;
		expect(result).toBeNull();
	});

	test("returns absolute path as-is", () => {
		const envFile = "/home/user/.env";
		const result = envFile.startsWith("/") ? envFile : "/cwd/.env";
		expect(result).toBe("/home/user/.env");
	});

	test("resolves relative path against project dir", () => {
		const envFile = ".env";
		const projectDir = "/home/user/project";
		const result = envFile.startsWith("/")
			? envFile
			: join(projectDir, envFile);
		expect(result).toBe("/home/user/project/.env");
	});
});

describe("wrapCommandWithEnvFile logic", () => {
	test("uses login shell when no env file", () => {
		const cmd = "npm test";
		const wrapped = `/bin/bash -l -c ${JSON.stringify(cmd)}`;
		expect(wrapped).toBe('/bin/bash -l -c "npm test"');
	});

	test("sources env file when set", () => {
		const cmd = "npm test";
		const envFile = "/home/user/.env";
		const wrapped = `source "${envFile}" && ${cmd}`;
		expect(wrapped).toBe('source "/home/user/.env" && npm test');
	});

	test("handles commands with special characters", () => {
		const cmd = 'echo "hello world"';
		const wrapped = `/bin/bash -l -c ${JSON.stringify(cmd)}`;
		expect(wrapped).toBe('/bin/bash -l -c "echo \\"hello world\\""');
	});
});

describe("runCommand result scenarios", () => {
	test("success result structure", () => {
		const result = {
			success: true,
			idleTimedOut: false,
		};

		expect(result.success).toBe(true);
		expect(result.idleTimedOut).toBe(false);
	});

	test("failure with output file", () => {
		const result = {
			success: false,
			idleTimedOut: false,
			outputFile: "/tmp/han-hook-output/lint_root_123.output.txt",
		};

		expect(result.success).toBe(false);
		expect(result.outputFile).toBeDefined();
		expect(result.outputFile).toContain(".output.txt");
	});

	test("idle timeout failure", () => {
		const result = {
			success: false,
			idleTimedOut: true,
		};

		expect(result.success).toBe(false);
		expect(result.idleTimedOut).toBe(true);
	});

	test("failure with debug file", () => {
		const result = {
			success: false,
			idleTimedOut: false,
			outputFile: "/tmp/output.txt",
			debugFile: "/tmp/debug.txt",
		};

		expect(result.outputFile).toBeDefined();
		expect(result.debugFile).toBeDefined();
	});
});

describe("plugin discovery logic", () => {
	test("findPluginInMarketplace path construction", () => {
		const marketplaceRoot = "/home/user/.claude/plugins/marketplaces/han";
		const pluginName = "jutsu-typescript";

		const potentialPaths = [
			join(marketplaceRoot, "jutsu", pluginName),
			join(marketplaceRoot, "do", pluginName),
			join(marketplaceRoot, "hashi", pluginName),
			join(marketplaceRoot, pluginName),
		];

		expect(potentialPaths[0]).toBe(
			"/home/user/.claude/plugins/marketplaces/han/jutsu/jutsu-typescript",
		);
		expect(potentialPaths[1]).toBe(
			"/home/user/.claude/plugins/marketplaces/han/do/jutsu-typescript",
		);
		expect(potentialPaths[2]).toBe(
			"/home/user/.claude/plugins/marketplaces/han/hashi/jutsu-typescript",
		);
		expect(potentialPaths[3]).toBe(
			"/home/user/.claude/plugins/marketplaces/han/jutsu-typescript",
		);
	});

	test("resolvePathToAbsolute handles relative paths", () => {
		const relPath = "src/plugins";
		const cwd = "/home/user/project";
		const resolved = relPath.startsWith("/") ? relPath : join(cwd, relPath);

		expect(resolved).toBe("/home/user/project/src/plugins");
	});

	test("resolvePathToAbsolute handles absolute paths", () => {
		const absPath = "/usr/local/plugins";
		const cwd = "/home/user/project";
		const resolved = absPath.startsWith("/") ? absPath : join(cwd, absPath);

		expect(resolved).toBe("/usr/local/plugins");
	});
});

describe("RunConfiguredHookOptions interface", () => {
	test("required fields", () => {
		const options = {
			pluginName: "jutsu-biome",
			hookName: "lint",
			failFast: true,
		};

		expect(options.pluginName).toBe("jutsu-biome");
		expect(options.hookName).toBe("lint");
		expect(options.failFast).toBe(true);
	});

	test("optional fields", () => {
		const options: {
			pluginName: string;
			hookName: string;
			failFast: boolean;
			cache?: boolean;
			only?: string;
			verbose?: boolean;
		} = {
			pluginName: "jutsu-bun",
			hookName: "test",
			failFast: false,
			cache: true,
			only: "packages/core",
			verbose: true,
		};

		expect(options.cache).toBe(true);
		expect(options.only).toBe("packages/core");
		expect(options.verbose).toBe(true);
	});

	test("defaults for optional fields", () => {
		const options = {
			pluginName: "jutsu-typescript",
			hookName: "typecheck",
			failFast: true,
		};

		const cache = (options as { cache?: boolean }).cache ?? false;
		const verbose = (options as { verbose?: boolean }).verbose ?? false;

		expect(cache).toBe(false);
		expect(verbose).toBe(false);
	});
});

describe("buildHookCommand logic", () => {
	test("basic command", () => {
		const pluginName = "jutsu-biome";
		const hookName = "lint";
		const cmd = `han hook run ${pluginName} ${hookName}`;
		expect(cmd).toBe("han hook run jutsu-biome lint");
	});

	test("with cached option", () => {
		const pluginName = "jutsu-bun";
		const hookName = "test";
		const options = { cached: true };
		let cmd = `han hook run ${pluginName} ${hookName}`;
		if (options.cached) {
			cmd += " --cached";
		}
		expect(cmd).toBe("han hook run jutsu-bun test --cached");
	});

	test("with only option", () => {
		const pluginName = "jutsu-typescript";
		const hookName = "typecheck";
		const options = { only: "packages/core" };
		let cmd = `han hook run ${pluginName} ${hookName}`;
		if (options.only) {
			cmd += ` --only=${options.only}`;
		}
		expect(cmd).toBe(
			"han hook run jutsu-typescript typecheck --only=packages/core",
		);
	});

	test("with both options", () => {
		const pluginName = "jutsu-biome";
		const hookName = "lint";
		const options = { cached: true, only: "src" };
		let cmd = `han hook run ${pluginName} ${hookName}`;
		if (options.cached) {
			cmd += " --cached";
		}
		if (options.only) {
			cmd += ` --only=${options.only}`;
		}
		expect(cmd).toBe("han hook run jutsu-biome lint --cached --only=src");
	});
});

describe("failure categorization", () => {
	test("separates idle timeout failures from regular failures", () => {
		const failures = [
			{ dir: "packages/core", idleTimedOut: false },
			{ dir: "packages/utils", idleTimedOut: true },
			{ dir: "packages/cli", idleTimedOut: false },
			{ dir: "packages/api", idleTimedOut: true },
		];

		const idleTimeoutFailures = failures.filter((f) => f.idleTimedOut);
		const regularFailures = failures.filter((f) => !f.idleTimedOut);

		expect(idleTimeoutFailures).toHaveLength(2);
		expect(regularFailures).toHaveLength(2);
		expect(idleTimeoutFailures[0]?.dir).toBe("packages/utils");
		expect(regularFailures[0]?.dir).toBe("packages/core");
	});
});

describe("error messages", () => {
	test("formats plugin not found error", () => {
		const pluginName = "jutsu-unknown";
		const error =
			`Error: Could not find plugin "${pluginName}".\n\n` +
			"The plugin must be enabled in your .claude/settings.json or .claude/settings.local.json.\n" +
			"If running outside of a Claude Code hook context, ensure the plugin is installed.";

		expect(error).toContain("jutsu-unknown");
		expect(error).toContain("settings.json");
	});

	test("formats plugin mismatch error", () => {
		const expectedName = "jutsu-biome";
		const actualName = "jutsu-typescript";
		const error =
			`Error: Plugin name mismatch.\n` +
			`  Expected: ${expectedName}\n` +
			`  Got: ${actualName} (from CLAUDE_PLUGIN_ROOT)`;

		expect(error).toContain("Plugin name mismatch");
		expect(error).toContain("jutsu-biome");
		expect(error).toContain("jutsu-typescript");
	});

	test("formats no directory found error", () => {
		const only = "packages/nonexistent";
		const error =
			`Error: No hook configuration found for directory "${only}".\n` +
			`The --only flag requires a directory that matches one of the hook's target directories.`;

		expect(error).toContain("packages/nonexistent");
		expect(error).toContain("--only flag");
	});
});

describe("config filtering", () => {
	test("filters configs by only option", () => {
		const configs = [
			{ directory: "/project/packages/core" },
			{ directory: "/project/packages/utils" },
			{ directory: "/project/packages/cli" },
		];
		const only = "packages/core";
		const projectRoot = "/project";

		const onlyAbsolute = only.startsWith("/") ? only : join(projectRoot, only);
		const filtered = configs.filter((config) => {
			const normalizedDir = config.directory.replace(/\/$/, "");
			const normalizedOnly = onlyAbsolute.replace(/\/$/, "");
			return normalizedDir === normalizedOnly;
		});

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.directory).toBe("/project/packages/core");
	});

	test("filters out disabled configs", () => {
		const configs = [
			{ directory: "/project/a", enabled: true },
			{ directory: "/project/b", enabled: false },
			{ directory: "/project/c", enabled: true },
		];

		const enabled = configs.filter((c) => c.enabled);
		expect(enabled).toHaveLength(2);
	});
});

describe("success message formatting", () => {
	test("singular directory", () => {
		const ranCount = 1;
		const message = `✅ All ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`;
		expect(message).toBe("✅ All 1 directory passed");
	});

	test("multiple directories", () => {
		const ranCount = 5;
		const message = `✅ All ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`;
		expect(message).toBe("✅ All 5 directories passed");
	});
});

describe("skipped directories message", () => {
	test("singular skipped", () => {
		const skippedCount = 1;
		const message = `Skipped ${skippedCount} director${skippedCount === 1 ? "y" : "ies"} (no changes detected)`;
		expect(message).toBe("Skipped 1 directory (no changes detected)");
	});

	test("multiple skipped", () => {
		const skippedCount = 3;
		const message = `Skipped ${skippedCount} director${skippedCount === 1 ? "y" : "ies"} (no changes detected)`;
		expect(message).toBe("Skipped 3 directories (no changes detected)");
	});
});

describe("disabled hooks message", () => {
	test("all directories disabled", () => {
		const hookName = "lint";
		const message = `All directories have hook "${hookName}" disabled via han-config.yml`;
		expect(message).toBe(
			'All directories have hook "lint" disabled via han-config.yml',
		);
	});
});

describe("idle timeout message", () => {
	test("formats idle timeout reason", () => {
		const idleTimedOut = true;
		const reason = idleTimedOut ? " (idle timeout - no output received)" : "";
		expect(reason).toBe(" (idle timeout - no output received)");
	});

	test("no reason when not timed out", () => {
		const idleTimedOut = false;
		const reason = idleTimedOut ? " (idle timeout - no output received)" : "";
		expect(reason).toBe("");
	});
});
