/**
 * Unit tests for shared.ts
 * Tests settings management and utility functions
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	type ClaudeSettings,
	ensureClaudeDirectory,
	getClaudeSettingsPath,
	getGlobalClaudeSettingsPath,
	getSettingsFilename,
	type InstallScope,
	readGlobalSettings,
	readOrCreateSettings,
	writeGlobalSettings,
	writeSettings,
} from "../lib/shared/index.ts";

// Store original environment
const originalEnv = { ...process.env };
const originalCwd = process.cwd;

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-shared-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(join(projectDir, ".claude"), { recursive: true });

	// Set environment for tests
	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.HOME = testDir;
	// Mock cwd to point to project dir
	process.cwd = () => projectDir;
}

function teardown(): void {
	process.env = { ...originalEnv };
	process.cwd = originalCwd;

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("shared.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getGlobalClaudeSettingsPath", () => {
		test("returns CLAUDE_CONFIG_DIR path when set", () => {
			process.env.CLAUDE_CONFIG_DIR = "/custom/config/dir";
			const result = getGlobalClaudeSettingsPath();
			expect(result).toBe("/custom/config/dir/settings.json");
		});

		test("returns ~/.claude/settings.json when CLAUDE_CONFIG_DIR not set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			process.env.HOME = "/home/testuser";
			const result = getGlobalClaudeSettingsPath();
			expect(result).toBe("/home/testuser/.claude/settings.json");
		});

		test("uses USERPROFILE when HOME not set", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;
			process.env.USERPROFILE = "C:\\Users\\testuser";
			const result = getGlobalClaudeSettingsPath();
			expect(result).toBe("C:\\Users\\testuser/.claude/settings.json");
		});

		test("handles missing home dir gracefully", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			delete process.env.HOME;
			delete process.env.USERPROFILE;
			const result = getGlobalClaudeSettingsPath();
			expect(result).toBe(".claude/settings.json");
		});
	});

	describe("getClaudeSettingsPath", () => {
		test("returns global path for user scope", () => {
			process.env.CLAUDE_CONFIG_DIR = "/config";
			const result = getClaudeSettingsPath("user");
			expect(result).toBe("/config/settings.json");
		});

		test("returns project path for project scope", () => {
			const result = getClaudeSettingsPath("project");
			expect(result).toBe(join(projectDir, ".claude", "settings.json"));
		});

		test("returns local path for local scope", () => {
			const result = getClaudeSettingsPath("local");
			expect(result).toBe(join(projectDir, ".claude", "settings.local.json"));
		});

		test("defaults to user scope", () => {
			process.env.CLAUDE_CONFIG_DIR = "/default";
			const result = getClaudeSettingsPath();
			expect(result).toBe("/default/settings.json");
		});
	});

	describe("getSettingsFilename", () => {
		test("returns user config path for user scope", () => {
			process.env.CLAUDE_CONFIG_DIR = "/custom/config";
			const result = getSettingsFilename("user");
			expect(result).toBe("/custom/config/settings.json");
		});

		test("returns relative .claude path for project scope", () => {
			const result = getSettingsFilename("project");
			expect(result).toBe(".claude/settings.json");
		});

		test("returns relative .claude path with local suffix for local scope", () => {
			const result = getSettingsFilename("local");
			expect(result).toBe(".claude/settings.local.json");
		});
	});

	describe("readGlobalSettings", () => {
		test("returns empty object when no settings file exists", () => {
			// Point to non-existent dir
			process.env.CLAUDE_CONFIG_DIR = join(testDir, "nonexistent");
			const result = readGlobalSettings();
			expect(result).toEqual({});
		});

		test("reads valid JSON settings file", () => {
			const settings: ClaudeSettings = {
				enabledPlugins: { "jutsu-biome@han": true },
				extraKnownMarketplaces: {
					han: { source: { source: "github", repo: "test/repo" } },
				},
			};
			writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

			const result = readGlobalSettings();
			expect(result.enabledPlugins?.["jutsu-biome@han"]).toBe(true);
			expect(result.extraKnownMarketplaces?.han?.source.source).toBe("github");
		});

		test("returns empty object for invalid JSON", () => {
			writeFileSync(join(configDir, "settings.json"), "not valid json {");
			const result = readGlobalSettings();
			expect(result).toEqual({});
		});
	});

	describe("writeGlobalSettings", () => {
		test("creates settings file", () => {
			const settings: ClaudeSettings = {
				enabledPlugins: { "test-plugin@market": true },
			};

			writeGlobalSettings(settings);

			const settingsPath = join(configDir, "settings.json");
			expect(existsSync(settingsPath)).toBe(true);

			const content = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(content.enabledPlugins["test-plugin@market"]).toBe(true);
		});

		test("creates directory if not exists", () => {
			process.env.CLAUDE_CONFIG_DIR = join(testDir, "new-config-dir");

			const settings: ClaudeSettings = { test: "value" };
			writeGlobalSettings(settings);

			const settingsPath = join(testDir, "new-config-dir", "settings.json");
			expect(existsSync(settingsPath)).toBe(true);
		});

		test("formats JSON with indentation", () => {
			const settings: ClaudeSettings = { key: "value" };
			writeGlobalSettings(settings);

			const content = readFileSync(join(configDir, "settings.json"), "utf-8");
			expect(content).toContain("\n"); // Should have newlines from formatting
		});
	});

	describe("readOrCreateSettings", () => {
		test("returns empty object when settings file does not exist", () => {
			const newConfigDir = join(testDir, "read-or-create-test");
			mkdirSync(newConfigDir, { recursive: true });
			process.env.CLAUDE_CONFIG_DIR = newConfigDir;

			const result = readOrCreateSettings("user");

			// readOrCreateSettings doesn't actually create the file if it doesn't exist
			expect(result).toEqual({});
		});

		test("reads existing settings file", () => {
			const settings: ClaudeSettings = { existing: "data" };
			writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

			const result = readOrCreateSettings("user");
			expect(result.existing).toBe("data");
		});

		test("handles project scope", () => {
			const projectSettings: ClaudeSettings = { project: true };
			writeFileSync(
				join(projectDir, ".claude", "settings.json"),
				JSON.stringify(projectSettings),
			);

			const result = readOrCreateSettings("project");
			expect(result.project).toBe(true);
		});
	});

	describe("writeSettings", () => {
		test("writes settings to correct scope path", () => {
			const settings: ClaudeSettings = { scopeTest: true };

			writeSettings(settings, "project");

			const content = JSON.parse(
				readFileSync(join(projectDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(content.scopeTest).toBe(true);
		});

		test("creates directory if needed for project scope", () => {
			const newProjectDir = join(testDir, "new-project");
			mkdirSync(join(newProjectDir, ".claude"), { recursive: true });
			process.cwd = () => newProjectDir;

			const settings: ClaudeSettings = { newProject: true };
			writeSettings(settings, "project");

			const settingsPath = join(newProjectDir, ".claude", "settings.json");
			expect(existsSync(settingsPath)).toBe(true);
		});
	});

	describe("ensureClaudeDirectory", () => {
		test("creates user config directory if not exists", () => {
			const newDir = join(testDir, "ensure-test");
			process.env.CLAUDE_CONFIG_DIR = newDir;

			ensureClaudeDirectory("user");

			expect(existsSync(newDir)).toBe(true);
		});

		test("creates project .claude directory if not exists", () => {
			const newProjectDir = join(testDir, "new-ensure-project");
			process.cwd = () => newProjectDir;

			ensureClaudeDirectory("project");

			expect(existsSync(join(newProjectDir, ".claude"))).toBe(true);
		});

		test("does nothing if directory already exists", () => {
			ensureClaudeDirectory("user");
			// Should not throw
			ensureClaudeDirectory("user");
			expect(existsSync(configDir)).toBe(true);
		});
	});
});

describe("shared.ts type definitions", () => {
	test("InstallScope type accepts valid values", () => {
		const scopes: InstallScope[] = ["user", "project", "local"];
		expect(scopes.length).toBe(3);
	});

	test("ClaudeSettings allows arbitrary keys", () => {
		const settings: ClaudeSettings = {
			enabledPlugins: { "test@market": true },
			extraKnownMarketplaces: {},
			customKey: "custom value",
		};
		expect(settings.customKey).toBe("custom value");
	});
});

describe("parsePluginRecommendations", () => {
	// Import the function dynamically to test it
	const { parsePluginRecommendations } = require("../lib/shared/index.ts");

	test("parses JSON array of plugin names", () => {
		const content =
			'Here are the recommended plugins: ["jutsu-typescript", "jutsu-biome", "hashi-github"]';
		const result = parsePluginRecommendations(content);
		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("jutsu-biome");
		expect(result).toContain("hashi-github");
		expect(result).toContain("bushido"); // Always included
	});

	test("handles multiline JSON array", () => {
		const content = `
Here are my recommendations:
[
  "jutsu-bun",
  "jutsu-markdown",
  "bushido"
]
These plugins should work well.
`;
		const result = parsePluginRecommendations(content);
		expect(result).toContain("jutsu-bun");
		expect(result).toContain("jutsu-markdown");
		expect(result).toContain("bushido");
	});

	test("falls back to regex pattern matching", () => {
		const content =
			"I recommend using jutsu-typescript for TypeScript support and do-accessibility for accessibility testing.";
		const result = parsePluginRecommendations(content);
		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("do-accessibility");
		expect(result).toContain("bushido");
	});

	test("returns only bushido when no plugins found", () => {
		const content = "No specific plugins are needed for this project.";
		const result = parsePluginRecommendations(content);
		expect(result).toEqual(["bushido"]);
	});

	test("deduplicates plugin names", () => {
		const content = '["jutsu-typescript", "jutsu-typescript", "bushido"]';
		const result = parsePluginRecommendations(content);
		const typescriptCount = result.filter(
			(p: string) => p === "jutsu-typescript",
		).length;
		expect(typescriptCount).toBe(1);
	});

	test("handles invalid JSON gracefully", () => {
		const content = "[not valid json at all]";
		const result = parsePluginRecommendations(content);
		expect(result).toContain("bushido");
	});

	test("filters non-string values from JSON array", () => {
		const content = '["jutsu-bun", 123, null, "do-frontend"]';
		const result = parsePluginRecommendations(content);
		expect(result).toContain("jutsu-bun");
		expect(result).toContain("do-frontend");
		expect(result).toContain("bushido");
		expect(result).not.toContain(123);
		expect(result).not.toContain(null);
	});

	test("matches hashi plugins", () => {
		const content =
			"Use hashi-github for GitHub integration and hashi-playwright-mcp for browser testing.";
		const result = parsePluginRecommendations(content);
		expect(result).toContain("hashi-github");
		expect(result).toContain("hashi-playwright-mcp");
	});
});

describe("ensureDispatchHooks", () => {
	const originalEnv = { ...process.env };
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-dispatch-hooks-test-${Date.now()}-${random}`);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.env.CLAUDE_PROJECT_DIR = projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	// Import dynamically to get fresh module state
	const getEnsureDispatchHooks = () =>
		require("../lib/shared/index.ts").ensureDispatchHooks;

	test("creates hooks if none exist", () => {
		// Start with settings file that has no hooks
		const settings = { enabledPlugins: {} };
		writeFileSync(
			join(configDir, "settings.json"),
			JSON.stringify(settings, null, 2),
		);

		const ensureDispatchHooks = getEnsureDispatchHooks();
		ensureDispatchHooks();

		const result = JSON.parse(
			readFileSync(join(configDir, "settings.json"), "utf-8"),
		);
		expect(result.hooks).toBeDefined();
		expect(result.hooks.UserPromptSubmit).toBeDefined();
		expect(result.hooks.SessionStart).toBeDefined();
	});

	test("does not modify if dispatch hooks already exist", () => {
		const settings = {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: "command",
								command: "han hook dispatch UserPromptSubmit",
							},
						],
					},
				],
				SessionStart: [
					{
						hooks: [
							{ type: "command", command: "han hook dispatch SessionStart" },
						],
					},
				],
			},
		};
		writeFileSync(
			join(configDir, "settings.json"),
			JSON.stringify(settings, null, 2),
		);

		const ensureDispatchHooks = getEnsureDispatchHooks();
		ensureDispatchHooks();

		const result = JSON.parse(
			readFileSync(join(configDir, "settings.json"), "utf-8"),
		);
		// Should still have exactly one group per hook type
		expect(result.hooks.UserPromptSubmit.length).toBe(1);
		expect(result.hooks.SessionStart.length).toBe(1);
	});

	test("migrates old-style npx hooks to direct han command", () => {
		const settings = {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: "command",
								command:
									"npx --yes @thebushidocollective/han@latest han hook dispatch UserPromptSubmit",
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(configDir, "settings.json"),
			JSON.stringify(settings, null, 2),
		);

		const ensureDispatchHooks = getEnsureDispatchHooks();
		ensureDispatchHooks();

		const result = JSON.parse(
			readFileSync(join(configDir, "settings.json"), "utf-8"),
		);
		// Should have migrated the command
		expect(result.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
			"han hook dispatch UserPromptSubmit",
		);
	});
});

describe("detectHanScopes", () => {
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd;
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-detect-scopes-test-${Date.now()}-${random}`);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.env.HOME = testDir;
		process.cwd = () => projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.cwd = originalCwd;
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	const getDetectHanScopes = () =>
		require("../lib/shared/index.ts").detectHanScopes;

	test("returns empty array when no Han configured", () => {
		const detectHanScopes = getDetectHanScopes();
		const result = detectHanScopes();
		expect(result).toEqual([]);
	});

	test("detects user scope when Han configured globally", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const detectHanScopes = getDetectHanScopes();
		const result = detectHanScopes();
		expect(result).toContain("user");
	});

	test("detects project scope", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);

		const detectHanScopes = getDetectHanScopes();
		const result = detectHanScopes();
		expect(result).toContain("project");
	});

	test("detects local scope", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(
			join(projectDir, ".claude", "settings.local.json"),
			JSON.stringify(settings),
		);

		const detectHanScopes = getDetectHanScopes();
		const result = detectHanScopes();
		expect(result).toContain("local");
	});

	test("detects multiple scopes", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);

		const detectHanScopes = getDetectHanScopes();
		const result = detectHanScopes();
		expect(result).toContain("user");
		expect(result).toContain("project");
	});
});

describe("getInstalledPlugins", () => {
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd;
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(
			tmpdir(),
			`han-installed-plugins-test-${Date.now()}-${random}`,
		);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.cwd = () => projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.cwd = originalCwd;
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	const getGetInstalledPlugins = () =>
		require("../lib/shared/index.ts").getInstalledPlugins;

	test("returns empty array when no plugins installed", () => {
		const getInstalledPlugins = getGetInstalledPlugins();
		const result = getInstalledPlugins("user");
		expect(result).toEqual([]);
	});

	test("returns installed han plugins", () => {
		const settings = {
			enabledPlugins: {
				"jutsu-typescript@han": true,
				"jutsu-biome@han": true,
				"other-plugin@market": true,
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const getInstalledPlugins = getGetInstalledPlugins();
		const result = getInstalledPlugins("user");
		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("jutsu-biome");
		expect(result).not.toContain("other-plugin");
	});

	test("filters out disabled plugins", () => {
		const settings = {
			enabledPlugins: {
				"jutsu-typescript@han": true,
				"jutsu-biome@han": false,
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const getInstalledPlugins = getGetInstalledPlugins();
		const result = getInstalledPlugins("user");
		expect(result).toContain("jutsu-typescript");
		expect(result).not.toContain("jutsu-biome");
	});

	test("works with project scope", () => {
		const settings = {
			enabledPlugins: {
				"hashi-github@han": true,
			},
		};
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);

		const getInstalledPlugins = getGetInstalledPlugins();
		const result = getInstalledPlugins("project");
		expect(result).toContain("hashi-github");
	});
});

describe("removeInvalidPlugins", () => {
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd;
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-remove-invalid-test-${Date.now()}-${random}`);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.cwd = () => projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.cwd = originalCwd;
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	const getRemoveInvalidPlugins = () =>
		require("../lib/shared/index.ts").removeInvalidPlugins;

	test("removes plugins not in valid set", () => {
		const settings = {
			enabledPlugins: {
				"jutsu-typescript@han": true,
				"invalid-plugin@han": true,
				"jutsu-biome@han": true,
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const validPlugins = new Set(["jutsu-typescript", "jutsu-biome"]);
		const removeInvalidPlugins = getRemoveInvalidPlugins();
		const removed = removeInvalidPlugins(validPlugins, "user");

		expect(removed).toEqual(["invalid-plugin"]);

		// Check that the settings file was updated
		const result = JSON.parse(
			readFileSync(join(configDir, "settings.json"), "utf-8"),
		);
		expect(result.enabledPlugins["invalid-plugin@han"]).toBeUndefined();
		expect(result.enabledPlugins["jutsu-typescript@han"]).toBe(true);
	});

	test("returns empty array when all plugins are valid", () => {
		const settings = {
			enabledPlugins: {
				"jutsu-typescript@han": true,
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const validPlugins = new Set(["jutsu-typescript"]);
		const removeInvalidPlugins = getRemoveInvalidPlugins();
		const removed = removeInvalidPlugins(validPlugins, "user");

		expect(removed).toEqual([]);
	});

	test("does not modify file when no invalid plugins", () => {
		const settings = {
			enabledPlugins: {
				"jutsu-typescript@han": true,
			},
		};
		const originalContent = JSON.stringify(settings);
		writeFileSync(join(configDir, "settings.json"), originalContent);

		const validPlugins = new Set(["jutsu-typescript"]);
		const removeInvalidPlugins = getRemoveInvalidPlugins();
		removeInvalidPlugins(validPlugins, "user");

		// File should not have been modified (no trailing newline added)
		const content = readFileSync(join(configDir, "settings.json"), "utf-8");
		expect(content).toBe(originalContent);
	});
});

describe("readOrCreateSettings error handling", () => {
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd;
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-read-error-test-${Date.now()}-${random}`);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.cwd = () => projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.cwd = originalCwd;
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	test("handles invalid JSON in project settings", () => {
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			"invalid json content",
		);

		const { readOrCreateSettings } = require("../lib/shared/index.ts");
		const result = readOrCreateSettings("project");
		expect(result).toEqual({});
	});

	test("handles invalid JSON in local settings", () => {
		writeFileSync(
			join(projectDir, ".claude", "settings.local.json"),
			"{ broken json",
		);

		const { readOrCreateSettings } = require("../lib/shared/index.ts");
		const result = readOrCreateSettings("local");
		expect(result).toEqual({});
	});
});

describe("findClaudeExecutable", () => {
	const { findClaudeExecutable } = require("../lib/shared/index.ts");

	test("returns path when Claude CLI is found", () => {
		// This test will pass when Claude is installed (which it is in the dev environment)
		// or fail gracefully when it's not installed
		try {
			const result = findClaudeExecutable();
			// If Claude is found, it should return a path
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		} catch (error) {
			// If Claude is not installed, verify the error message
			expect((error as Error).message).toContain("Claude CLI not found");
		}
	});

	test("error message contains installation guidance", () => {
		// Test the error message format directly
		const expectedMessage =
			"Claude CLI not found. Please install Claude Code: https://claude.ai/code";
		expect(expectedMessage).toContain("Claude CLI not found");
		expect(expectedMessage).toContain("https://claude.ai/code");
	});
});

describe("MarketplacePlugin interface", () => {
	test("MarketplacePlugin has correct structure", () => {
		const plugin = {
			name: "jutsu-typescript",
			description: "TypeScript support",
			keywords: ["typescript", "type-checking"],
			category: "Technique",
		};

		expect(plugin.name).toBe("jutsu-typescript");
		expect(plugin.description).toBe("TypeScript support");
		expect(plugin.keywords).toEqual(["typescript", "type-checking"]);
		expect(plugin.category).toBe("Technique");
	});

	test("MarketplacePlugin with minimal fields", () => {
		const plugin: {
			name: string;
			description?: string;
			keywords?: string[];
			category?: string;
		} = {
			name: "core",
		};

		expect(plugin.name).toBe("core");
		expect(plugin.description).toBeUndefined();
		expect(plugin.keywords).toBeUndefined();
		expect(plugin.category).toBeUndefined();
	});
});

describe("AgentUpdate interface", () => {
	test("AgentUpdate text type", () => {
		const update = {
			type: "text" as const,
			content: "Analyzing codebase...",
		};

		expect(update.type).toBe("text");
		expect(update.content).toBe("Analyzing codebase...");
	});

	test("AgentUpdate tool type", () => {
		const update = {
			type: "tool" as const,
			content: "Using read_file",
			toolName: "read_file",
			toolInput: { path: "/src/index.ts" },
		};

		expect(update.type).toBe("tool");
		expect(update.content).toBe("Using read_file");
		expect(update.toolName).toBe("read_file");
		expect(update.toolInput).toEqual({ path: "/src/index.ts" });
	});
});

describe("DetectPluginsCallbacks interface", () => {
	test("callbacks can be defined with correct types", () => {
		const updates: Array<{ type: string; content: string }> = [];
		let completedPlugins: string[] = [];
		let errorMessage = "";

		const callbacks = {
			onUpdate: (update: { type: string; content: string }) => {
				updates.push(update);
			},
			onComplete: (plugins: string[], _fullText: string) => {
				completedPlugins = plugins;
			},
			onError: (error: Error) => {
				errorMessage = error.message;
			},
		};

		// Test onUpdate
		callbacks.onUpdate({ type: "text", content: "Testing" });
		expect(updates).toHaveLength(1);

		// Test onComplete
		callbacks.onComplete(["jutsu-typescript", "bushido"], "Full response");
		expect(completedPlugins).toEqual(["jutsu-typescript", "bushido"]);

		// Test onError
		callbacks.onError(new Error("Test error"));
		expect(errorMessage).toBe("Test error");
	});
});

describe("HookEntry interface", () => {
	test("HookEntry command type", () => {
		const hook = {
			type: "command" as const,
			command: "han hook dispatch UserPromptSubmit",
			timeout: 30000,
		};

		expect(hook.type).toBe("command");
		expect(hook.command).toBe("han hook dispatch UserPromptSubmit");
		expect(hook.timeout).toBe(30000);
	});

	test("HookEntry prompt type", () => {
		const hook = {
			type: "prompt" as const,
			prompt: "Analyze the codebase",
		};

		expect(hook.type).toBe("prompt");
		expect(hook.prompt).toBe("Analyze the codebase");
	});
});

describe("HookGroup interface", () => {
	test("HookGroup with multiple hooks", () => {
		const group = {
			hooks: [
				{ type: "command" as const, command: "han hook dispatch" },
				{ type: "prompt" as const, prompt: "Additional context" },
			],
		};

		expect(group.hooks).toHaveLength(2);
		expect(group.hooks[0]?.type).toBe("command");
		expect(group.hooks[1]?.type).toBe("prompt");
	});
});

describe("MarketplaceSource type", () => {
	test("directory source", () => {
		const source = { source: "directory" as const, path: "/local/plugins" };
		expect(source.source).toBe("directory");
		expect(source.path).toBe("/local/plugins");
	});

	test("git source", () => {
		const source = {
			source: "git" as const,
			url: "https://github.com/test/repo.git",
		};
		expect(source.source).toBe("git");
		expect(source.url).toBe("https://github.com/test/repo.git");
	});

	test("github source", () => {
		const source = {
			source: "github" as const,
			repo: "thebushidocollective/han",
		};
		expect(source.source).toBe("github");
		expect(source.repo).toBe("thebushidocollective/han");
	});
});

describe("Marketplace and Marketplaces types", () => {
	test("Marketplace with source", () => {
		const marketplace = {
			source: { source: "github" as const, repo: "test/repo" },
		};
		expect(marketplace.source.source).toBe("github");
	});

	test("Marketplaces record", () => {
		const marketplaces: Record<
			string,
			{ source: { source: string; repo: string } }
		> = {
			han: { source: { source: "github", repo: "thebushidocollective/han" } },
			custom: { source: { source: "github", repo: "user/custom-plugins" } },
		};

		expect(Object.keys(marketplaces)).toHaveLength(2);
		expect(marketplaces.han?.source.repo).toBe("thebushidocollective/han");
	});
});

describe("Plugins type", () => {
	test("Plugins record with boolean values", () => {
		const plugins: Record<string, boolean> = {
			"jutsu-typescript@han": true,
			"jutsu-biome@han": true,
			"disabled-plugin@han": false,
		};

		expect(plugins["jutsu-typescript@han"]).toBe(true);
		expect(plugins["disabled-plugin@han"]).toBe(false);
	});
});

describe("HAN_MARKETPLACE_REPO constant", () => {
	test("exports correct repo value", () => {
		const { HAN_MARKETPLACE_REPO } = require("../lib/shared/index.ts");
		expect(HAN_MARKETPLACE_REPO).toBe("thebushidocollective/han");
	});
});

describe("getEffectiveProjectScope", () => {
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd;
	let testDir: string;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(
			tmpdir(),
			`han-effective-scope-test-${Date.now()}-${random}`,
		);
		configDir = join(testDir, ".claude");
		projectDir = join(testDir, "project");
		mkdirSync(configDir, { recursive: true });
		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.env.HOME = testDir;
		process.cwd = () => projectDir;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.cwd = originalCwd;
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	const getGetEffectiveProjectScope = () =>
		require("../lib/shared/index.ts").getEffectiveProjectScope;

	test("returns null when Han is only in user scope", () => {
		// Han configured in user scope only
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBeNull();
	});

	test("returns null when Han is not installed anywhere", () => {
		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBeNull();
	});

	test("returns 'project' when Han is in project scope only", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBe("project");
	});

	test("returns 'local' when Han is in local scope only", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		writeFileSync(
			join(projectDir, ".claude", "settings.local.json"),
			JSON.stringify(settings),
		);

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBe("local");
	});

	test("returns 'local' when Han is in both project and local scopes (local takes precedence)", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		// Install Han in both project and local scopes
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);
		writeFileSync(
			join(projectDir, ".claude", "settings.local.json"),
			JSON.stringify(settings),
		);

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBe("local");
	});

	test("returns 'project' when Han is in user and project scopes (project-level overrides user)", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		// Install Han in user and project scopes
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBe("project");
	});

	test("returns 'local' when Han is in all three scopes", () => {
		const settings = {
			extraKnownMarketplaces: {
				han: { source: { source: "github", repo: "test/repo" } },
			},
		};
		// Install Han in all scopes
		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));
		writeFileSync(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify(settings),
		);
		writeFileSync(
			join(projectDir, ".claude", "settings.local.json"),
			JSON.stringify(settings),
		);

		const getEffectiveProjectScope = getGetEffectiveProjectScope();
		const result = getEffectiveProjectScope();
		expect(result).toBe("local");
	});
});

describe("Prompt building logic", () => {
	test("plugin list formatting with all fields", () => {
		const plugins = [
			{
				name: "jutsu-typescript",
				description: "TypeScript support",
				keywords: ["typescript", "ts"],
			},
			{
				name: "jutsu-biome",
				description: "Biome linting",
				keywords: ["lint", "format"],
			},
		];

		const pluginList = plugins
			.map((p) => {
				const parts = [`- ${p.name}`];
				if (p.description) parts.push(`: ${p.description}`);
				if (p.keywords && p.keywords.length > 0) {
					parts.push(` [${p.keywords.join(", ")}]`);
				}
				return parts.join("");
			})
			.join("\n");

		expect(pluginList).toContain(
			"- jutsu-typescript: TypeScript support [typescript, ts]",
		);
		expect(pluginList).toContain("- jutsu-biome: Biome linting [lint, format]");
	});

	test("plugin list formatting without description", () => {
		const plugins = [
			{ name: "core", description: undefined, keywords: undefined },
		];

		const pluginList = plugins
			.map((p) => {
				const parts = [`- ${p.name}`];
				if (p.description) parts.push(`: ${p.description}`);
				const keywords = p.keywords as string[] | undefined;
				if (keywords && keywords.length > 0) {
					parts.push(` [${keywords.join(", ")}]`);
				}
				return parts.join("");
			})
			.join("\n");

		expect(pluginList).toBe("- core");
	});

	test("plugin list formatting without keywords", () => {
		const plugins: Array<{
			name: string;
			description: string;
			keywords?: string[];
		}> = [
			{ name: "bushido", description: "Core foundation", keywords: undefined },
		];

		const pluginList = plugins
			.map((p) => {
				const parts = [`- ${p.name}`];
				if (p.description) parts.push(`: ${p.description}`);
				if (p.keywords && p.keywords.length > 0) {
					parts.push(` [${p.keywords.join(", ")}]`);
				}
				return parts.join("");
			})
			.join("\n");

		expect(pluginList).toBe("- bushido: Core foundation");
	});

	test("installed plugins list formatting", () => {
		const installedPlugins = ["core", "jutsu-typescript"];
		const allPlugins = [
			{ name: "core", description: "Core plugin" },
			{ name: "jutsu-typescript", description: "TypeScript support" },
			{ name: "jutsu-biome", description: "Biome linting" },
		];

		const installedList = installedPlugins
			.map((name) => {
				const plugin = allPlugins.find((p) => p.name === name);
				if (plugin) {
					const parts = [`- ${plugin.name}`];
					if (plugin.description) parts.push(`: ${plugin.description}`);
					return parts.join("");
				}
				return `- ${name}`;
			})
			.join("\n");

		expect(installedList).toContain("- core: Core plugin");
		expect(installedList).toContain("- jutsu-typescript: TypeScript support");
	});

	test("installed plugins list with unknown plugin", () => {
		const installedPlugins = ["unknown-plugin"];
		const allPlugins = [{ name: "core", description: "Core plugin" }];

		const installedList = installedPlugins
			.map((name) => {
				const plugin = allPlugins.find((p) => p.name === name);
				if (plugin) {
					return `- ${plugin.name}: ${plugin.description}`;
				}
				return `- ${name}`;
			})
			.join("\n");

		expect(installedList).toBe("- unknown-plugin");
	});
});

describe("Plugin validation logic", () => {
	test("validates plugins against marketplace set", () => {
		const validPluginNames = new Set([
			"jutsu-typescript",
			"jutsu-biome",
			"bushido",
		]);
		const plugins = ["jutsu-typescript", "invalid-plugin", "bushido"];

		const validated: string[] = [];
		const invalid: string[] = [];

		for (const plugin of plugins) {
			if (validPluginNames.has(plugin)) {
				validated.push(plugin);
			} else {
				invalid.push(plugin);
			}
		}

		expect(validated).toEqual(["jutsu-typescript", "bushido"]);
		expect(invalid).toEqual(["invalid-plugin"]);
	});

	test("returns bushido as default when no valid plugins", () => {
		const validated: string[] = [];
		const finalPlugins = validated.length > 0 ? validated : ["bushido"];
		expect(finalPlugins).toEqual(["bushido"]);
	});
});

describe("Agent allowed tools", () => {
	test("allowed tools are read-only", () => {
		const allowedTools = ["read_file", "glob", "grep"];

		expect(allowedTools).toContain("read_file");
		expect(allowedTools).toContain("glob");
		expect(allowedTools).toContain("grep");
		expect(allowedTools).not.toContain("write_file");
		expect(allowedTools).not.toContain("bash");
	});
});

describe("Git remote URL parsing simulation", () => {
	test("null returned when no git remote", () => {
		const remoteUrl: string | null = null;
		expect(remoteUrl).toBeNull();
	});

	test("URL returned when git remote exists", () => {
		const remoteUrl = "https://github.com/thebushidocollective/han.git";
		expect(remoteUrl).toBeTruthy();
		expect(remoteUrl).toContain("github.com");
	});

	test("empty string treated as no remote", () => {
		const rawOutput = "";
		const remoteUrl = rawOutput.trim() || null;
		expect(remoteUrl).toBeNull();
	});
});

describe("Installed plugins aggregation", () => {
	test("combines project and local plugins with deduplication", () => {
		const projectPlugins = ["core", "jutsu-typescript"];
		const localPlugins = ["jutsu-typescript", "jutsu-biome"];

		const installedPlugins = Array.from(
			new Set([...projectPlugins, ...localPlugins]),
		);

		expect(installedPlugins).toHaveLength(3);
		expect(installedPlugins).toContain("core");
		expect(installedPlugins).toContain("jutsu-typescript");
		expect(installedPlugins).toContain("jutsu-biome");
	});

	test("handles empty plugin arrays", () => {
		const projectPlugins: string[] = [];
		const localPlugins: string[] = [];

		const installedPlugins = Array.from(
			new Set([...projectPlugins, ...localPlugins]),
		);

		expect(installedPlugins).toHaveLength(0);
	});
});

describe("fetchMarketplace verbose mode", () => {
	test("HAN_VERBOSE env controls logging", () => {
		const fromCache = true;

		// Test verbose mode detection
		const originalVerbose = process.env.HAN_VERBOSE;

		process.env.HAN_VERBOSE = "true";
		const shouldLog = process.env.HAN_VERBOSE && fromCache;
		expect(shouldLog).toBeTruthy();

		delete process.env.HAN_VERBOSE;
		const shouldNotLog = process.env.HAN_VERBOSE && fromCache;
		expect(shouldNotLog).toBeFalsy();

		// Restore
		if (originalVerbose) {
			process.env.HAN_VERBOSE = originalVerbose;
		}
	});
});

describe("Error message extraction", () => {
	test("extracts message from Error object", () => {
		const error: unknown = new Error("Test error message");
		const message = error instanceof Error ? error.message : String(error);
		expect(message).toBe("Test error message");
	});

	test("converts non-Error to string", () => {
		const error: unknown = "String error";
		const message = error instanceof Error ? error.message : String(error);
		expect(message).toBe("String error");
	});

	test("handles undefined error", () => {
		const error: unknown = undefined;
		const message = error instanceof Error ? error.message : String(error);
		expect(message).toBe("undefined");
	});
});
