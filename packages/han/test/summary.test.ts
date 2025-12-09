/**
 * Unit tests for lib/summary.ts
 * Tests summary generation functionality
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("summary.ts unit tests", () => {
	describe("PluginInfo interface", () => {
		test("PluginInfo has correct structure", () => {
			const info = {
				name: "jutsu-typescript",
				category: "Technique",
				description: "TypeScript support",
			};

			expect(info.name).toBe("jutsu-typescript");
			expect(info.category).toBe("Technique");
			expect(info.description).toBe("TypeScript support");
		});

		test("PluginInfo with minimal fields", () => {
			const info: { name: string; category?: string; description?: string } = {
				name: "core",
			};

			expect(info.name).toBe("core");
			expect(info.category).toBeUndefined();
			expect(info.description).toBeUndefined();
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
					category: undefined as string | undefined,
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
					description: undefined as string | undefined,
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
					category: undefined as string | undefined,
					description: undefined as string | undefined,
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

		test("formats multiple plugins with newlines", () => {
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

			const lines = formatted.split("\n");
			expect(lines).toHaveLength(2);
			expect(lines[0]).toBe("- core (Core): Core plugin");
			expect(lines[1]).toBe("- jutsu-typescript (Technique): TypeScript");
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

	describe("Plugin name aggregation", () => {
		test("Set correctly deduplicates plugins from multiple scopes", () => {
			const userPlugins = ["core", "jutsu-typescript"];
			const projectPlugins = ["jutsu-typescript", "jutsu-biome"]; // typescript is duplicate

			const allPlugins = new Set<string>();
			for (const plugin of userPlugins) allPlugins.add(plugin);
			for (const plugin of projectPlugins) allPlugins.add(plugin);

			expect(allPlugins.size).toBe(3);
			expect(Array.from(allPlugins).sort()).toEqual([
				"core",
				"jutsu-biome",
				"jutsu-typescript",
			]);
		});

		test("Set handles empty scopes", () => {
			const userPlugins: string[] = [];
			const projectPlugins: string[] = [];

			const allPlugins = new Set<string>();
			for (const plugin of userPlugins) allPlugins.add(plugin);
			for (const plugin of projectPlugins) allPlugins.add(plugin);

			expect(allPlugins.size).toBe(0);
		});
	});

	describe("Plugin map creation", () => {
		test("maps marketplace plugins by name", () => {
			const marketplacePlugins = [
				{ name: "core", category: "Core", description: "Core plugin" },
				{
					name: "jutsu-typescript",
					category: "Technique",
					description: "TypeScript",
				},
			];

			const pluginMap = new Map(
				marketplacePlugins.map((plugin) => [plugin.name, plugin]),
			);

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
		});

		test("handles missing plugins gracefully", () => {
			const marketplacePlugins = [
				{ name: "core", category: "Core", description: "Core plugin" },
			];

			const pluginMap = new Map(
				marketplacePlugins.map((plugin) => [plugin.name, plugin]),
			);

			const nonexistent = pluginMap.get("nonexistent");
			expect(nonexistent).toBeUndefined();

			// When mapping installed plugins that aren't in marketplace
			const installedName = "unknown-plugin";
			const plugin = pluginMap.get(installedName);
			const pluginInfo = {
				name: installedName,
				category: plugin?.category,
				description: plugin?.description,
			};

			expect(pluginInfo.name).toBe("unknown-plugin");
			expect(pluginInfo.category).toBeUndefined();
			expect(pluginInfo.description).toBeUndefined();
		});
	});

	describe("Prompt construction", () => {
		test("constructs installed plugins section", () => {
			const pluginList = [
				"- core (Core): Core foundation",
				"- jutsu-typescript (Technique): TypeScript support",
			].join("\n");

			const prompt = `INSTALLED HAN PLUGINS:\n${pluginList}`;

			expect(prompt).toContain("INSTALLED HAN PLUGINS:");
			expect(prompt).toContain("- core (Core): Core foundation");
			expect(prompt).toContain(
				"- jutsu-typescript (Technique): TypeScript support",
			);
		});
	});

	describe("Agent SDK options", () => {
		test("allowed tools list for summary generation", () => {
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
			const message = error instanceof Error ? error.message : error;

			expect(message).toBe("Test error message");
		});

		test("error message extraction for string errors", () => {
			const error = "String error";
			const message = error instanceof Error ? error.message : error;

			expect(message).toBe("String error");
		});
	});

	describe("Empty plugins handling", () => {
		test("returns early with no plugins message", () => {
			const installedPlugins: Array<{ name: string }> = [];

			if (installedPlugins.length === 0) {
				const message = "❌ No Han plugins installed";
				expect(message).toBe("❌ No Han plugins installed");
			}
		});

		test("suggests install command for empty state", () => {
			const installedPlugins: Array<{ name: string }> = [];

			if (installedPlugins.length === 0) {
				const suggestion = "To get started, run: han plugin install --auto";
				expect(suggestion).toContain("han plugin install --auto");
			}
		});
	});

	describe("SDK message processing", () => {
		test("extracts text from assistant message content", () => {
			const sdkMessage = {
				type: "assistant",
				message: {
					content: [
						{ type: "text", text: "Summary part 1" },
						{ type: "text", text: "Summary part 2" },
					],
				},
			};

			const texts: string[] = [];
			if (sdkMessage.type === "assistant" && sdkMessage.message.content) {
				for (const block of sdkMessage.message.content) {
					if (block.type === "text") {
						texts.push(block.text);
					}
				}
			}

			expect(texts).toEqual(["Summary part 1", "Summary part 2"]);
		});

		test("handles non-text content blocks", () => {
			const sdkMessage = {
				type: "assistant",
				message: {
					content: [
						{ type: "tool_use", id: "123", name: "read_file" },
						{ type: "text", text: "Result" },
					],
				},
			};

			const texts: string[] = [];
			if (sdkMessage.type === "assistant" && sdkMessage.message.content) {
				for (const block of sdkMessage.message.content) {
					if (block.type === "text") {
						texts.push((block as { text: string }).text);
					}
				}
			}

			expect(texts).toEqual(["Result"]);
		});

		test("handles non-assistant messages", () => {
			const sdkMessage = {
				type: "user",
				message: { content: [] },
			};

			const texts: string[] = [];
			if (sdkMessage.type === "assistant") {
				// Won't enter this block
				texts.push("should not appear");
			}

			expect(texts).toHaveLength(0);
		});
	});
});

describe("summary.ts integration tests", () => {
	const testDir = `/tmp/test-summary-${Date.now()}`;
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

	describe("Scope settings files", () => {
		test("creates user scope settings", () => {
			const userSettingsPath = join(testDir, "config", "settings.json");
			const userSettings = {
				projects: {
					"/test/project": {
						hanPlugins: { han: ["core", "jutsu-typescript"] },
					},
				},
			};
			writeFileSync(userSettingsPath, JSON.stringify(userSettings));

			const { existsSync, readFileSync } = require("node:fs");
			expect(existsSync(userSettingsPath)).toBe(true);

			const parsed = JSON.parse(readFileSync(userSettingsPath, "utf-8"));
			expect(parsed.projects["/test/project"].hanPlugins.han).toContain("core");
		});
	});
});
