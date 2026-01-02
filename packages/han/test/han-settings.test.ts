/**
 * Unit tests for han-settings.ts
 * Tests han.yml configuration loading and merging
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getHanBinary,
	getHanConfigPaths,
	getHanConfigPathsForDirectory,
	getMergedHanConfig,
	getMergedHanConfigForDirectory,
	getPluginHookSettings,
	isCacheEnabled,
	isCheckpointsEnabled,
	isFailFastEnabled,
	isHooksEnabled,
	isMemoryEnabled,
	isMetricsEnabled,
	loadHanConfigFile,
} from "../lib/config/index.ts";

// Store original environment
const originalEnv = { ...process.env };

let tempUserDir: string;
let tempProjectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	tempUserDir = join(tmpdir(), `han-test-user-${Date.now()}-${random}`);
	tempProjectDir = join(tmpdir(), `han-test-project-${Date.now()}-${random}`);

	mkdirSync(tempUserDir, { recursive: true });
	mkdirSync(tempProjectDir, { recursive: true });
	mkdirSync(join(tempProjectDir, ".claude"), { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = tempUserDir;
	process.env.CLAUDE_PROJECT_DIR = tempProjectDir;
}

function teardown(): void {
	// Restore environment
	process.env = { ...originalEnv };

	// Clean up temp directories
	if (tempUserDir && existsSync(tempUserDir)) {
		try {
			rmSync(tempUserDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
	if (tempProjectDir && existsSync(tempProjectDir)) {
		try {
			rmSync(tempProjectDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe.serial("han-settings.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getHanConfigPaths", () => {
		test("returns paths in correct precedence order", () => {
			const paths = getHanConfigPaths();

			expect(paths).toHaveLength(4);
			expect(paths[0].scope).toBe("user");
			expect(paths[0].path).toBe(join(tempUserDir, "han.yml"));
			expect(paths[1].scope).toBe("project");
			expect(paths[1].path).toBe(join(tempProjectDir, ".claude", "han.yml"));
			expect(paths[2].scope).toBe("local");
			expect(paths[2].path).toBe(
				join(tempProjectDir, ".claude", "han.local.yml"),
			);
			expect(paths[3].scope).toBe("root");
			expect(paths[3].path).toBe(join(tempProjectDir, "han.yml"));
		});

		test("handles missing CLAUDE_CONFIG_DIR", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			const paths = getHanConfigPaths();

			// Should still have project, local, and root paths
			expect(paths.length).toBeGreaterThanOrEqual(3);
			expect(paths.some((p) => p.scope === "project")).toBe(true);
			expect(paths.some((p) => p.scope === "local")).toBe(true);
			expect(paths.some((p) => p.scope === "root")).toBe(true);
		});
	});

	describe("loadHanConfigFile", () => {
		test("returns null for non-existent file", () => {
			const config = loadHanConfigFile("/nonexistent/han.yml");
			expect(config).toBeNull();
		});

		test("parses valid YAML config", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(
				configPath,
				"hooks:\n  enabled: false\n  checkpoints: false\n",
			);

			const config = loadHanConfigFile(configPath);
			expect(config).not.toBeNull();
			expect(config?.hooks?.enabled).toBe(false);
			expect(config?.hooks?.checkpoints).toBe(false);
		});

		test("returns null for invalid YAML", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "{ invalid: yaml: content");

			const config = loadHanConfigFile(configPath);
			expect(config).toBeNull();
		});

		test("handles empty config file", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "");

			const config = loadHanConfigFile(configPath);
			expect(config).not.toBeNull();
			expect(config).toEqual({});
		});

		test("handles partial config", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			const config = loadHanConfigFile(configPath);
			expect(config).not.toBeNull();
			expect(config?.hooks?.enabled).toBe(true);
			expect(config?.hooks?.checkpoints).toBeUndefined();
		});
	});

	describe("getMergedHanConfig", () => {
		test("returns default empty config when no files exist", () => {
			const merged = getMergedHanConfig();
			expect(merged).toEqual({});
		});

		test("loads user config only", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(userConfigPath, "hooks:\n  enabled: false\n");

			const merged = getMergedHanConfig();
			expect(merged.hooks?.enabled).toBe(false);
		});

		test("loads project config only", () => {
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			writeFileSync(projectConfigPath, "hooks:\n  checkpoints: false\n");

			const merged = getMergedHanConfig();
			expect(merged.hooks?.checkpoints).toBe(false);
		});

		test("loads local config only", () => {
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");
			writeFileSync(
				localConfigPath,
				"hooks:\n  enabled: true\n  checkpoints: true\n",
			);

			const merged = getMergedHanConfig();
			expect(merged.hooks?.enabled).toBe(true);
			expect(merged.hooks?.checkpoints).toBe(true);
		});

		test("merges user and project configs (project overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				userConfigPath,
				"hooks:\n  enabled: false\n  checkpoints: true\n",
			);
			writeFileSync(projectConfigPath, "hooks:\n  enabled: true\n");

			const merged = getMergedHanConfig();
			expect(merged.hooks?.enabled).toBe(true); // Project overrides user
			expect(merged.hooks?.checkpoints).toBe(true); // From user
		});

		test("merges all three configs (local > project > user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(
				userConfigPath,
				"hooks:\n  enabled: true\n  checkpoints: true\n",
			);
			writeFileSync(projectConfigPath, "hooks:\n  enabled: false\n");
			writeFileSync(localConfigPath, "hooks:\n  checkpoints: false\n");

			const merged = getMergedHanConfig();
			expect(merged.hooks?.enabled).toBe(false); // From project
			expect(merged.hooks?.checkpoints).toBe(false); // Local overrides user
		});

		test("handles malformed config gracefully", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(userConfigPath, "{ invalid yaml");
			writeFileSync(projectConfigPath, "hooks:\n  enabled: true\n");

			const merged = getMergedHanConfig();
			// Should skip malformed user config and use project config
			expect(merged.hooks?.enabled).toBe(true);
		});
	});

	describe("isHooksEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isHooksEnabled()).toBe(true);
		});

		test("returns true when hooks.enabled is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			expect(isHooksEnabled()).toBe(true);
		});

		test("returns false when hooks.enabled is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: false\n");

			expect(isHooksEnabled()).toBe(false);
		});

		test("returns true when hooks section exists but enabled is undefined", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  checkpoints: false\n");

			expect(isHooksEnabled()).toBe(true);
		});

		test("respects config precedence (local overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(userConfigPath, "hooks:\n  enabled: false\n");
			writeFileSync(localConfigPath, "hooks:\n  enabled: true\n");

			expect(isHooksEnabled()).toBe(true);
		});
	});

	describe("isCheckpointsEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isCheckpointsEnabled()).toBe(true);
		});

		test("returns true when hooks.checkpoints is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  checkpoints: true\n");

			expect(isCheckpointsEnabled()).toBe(true);
		});

		test("returns false when hooks.checkpoints is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  checkpoints: false\n");

			expect(isCheckpointsEnabled()).toBe(false);
		});

		test("returns true when hooks section exists but checkpoints is undefined", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			expect(isCheckpointsEnabled()).toBe(true);
		});

		test("respects config precedence (project overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(userConfigPath, "hooks:\n  checkpoints: true\n");
			writeFileSync(projectConfigPath, "hooks:\n  checkpoints: false\n");

			expect(isCheckpointsEnabled()).toBe(false);
		});

		test("returns false when hooks are globally disabled", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(
				configPath,
				"hooks:\n  enabled: false\n  checkpoints: true\n",
			);

			// When hooks are disabled globally, checkpoints should also be disabled
			expect(isCheckpointsEnabled()).toBe(false);
		});
	});

	describe("isMemoryEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isMemoryEnabled()).toBe(true);
		});

		test("returns true when memory.enabled is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "memory:\n  enabled: true\n");

			expect(isMemoryEnabled()).toBe(true);
		});

		test("returns false when memory.enabled is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "memory:\n  enabled: false\n");

			expect(isMemoryEnabled()).toBe(false);
		});

		test("respects config precedence (project overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(userConfigPath, "memory:\n  enabled: true\n");
			writeFileSync(projectConfigPath, "memory:\n  enabled: false\n");

			expect(isMemoryEnabled()).toBe(false);
		});
	});

	describe("isMetricsEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isMetricsEnabled()).toBe(true);
		});

		test("returns true when metrics.enabled is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "metrics:\n  enabled: true\n");

			expect(isMetricsEnabled()).toBe(true);
		});

		test("returns false when metrics.enabled is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "metrics:\n  enabled: false\n");

			expect(isMetricsEnabled()).toBe(false);
		});

		test("respects config precedence (local overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(userConfigPath, "metrics:\n  enabled: false\n");
			writeFileSync(localConfigPath, "metrics:\n  enabled: true\n");

			expect(isMetricsEnabled()).toBe(true);
		});
	});

	describe("isCacheEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isCacheEnabled()).toBe(true);
		});

		test("returns true when hooks.cache is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  cache: true\n");

			expect(isCacheEnabled()).toBe(true);
		});

		test("returns false when hooks.cache is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  cache: false\n");

			expect(isCacheEnabled()).toBe(false);
		});

		test("returns true when hooks section exists but cache is undefined", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			expect(isCacheEnabled()).toBe(true);
		});

		test("respects config precedence (project overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(userConfigPath, "hooks:\n  cache: true\n");
			writeFileSync(projectConfigPath, "hooks:\n  cache: false\n");

			expect(isCacheEnabled()).toBe(false);
		});

		test("returns false when hooks are globally disabled", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: false\n  cache: true\n");

			// When hooks are disabled globally, cache should also be disabled
			expect(isCacheEnabled()).toBe(false);
		});
	});

	describe("isFailFastEnabled", () => {
		test("returns true by default when no config exists", () => {
			expect(isFailFastEnabled()).toBe(true);
		});

		test("returns true when hooks.fail_fast is explicitly true", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  fail_fast: true\n");

			expect(isFailFastEnabled()).toBe(true);
		});

		test("returns false when hooks.fail_fast is false", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  fail_fast: false\n");

			expect(isFailFastEnabled()).toBe(false);
		});

		test("returns true when hooks section exists but fail_fast is undefined", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			expect(isFailFastEnabled()).toBe(true);
		});

		test("respects config precedence (local overrides project)", () => {
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(projectConfigPath, "hooks:\n  fail_fast: true\n");
			writeFileSync(localConfigPath, "hooks:\n  fail_fast: false\n");

			expect(isFailFastEnabled()).toBe(false);
		});

		test("returns false when hooks are globally disabled", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(
				configPath,
				"hooks:\n  enabled: false\n  fail_fast: true\n",
			);

			// When hooks are disabled globally, fail_fast should also be disabled
			expect(isFailFastEnabled()).toBe(false);
		});
	});

	describe("getHanBinary", () => {
		test("returns 'han' by default when no config exists", () => {
			expect(getHanBinary()).toBe("han");
		});

		test("returns 'han' when config exists but hanBinary is not set", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hooks:\n  enabled: true\n");

			expect(getHanBinary()).toBe("han");
		});

		test("returns custom value when hanBinary is configured", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(
				configPath,
				"hanBinary: bun run /path/to/han/packages/han/lib/main.ts\n",
			);

			expect(getHanBinary()).toBe(
				"bun run /path/to/han/packages/han/lib/main.ts",
			);
		});

		test("returns custom path when hanBinary is a simple path", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hanBinary: /usr/local/bin/han-dev\n");

			expect(getHanBinary()).toBe("/usr/local/bin/han-dev");
		});

		test("respects config precedence (project overrides user)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(userConfigPath, "hanBinary: /user/bin/han\n");
			writeFileSync(projectConfigPath, "hanBinary: /project/bin/han\n");

			expect(getHanBinary()).toBe("/project/bin/han");
		});

		test("respects config precedence (local overrides project)", () => {
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(projectConfigPath, "hanBinary: /project/bin/han\n");
			writeFileSync(localConfigPath, "hanBinary: /local/bin/han\n");

			expect(getHanBinary()).toBe("/local/bin/han");
		});

		test("respects config precedence (root overrides local)", () => {
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");
			const rootConfigPath = join(tempProjectDir, "han.yml");

			writeFileSync(localConfigPath, "hanBinary: /local/bin/han\n");
			writeFileSync(rootConfigPath, "hanBinary: /root/bin/han\n");

			expect(getHanBinary()).toBe("/root/bin/han");
		});

		test("handles hanBinary with other config options", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(
				configPath,
				`hanBinary: bun run /dev/han/main.ts
hooks:
  enabled: true
  checkpoints: false
memory:
  enabled: true
`,
			);

			expect(getHanBinary()).toBe("bun run /dev/han/main.ts");
		});

		test("HAN_BINARY env var takes priority over config", () => {
			const configPath = join(tempUserDir, "han.yml");
			writeFileSync(configPath, "hanBinary: /config/bin/han\n");

			process.env.HAN_BINARY = "/env/bin/han";
			expect(getHanBinary()).toBe("/env/bin/han");
			delete process.env.HAN_BINARY;
		});

		test("HAN_BINARY env var takes priority over default", () => {
			process.env.HAN_BINARY = "bun run /custom/main.ts";
			expect(getHanBinary()).toBe("bun run /custom/main.ts");
			delete process.env.HAN_BINARY;
		});
	});

	describe("getHanConfigPathsForDirectory", () => {
		test("includes directory-specific config when directory differs from project root", () => {
			const subDir = join(tempProjectDir, "src", "components");
			mkdirSync(subDir, { recursive: true });

			const paths = getHanConfigPathsForDirectory(subDir);

			expect(paths).toHaveLength(5);
			expect(paths[0].scope).toBe("user");
			expect(paths[1].scope).toBe("project");
			expect(paths[2].scope).toBe("local");
			expect(paths[3].scope).toBe("root");
			expect(paths[4].scope).toBe("directory");
			expect(paths[4].path).toBe(join(subDir, "han.yml"));
		});

		test("does not include directory config when directory is project root", () => {
			const paths = getHanConfigPathsForDirectory(tempProjectDir);

			expect(paths).toHaveLength(4);
			expect(paths.every((p) => p.scope !== "directory")).toBe(true);
		});

		test("handles nested directory paths", () => {
			const deepDir = join(tempProjectDir, "src", "lib", "utils");
			mkdirSync(deepDir, { recursive: true });

			const paths = getHanConfigPathsForDirectory(deepDir);

			expect(paths[4].scope).toBe("directory");
			expect(paths[4].path).toBe(join(deepDir, "han.yml"));
		});
	});

	describe("getMergedHanConfigForDirectory", () => {
		test("merges directory-specific config with base configs", () => {
			const subDir = join(tempProjectDir, "src");
			mkdirSync(subDir, { recursive: true });

			const userConfigPath = join(tempUserDir, "han.yml");
			const dirConfigPath = join(subDir, "han.yml");

			writeFileSync(userConfigPath, "hooks:\n  enabled: true\n  cache: true\n");
			writeFileSync(dirConfigPath, "hooks:\n  cache: false\n");

			const merged = getMergedHanConfigForDirectory(subDir);

			expect(merged.hooks?.enabled).toBe(true); // From user
			expect(merged.hooks?.cache).toBe(false); // Directory overrides user
		});

		test("respects full precedence chain with directory config", () => {
			const subDir = join(tempProjectDir, "src");
			mkdirSync(subDir, { recursive: true });

			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");
			const dirConfigPath = join(subDir, "han.yml");

			writeFileSync(
				userConfigPath,
				"hooks:\n  enabled: true\n  cache: true\n  checkpoints: true\n",
			);
			writeFileSync(projectConfigPath, "hooks:\n  cache: false\n");
			writeFileSync(localConfigPath, "hooks:\n  checkpoints: false\n");
			writeFileSync(dirConfigPath, "hooks:\n  fail_fast: false\n");

			const merged = getMergedHanConfigForDirectory(subDir);

			expect(merged.hooks?.enabled).toBe(true); // From user
			expect(merged.hooks?.cache).toBe(false); // From project
			expect(merged.hooks?.checkpoints).toBe(false); // From local
			expect(merged.hooks?.fail_fast).toBe(false); // From directory
		});

		test("handles directory config for project root (same as getMergedHanConfig)", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(userConfigPath, "hooks:\n  enabled: false\n");

			const merged = getMergedHanConfigForDirectory(tempProjectDir);

			expect(merged.hooks?.enabled).toBe(false);
			expect(merged).toEqual(getMergedHanConfig());
		});

		test("merges memory and metrics sections from directory config", () => {
			const subDir = join(tempProjectDir, "src");
			mkdirSync(subDir, { recursive: true });

			const userConfigPath = join(tempUserDir, "han.yml");
			const dirConfigPath = join(subDir, "han.yml");

			writeFileSync(userConfigPath, "memory:\n  enabled: true\n");
			writeFileSync(
				dirConfigPath,
				"memory:\n  enabled: false\nmetrics:\n  enabled: false\n",
			);

			const merged = getMergedHanConfigForDirectory(subDir);

			expect(merged.memory?.enabled).toBe(false); // Directory overrides user
			expect(merged.metrics?.enabled).toBe(false); // From directory
		});

		test("merges plugin settings from directory config", () => {
			const subDir = join(tempProjectDir, "src");
			mkdirSync(subDir, { recursive: true });

			const userConfigPath = join(tempUserDir, "han.yml");
			const dirConfigPath = join(subDir, "han.yml");

			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: true\n",
			);
			writeFileSync(
				dirConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n",
			);

			const merged = getMergedHanConfigForDirectory(subDir);

			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(false);
		});
	});

	describe("getPluginHookSettings", () => {
		test("returns undefined when no plugin settings exist", () => {
			const settings = getPluginHookSettings("jutsu-biome", "lint");

			expect(settings).toBeUndefined();
		});

		test("returns hook settings for a specific plugin and hook", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n        command: npx biome check\n",
			);

			const settings = getPluginHookSettings("jutsu-biome", "lint");

			expect(settings).not.toBeUndefined();
			expect(settings?.enabled).toBe(false);
			expect(settings?.command).toBe("npx biome check");
		});

		test("returns undefined for non-existent plugin", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n",
			);

			const settings = getPluginHookSettings("jutsu-typescript", "lint");

			expect(settings).toBeUndefined();
		});

		test("returns undefined for non-existent hook in existing plugin", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n",
			);

			const settings = getPluginHookSettings("jutsu-biome", "format");

			expect(settings).toBeUndefined();
		});

		test("later config completely overrides hook settings", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: true\n        command: npx biome check\n",
			);
			writeFileSync(
				projectConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n",
			);

			const settings = getPluginHookSettings("jutsu-biome", "lint");

			// Project config completely replaces user config for this hook
			expect(settings?.enabled).toBe(false);
			expect(settings?.command).toBeUndefined(); // Not preserved from user
		});

		test("uses directory-specific config when directory parameter is provided", () => {
			const subDir = join(tempProjectDir, "src");
			mkdirSync(subDir, { recursive: true });

			const userConfigPath = join(tempUserDir, "han.yml");
			const dirConfigPath = join(subDir, "han.yml");

			writeFileSync(
				userConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: true\n",
			);
			writeFileSync(
				dirConfigPath,
				"plugins:\n  jutsu-biome:\n    hooks:\n      lint:\n        enabled: false\n        if_changed:\n          - '*.ts'\n",
			);

			const settings = getPluginHookSettings("jutsu-biome", "lint", subDir);

			expect(settings?.enabled).toBe(false); // Directory overrides user
			expect(settings?.if_changed).toEqual(["*.ts"]); // From directory
		});

		test("handles all hook override properties", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-typescript:
    hooks:
      typecheck:
        enabled: true
        command: tsc --noEmit
        if_changed:
          - '*.ts'
          - '*.tsx'
        idle_timeout: 5000
`,
			);

			const settings = getPluginHookSettings("jutsu-typescript", "typecheck");

			expect(settings?.enabled).toBe(true);
			expect(settings?.command).toBe("tsc --noEmit");
			expect(settings?.if_changed).toEqual(["*.ts", "*.tsx"]);
			expect(settings?.idle_timeout).toBe(5000);
		});

		test("handles idle_timeout set to false", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        idle_timeout: false
`,
			);

			const settings = getPluginHookSettings("jutsu-biome", "lint");

			expect(settings?.idle_timeout).toBe(false);
		});
	});

	describe("plugin settings merging", () => {
		test("handles undefined base plugin settings", () => {
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				projectConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(true);
		});

		test("merges multiple plugins from different config sources", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
  jutsu-typescript:
    hooks:
      typecheck:
        enabled: true
`,
			);
			writeFileSync(
				projectConfigPath,
				`plugins:
  jutsu-npm:
    hooks:
      audit:
        enabled: false
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(true);
			expect(
				merged.plugins?.["jutsu-typescript"]?.hooks?.typecheck?.enabled,
			).toBe(true);
			expect(merged.plugins?.["jutsu-npm"]?.hooks?.audit?.enabled).toBe(false);
		});

		test("merges hooks within same plugin from different sources", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
      format:
        enabled: true
`,
			);
			writeFileSync(
				projectConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: false
      check:
        enabled: true
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(false); // Project overrides
			expect(merged.plugins?.["jutsu-biome"]?.hooks?.format?.enabled).toBe(
				true,
			); // From user
			expect(merged.plugins?.["jutsu-biome"]?.hooks?.check?.enabled).toBe(true); // From project
		});

		test("hook override replaces entire hook object", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");

			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .
        if_changed:
          - '*.ts'
`,
			);
			writeFileSync(
				projectConfigPath,
				`plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: false
`,
			);

			const settings = getPluginHookSettings("jutsu-biome", "lint");

			// Later config replaces entire hook object
			expect(settings?.enabled).toBe(false);
			expect(settings?.command).toBeUndefined(); // Not preserved
			expect(settings?.if_changed).toBeUndefined(); // Not preserved
		});

		test("handles empty plugins section", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(userConfigPath, "plugins: {}\n");

			const merged = getMergedHanConfig();

			expect(merged.plugins).toEqual({});
		});

		test("handles plugin with no hooks section", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				`plugins:
  jutsu-biome: {}
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.plugins?.["jutsu-biome"]).toEqual({});
		});
	});

	describe("root config precedence", () => {
		test("root han.yml overrides project .claude/han.yml", () => {
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const rootConfigPath = join(tempProjectDir, "han.yml");

			writeFileSync(projectConfigPath, "hooks:\n  enabled: true\n");
			writeFileSync(rootConfigPath, "hooks:\n  enabled: false\n");

			const merged = getMergedHanConfig();

			expect(merged.hooks?.enabled).toBe(false); // Root overrides project
		});

		test("root config overrides local config", () => {
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");
			const rootConfigPath = join(tempProjectDir, "han.yml");

			writeFileSync(localConfigPath, "hooks:\n  cache: true\n");
			writeFileSync(rootConfigPath, "hooks:\n  cache: false\n");

			const merged = getMergedHanConfig();

			// Precedence: user < project < local < root
			expect(merged.hooks?.cache).toBe(false); // Root overrides local
		});

		test("root config is highest precedence", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const projectConfigPath = join(tempProjectDir, ".claude", "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");
			const rootConfigPath = join(tempProjectDir, "han.yml");

			writeFileSync(userConfigPath, "hooks:\n  fail_fast: false\n");
			writeFileSync(projectConfigPath, "hooks:\n  fail_fast: false\n");
			writeFileSync(localConfigPath, "hooks:\n  fail_fast: false\n");
			writeFileSync(rootConfigPath, "hooks:\n  fail_fast: true\n");

			const merged = getMergedHanConfig();

			expect(merged.hooks?.fail_fast).toBe(true); // Root has highest precedence
		});
	});

	describe("complex config scenarios", () => {
		test("merges all config sections simultaneously", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			writeFileSync(
				userConfigPath,
				`hooks:
  enabled: true
  checkpoints: true
  cache: true
  fail_fast: true
memory:
  enabled: true
metrics:
  enabled: true
plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.hooks?.enabled).toBe(true);
			expect(merged.hooks?.checkpoints).toBe(true);
			expect(merged.hooks?.cache).toBe(true);
			expect(merged.hooks?.fail_fast).toBe(true);
			expect(merged.memory?.enabled).toBe(true);
			expect(merged.metrics?.enabled).toBe(true);
			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(true);
		});

		test("handles selective overrides across all sections", () => {
			const userConfigPath = join(tempUserDir, "han.yml");
			const localConfigPath = join(tempProjectDir, ".claude", "han.local.yml");

			writeFileSync(
				userConfigPath,
				`hooks:
  enabled: true
  checkpoints: true
  cache: true
memory:
  enabled: true
metrics:
  enabled: true
plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
`,
			);
			writeFileSync(
				localConfigPath,
				`hooks:
  checkpoints: false
memory:
  enabled: false
plugins:
  jutsu-biome:
    hooks:
      format:
        command: custom-format
`,
			);

			const merged = getMergedHanConfig();

			expect(merged.hooks?.enabled).toBe(true); // From user
			expect(merged.hooks?.checkpoints).toBe(false); // Overridden by local
			expect(merged.hooks?.cache).toBe(true); // From user
			expect(merged.memory?.enabled).toBe(false); // Overridden by local
			expect(merged.metrics?.enabled).toBe(true); // From user
			expect(merged.plugins?.["jutsu-biome"]?.hooks?.lint?.enabled).toBe(true); // From user
			expect(merged.plugins?.["jutsu-biome"]?.hooks?.format?.command).toBe(
				"custom-format",
			); // From local (different hook)
		});
	});
});
