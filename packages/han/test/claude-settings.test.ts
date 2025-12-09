/**
 * Tests for claude-settings.ts
 * Testing configuration reading and settings paths
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
	getClaudeConfigDir,
	getProjectDir,
	getSettingsPaths,
	readSettingsFile,
} from "../lib/claude-settings.ts";

describe("claude-settings.ts", () => {
	describe("getClaudeConfigDir", () => {
		const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
		const originalHome = process.env.HOME;

		afterEach(() => {
			if (originalConfigDir !== undefined) {
				process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
			} else {
				delete process.env.CLAUDE_CONFIG_DIR;
			}
			if (originalHome !== undefined) {
				process.env.HOME = originalHome;
			} else {
				delete process.env.HOME;
			}
		});

		test("returns CLAUDE_CONFIG_DIR when set", () => {
			process.env.CLAUDE_CONFIG_DIR = "/custom/config";
			expect(getClaudeConfigDir()).toBe("/custom/config");
		});

		test("returns ~/.claude when CLAUDE_CONFIG_DIR not set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			process.env.HOME = "/home/user";
			expect(getClaudeConfigDir()).toBe("/home/user/.claude");
		});

		test("returns empty string when no HOME set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;
			delete process.env.USERPROFILE;
			expect(getClaudeConfigDir()).toBe("");
		});
	});

	describe("getProjectDir", () => {
		const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
		const originalCwd = process.cwd;

		afterEach(() => {
			if (originalProjectDir !== undefined) {
				process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
			} else {
				delete process.env.CLAUDE_PROJECT_DIR;
			}
			process.cwd = originalCwd;
		});

		test("returns CLAUDE_PROJECT_DIR when set", () => {
			process.env.CLAUDE_PROJECT_DIR = "/my/project";
			expect(getProjectDir()).toBe("/my/project");
		});

		test("returns cwd when CLAUDE_PROJECT_DIR not set", () => {
			delete process.env.CLAUDE_PROJECT_DIR;
			process.cwd = () => "/current/directory";
			expect(getProjectDir()).toBe("/current/directory");
		});
	});

	describe("readSettingsFile", () => {
		let testDir: string;

		beforeEach(() => {
			const random = Math.random().toString(36).substring(2, 9);
			testDir = `/tmp/han-settings-test-${Date.now()}-${random}`;
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			if (testDir && existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		test("returns null for non-existent file", () => {
			expect(readSettingsFile("/non/existent/path.json")).toBeNull();
		});

		test("parses valid JSON settings file", () => {
			const settingsPath = join(testDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({ enabledPlugins: { "jutsu-typescript": true } }),
			);
			const result = readSettingsFile(settingsPath);
			expect(result).not.toBeNull();
			expect(result?.enabledPlugins).toEqual({ "jutsu-typescript": true });
		});

		test("returns null for invalid JSON", () => {
			const settingsPath = join(testDir, "invalid.json");
			writeFileSync(settingsPath, "not valid json {");
			expect(readSettingsFile(settingsPath)).toBeNull();
		});

		test("parses settings with hooks", () => {
			const settingsPath = join(testDir, "settings.json");
			const settings = {
				hooks: {
					SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }],
				},
			};
			writeFileSync(settingsPath, JSON.stringify(settings));
			const result = readSettingsFile(settingsPath);
			expect(result?.hooks).toBeDefined();
			expect(result?.hooks?.SessionStart).toBeDefined();
		});

		test("parses settings with marketplaces", () => {
			const settingsPath = join(testDir, "settings.json");
			const settings = {
				extraKnownMarketplaces: {
					han: { source: { source: "github", repo: "han-plugins/han" } },
				},
			};
			writeFileSync(settingsPath, JSON.stringify(settings));
			const result = readSettingsFile(settingsPath);
			expect(result?.extraKnownMarketplaces?.han).toBeDefined();
		});

		test("parses empty settings object", () => {
			const settingsPath = join(testDir, "settings.json");
			writeFileSync(settingsPath, "{}");
			const result = readSettingsFile(settingsPath);
			expect(result).toEqual({});
		});
	});

	describe("getSettingsPaths", () => {
		const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
		const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;

		afterEach(() => {
			if (originalConfigDir !== undefined) {
				process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
			} else {
				delete process.env.CLAUDE_CONFIG_DIR;
			}
			if (originalProjectDir !== undefined) {
				process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
			} else {
				delete process.env.CLAUDE_PROJECT_DIR;
			}
		});

		test("returns paths in correct order", () => {
			process.env.CLAUDE_CONFIG_DIR = "/config";
			process.env.CLAUDE_PROJECT_DIR = "/project";

			const paths = getSettingsPaths();
			const scopes = paths.map((p) => p.scope);

			// User should come before project, which should come before local
			expect(scopes.indexOf("user")).toBeLessThan(scopes.indexOf("project"));
			expect(scopes.indexOf("project")).toBeLessThan(scopes.indexOf("local"));
		});

		test("includes user settings path", () => {
			process.env.CLAUDE_CONFIG_DIR = "/my/config";
			process.env.CLAUDE_PROJECT_DIR = "/project";

			const paths = getSettingsPaths();
			const userPath = paths.find((p) => p.scope === "user");

			expect(userPath).toBeDefined();
			expect(userPath?.path).toBe("/my/config/settings.json");
		});

		test("includes project settings path", () => {
			process.env.CLAUDE_CONFIG_DIR = "/config";
			process.env.CLAUDE_PROJECT_DIR = "/my/project";

			const paths = getSettingsPaths();
			const projectPath = paths.find((p) => p.scope === "project");

			expect(projectPath).toBeDefined();
			expect(projectPath?.path).toBe("/my/project/.claude/settings.json");
		});

		test("includes local settings path", () => {
			process.env.CLAUDE_CONFIG_DIR = "/config";
			process.env.CLAUDE_PROJECT_DIR = "/my/project";

			const paths = getSettingsPaths();
			const localPath = paths.find((p) => p.scope === "local");

			expect(localPath).toBeDefined();
			expect(localPath?.path).toBe("/my/project/.claude/settings.local.json");
		});

		test("returns at least 3 paths", () => {
			process.env.CLAUDE_CONFIG_DIR = "/config";
			process.env.CLAUDE_PROJECT_DIR = "/project";

			const paths = getSettingsPaths();
			// User, project, local at minimum
			expect(paths.length).toBeGreaterThanOrEqual(3);
		});
	});
});
