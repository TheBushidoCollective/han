/**
 * Integration tests for plugin alias resolution
 *
 * These tests verify the alias system integrates correctly with the install flow
 * without requiring full React/Ink component setup.
 */
import { describe, expect, test } from "bun:test";
import {
	getNewPluginPath,
	getOldPluginName,
	getPluginCategories,
	getPluginsInCategory,
	isKnownPlugin,
	PLUGIN_ALIASES,
	resolvePluginName,
	resolvePluginNames,
	REVERSE_ALIASES,
	SHORT_NAME_ALIASES,
} from "../lib/plugin-aliases.ts";

describe("plugin alias integration", () => {
	describe("full alias coverage", () => {
		test("all jutsu plugins have aliases", () => {
			const jutsuPlugins = Object.keys(PLUGIN_ALIASES).filter((name) =>
				name.startsWith("jutsu-"),
			);
			expect(jutsuPlugins.length).toBeGreaterThan(100);
		});

		test("all do plugins have aliases", () => {
			const doPlugins = Object.keys(PLUGIN_ALIASES).filter((name) =>
				name.startsWith("do-"),
			);
			expect(doPlugins.length).toBeGreaterThan(25);
		});

		test("all hashi plugins have aliases", () => {
			const hashiPlugins = Object.keys(PLUGIN_ALIASES).filter((name) =>
				name.startsWith("hashi-"),
			);
			expect(hashiPlugins.length).toBeGreaterThanOrEqual(10);
		});
	});

	describe("short name resolution", () => {
		test("language short names resolve correctly", () => {
			const languages = [
				"typescript",
				"python",
				"ruby",
				"go",
				"rust",
				"java",
				"kotlin",
				"swift",
				"elixir",
				"php",
			];

			for (const lang of languages) {
				const resolved = resolvePluginName(lang);
				expect(resolved).toBe(`jutsu-${lang}`);
			}
		});

		test("framework short names resolve correctly", () => {
			const frameworks = ["react", "vue", "angular", "nextjs", "rails"];

			for (const framework of frameworks) {
				const resolved = resolvePluginName(framework);
				expect(resolved).toBe(`jutsu-${framework}`);
			}
		});

		test("tool short names resolve correctly", () => {
			const tools = ["eslint", "prettier", "biome"];

			for (const tool of tools) {
				const resolved = resolvePluginName(tool);
				expect(resolved).toBe(`jutsu-${tool}`);
			}
		});
	});

	describe("new path resolution", () => {
		test("languages category resolves to jutsu", () => {
			expect(resolvePluginName("languages/typescript")).toBe("jutsu-typescript");
			expect(resolvePluginName("languages/python")).toBe("jutsu-python");
			expect(resolvePluginName("languages/rust")).toBe("jutsu-rust");
		});

		test("frameworks category resolves to jutsu", () => {
			expect(resolvePluginName("frameworks/react")).toBe("jutsu-react");
			expect(resolvePluginName("frameworks/nextjs")).toBe("jutsu-nextjs");
		});

		test("disciplines category resolves to do", () => {
			expect(resolvePluginName("disciplines/frontend-development")).toBe(
				"do-frontend-development",
			);
			expect(resolvePluginName("disciplines/backend-development")).toBe(
				"do-backend-development",
			);
		});

		test("integrations category resolves to hashi", () => {
			expect(resolvePluginName("integrations/github")).toBe("hashi-github");
			expect(resolvePluginName("integrations/gitlab")).toBe("hashi-gitlab");
		});
	});

	describe("bidirectional mapping", () => {
		test("old name -> new path -> old name roundtrip works", () => {
			const testCases = [
				"jutsu-typescript",
				"jutsu-react",
				"do-frontend-development",
				"hashi-github",
			];

			for (const oldName of testCases) {
				const newPath = getNewPluginPath(oldName);
				expect(newPath).toBeDefined();
				const backToOld = getOldPluginName(newPath!);
				expect(backToOld).toBe(oldName);
			}
		});

		test("new path -> old name -> new path roundtrip works", () => {
			const testCases = [
				"languages/typescript",
				"frameworks/react",
				"disciplines/frontend-development",
				"integrations/github",
			];

			for (const newPath of testCases) {
				const oldName = getOldPluginName(newPath);
				expect(oldName).toBeDefined();
				const backToNew = getNewPluginPath(oldName!);
				expect(backToNew).toBe(newPath);
			}
		});
	});

	describe("category organization", () => {
		test("getPluginCategories returns expected categories", () => {
			const categories = getPluginCategories();

			expect(categories).toContain("languages");
			expect(categories).toContain("frameworks");
			expect(categories).toContain("tools");
			expect(categories).toContain("testing");
			expect(categories).toContain("infrastructure");
			expect(categories).toContain("disciplines");
			expect(categories).toContain("integrations");
		});

		test("languages category has all language plugins", () => {
			const languages = getPluginsInCategory("languages");

			expect(languages).toContain("jutsu-typescript");
			expect(languages).toContain("jutsu-python");
			expect(languages).toContain("jutsu-rust");
			expect(languages).toContain("jutsu-go");
			expect(languages).toContain("jutsu-java");
		});

		test("disciplines category has all do plugins", () => {
			const disciplines = getPluginsInCategory("disciplines");

			expect(disciplines).toContain("do-frontend-development");
			expect(disciplines).toContain("do-backend-development");
			expect(disciplines).toContain("do-security-engineering");
		});

		test("integrations category has all hashi plugins", () => {
			const integrations = getPluginsInCategory("integrations");

			expect(integrations).toContain("hashi-github");
			expect(integrations).toContain("hashi-gitlab");
			expect(integrations).toContain("hashi-jira");
		});
	});

	describe("isKnownPlugin comprehensive check", () => {
		test("returns true for all alias formats of a plugin", () => {
			// Test with typescript as example
			expect(isKnownPlugin("jutsu-typescript")).toBe(true); // old name
			expect(isKnownPlugin("typescript")).toBe(true); // short name
			expect(isKnownPlugin("languages/typescript")).toBe(true); // new path
		});

		test("returns true for core plugins", () => {
			expect(isKnownPlugin("core")).toBe(true);
			expect(isKnownPlugin("bushido")).toBe(true);
		});

		test("returns false for non-existent plugins", () => {
			expect(isKnownPlugin("jutsu-nonexistent")).toBe(false);
			expect(isKnownPlugin("nonexistent")).toBe(false);
			expect(isKnownPlugin("unknown/path")).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles empty string", () => {
			expect(resolvePluginName("")).toBe("");
		});

		test("handles whitespace-only string (returns trimmed)", () => {
			// Whitespace-only input becomes empty after trim, which is returned as-is
			const result = resolvePluginName("   ");
			expect(result).toBe("");
		});

		test("handles mixed case consistently", () => {
			const variations = [
				"jutsu-typescript",
				"JUTSU-TYPESCRIPT",
				"Jutsu-TypeScript",
				"JuTsU-TyPeScRiPt",
			];

			const results = variations.map(resolvePluginName);
			expect(new Set(results).size).toBe(1); // All should resolve to same value
			expect(results[0]).toBe("jutsu-typescript");
		});

		test("handles plugins with multiple hyphens", () => {
			expect(resolvePluginName("jutsu-react-native")).toBe("jutsu-react-native");
			expect(resolvePluginName("jutsu-react-native-web")).toBe(
				"jutsu-react-native-web",
			);
			expect(resolvePluginName("do-machine-learning-engineering")).toBe(
				"do-machine-learning-engineering",
			);
		});
	});

	describe("install flow simulation", () => {
		test("simulates han plugin install typescript", () => {
			// User runs: han plugin install typescript
			const userInput = "typescript";

			// System resolves to canonical name
			const resolved = resolvePluginName(userInput);
			expect(resolved).toBe("jutsu-typescript");

			// Verify it's a known plugin
			expect(isKnownPlugin(resolved)).toBe(true);
		});

		test("simulates han plugin install languages/typescript", () => {
			// User runs: han plugin install languages/typescript
			const userInput = "languages/typescript";

			// System resolves to canonical name
			const resolved = resolvePluginName(userInput);
			expect(resolved).toBe("jutsu-typescript");

			// Verify it's a known plugin
			expect(isKnownPlugin(resolved)).toBe(true);
		});

		test("simulates han plugin install with multiple plugins", () => {
			// User runs: han plugin install typescript react hashi-github
			const userInputs = ["typescript", "react", "hashi-github"];

			// System resolves all to canonical names
			const resolved = resolvePluginNames(userInputs);
			expect(resolved).toEqual([
				"jutsu-typescript",
				"jutsu-react",
				"hashi-github",
			]);

			// All should be known plugins
			for (const name of resolved) {
				expect(isKnownPlugin(name)).toBe(true);
			}
		});
	});
});
