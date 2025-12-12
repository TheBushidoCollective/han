/**
 * Unit tests for han-settings.ts
 * Tests han.yml configuration loading and merging
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getHanConfigPaths,
	getMergedHanConfig,
	isCheckpointsEnabled,
	isHooksEnabled,
	loadHanConfigFile,
} from "../lib/han-settings.ts";

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

describe("han-settings.ts", () => {
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
});
