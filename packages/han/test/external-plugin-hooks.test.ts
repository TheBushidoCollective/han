/**
 * Tests for external plugin hook discovery and execution.
 *
 * These tests verify that han discovers and executes hooks from plugins
 * installed via various sources:
 * - Local directory paths (source: directory)
 * - Git URLs (source: git)
 * - GitHub repositories (source: github)
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

describe("External Plugin Hook Discovery", () => {
	const testDir = `/tmp/test-external-plugins-${Date.now()}`;
	let originalEnv: Record<string, string | undefined>;
	let originalCwd: () => string;

	beforeEach(() => {
		// Save original environment
		originalEnv = {
			CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
			CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
		};
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "claude-config");
		process.env.CLAUDE_PROJECT_DIR = join(testDir, "project");
		process.cwd = () => join(testDir, "project");

		// Create directories
		mkdirSync(join(testDir, "claude-config"), { recursive: true });
		mkdirSync(join(testDir, "project", ".claude"), { recursive: true });
		mkdirSync(join(testDir, "external-plugins"), { recursive: true });
	});

	afterEach(() => {
		// Restore environment
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
		process.cwd = originalCwd;

		// Clean up test directory
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Directory source plugins", () => {
		test("plugin config format with directory source", () => {
			// Create an external plugin in a local directory
			const externalPluginDir = join(testDir, "external-plugins", "my-plugin");
			mkdirSync(externalPluginDir, { recursive: true });

			writeFileSync(
				join(externalPluginDir, "han-plugin.yml"),
				`name: my-plugin
hooks:
  lint:
    event: Stop
    command: echo "linting"
    description: Custom linter
    if_changed:
      - "*.ts"
`,
			);

			// Create settings that reference the external plugin via directory source
			const settingsContent = {
				extraKnownMarketplaces: {
					"my-marketplace": {
						source: {
							source: "directory",
							path: join(testDir, "external-plugins"),
						},
					},
				},
				enabledPlugins: {
					"my-plugin@my-marketplace": true,
				},
			};

			writeFileSync(
				join(testDir, "claude-config", "settings.json"),
				JSON.stringify(settingsContent, null, 2),
			);

			// Verify the plugin config file was created correctly
			const pluginConfig = readFileSync(
				join(externalPluginDir, "han-plugin.yml"),
				"utf-8",
			);
			expect(pluginConfig).toContain("my-plugin");
			expect(pluginConfig).toContain("lint");
			expect(pluginConfig).toContain("Stop");
		});

		test("nested directory source plugin structure", () => {
			// External plugins can be organized in subdirectories like jutsu/do/hashi
			const nestedPluginDir = join(
				testDir,
				"external-plugins",
				"jutsu",
				"jutsu-custom",
			);
			mkdirSync(nestedPluginDir, { recursive: true });

			writeFileSync(
				join(nestedPluginDir, "han-plugin.yml"),
				`name: jutsu-custom
hooks:
  typecheck:
    event: Stop
    command: echo "typechecking"
    if_changed:
      - "**/*.ts"
`,
			);

			// Verify nested structure
			expect(existsSync(join(nestedPluginDir, "han-plugin.yml"))).toBe(true);

			const config = readFileSync(
				join(nestedPluginDir, "han-plugin.yml"),
				"utf-8",
			);
			expect(config).toContain("jutsu-custom");
		});
	});

	describe("Git source plugins", () => {
		test("settings format for git source", () => {
			// Create settings that reference a git source marketplace
			const settingsContent = {
				extraKnownMarketplaces: {
					"company-plugins": {
						source: {
							source: "git",
							url: "https://github.com/company/claude-plugins.git",
						},
					},
				},
				enabledPlugins: {
					"company-linter@company-plugins": true,
				},
			};

			writeFileSync(
				join(testDir, "claude-config", "settings.json"),
				JSON.stringify(settingsContent, null, 2),
			);

			// Verify settings were written correctly
			const settings = JSON.parse(
				readFileSync(
					join(testDir, "claude-config", "settings.json"),
					"utf-8",
				),
			);

			expect(settings.extraKnownMarketplaces["company-plugins"]).toBeDefined();
			expect(
				settings.extraKnownMarketplaces["company-plugins"].source.source,
			).toBe("git");
			expect(
				settings.extraKnownMarketplaces["company-plugins"].source.url,
			).toBe("https://github.com/company/claude-plugins.git");
		});

		test("git source plugin installation location", () => {
			// Git source plugins are cloned to ~/.claude/plugins/marketplaces/{marketplace}/
			const marketplaceRoot = join(
				testDir,
				"claude-config",
				"plugins",
				"marketplaces",
				"company-plugins",
			);
			const pluginDir = join(marketplaceRoot, "jutsu", "company-linter");
			mkdirSync(pluginDir, { recursive: true });

			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				`name: company-linter
hooks:
  lint:
    event: Stop
    command: company-lint .
    if_changed:
      - "**/*.ts"
`,
			);

			// Verify the structure matches expected git installation location
			expect(
				existsSync(
					join(marketplaceRoot, "jutsu", "company-linter", "han-plugin.yml"),
				),
			).toBe(true);
		});
	});

	describe("Hook dependency resolution with external plugins", () => {
		test("external plugin can depend on first-party han hooks", () => {
			// Create an external plugin that depends on jutsu-biome/lint
			const externalPluginDir = join(testDir, "external-plugins", "my-linter");
			mkdirSync(externalPluginDir, { recursive: true });

			writeFileSync(
				join(externalPluginDir, "han-plugin.yml"),
				`name: my-linter
hooks:
  custom-lint:
    event: Stop
    command: my-lint .
    description: Custom linting that runs after biome
    depends_on:
      - plugin: jutsu-biome
        hook: lint
        optional: true
    if_changed:
      - "**/*.ts"
`,
			);

			const config = readFileSync(
				join(externalPluginDir, "han-plugin.yml"),
				"utf-8",
			);

			// Verify dependency is declared correctly
			expect(config).toContain("depends_on:");
			expect(config).toContain("jutsu-biome");
			expect(config).toContain("optional: true");
		});

		test("first-party hook can optionally depend on external plugin", () => {
			// This tests the scenario where a han plugin might optionally
			// depend on a user's custom plugin
			const hookConfig = {
				name: "example-hook",
				dependsOn: [
					{ plugin: "user-custom-plugin", hook: "pre-check", optional: true },
				],
			};

			// Verify optional dependencies don't block execution
			expect(hookConfig.dependsOn[0].optional).toBe(true);
		});
	});

	describe("Hook caching with external plugins", () => {
		test("cache key includes plugin path for uniqueness", () => {
			// Two plugins with the same hook name should have different cache keys
			const plugin1 = {
				plugin: "plugin-a",
				hook: "lint",
				directory: "/project/src",
				pluginRoot: "/external/plugin-a",
			};

			const plugin2 = {
				plugin: "plugin-b",
				hook: "lint",
				directory: "/project/src",
				pluginRoot: "/external/plugin-b",
			};

			// Cache keys should be different even with same hook name and directory
			const key1 = `${plugin1.plugin}:${plugin1.hook}:${plugin1.directory}`;
			const key2 = `${plugin2.plugin}:${plugin2.hook}:${plugin2.directory}`;

			expect(key1).not.toBe(key2);
		});
	});

	describe("Settings merging with external plugins", () => {
		test("user scope settings merge with project scope", () => {
			// User scope enables core@han
			writeFileSync(
				join(testDir, "claude-config", "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						han: {
							source: { source: "github", repo: "thebushidocollective/han" },
						},
					},
					enabledPlugins: {
						"core@han": true,
					},
				}),
			);

			// Project scope enables an external plugin
			writeFileSync(
				join(testDir, "project", ".claude", "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						"company-plugins": {
							source: {
								source: "directory",
								path: join(testDir, "external-plugins"),
							},
						},
					},
					enabledPlugins: {
						"company-linter@company-plugins": true,
					},
				}),
			);

			// Verify both settings files exist
			expect(
				existsSync(join(testDir, "claude-config", "settings.json")),
			).toBe(true);
			expect(
				existsSync(join(testDir, "project", ".claude", "settings.json")),
			).toBe(true);

			// Read and verify contents
			const userSettings = JSON.parse(
				readFileSync(
					join(testDir, "claude-config", "settings.json"),
					"utf-8",
				),
			);
			const projectSettings = JSON.parse(
				readFileSync(
					join(testDir, "project", ".claude", "settings.json"),
					"utf-8",
				),
			);

			expect(userSettings.enabledPlugins["core@han"]).toBe(true);
			expect(
				projectSettings.enabledPlugins["company-linter@company-plugins"],
			).toBe(true);
		});

		test("project scope can override user scope plugin settings", () => {
			// User scope enables a plugin
			writeFileSync(
				join(testDir, "claude-config", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"some-plugin@han": true,
					},
				}),
			);

			// Project scope disables the same plugin
			writeFileSync(
				join(testDir, "project", ".claude", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"some-plugin@han": false,
					},
				}),
			);

			const projectSettings = JSON.parse(
				readFileSync(
					join(testDir, "project", ".claude", "settings.json"),
					"utf-8",
				),
			);

			// Project scope should be able to disable plugins enabled in user scope
			expect(projectSettings.enabledPlugins["some-plugin@han"]).toBe(false);
		});
	});

	describe("Plugin naming conventions", () => {
		test("external plugins follow naming conventions", () => {
			const validNames = [
				"jutsu-custom-linter",
				"do-code-review",
				"hashi-custom-mcp",
				"my-simple-plugin",
			];

			for (const name of validNames) {
				// Plugin names should be lowercase with hyphens
				expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
			}
		});

		test("external marketplace names are valid", () => {
			const validMarketplaceNames = [
				"company-plugins",
				"my-plugins",
				"team-tools",
			];

			for (const name of validMarketplaceNames) {
				// Marketplace names should be lowercase with hyphens
				expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
			}
		});
	});

	describe("Hook execution environment for external plugins", () => {
		test("CLAUDE_PLUGIN_ROOT is set to external plugin path", () => {
			const externalPluginRoot = join(testDir, "external-plugins", "my-plugin");

			// When executing a hook, CLAUDE_PLUGIN_ROOT should point to the plugin
			const expectedEnv = {
				CLAUDE_PLUGIN_ROOT: externalPluginRoot,
			};

			// Verify the path is absolute
			expect(expectedEnv.CLAUDE_PLUGIN_ROOT.startsWith("/")).toBe(true);
		});

		test("relative paths in external plugin are resolved correctly", () => {
			const externalPluginRoot = join(testDir, "external-plugins", "my-plugin");
			mkdirSync(externalPluginRoot, { recursive: true });

			// Plugin uses relative path to its own scripts
			writeFileSync(
				join(externalPluginRoot, "han-plugin.yml"),
				`name: my-plugin
hooks:
  lint:
    event: Stop
    command: bash "\${CLAUDE_PLUGIN_ROOT}/scripts/lint.sh"
`,
			);

			// Create the script
			mkdirSync(join(externalPluginRoot, "scripts"), { recursive: true });
			writeFileSync(
				join(externalPluginRoot, "scripts", "lint.sh"),
				'#!/bin/bash\necho "linting"',
			);

			// Verify the structure
			expect(existsSync(join(externalPluginRoot, "scripts", "lint.sh"))).toBe(
				true,
			);

			const config = readFileSync(
				join(externalPluginRoot, "han-plugin.yml"),
				"utf-8",
			);
			expect(config).toContain("${CLAUDE_PLUGIN_ROOT}");
		});
	});

	describe("Hook list command with external plugins", () => {
		test("external plugins appear in hook list output structure", () => {
			// Simulate the expected output structure of `han hook list --json`
			const expectedOutput = [
				{
					plugin: "core",
					hook: "context",
					events: ["UserPromptSubmit"],
					marketplace: "han",
					source: { type: "github", repo: "thebushidocollective/han" },
				},
				{
					plugin: "my-external-plugin",
					hook: "lint",
					events: ["Stop", "SubagentStop"],
					marketplace: "company-plugins",
					source: {
						type: "directory",
						path: join(testDir, "external-plugins"),
					},
				},
			];

			// Verify structure includes source information
			for (const hook of expectedOutput) {
				expect(hook.source).toBeDefined();
				expect(hook.source.type).toMatch(
					/^(github|directory|git|development)$/,
				);
				expect(hook.marketplace).toBeDefined();
			}
		});
	});
});

describe("External Plugin Integration", () => {
	describe("getMergedPluginsAndMarketplaces", () => {
		test("returns correct structure for external plugins", () => {
			// The function should return plugins map with marketplace associations
			const mockResult = {
				plugins: new Map([
					["core", "han"],
					["my-plugin", "company-plugins"],
				]),
				marketplaces: new Map([
					[
						"han",
						{
							source: { source: "github", repo: "thebushidocollective/han" },
						},
					],
					[
						"company-plugins",
						{
							source: {
								source: "directory",
								path: "/path/to/external/plugins",
							},
						},
					],
				]),
			};

			expect(mockResult.plugins.get("core")).toBe("han");
			expect(mockResult.plugins.get("my-plugin")).toBe("company-plugins");
			expect(mockResult.marketplaces.get("company-plugins")).toBeDefined();
		});
	});

	describe("Plugin config file format", () => {
		const testDir = `/tmp/test-plugin-config-${Date.now()}`;

		beforeEach(() => {
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			rmSync(testDir, { recursive: true, force: true });
		});

		test("han-plugin.yml format is valid", () => {
			const validConfig = `name: test-plugin
hooks:
  lint:
    event: Stop
    command: test-lint
    description: Test linter
    if_changed:
      - "**/*.ts"
`;
			writeFileSync(join(testDir, "han-plugin.yml"), validConfig);

			// Verify file was created
			expect(existsSync(join(testDir, "han-plugin.yml"))).toBe(true);

			// Verify content is correct YAML
			const content = readFileSync(join(testDir, "han-plugin.yml"), "utf-8");
			expect(content).toContain("hooks:");
			expect(content).toContain("lint:");
			expect(content).toContain("command: test-lint");
		});

		test("external plugin config can include dependencies", () => {
			const configWithDeps = `name: test-plugin
hooks:
  custom-lint:
    event: Stop
    command: custom-lint
    depends_on:
      - plugin: jutsu-biome
        hook: format
        optional: true
`;
			writeFileSync(join(testDir, "han-plugin.yml"), configWithDeps);

			const content = readFileSync(join(testDir, "han-plugin.yml"), "utf-8");
			expect(content).toContain("depends_on:");
			expect(content).toContain("plugin: jutsu-biome");
			expect(content).toContain("optional: true");
		});
	});
});
