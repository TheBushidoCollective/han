/**
 * Unit tests for the plugin alias resolution system
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

describe("plugin-aliases", () => {
	describe("PLUGIN_ALIASES constant", () => {
		test("contains expected jutsu plugins", () => {
			expect(PLUGIN_ALIASES["jutsu-typescript"]).toBe("languages/typescript");
			expect(PLUGIN_ALIASES["jutsu-python"]).toBe("languages/python");
			expect(PLUGIN_ALIASES["jutsu-react"]).toBe("frameworks/react");
			expect(PLUGIN_ALIASES["jutsu-eslint"]).toBe("validation/eslint");
		});

		test("contains expected do plugins", () => {
			expect(PLUGIN_ALIASES["do-frontend-development"]).toBe(
				"disciplines/frontend",
			);
			expect(PLUGIN_ALIASES["do-backend-development"]).toBe(
				"disciplines/backend",
			);
			expect(PLUGIN_ALIASES["do-security-engineering"]).toBe(
				"disciplines/security",
			);
		});

		test("contains expected hashi plugins", () => {
			expect(PLUGIN_ALIASES["hashi-github"]).toBe("services/github");
			expect(PLUGIN_ALIASES["hashi-gitlab"]).toBe("services/gitlab");
			expect(PLUGIN_ALIASES["hashi-jira"]).toBe("services/jira");
		});

		test("has at least 130 plugin mappings", () => {
			const count = Object.keys(PLUGIN_ALIASES).length;
			expect(count).toBeGreaterThanOrEqual(130);
		});

		test("all values are in category/name format", () => {
			for (const [_key, value] of Object.entries(PLUGIN_ALIASES)) {
				expect(value).toMatch(/^[a-z-]+\/[a-z0-9-]+$/);
			}
		});
	});

	describe("REVERSE_ALIASES constant", () => {
		test("maps new paths back to old names", () => {
			expect(REVERSE_ALIASES["languages/typescript"]).toBe("jutsu-typescript");
			expect(REVERSE_ALIASES["frameworks/react"]).toBe("jutsu-react");
			expect(REVERSE_ALIASES["disciplines/frontend"]).toBe(
				"do-frontend-development",
			);
			expect(REVERSE_ALIASES["services/github"]).toBe("hashi-github");
		});

		test("has entries for all unique paths in PLUGIN_ALIASES", () => {
			// REVERSE_ALIASES has fewer entries because multiple old names can map to the same path
			// e.g., do-accessibility and do-accessibility-engineering both map to disciplines/accessibility
			const uniquePaths = new Set(Object.values(PLUGIN_ALIASES));
			expect(Object.keys(REVERSE_ALIASES).length).toBe(uniquePaths.size);
		});

		test("all reverse mappings point to valid PLUGIN_ALIASES entries", () => {
			for (const [newPath, oldName] of Object.entries(REVERSE_ALIASES)) {
				// The old name should exist in PLUGIN_ALIASES
				expect(PLUGIN_ALIASES[oldName]).toBeDefined();
				// And it should map to this new path
				expect(PLUGIN_ALIASES[oldName]).toBe(newPath);
			}
		});
	});

	describe("SHORT_NAME_ALIASES constant", () => {
		test("maps short names to full names", () => {
			expect(SHORT_NAME_ALIASES.typescript).toBe("jutsu-typescript");
			expect(SHORT_NAME_ALIASES.python).toBe("jutsu-python");
			expect(SHORT_NAME_ALIASES.react).toBe("jutsu-react");
		});

		test("maps do short names correctly", () => {
			// Short names map to the first matching plugin processed
			expect(SHORT_NAME_ALIASES["frontend"]).toBe("do-frontend");
		});

		test("maps hashi short names correctly", () => {
			expect(SHORT_NAME_ALIASES.github).toBe("hashi-github");
		});

		test("handles potential conflicts (first wins)", () => {
			// "sentry" could be jutsu-sentry or hashi-sentry
			// Whichever is processed first wins
			const sentry = SHORT_NAME_ALIASES.sentry;
			expect(sentry).toMatch(/^(jutsu|hashi)-sentry$/);
		});
	});

	describe("resolvePluginName", () => {
		describe("with old full names", () => {
			test("resolves jutsu-typescript", () => {
				expect(resolvePluginName("jutsu-typescript")).toBe("jutsu-typescript");
			});

			test("resolves jutsu-python", () => {
				expect(resolvePluginName("jutsu-python")).toBe("jutsu-python");
			});

			test("resolves do-frontend-development", () => {
				expect(resolvePluginName("do-frontend-development")).toBe(
					"do-frontend-development",
				);
			});

			test("resolves hashi-github", () => {
				expect(resolvePluginName("hashi-github")).toBe("hashi-github");
			});
		});

		describe("with short names", () => {
			test("resolves typescript to jutsu-typescript", () => {
				expect(resolvePluginName("typescript")).toBe("jutsu-typescript");
			});

			test("resolves python to jutsu-python", () => {
				expect(resolvePluginName("python")).toBe("jutsu-python");
			});

			test("resolves react to jutsu-react", () => {
				expect(resolvePluginName("react")).toBe("jutsu-react");
			});

			test("resolves eslint to jutsu-eslint", () => {
				expect(resolvePluginName("eslint")).toBe("jutsu-eslint");
			});
		});

		describe("with new path format", () => {
			test("resolves languages/typescript to jutsu-typescript", () => {
				expect(resolvePluginName("languages/typescript")).toBe(
					"jutsu-typescript",
				);
			});

			test("resolves frameworks/react to jutsu-react", () => {
				expect(resolvePluginName("frameworks/react")).toBe("jutsu-react");
			});

			test("resolves disciplines/frontend", () => {
				expect(resolvePluginName("disciplines/frontend")).toBe(
					"do-frontend-development",
				);
			});

			test("resolves services/github to hashi-github", () => {
				expect(resolvePluginName("services/github")).toBe("hashi-github");
			});
		});

		describe("with core plugins", () => {
			test("resolves core unchanged", () => {
				expect(resolvePluginName("core")).toBe("core");
			});

			test("resolves bushido unchanged", () => {
				expect(resolvePluginName("bushido")).toBe("bushido");
			});
		});

		describe("case handling", () => {
			test("handles uppercase input", () => {
				expect(resolvePluginName("JUTSU-TYPESCRIPT")).toBe("jutsu-typescript");
			});

			test("handles mixed case input", () => {
				expect(resolvePluginName("Jutsu-TypeScript")).toBe("jutsu-typescript");
			});

			test("handles uppercase short names", () => {
				expect(resolvePluginName("TYPESCRIPT")).toBe("jutsu-typescript");
			});

			test("handles uppercase new paths", () => {
				expect(resolvePluginName("LANGUAGES/TYPESCRIPT")).toBe(
					"jutsu-typescript",
				);
			});
		});

		describe("whitespace handling", () => {
			test("trims leading whitespace", () => {
				expect(resolvePluginName("  jutsu-typescript")).toBe("jutsu-typescript");
			});

			test("trims trailing whitespace", () => {
				expect(resolvePluginName("jutsu-typescript  ")).toBe("jutsu-typescript");
			});

			test("trims both", () => {
				expect(resolvePluginName("  jutsu-typescript  ")).toBe(
					"jutsu-typescript",
				);
			});
		});

		describe("unknown plugins", () => {
			test("returns unknown plugin name as-is", () => {
				expect(resolvePluginName("unknown-plugin")).toBe("unknown-plugin");
			});

			test("returns new plugin not in aliases as-is", () => {
				expect(resolvePluginName("jutsu-future-plugin")).toBe(
					"jutsu-future-plugin",
				);
			});
		});
	});

	describe("getNewPluginPath", () => {
		test("returns new path for jutsu plugins", () => {
			expect(getNewPluginPath("jutsu-typescript")).toBe("languages/typescript");
			expect(getNewPluginPath("jutsu-react")).toBe("frameworks/react");
		});

		test("returns new path for do plugins", () => {
			expect(getNewPluginPath("do-frontend-development")).toBe(
				"disciplines/frontend",
			);
		});

		test("returns new path for hashi plugins", () => {
			expect(getNewPluginPath("hashi-github")).toBe("services/github");
		});

		test("returns undefined for unknown plugins", () => {
			expect(getNewPluginPath("unknown-plugin")).toBeUndefined();
		});

		test("handles case insensitivity", () => {
			expect(getNewPluginPath("JUTSU-TYPESCRIPT")).toBe("languages/typescript");
		});
	});

	describe("getOldPluginName", () => {
		test("returns old name from new path", () => {
			expect(getOldPluginName("languages/typescript")).toBe("jutsu-typescript");
			expect(getOldPluginName("frameworks/react")).toBe("jutsu-react");
		});

		test("returns old name for disciplines", () => {
			expect(getOldPluginName("disciplines/frontend")).toBe(
				"do-frontend-development",
			);
		});

		test("returns old name for services", () => {
			expect(getOldPluginName("services/github")).toBe("hashi-github");
		});

		test("returns undefined for unknown paths", () => {
			expect(getOldPluginName("unknown/path")).toBeUndefined();
		});

		test("handles case insensitivity", () => {
			expect(getOldPluginName("LANGUAGES/TYPESCRIPT")).toBe("jutsu-typescript");
		});
	});

	describe("isKnownPlugin", () => {
		test("recognizes old plugin names", () => {
			expect(isKnownPlugin("jutsu-typescript")).toBe(true);
			expect(isKnownPlugin("do-frontend-development")).toBe(true);
			expect(isKnownPlugin("hashi-github")).toBe(true);
		});

		test("recognizes short names", () => {
			expect(isKnownPlugin("typescript")).toBe(true);
			expect(isKnownPlugin("react")).toBe(true);
		});

		test("recognizes new paths", () => {
			expect(isKnownPlugin("languages/typescript")).toBe(true);
			expect(isKnownPlugin("frameworks/react")).toBe(true);
		});

		test("recognizes core plugins", () => {
			expect(isKnownPlugin("core")).toBe(true);
			expect(isKnownPlugin("bushido")).toBe(true);
		});

		test("returns false for unknown plugins", () => {
			expect(isKnownPlugin("unknown-plugin")).toBe(false);
			expect(isKnownPlugin("invalid/path/here")).toBe(false);
		});

		test("handles case insensitivity", () => {
			expect(isKnownPlugin("JUTSU-TYPESCRIPT")).toBe(true);
			expect(isKnownPlugin("TYPESCRIPT")).toBe(true);
		});

		test("handles whitespace", () => {
			expect(isKnownPlugin("  jutsu-typescript  ")).toBe(true);
		});
	});

	describe("getPluginCategories", () => {
		test("returns all categories", () => {
			const categories = getPluginCategories();
			expect(categories).toContain("languages");
			expect(categories).toContain("frameworks");
			expect(categories).toContain("tools");
			expect(categories).toContain("validation");
			expect(categories).toContain("disciplines");
			expect(categories).toContain("services");
		});

		test("returns sorted categories", () => {
			const categories = getPluginCategories();
			const sorted = [...categories].sort();
			expect(categories).toEqual(sorted);
		});

		test("returns unique categories", () => {
			const categories = getPluginCategories();
			const unique = [...new Set(categories)];
			expect(categories.length).toBe(unique.length);
		});
	});

	describe("getPluginsInCategory", () => {
		test("returns plugins in languages category", () => {
			const plugins = getPluginsInCategory("languages");
			expect(plugins).toContain("jutsu-typescript");
			expect(plugins).toContain("jutsu-python");
			expect(plugins).toContain("jutsu-rust");
			expect(plugins).toContain("jutsu-go");
		});

		test("returns plugins in frameworks category", () => {
			const plugins = getPluginsInCategory("frameworks");
			expect(plugins).toContain("jutsu-react");
			expect(plugins).toContain("jutsu-nextjs");
			expect(plugins).toContain("jutsu-vue");
		});

		test("returns plugins in disciplines category", () => {
			const plugins = getPluginsInCategory("disciplines");
			expect(plugins).toContain("do-frontend");
			expect(plugins).toContain("do-backend");
		});

		test("returns plugins in services category", () => {
			const plugins = getPluginsInCategory("services");
			expect(plugins).toContain("hashi-github");
			expect(plugins).toContain("hashi-gitlab");
		});

		test("returns sorted results", () => {
			const plugins = getPluginsInCategory("languages");
			const sorted = [...plugins].sort();
			expect(plugins).toEqual(sorted);
		});

		test("handles case insensitivity", () => {
			const lower = getPluginsInCategory("languages");
			const upper = getPluginsInCategory("LANGUAGES");
			expect(lower).toEqual(upper);
		});

		test("returns empty array for unknown category", () => {
			const plugins = getPluginsInCategory("unknown-category");
			expect(plugins).toEqual([]);
		});
	});

	describe("resolvePluginNames", () => {
		test("resolves multiple old names", () => {
			const result = resolvePluginNames([
				"jutsu-typescript",
				"jutsu-react",
				"hashi-github",
			]);
			expect(result).toEqual([
				"jutsu-typescript",
				"jutsu-react",
				"hashi-github",
			]);
		});

		test("resolves multiple short names", () => {
			const result = resolvePluginNames(["typescript", "react", "eslint"]);
			expect(result).toEqual(["jutsu-typescript", "jutsu-react", "jutsu-eslint"]);
		});

		test("resolves multiple new paths", () => {
			const result = resolvePluginNames([
				"languages/typescript",
				"frameworks/react",
			]);
			expect(result).toEqual(["jutsu-typescript", "jutsu-react"]);
		});

		test("resolves mixed formats", () => {
			const result = resolvePluginNames([
				"jutsu-typescript",
				"react",
				"services/github",
			]);
			expect(result).toEqual([
				"jutsu-typescript",
				"jutsu-react",
				"hashi-github",
			]);
		});

		test("handles empty array", () => {
			expect(resolvePluginNames([])).toEqual([]);
		});
	});

	describe("integration scenarios", () => {
		test("user installs with old name gets same result as short name", () => {
			const oldNameResult = resolvePluginName("jutsu-typescript");
			const shortNameResult = resolvePluginName("typescript");
			expect(oldNameResult).toBe(shortNameResult);
		});

		test("user installs with new path gets same result as old name", () => {
			const newPathResult = resolvePluginName("languages/typescript");
			const oldNameResult = resolvePluginName("jutsu-typescript");
			expect(newPathResult).toBe(oldNameResult);
		});

		test("all three formats resolve to same canonical name", () => {
			const oldName = resolvePluginName("jutsu-react");
			const shortName = resolvePluginName("react");
			const newPath = resolvePluginName("frameworks/react");

			expect(oldName).toBe("jutsu-react");
			expect(shortName).toBe("jutsu-react");
			expect(newPath).toBe("jutsu-react");
		});

		test("round-trip: old -> new -> old", () => {
			const original = "jutsu-typescript";
			const newPath = getNewPluginPath(original);
			expect(newPath).toBeDefined();
			const backToOld = getOldPluginName(newPath!);
			expect(backToOld).toBe(original);
		});
	});
});
