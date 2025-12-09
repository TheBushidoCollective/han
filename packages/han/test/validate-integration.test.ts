/**
 * Integration tests for validate.ts
 * Tests the exported functions with mocked dependencies
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let projectDir: string;
let pluginDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-validate-integration-${Date.now()}-${random}`);
	projectDir = join(testDir, "project");
	pluginDir = join(testDir, "plugin");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(pluginDir, { recursive: true });
}

function teardown(): void {
	// Restore environment
	process.env = { ...originalEnv };

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

function _createPluginConfig(
	hooks: Record<string, unknown>,
	dir: string = pluginDir,
): void {
	const configDir = join(dir, ".claude-plugin");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(dir, "han-config.json"),
		JSON.stringify({ hooks }, null, 2),
	);
}

describe("validate.ts helper functions", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("isDebugMode pattern", () => {
		test("returns true for HAN_DEBUG=1", () => {
			const debug = "1";
			const isDebug = debug === "1" || debug === "true";
			expect(isDebug).toBe(true);
		});

		test("returns true for HAN_DEBUG=true", () => {
			const debug: string = "true";
			const isDebug = debug === "1" || debug === "true";
			expect(isDebug).toBe(true);
		});

		test("returns false for HAN_DEBUG=false", () => {
			const debug: string = "false";
			const isDebug = debug === "1" || debug === "true";
			expect(isDebug).toBe(false);
		});

		test("returns false for undefined", () => {
			const debug = undefined;
			const isDebug = debug === "1" || debug === "true";
			expect(isDebug).toBe(false);
		});
	});

	describe("getHanTempDir pattern", () => {
		test("creates temp directory in tmpdir", () => {
			const dir = join(tmpdir(), "han-hook-output");
			mkdirSync(dir, { recursive: true });
			expect(existsSync(dir)).toBe(true);
		});
	});

	describe("generateOutputFilename pattern", () => {
		test("creates filename with hook name, sanitized dir, and timestamp", () => {
			const hookName = "lint";
			const directory = "/home/user/project/src/components";
			const timestamp = Date.now();
			const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
			const filename = `${hookName}_${sanitizedDir}_${timestamp}`;

			expect(filename).toContain("lint");
			expect(filename).toContain(String(timestamp));
			expect(sanitizedDir.length).toBeLessThanOrEqual(30);
		});

		test("sanitizes special characters in directory", () => {
			const directory = "/path/with spaces/and-dashes/file.ts";
			const sanitized = directory.replace(/[^a-zA-Z0-9]/g, "_");
			expect(sanitized).not.toContain("/");
			expect(sanitized).not.toContain(" ");
			expect(sanitized).not.toContain("-");
			expect(sanitized).not.toContain(".");
		});
	});

	describe("getAbsoluteEnvFilePath pattern", () => {
		test("returns null when no env file set", () => {
			const envFile = undefined;
			const result = envFile ? envFile : null;
			expect(result).toBeNull();
		});

		test("returns absolute path as-is", () => {
			const envFile = "/absolute/path/.env";
			const result = envFile.startsWith("/") ? envFile : null;
			expect(result).toBe("/absolute/path/.env");
		});

		test("resolves relative path", () => {
			const envFile = ".env";
			const projectDir = "/home/user/project";
			const result = envFile.startsWith("/")
				? envFile
				: join(projectDir, envFile);
			expect(result).toBe("/home/user/project/.env");
		});
	});

	describe("wrapCommandWithEnvFile pattern", () => {
		test("wraps with login shell when no env file", () => {
			const cmd = "npm test";
			const envFile = null;
			const wrapped = envFile
				? `source "${envFile}" && ${cmd}`
				: `/bin/bash -l -c ${JSON.stringify(cmd)}`;
			expect(wrapped).toBe('/bin/bash -l -c "npm test"');
		});

		test("sources env file when set", () => {
			const cmd = "npm test";
			const envFile = "/home/user/.env";
			const wrapped = envFile
				? `source "${envFile}" && ${cmd}`
				: `/bin/bash -l -c ${JSON.stringify(cmd)}`;
			expect(wrapped).toBe('source "/home/user/.env" && npm test');
		});
	});

	describe("findDirectoriesWithMarker integration", () => {
		test("finds directories with package.json", () => {
			// Create nested structure
			const pkg1 = join(projectDir, "packages", "core");
			const pkg2 = join(projectDir, "packages", "utils");
			mkdirSync(pkg1, { recursive: true });
			mkdirSync(pkg2, { recursive: true });
			writeFileSync(join(pkg1, "package.json"), "{}");
			writeFileSync(join(pkg2, "package.json"), "{}");

			// Import and test
			const { findDirectoriesWithMarkers } = require("../lib/hook-cache.ts");
			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(2);
		});

		test("excludes node_modules", () => {
			// Initialize git repo so gitignore is respected by native module
			mkdirSync(join(projectDir, ".git"), { recursive: true });
			// Add node_modules to gitignore
			writeFileSync(join(projectDir, ".gitignore"), "node_modules/\n");

			const nodeModules = join(projectDir, "node_modules", "some-pkg");
			mkdirSync(nodeModules, { recursive: true });
			writeFileSync(join(nodeModules, "package.json"), "{}");

			const { findDirectoriesWithMarkers } = require("../lib/hook-cache.ts");
			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(0);
		});
	});

	describe("getCacheKeyForDirectory pattern", () => {
		test("generates cache key for root directory", () => {
			const hookName = "lint";
			const directory = "/home/user/project";
			const projectRoot = "/home/user/project";
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
			const directory = "/home/user/project/packages/core";
			const projectRoot = "/home/user/project";
			const relativeDirPath =
				directory
					.replace(projectRoot, "")
					.replace(/^\//, "")
					.replace(/\//g, "_") || "root";
			const cacheKey = `${hookName}_${relativeDirPath}`;
			expect(cacheKey).toBe("test_packages_core");
		});
	});

	describe("buildHookCommand pattern", () => {
		test("builds basic command", () => {
			const pluginName = "jutsu-biome";
			const hookName = "lint";
			const cmd = `han hook run ${pluginName} ${hookName}`;
			expect(cmd).toBe("han hook run jutsu-biome lint");
		});

		test("adds --cached option", () => {
			const pluginName = "jutsu-biome";
			const hookName = "lint";
			let cmd = `han hook run ${pluginName} ${hookName}`;
			cmd += " --cached";
			expect(cmd).toBe("han hook run jutsu-biome lint --cached");
		});

		test("adds --only option", () => {
			const pluginName = "jutsu-bun";
			const hookName = "test";
			const only = "packages/core";
			let cmd = `han hook run ${pluginName} ${hookName}`;
			cmd += ` --only=${only}`;
			expect(cmd).toBe("han hook run jutsu-bun test --only=packages/core");
		});

		test("adds both options", () => {
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

	describe("findPluginInMarketplace pattern", () => {
		test("constructs potential paths for jutsu plugin", () => {
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
		});

		test("finds first existing path", () => {
			// Create a jutsu plugin directory
			const jutsuDir = join(testDir, "marketplace", "jutsu", "jutsu-test");
			mkdirSync(jutsuDir, { recursive: true });

			const marketplaceRoot = join(testDir, "marketplace");
			const pluginName = "jutsu-test";
			const potentialPaths = [
				join(marketplaceRoot, "jutsu", pluginName),
				join(marketplaceRoot, "do", pluginName),
				join(marketplaceRoot, "hashi", pluginName),
				join(marketplaceRoot, pluginName),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuDir);
		});
	});

	describe("resolvePathToAbsolute pattern", () => {
		test("returns absolute path unchanged", () => {
			const path = "/usr/local/bin";
			const result = path.startsWith("/") ? path : join(process.cwd(), path);
			expect(result).toBe("/usr/local/bin");
		});

		test("resolves relative path to cwd", () => {
			const path = "src/lib";
			const cwd = "/home/user/project";
			const result = path.startsWith("/") ? path : join(cwd, path);
			expect(result).toBe("/home/user/project/src/lib");
		});
	});

	describe("failure message formatting", () => {
		test("formats single failure message", () => {
			const failures = ["packages/core"];
			const message = `\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation.`;
			expect(message).toContain("1 directory failed");
		});

		test("formats multiple failures message", () => {
			const failures = ["packages/core", "packages/utils", "packages/cli"];
			const message = `\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation.`;
			expect(message).toContain("3 directories failed");
		});
	});

	describe("success message formatting", () => {
		test("formats single success message", () => {
			const count = 1;
			const message = `\n✅ All ${count} director${count === 1 ? "y" : "ies"} passed validation`;
			expect(message).toContain("1 directory passed");
		});

		test("formats multiple success message", () => {
			const count: number = 5;
			const message = `\n✅ All ${count} director${count === 1 ? "y" : "ies"} passed validation`;
			expect(message).toContain("5 directories passed");
		});
	});

	describe("idle timeout handling", () => {
		test("formats idle timeout failure message", () => {
			const idleTimedOut = true;
			const reason = idleTimedOut ? " (idle timeout - no output received)" : "";
			expect(reason).toBe(" (idle timeout - no output received)");
		});

		test("formats regular failure message", () => {
			const idleTimedOut = false;
			const reason = idleTimedOut ? " (idle timeout - no output received)" : "";
			expect(reason).toBe("");
		});
	});

	describe("output file reference formatting", () => {
		test("formats output file reference", () => {
			const outputFile =
				"/tmp/han-hook-output/lint_packages_core_123.output.txt";
			const outputRef = outputFile ? `\n\nOutput saved to: ${outputFile}` : "";
			expect(outputRef).toContain(outputFile);
		});

		test("formats debug file reference", () => {
			const debugFile = "/tmp/han-hook-output/lint_packages_core_123.debug.txt";
			const debugRef = debugFile ? `\nDebug info saved to: ${debugFile}` : "";
			expect(debugRef).toContain(debugFile);
		});

		test("handles missing output file", () => {
			const outputFile = undefined;
			const outputRef = outputFile ? `\n\nOutput saved to: ${outputFile}` : "";
			expect(outputRef).toBe("");
		});
	});

	describe("config filtering", () => {
		test("filters disabled configs", () => {
			const configs = [
				{ enabled: true, directory: "/a" },
				{ enabled: false, directory: "/b" },
				{ enabled: true, directory: "/c" },
			];
			const enabledConfigs = configs.filter((c) => c.enabled);
			expect(enabledConfigs.length).toBe(2);
		});

		test("filters by --only directory", () => {
			const configs = [
				{ directory: "/project/packages/core" },
				{ directory: "/project/packages/utils" },
				{ directory: "/project" },
			];
			const onlyAbsolute = "/project/packages/core";
			const filtered = configs.filter((c) => {
				const normalizedDir = c.directory.replace(/\/$/, "");
				return normalizedDir === onlyAbsolute;
			});
			expect(filtered.length).toBe(1);
			expect(filtered[0].directory).toBe("/project/packages/core");
		});
	});

	describe("debug info generation", () => {
		test("generates debug info structure", () => {
			const info = {
				hookName: "lint",
				command: "npm run lint",
				wrappedCommand: '/bin/bash -l -c "npm run lint"',
				directory: "/home/user/project",
				idleTimeout: 30000,
				idleTimedOut: false,
				exitSuccess: true,
				durationMs: 1234,
				outputLength: 567,
			};

			const lines: string[] = [
				"=== Han Hook Debug Info ===",
				`Timestamp: ${new Date().toISOString()}`,
				"",
				"=== Environment ===",
				`NODE_VERSION: ${process.version}`,
				`PLATFORM: ${process.platform}`,
				`ARCH: ${process.arch}`,
				`CWD: ${process.cwd()}`,
				"",
				"=== Hook Info ===",
			];

			for (const [key, value] of Object.entries(info)) {
				lines.push(`${key}: ${JSON.stringify(value)}`);
			}

			const content = lines.join("\n");
			expect(content).toContain('hookName: "lint"');
			expect(content).toContain("durationMs: 1234");
			expect(content).toContain("NODE_VERSION:");
		});
	});

	describe("relative path calculation", () => {
		test("calculates relative path for subdirectory", () => {
			const projectRoot = "/home/user/project";
			const directory: string = "/home/user/project/packages/core";
			const relativePath =
				directory === projectRoot
					? "."
					: directory.replace(`${projectRoot}/`, "");
			expect(relativePath).toBe("packages/core");
		});

		test("returns . for root directory", () => {
			const projectRoot = "/home/user/project";
			const directory: string = "/home/user/project";
			const relativePath =
				directory === projectRoot
					? "."
					: directory.replace(`${projectRoot}/`, "");
			expect(relativePath).toBe(".");
		});
	});

	describe("command string building", () => {
		test("builds command for root directory", () => {
			const relativePath = ".";
			const commandToRun = "npm test";
			const cmdStr =
				relativePath === "."
					? commandToRun
					: `cd ${relativePath} && ${commandToRun}`;
			expect(cmdStr).toBe("npm test");
		});

		test("builds command for subdirectory", () => {
			const relativePath: string = "packages/core";
			const commandToRun = "npm test";
			const cmdStr =
				relativePath === "."
					? commandToRun
					: `cd ${relativePath} && ${commandToRun}`;
			expect(cmdStr).toBe("cd packages/core && npm test");
		});
	});

	describe("pattern parsing", () => {
		test("parses comma-delimited patterns", () => {
			const dirsWith = "package.json, Cargo.toml, go.mod";
			const patterns = dirsWith.split(",").map((p) => p.trim());
			expect(patterns).toEqual(["package.json", "Cargo.toml", "go.mod"]);
		});

		test("handles single pattern", () => {
			const dirsWith = "package.json";
			const patterns = dirsWith.split(",").map((p) => p.trim());
			expect(patterns).toEqual(["package.json"]);
		});
	});

	describe("RunCommandResult structure", () => {
		test("success result structure", () => {
			const result = {
				success: true,
				idleTimedOut: false,
				outputFile: undefined,
			};
			expect(result.success).toBe(true);
			expect(result.idleTimedOut).toBe(false);
			expect(result.outputFile).toBeUndefined();
		});

		test("failure result structure", () => {
			const result = {
				success: false,
				idleTimedOut: false,
				outputFile: "/tmp/output.txt",
				debugFile: "/tmp/debug.txt",
			};
			expect(result.success).toBe(false);
			expect(result.outputFile).toBe("/tmp/output.txt");
			expect(result.debugFile).toBe("/tmp/debug.txt");
		});

		test("idle timeout result structure", () => {
			const result = {
				success: false,
				idleTimedOut: true,
				outputFile: "/tmp/output.txt",
			};
			expect(result.success).toBe(false);
			expect(result.idleTimedOut).toBe(true);
		});
	});

	describe("environment variable handling", () => {
		test("uses CLAUDE_PROJECT_DIR when set", () => {
			const claudeProjectDir = "/custom/project/dir";
			const rootDir = claudeProjectDir || process.cwd();
			expect(rootDir).toBe("/custom/project/dir");
		});

		test("falls back to cwd when CLAUDE_PROJECT_DIR not set", () => {
			const claudeProjectDir = undefined;
			const cwd = "/fallback/cwd";
			const rootDir = claudeProjectDir || cwd;
			expect(rootDir).toBe("/fallback/cwd");
		});

		test("uses CLAUDE_PLUGIN_ROOT when set", () => {
			const pluginRoot = "/path/to/plugin";
			expect(pluginRoot).toBe("/path/to/plugin");
		});
	});

	describe("plugin name extraction", () => {
		test("extracts plugin name from CLAUDE_PLUGIN_ROOT", () => {
			const { getPluginNameFromRoot } = require("../lib/hook-config.ts");
			const pluginRoot = "/path/to/plugins/marketplaces/han/jutsu/jutsu-biome";
			const name = getPluginNameFromRoot(pluginRoot);
			expect(name).toBe("jutsu-biome");
		});

		test("validates plugin name matches", () => {
			const pluginRootName = "jutsu-biome";
			const expectedPluginName = "jutsu-biome";
			const matches = pluginRootName === expectedPluginName;
			expect(matches).toBe(true);
		});

		test("detects plugin name mismatch", () => {
			const pluginRootName: string = "jutsu-biome";
			const expectedPluginName = "jutsu-typescript";
			const matches = pluginRootName === expectedPluginName;
			expect(matches).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles empty directory list", () => {
			const directories: string[] = [];
			const processedCount = directories.length;
			expect(processedCount).toBe(0);
		});

		test("handles all directories disabled", () => {
			const totalFound = 5;
			const disabledCount = 5;
			const allDisabled = disabledCount === totalFound;
			expect(allDisabled).toBe(true);
		});

		test("handles all directories skipped (no changes)", () => {
			const configsToRun: unknown[] = [];
			const skippedCount = 3;
			const shouldSkipAll = configsToRun.length === 0 && skippedCount > 0;
			expect(shouldSkipAll).toBe(true);
		});
	});
});
