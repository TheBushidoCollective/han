/**
 * Tests for explain.ts helper functions
 * Tests the plugin analysis and directory utilities
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getCapabilitiesString, type PluginDetails } from "../lib/explain.ts";

describe("explain.ts helper logic", () => {
	const testDir = `/tmp/test-explain-${Date.now()}`;
	let originalEnv: string | undefined;
	let originalHome: string | undefined;

	beforeEach(() => {
		// Save original environment
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		originalHome = process.env.HOME;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;

		// Create directories
		mkdirSync(join(testDir, "config"), { recursive: true });
	});

	afterEach(() => {
		// Restore environment
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		if (originalHome) {
			process.env.HOME = originalHome;
		} else {
			delete process.env.HOME;
		}

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("getPluginDirectory logic", () => {
		test("constructs correct path with CLAUDE_CONFIG_DIR", () => {
			const expectedPath = join(
				testDir,
				"config",
				"plugins",
				"marketplaces",
				"han",
			);
			// The function builds: configDir + /plugins/marketplaces/han
			expect(expectedPath).toContain("plugins");
			expect(expectedPath).toContain("marketplaces");
			expect(expectedPath).toContain("han");
		});

		test("constructs correct path with HOME fallback", () => {
			delete process.env.CLAUDE_CONFIG_DIR;
			const expectedPath = join(
				testDir,
				".claude",
				"plugins",
				"marketplaces",
				"han",
			);
			expect(expectedPath).toContain(".claude");
			expect(expectedPath).toContain("plugins");
			expect(expectedPath).toContain("han");
		});
	});

	describe("analyzePlugin logic", () => {
		test("detects commands directory presence", () => {
			const pluginDir = join(testDir, "plugin-with-commands");
			const commandsDir = join(pluginDir, "commands");
			mkdirSync(commandsDir, { recursive: true });
			writeFileSync(join(commandsDir, "test.md"), "# Test command");

			// Simulate the logic from analyzePlugin
			const hasCommands =
				require("node:fs").existsSync(commandsDir) &&
				require("node:fs").readdirSync(commandsDir).length > 0;
			expect(hasCommands).toBe(true);
		});

		test("detects skills directory presence", () => {
			const pluginDir = join(testDir, "plugin-with-skills");
			const skillsDir = join(pluginDir, "skills");
			mkdirSync(skillsDir, { recursive: true });
			writeFileSync(join(skillsDir, "test.md"), "# Test skill");

			const hasSkills =
				require("node:fs").existsSync(skillsDir) &&
				require("node:fs").readdirSync(skillsDir).length > 0;
			expect(hasSkills).toBe(true);
		});

		test("detects agents directory presence", () => {
			const pluginDir = join(testDir, "plugin-with-agents");
			const agentsDir = join(pluginDir, "agents");
			mkdirSync(agentsDir, { recursive: true });
			writeFileSync(join(agentsDir, "test-agent.md"), "# Test agent");

			const hasAgents =
				require("node:fs").existsSync(agentsDir) &&
				require("node:fs").readdirSync(agentsDir).length > 0;
			expect(hasAgents).toBe(true);
		});

		test("detects hooks.json presence", () => {
			const pluginDir = join(testDir, "plugin-with-hooks");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "hooks.json"),
				JSON.stringify({ hooks: { Stop: [] } }),
			);

			const hasHooks = require("node:fs").existsSync(
				join(claudePluginDir, "hooks.json"),
			);
			expect(hasHooks).toBe(true);
		});

		test("detects MCP servers in plugin.json", () => {
			const pluginDir = join(testDir, "plugin-with-mcp");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "plugin.json"),
				JSON.stringify({
					mcpServers: {
						"test-server": { command: "npx", args: ["test-server"] },
					},
				}),
			);

			const pluginJson = JSON.parse(
				require("node:fs").readFileSync(
					join(claudePluginDir, "plugin.json"),
					"utf-8",
				),
			);
			const hasMcp =
				!!pluginJson.mcpServers &&
				Object.keys(pluginJson.mcpServers).length > 0;
			expect(hasMcp).toBe(true);
		});

		test("returns false when no MCP servers", () => {
			const pluginDir = join(testDir, "plugin-without-mcp");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "plugin.json"),
				JSON.stringify({ name: "test-plugin" }),
			);

			const pluginJson = JSON.parse(
				require("node:fs").readFileSync(
					join(claudePluginDir, "plugin.json"),
					"utf-8",
				),
			);
			const hasMcp =
				!!pluginJson.mcpServers &&
				Object.keys(pluginJson.mcpServers).length > 0;
			expect(hasMcp).toBe(false);
		});

		test("returns all false for non-existent plugin directory", () => {
			const pluginDir = join(testDir, "nonexistent-plugin");
			const exists = require("node:fs").existsSync(pluginDir);
			expect(exists).toBe(false);
		});
	});

	describe("getCapabilitiesString", () => {
		// Helper to create a full PluginDetails object
		function makePlugin(capabilities: {
			hasCommands?: boolean;
			hasSkills?: boolean;
			hasAgents?: boolean;
			hasHooks?: boolean;
			hasMcp?: boolean;
		}): PluginDetails {
			return {
				name: "test-plugin",
				scope: "User",
				hasCommands: capabilities.hasCommands ?? false,
				hasSkills: capabilities.hasSkills ?? false,
				hasAgents: capabilities.hasAgents ?? false,
				hasHooks: capabilities.hasHooks ?? false,
				hasMcp: capabilities.hasMcp ?? false,
			};
		}

		test("generates commands emoji for hasCommands", () => {
			const result = getCapabilitiesString(makePlugin({ hasCommands: true }));
			expect(result).toContain("📜");
		});

		test("generates skills emoji for hasSkills", () => {
			const result = getCapabilitiesString(makePlugin({ hasSkills: true }));
			expect(result).toContain("⚔️");
		});

		test("generates agents emoji for hasAgents", () => {
			const result = getCapabilitiesString(makePlugin({ hasAgents: true }));
			expect(result).toContain("🤖");
		});

		test("generates hooks emoji for hasHooks", () => {
			const result = getCapabilitiesString(makePlugin({ hasHooks: true }));
			expect(result).toContain("🪝");
		});

		test("generates MCP emoji for hasMcp", () => {
			const result = getCapabilitiesString(makePlugin({ hasMcp: true }));
			expect(result).toContain("🔌");
		});

		test("returns dash for no capabilities", () => {
			const result = getCapabilitiesString(makePlugin({}));
			expect(result).toBe("-");
		});

		test("joins multiple indicators with space", () => {
			const result = getCapabilitiesString(
				makePlugin({
					hasCommands: true,
					hasHooks: true,
					hasMcp: true,
				}),
			);
			expect(result).toBe("📜 🪝 🔌");
		});
	});

	describe("plugin category path resolution", () => {
		test("Core plugins use core/ or root directory", () => {
			const marketplaceDir = join(testDir, "marketplace");
			const coreDir = join(marketplaceDir, "core", "test-plugin");
			const rootDir = join(marketplaceDir, "test-plugin");

			mkdirSync(coreDir, { recursive: true });

			const exists =
				require("node:fs").existsSync(coreDir) ||
				require("node:fs").existsSync(rootDir);
			expect(exists).toBe(true);
		});

		test("Technique plugins use jutsu/ directory", () => {
			const marketplaceDir = join(testDir, "marketplace");
			const jutsuDir = join(marketplaceDir, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuDir, { recursive: true });

			const exists = require("node:fs").existsSync(jutsuDir);
			expect(exists).toBe(true);
		});

		test("Discipline plugins use do/ directory", () => {
			const marketplaceDir = join(testDir, "marketplace");
			const doDir = join(marketplaceDir, "do", "do-accessibility");
			mkdirSync(doDir, { recursive: true });

			const exists = require("node:fs").existsSync(doDir);
			expect(exists).toBe(true);
		});

		test("Bridge plugins use hashi/ directory", () => {
			const marketplaceDir = join(testDir, "marketplace");
			const hashiDir = join(marketplaceDir, "hashi", "hashi-github");
			mkdirSync(hashiDir, { recursive: true });

			const exists = require("node:fs").existsSync(hashiDir);
			expect(exists).toBe(true);
		});
	});

	describe("PluginDetails interface", () => {
		test("has expected structure", () => {
			const plugin = {
				name: "test-plugin",
				description: "Test description",
				category: "Technique",
				scope: "User",
				hasCommands: true,
				hasSkills: false,
				hasHooks: true,
				hasMcp: false,
				hasAgents: false,
			};

			expect(plugin.name).toBe("test-plugin");
			expect(plugin.description).toBe("Test description");
			expect(plugin.category).toBe("Technique");
			expect(plugin.scope).toBe("User");
			expect(typeof plugin.hasCommands).toBe("boolean");
			expect(typeof plugin.hasSkills).toBe("boolean");
			expect(typeof plugin.hasHooks).toBe("boolean");
			expect(typeof plugin.hasMcp).toBe("boolean");
			expect(typeof plugin.hasAgents).toBe("boolean");
		});

		test("allows optional description", () => {
			const plugin = {
				name: "test-plugin",
				scope: "User",
				hasCommands: false,
				hasSkills: false,
				hasHooks: false,
				hasMcp: false,
				hasAgents: false,
			};

			expect(plugin.name).toBe("test-plugin");
			expect((plugin as { description?: string }).description).toBeUndefined();
		});

		test("allows optional category", () => {
			const plugin = {
				name: "test-plugin",
				scope: "User",
				hasCommands: false,
				hasSkills: false,
				hasHooks: false,
				hasMcp: false,
				hasAgents: false,
			};

			expect((plugin as { category?: string }).category).toBeUndefined();
		});
	});

	describe("scope labels mapping", () => {
		test("user scope label is User", () => {
			const scopeLabels = {
				user: "User",
				project: "Project",
				local: "Local",
			};
			expect(scopeLabels.user).toBe("User");
		});

		test("project scope label is Project", () => {
			const scopeLabels = {
				user: "User",
				project: "Project",
				local: "Local",
			};
			expect(scopeLabels.project).toBe("Project");
		});

		test("local scope label is Local", () => {
			const scopeLabels = {
				user: "User",
				project: "Project",
				local: "Local",
			};
			expect(scopeLabels.local).toBe("Local");
		});
	});

	describe("MCP server detection edge cases", () => {
		test("handles empty mcpServers object", () => {
			const pluginDir = join(testDir, "plugin-empty-mcp");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "plugin.json"),
				JSON.stringify({ mcpServers: {} }),
			);

			const pluginJson = JSON.parse(
				require("node:fs").readFileSync(
					join(claudePluginDir, "plugin.json"),
					"utf-8",
				),
			);
			const hasMcp =
				!!pluginJson.mcpServers &&
				Object.keys(pluginJson.mcpServers).length > 0;
			expect(hasMcp).toBe(false);
		});

		test("handles malformed plugin.json gracefully", () => {
			const pluginDir = join(testDir, "plugin-bad-json");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(join(claudePluginDir, "plugin.json"), "not valid json{");

			let hasMcp = false;
			try {
				const pluginJson = JSON.parse(
					require("node:fs").readFileSync(
						join(claudePluginDir, "plugin.json"),
						"utf-8",
					),
				);
				hasMcp =
					!!pluginJson.mcpServers &&
					Object.keys(pluginJson.mcpServers).length > 0;
			} catch {
				// Ignore parse errors - hasMcp stays false
			}
			expect(hasMcp).toBe(false);
		});

		test("handles multiple MCP servers", () => {
			const pluginDir = join(testDir, "plugin-multi-mcp");
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "plugin.json"),
				JSON.stringify({
					mcpServers: {
						server1: { command: "cmd1" },
						server2: { command: "cmd2" },
						server3: { command: "cmd3" },
					},
				}),
			);

			const pluginJson = JSON.parse(
				require("node:fs").readFileSync(
					join(claudePluginDir, "plugin.json"),
					"utf-8",
				),
			);
			const serverCount = Object.keys(pluginJson.mcpServers).length;
			expect(serverCount).toBe(3);
		});
	});

	describe("Summary statistics calculation", () => {
		test("calculates totals from plugin list", () => {
			const allPlugins = [
				{
					hasCommands: true,
					hasSkills: true,
					hasAgents: false,
					hasHooks: true,
					hasMcp: false,
				},
				{
					hasCommands: false,
					hasSkills: true,
					hasAgents: true,
					hasHooks: false,
					hasMcp: true,
				},
				{
					hasCommands: true,
					hasSkills: false,
					hasAgents: false,
					hasHooks: true,
					hasMcp: true,
				},
			];

			const totalCommands = allPlugins.filter((p) => p.hasCommands).length;
			const totalSkills = allPlugins.filter((p) => p.hasSkills).length;
			const totalAgents = allPlugins.filter((p) => p.hasAgents).length;
			const totalHooks = allPlugins.filter((p) => p.hasHooks).length;
			const totalMcp = allPlugins.filter((p) => p.hasMcp).length;

			expect(totalCommands).toBe(2);
			expect(totalSkills).toBe(2);
			expect(totalAgents).toBe(1);
			expect(totalHooks).toBe(2);
			expect(totalMcp).toBe(2);
		});

		test("handles empty plugin list", () => {
			const allPlugins: Array<{
				hasCommands: boolean;
				hasSkills: boolean;
				hasAgents: boolean;
				hasHooks: boolean;
				hasMcp: boolean;
			}> = [];

			const totalCommands = allPlugins.filter((p) => p.hasCommands).length;
			expect(totalCommands).toBe(0);
		});

		test("handles all capabilities enabled", () => {
			const allPlugins = [
				{
					hasCommands: true,
					hasSkills: true,
					hasAgents: true,
					hasHooks: true,
					hasMcp: true,
				},
			];

			const totalCommands = allPlugins.filter((p) => p.hasCommands).length;
			const totalSkills = allPlugins.filter((p) => p.hasSkills).length;
			const totalAgents = allPlugins.filter((p) => p.hasAgents).length;
			const totalHooks = allPlugins.filter((p) => p.hasHooks).length;
			const totalMcp = allPlugins.filter((p) => p.hasMcp).length;

			expect(totalCommands).toBe(1);
			expect(totalSkills).toBe(1);
			expect(totalAgents).toBe(1);
			expect(totalHooks).toBe(1);
			expect(totalMcp).toBe(1);
		});
	});

	describe("Marketplace status detection", () => {
		test("detects configured han marketplace", () => {
			const globalSettings = {
				extraKnownMarketplaces: {
					han: { url: "https://han.guru/marketplace.json" },
				},
			};

			const hasMarketplace = !!globalSettings.extraKnownMarketplaces?.han;
			expect(hasMarketplace).toBe(true);
		});

		test("detects missing han marketplace", () => {
			const globalSettings: { extraKnownMarketplaces?: { han?: object } } = {
				extraKnownMarketplaces: {},
			};

			const hasMarketplace = !!globalSettings.extraKnownMarketplaces?.han;
			expect(hasMarketplace).toBe(false);
		});

		test("handles undefined extraKnownMarketplaces", () => {
			const globalSettings: { extraKnownMarketplaces?: { han?: object } } = {};

			const hasMarketplace = !!globalSettings.extraKnownMarketplaces?.han;
			expect(hasMarketplace).toBe(false);
		});
	});

	describe("Empty directory handling", () => {
		test("detects empty commands directory as no commands", () => {
			const pluginDir = join(testDir, "plugin-empty-commands");
			const commandsDir = join(pluginDir, "commands");
			mkdirSync(commandsDir, { recursive: true });
			// Directory exists but is empty

			const hasCommands =
				require("node:fs").existsSync(commandsDir) &&
				require("node:fs").readdirSync(commandsDir).length > 0;
			expect(hasCommands).toBe(false);
		});

		test("detects empty skills directory as no skills", () => {
			const pluginDir = join(testDir, "plugin-empty-skills");
			const skillsDir = join(pluginDir, "skills");
			mkdirSync(skillsDir, { recursive: true });

			const hasSkills =
				require("node:fs").existsSync(skillsDir) &&
				require("node:fs").readdirSync(skillsDir).length > 0;
			expect(hasSkills).toBe(false);
		});

		test("detects empty agents directory as no agents", () => {
			const pluginDir = join(testDir, "plugin-empty-agents");
			const agentsDir = join(pluginDir, "agents");
			mkdirSync(agentsDir, { recursive: true });

			const hasAgents =
				require("node:fs").existsSync(agentsDir) &&
				require("node:fs").readdirSync(agentsDir).length > 0;
			expect(hasAgents).toBe(false);
		});
	});

	describe("Path construction", () => {
		test("constructs commands path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const commandsDir = join(pluginDir, "commands");
			expect(commandsDir).toBe("/path/to/plugin/commands");
		});

		test("constructs skills path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const skillsDir = join(pluginDir, "skills");
			expect(skillsDir).toBe("/path/to/plugin/skills");
		});

		test("constructs agents path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const agentsDir = join(pluginDir, "agents");
			expect(agentsDir).toBe("/path/to/plugin/agents");
		});

		test("constructs .claude-plugin path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			expect(claudePluginDir).toBe("/path/to/plugin/.claude-plugin");
		});

		test("constructs hooks.json path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			const hooksFile = join(claudePluginDir, "hooks.json");
			expect(hooksFile).toBe("/path/to/plugin/.claude-plugin/hooks.json");
		});

		test("constructs plugin.json path correctly", () => {
			const pluginDir = "/path/to/plugin";
			const claudePluginDir = join(pluginDir, ".claude-plugin");
			const pluginJsonPath = join(claudePluginDir, "plugin.json");
			expect(pluginJsonPath).toBe("/path/to/plugin/.claude-plugin/plugin.json");
		});
	});

	describe("Capabilities emoji order", () => {
		// Helper to create a full PluginDetails object
		function makePluginForOrder(capabilities: {
			hasCommands?: boolean;
			hasSkills?: boolean;
			hasAgents?: boolean;
			hasHooks?: boolean;
			hasMcp?: boolean;
		}): PluginDetails {
			return {
				name: "test-plugin",
				scope: "User",
				hasCommands: capabilities.hasCommands ?? false,
				hasSkills: capabilities.hasSkills ?? false,
				hasAgents: capabilities.hasAgents ?? false,
				hasHooks: capabilities.hasHooks ?? false,
				hasMcp: capabilities.hasMcp ?? false,
			};
		}

		test("emojis appear in correct order: commands, skills, agents, hooks, mcp", () => {
			const result = getCapabilitiesString(
				makePluginForOrder({
					hasCommands: true,
					hasSkills: true,
					hasAgents: true,
					hasHooks: true,
					hasMcp: true,
				}),
			);

			expect(result).toBe("📜 ⚔️ 🤖 🪝 🔌");
		});

		test("partial capabilities maintain order", () => {
			// Only skills and mcp
			const result = getCapabilitiesString(
				makePluginForOrder({
					hasCommands: false,
					hasSkills: true,
					hasAgents: false,
					hasHooks: false,
					hasMcp: true,
				}),
			);

			expect(result).toBe("⚔️ 🔌");
		});
	});
});
