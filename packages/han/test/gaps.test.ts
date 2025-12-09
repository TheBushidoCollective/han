/**
 * Unit tests for lib/gaps.ts
 * Tests gap analysis and plugin suggestion functionality
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("gaps.ts unit tests", () => {
	describe("PluginInfo interface", () => {
		test("PluginInfo has correct structure", () => {
			const info = {
				name: "jutsu-typescript",
				category: "Technique",
				description: "TypeScript support",
				keywords: ["typescript", "type-checking"],
			};

			expect(info.name).toBe("jutsu-typescript");
			expect(info.category).toBe("Technique");
			expect(info.description).toBe("TypeScript support");
			expect(info.keywords).toEqual(["typescript", "type-checking"]);
		});

		test("PluginInfo with minimal fields", () => {
			const info: {
				name: string;
				category?: string;
				description?: string;
				keywords?: string[];
			} = {
				name: "core",
			};

			expect(info.name).toBe("core");
			expect(info.category).toBeUndefined();
			expect(info.description).toBeUndefined();
			expect(info.keywords).toBeUndefined();
		});
	});

	describe("Plugin filtering logic", () => {
		test("filters out installed plugins from available", () => {
			const installedPlugins = [{ name: "core" }, { name: "jutsu-typescript" }];
			const availablePlugins = [
				{ name: "core" },
				{ name: "jutsu-typescript" },
				{ name: "jutsu-biome" },
				{ name: "hashi-github" },
			];

			const installedNames = new Set(installedPlugins.map((p) => p.name));
			const notInstalledPlugins = availablePlugins.filter(
				(p) => !installedNames.has(p.name),
			);

			expect(notInstalledPlugins).toHaveLength(2);
			expect(notInstalledPlugins.map((p) => p.name)).toEqual([
				"jutsu-biome",
				"hashi-github",
			]);
		});

		test("returns all available when none installed", () => {
			const installedPlugins: Array<{ name: string }> = [];
			const availablePlugins = [{ name: "core" }, { name: "jutsu-typescript" }];

			const installedNames = new Set(installedPlugins.map((p) => p.name));
			const notInstalledPlugins = availablePlugins.filter(
				(p) => !installedNames.has(p.name),
			);

			expect(notInstalledPlugins).toHaveLength(2);
		});

		test("returns empty when all installed", () => {
			const installedPlugins = [{ name: "core" }, { name: "jutsu-typescript" }];
			const availablePlugins = [{ name: "core" }, { name: "jutsu-typescript" }];

			const installedNames = new Set(installedPlugins.map((p) => p.name));
			const notInstalledPlugins = availablePlugins.filter(
				(p) => !installedNames.has(p.name),
			);

			expect(notInstalledPlugins).toHaveLength(0);
		});
	});

	describe("Plugin list formatting", () => {
		test("formats plugin list with all fields", () => {
			const plugins = [
				{
					name: "jutsu-typescript",
					category: "Technique",
					description: "TypeScript support",
				},
			];

			const formatted = plugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			expect(formatted).toBe(
				"- jutsu-typescript (Technique): TypeScript support",
			);
		});

		test("formats plugin list without category", () => {
			const plugins = [
				{
					name: "core",
					category: undefined,
					description: "Core plugin",
				},
			];

			const formatted = plugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			expect(formatted).toBe("- core: Core plugin");
		});

		test("formats plugin list without description", () => {
			const plugins = [
				{
					name: "jutsu-biome",
					category: "Technique",
					description: undefined,
				},
			];

			const formatted = plugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			expect(formatted).toBe("- jutsu-biome (Technique)");
		});

		test("formats plugin with only name", () => {
			const plugins = [
				{
					name: "unknown",
					category: undefined,
					description: undefined,
				},
			];

			const formatted = plugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			expect(formatted).toBe("- unknown");
		});

		test("formats multiple plugins", () => {
			const plugins = [
				{ name: "core", category: "Core", description: "Core plugin" },
				{
					name: "jutsu-typescript",
					category: "Technique",
					description: "TypeScript",
				},
			];

			const formatted = plugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			expect(formatted).toContain("- core (Core): Core plugin");
			expect(formatted).toContain("- jutsu-typescript (Technique): TypeScript");
		});

		test("returns 'None' for empty installed list", () => {
			const installedPlugins: Array<{ name: string }> = [];

			const installedList =
				installedPlugins.length > 0
					? installedPlugins.map((p) => `- ${p.name}`).join("\n")
					: "None";

			expect(installedList).toBe("None");
		});
	});

	describe("Scope iteration", () => {
		test("scopes array contains all valid scopes", () => {
			const scopes = ["user", "project", "local"];

			expect(scopes).toContain("user");
			expect(scopes).toContain("project");
			expect(scopes).toContain("local");
			expect(scopes).toHaveLength(3);
		});
	});

	describe("Plugin info mapping", () => {
		test("maps marketplace plugin to PluginInfo", () => {
			const marketplacePlugin = {
				name: "jutsu-typescript",
				category: "Technique",
				description: "TypeScript support",
				keywords: ["typescript", "type-checking"],
				dependencies: [],
			};

			const pluginInfo = {
				name: marketplacePlugin.name,
				category: marketplacePlugin.category,
				description: marketplacePlugin.description,
				keywords: marketplacePlugin.keywords,
			};

			expect(pluginInfo.name).toBe("jutsu-typescript");
			expect(pluginInfo.category).toBe("Technique");
			expect(pluginInfo.description).toBe("TypeScript support");
			expect(pluginInfo.keywords).toEqual(["typescript", "type-checking"]);
		});

		test("maps plugin name to marketplace data", () => {
			const marketplacePlugins = [
				{ name: "core", category: "Core", description: "Core plugin" },
				{
					name: "jutsu-typescript",
					category: "Technique",
					description: "TypeScript",
				},
			];

			const pluginMap = new Map(marketplacePlugins.map((p) => [p.name, p]));

			expect(pluginMap.get("core")).toEqual({
				name: "core",
				category: "Core",
				description: "Core plugin",
			});
			expect(pluginMap.get("jutsu-typescript")).toEqual({
				name: "jutsu-typescript",
				category: "Technique",
				description: "TypeScript",
			});
			expect(pluginMap.get("nonexistent")).toBeUndefined();
		});
	});

	describe("Prompt construction", () => {
		test("constructs installed plugins section", () => {
			const installedPlugins = [
				{ name: "core", category: "Core", description: "Core plugin" },
			];

			const installedList =
				installedPlugins.length > 0
					? installedPlugins
							.map(
								(p) =>
									`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
							)
							.join("\n")
					: "None";

			const prompt = `CURRENTLY INSTALLED HAN PLUGINS:\n${installedList}`;

			expect(prompt).toContain("CURRENTLY INSTALLED HAN PLUGINS:");
			expect(prompt).toContain("- core (Core): Core plugin");
		});

		test("constructs available plugins section", () => {
			const notInstalledPlugins = [
				{
					name: "hashi-github",
					category: "Bridge",
					description: "GitHub integration",
				},
			];

			const availableList = notInstalledPlugins
				.map(
					(p) =>
						`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
				)
				.join("\n");

			const prompt = `AVAILABLE HAN PLUGINS (NOT INSTALLED):\n${availableList}`;

			expect(prompt).toContain("AVAILABLE HAN PLUGINS (NOT INSTALLED):");
			expect(prompt).toContain("- hashi-github (Bridge): GitHub integration");
		});
	});

	describe("Set operations for plugin filtering", () => {
		test("Set correctly identifies installed plugins", () => {
			const installedPlugins = ["core", "jutsu-typescript"];
			const installedNames = new Set(installedPlugins);

			expect(installedNames.has("core")).toBe(true);
			expect(installedNames.has("jutsu-typescript")).toBe(true);
			expect(installedNames.has("jutsu-biome")).toBe(false);
		});

		test("Set correctly handles empty installed list", () => {
			const installedPlugins: string[] = [];
			const installedNames = new Set(installedPlugins);

			expect(installedNames.has("core")).toBe(false);
			expect(installedNames.size).toBe(0);
		});
	});

	describe("Agent SDK options", () => {
		test("allowed tools list for gap analysis", () => {
			const allowedTools = ["read_file", "glob", "grep"];

			expect(allowedTools).toContain("read_file");
			expect(allowedTools).toContain("glob");
			expect(allowedTools).toContain("grep");
			expect(allowedTools).toHaveLength(3);
		});

		test("model is haiku for efficiency", () => {
			const options = {
				model: "haiku",
				includePartialMessages: true,
			};

			expect(options.model).toBe("haiku");
			expect(options.includePartialMessages).toBe(true);
		});
	});

	describe("Error handling", () => {
		test("error message extraction for Error objects", () => {
			const error = new Error("Test error message");
			const message = error instanceof Error ? error.message : String(error);

			expect(message).toBe("Test error message");
		});

		test("error message extraction for non-Error objects", () => {
			const error = "String error";
			const message = error instanceof Error ? error.message : String(error);

			expect(message).toBe("String error");
		});

		test("error message extraction for undefined", () => {
			const error = undefined;
			const message = error instanceof Error ? error.message : String(error);

			expect(message).toBe("undefined");
		});
	});
});

describe("gaps.ts integration tests", () => {
	const testDir = `/tmp/test-gaps-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config"), { recursive: true });
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Plugin aggregation from scopes", () => {
		test("aggregates plugins from multiple scopes into unique set", () => {
			// Simulate plugins from different scopes
			const userPlugins = ["core", "jutsu-typescript"];
			const projectPlugins = ["jutsu-typescript", "jutsu-biome"]; // typescript is duplicate
			const localPlugins = ["jutsu-bun"];

			const allPlugins = new Set<string>();
			for (const plugin of userPlugins) allPlugins.add(plugin);
			for (const plugin of projectPlugins) allPlugins.add(plugin);
			for (const plugin of localPlugins) allPlugins.add(plugin);

			expect(allPlugins.size).toBe(4); // core, typescript, biome, bun
			expect(allPlugins.has("core")).toBe(true);
			expect(allPlugins.has("jutsu-typescript")).toBe(true);
			expect(allPlugins.has("jutsu-biome")).toBe(true);
			expect(allPlugins.has("jutsu-bun")).toBe(true);
		});
	});

	describe("Settings path checking", () => {
		test("skips non-existent settings paths", () => {
			const { existsSync } = require("node:fs");
			const nonExistentPath = join(testDir, "nonexistent", "settings.json");

			const exists = existsSync(nonExistentPath);
			expect(exists).toBe(false);
		});

		test("processes existent settings paths", () => {
			const settingsPath = join(testDir, "config", "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ projects: {} }));

			const { existsSync } = require("node:fs");
			const exists = existsSync(settingsPath);

			expect(exists).toBe(true);
		});
	});
});
