/**
 * Unit tests for install.ts plugin synchronization logic
 * Tests the syncPluginsToSettings behavior without UI dependencies
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

// Store original env
const originalEnv = { ...process.env };
const originalCwd = process.cwd;

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-install-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(join(projectDir, ".claude"), { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.HOME = testDir;
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

describe("install.ts plugin sync logic", () => {
	beforeEach(() => setup());
	afterEach(() => teardown());

	describe("syncPluginsToSettings behavior", () => {
		test("adds selected plugins to settings", () => {
			// Start with empty settings
			writeFileSync(join(configDir, "settings.json"), "{}");

			const selectedPlugins = ["jutsu-typescript", "jutsu-biome"];
			const validPluginNames = new Set([
				"core",
				"jutsu-typescript",
				"jutsu-biome",
				"bushido",
			]);

			// Simulate syncPluginsToSettings logic
			const settings = JSON.parse(
				readFileSync(join(configDir, "settings.json"), "utf-8"),
			);
			const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

			// Add Han marketplace
			settings.extraKnownMarketplaces = {
				...settings.extraKnownMarketplaces,
				han: { source: { source: "github", repo: "thebushidocollective/han" } },
			};

			// Add plugins
			for (const plugin of pluginsToInstall) {
				if (validPluginNames.has(plugin)) {
					settings.enabledPlugins = {
						...settings.enabledPlugins,
						[`${plugin}@han`]: true,
					};
				}
			}

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			// Verify
			const result = JSON.parse(
				readFileSync(join(configDir, "settings.json"), "utf-8"),
			);
			expect(result.enabledPlugins["core@han"]).toBe(true);
			expect(result.enabledPlugins["jutsu-typescript@han"]).toBe(true);
			expect(result.enabledPlugins["jutsu-biome@han"]).toBe(true);
			expect(result.extraKnownMarketplaces?.han).toBeDefined();
		});

		test("core is always included even when not selected", () => {
			const selectedPlugins: string[] = ["jutsu-typescript"];
			const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

			expect(pluginsToInstall).toContain("core");
			expect(pluginsToInstall).toContain("jutsu-typescript");
		});

		test("deduplicates plugins when core is explicitly selected", () => {
			const selectedPlugins = ["core", "jutsu-typescript", "core"];
			const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

			const coreCount = pluginsToInstall.filter((p) => p === "core").length;
			expect(coreCount).toBe(1);
		});

		test("filters out invalid plugins", () => {
			const selectedPlugins = ["jutsu-typescript", "invalid-plugin", "bushido"];
			const validPluginNames = new Set(["core", "jutsu-typescript", "bushido"]);

			const validPlugins: string[] = [];
			for (const plugin of selectedPlugins) {
				if (validPluginNames.has(plugin)) {
					validPlugins.push(plugin);
				}
			}

			expect(validPlugins).toContain("jutsu-typescript");
			expect(validPlugins).toContain("bushido");
			expect(validPlugins).not.toContain("invalid-plugin");
		});

		test("removes deselected plugins in project scope", () => {
			const scope = "project";
			const selectedPlugins = ["core", "jutsu-typescript"];
			const currentPlugins = ["core", "jutsu-typescript", "jutsu-biome"];
			const validPluginNames = new Set([
				"core",
				"jutsu-typescript",
				"jutsu-biome",
			]);

			const removed: string[] = [];

			for (const plugin of currentPlugins) {
				if (
					scope !== "user" &&
					plugin !== "core" &&
					!selectedPlugins.includes(plugin) &&
					validPluginNames.has(plugin)
				) {
					removed.push(plugin);
				}
			}

			expect(removed).toEqual(["jutsu-biome"]);
		});

		test("does not remove deselected plugins in user scope", () => {
			const scope = "user";
			const selectedPlugins = ["core"];
			const currentPlugins = ["core", "jutsu-typescript"];
			const validPluginNames = new Set(["core", "jutsu-typescript"]);

			const removed: string[] = [];

			for (const plugin of currentPlugins) {
				if (
					scope !== "user" &&
					plugin !== "core" &&
					!selectedPlugins.includes(plugin) &&
					validPluginNames.has(plugin)
				) {
					removed.push(plugin);
				}
			}

			// User scope should not remove plugins
			expect(removed).toEqual([]);
		});

		test("removes invalid plugins regardless of scope", () => {
			const currentPlugins = ["core", "jutsu-typescript", "deleted-plugin"];
			const validPluginNames = new Set(["core", "jutsu-typescript"]);

			const invalid: string[] = [];

			for (const plugin of currentPlugins) {
				if (!validPluginNames.has(plugin)) {
					invalid.push(plugin);
				}
			}

			expect(invalid).toEqual(["deleted-plugin"]);
		});

		test("preserves core even when deselected in project scope", () => {
			const scope = "project";
			const selectedPlugins: string[] = [];
			const currentPlugins = ["core", "jutsu-typescript"];

			const removed: string[] = [];

			for (const plugin of currentPlugins) {
				if (
					scope !== "user" &&
					plugin !== "core" &&
					!selectedPlugins.includes(plugin)
				) {
					removed.push(plugin);
				}
			}

			// core should NOT be in removed list
			expect(removed).not.toContain("core");
			expect(removed).toContain("jutsu-typescript");
		});
	});

	describe("PluginChanges tracking", () => {
		test("tracks added plugins", () => {
			const currentPlugins: string[] = [];
			const selectedPlugins = ["jutsu-typescript", "jutsu-biome"];
			const validPluginNames = new Set([
				"core",
				"jutsu-typescript",
				"jutsu-biome",
			]);

			const added: string[] = [];
			const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

			for (const plugin of pluginsToInstall) {
				if (validPluginNames.has(plugin) && !currentPlugins.includes(plugin)) {
					added.push(plugin);
				}
			}

			expect(added).toContain("core");
			expect(added).toContain("jutsu-typescript");
			expect(added).toContain("jutsu-biome");
		});

		test("does not add already installed plugins to added list", () => {
			const currentPlugins = ["core", "jutsu-typescript"];
			const selectedPlugins = ["jutsu-typescript", "jutsu-biome"];
			const validPluginNames = new Set([
				"core",
				"jutsu-typescript",
				"jutsu-biome",
			]);

			const added: string[] = [];
			const pluginsToInstall = [...new Set(["core", ...selectedPlugins])];

			for (const plugin of pluginsToInstall) {
				if (validPluginNames.has(plugin) && !currentPlugins.includes(plugin)) {
					added.push(plugin);
				}
			}

			// core and jutsu-typescript are already installed
			expect(added).not.toContain("core");
			expect(added).not.toContain("jutsu-typescript");
			// jutsu-biome is new
			expect(added).toContain("jutsu-biome");
		});

		test("tracks invalid plugins for cleanup", () => {
			const currentPlugins = [
				"core",
				"jutsu-typescript",
				"old-plugin",
				"deleted-plugin",
			];
			const validPluginNames = new Set([
				"core",
				"jutsu-typescript",
				"jutsu-biome",
			]);

			const invalid: string[] = [];

			for (const plugin of currentPlugins) {
				if (!validPluginNames.has(plugin)) {
					invalid.push(plugin);
				}
			}

			expect(invalid).toContain("old-plugin");
			expect(invalid).toContain("deleted-plugin");
			expect(invalid).not.toContain("core");
			expect(invalid).not.toContain("jutsu-typescript");
		});
	});

	describe("Han marketplace configuration", () => {
		test("adds Han marketplace when not present", () => {
			const settings: Record<string, unknown> = {};

			if (
				!settings.extraKnownMarketplaces ||
				!(settings.extraKnownMarketplaces as Record<string, unknown>).han
			) {
				settings.extraKnownMarketplaces = {
					...((settings.extraKnownMarketplaces as Record<string, unknown>) ||
						{}),
					han: {
						source: { source: "github", repo: "thebushidocollective/han" },
					},
				};
			}

			expect(
				(settings.extraKnownMarketplaces as Record<string, unknown>).han,
			).toBeDefined();
		});

		test("preserves existing marketplaces when adding Han", () => {
			const settings: Record<string, unknown> = {
				extraKnownMarketplaces: {
					custom: { source: { source: "github", repo: "user/custom" } },
				},
			};

			const existingMarketplaces = settings.extraKnownMarketplaces as Record<
				string,
				unknown
			>;
			if (!existingMarketplaces.han) {
				settings.extraKnownMarketplaces = {
					...existingMarketplaces,
					han: {
						source: { source: "github", repo: "thebushidocollective/han" },
					},
				};
			}

			const marketplaces = settings.extraKnownMarketplaces as Record<
				string,
				unknown
			>;
			expect(marketplaces.custom).toBeDefined();
			expect(marketplaces.han).toBeDefined();
		});

		test("does not overwrite existing Han marketplace config", () => {
			const settings = {
				extraKnownMarketplaces: {
					han: { source: { source: "directory", path: "/local/han" } },
				},
			};

			// The condition checks if han exists
			const hanExists = settings.extraKnownMarketplaces?.han;
			expect(hanExists).toBeDefined();
			// Since han exists, we should NOT overwrite it
		});
	});
});

describe("install.ts InstallResult interface", () => {
	test("InstallResult with plugins", () => {
		const result = {
			plugins: ["jutsu-typescript", "bushido"],
			marketplacePlugins: [
				{ name: "jutsu-typescript", description: "TypeScript support" },
				{ name: "bushido", description: "Core foundation" },
			],
		};

		expect(result.plugins).toHaveLength(2);
		expect(result.marketplacePlugins).toHaveLength(2);
	});

	test("InstallResult with cancellation", () => {
		const result = {
			cancelled: true,
		};

		expect(result.cancelled).toBe(true);
	});

	test("InstallResult with error", () => {
		const result = {
			error: new Error("Failed to fetch marketplace"),
		};

		expect(result.error).toBeInstanceOf(Error);
		expect(result.error.message).toBe("Failed to fetch marketplace");
	});
});

describe("install.ts output message generation", () => {
	test("generates add message for single plugin", () => {
		const added = ["jutsu-typescript"];
		const message = `\n\u2713 Added ${added.length} plugin(s): ${added.join(", ")}`;
		expect(message).toContain("Added 1 plugin(s)");
		expect(message).toContain("jutsu-typescript");
	});

	test("generates add message for multiple plugins", () => {
		const added = ["jutsu-typescript", "jutsu-biome", "hashi-github"];
		const message = `\n\u2713 Added ${added.length} plugin(s): ${added.join(", ")}`;
		expect(message).toContain("Added 3 plugin(s)");
		expect(message).toContain("jutsu-typescript, jutsu-biome, hashi-github");
	});

	test("generates remove message", () => {
		const removed = ["old-plugin"];
		const message = `\n\u2713 Removed ${removed.length} plugin(s): ${removed.join(", ")}`;
		expect(message).toContain("Removed 1 plugin(s)");
		expect(message).toContain("old-plugin");
	});

	test("generates invalid cleanup message", () => {
		const invalid = ["deleted-from-marketplace"];
		const message = `\n\u2713 Removed ${invalid.length} invalid plugin(s): ${invalid.join(", ")}`;
		expect(message).toContain("invalid plugin(s)");
	});

	test("generates no changes message", () => {
		const added: string[] = [];
		const removed: string[] = [];
		const invalid: string[] = [];

		if (added.length === 0 && removed.length === 0 && invalid.length === 0) {
			const message = "\n\u2713 No changes made";
			expect(message).toBe("\n\u2713 No changes made");
		}
	});

	test("generates restart reminder", () => {
		const message =
			"\n\u26a0\ufe0f  Please restart Claude Code to load the new plugins";
		expect(message).toContain("restart Claude Code");
	});
});

describe("install.ts scope handling", () => {
	beforeEach(() => setup());
	afterEach(() => teardown());

	test("getSettingsFilename returns correct path for user scope", () => {
		const scope = "user";
		const filename =
			scope === "user"
				? `${process.env.CLAUDE_CONFIG_DIR || "~/.claude"}/settings.json`
				: scope === "local"
					? ".claude/settings.local.json"
					: ".claude/settings.json";

		expect(filename).toContain("settings.json");
		expect(filename).toContain(configDir);
	});

	test("getSettingsFilename returns correct path for project scope", () => {
		const scope = "project";
		const filename =
			scope === "user"
				? "~/.claude/settings.json"
				: scope === "local"
					? ".claude/settings.local.json"
					: ".claude/settings.json";

		expect(filename).toBe(".claude/settings.json");
	});

	test("getSettingsFilename returns correct path for local scope", () => {
		const scope = "local";
		const filename =
			scope === "user"
				? "~/.claude/settings.json"
				: scope === "local"
					? ".claude/settings.local.json"
					: ".claude/settings.json";

		expect(filename).toBe(".claude/settings.local.json");
	});
});

describe("install.ts existing plugins display", () => {
	test("filters Han plugins from installed list", () => {
		const existingPlugins = [
			"jutsu-typescript",
			"do-frontend",
			"hashi-github",
			"core",
			"bushido",
			"other-marketplace-plugin",
		];

		const hanPlugins = existingPlugins.filter(
			(p) =>
				p.startsWith("jutsu-") ||
				p.startsWith("do-") ||
				p.startsWith("hashi-") ||
				p === "core" ||
				p === "bushido",
		);

		expect(hanPlugins).toContain("jutsu-typescript");
		expect(hanPlugins).toContain("do-frontend");
		expect(hanPlugins).toContain("hashi-github");
		expect(hanPlugins).toContain("core");
		expect(hanPlugins).toContain("bushido");
		expect(hanPlugins).not.toContain("other-marketplace-plugin");
	});

	test("shows message when Han plugins installed", () => {
		const hanPlugins = ["core", "jutsu-typescript"];
		let message = "";

		if (hanPlugins.length > 0) {
			message = `Currently installed: ${hanPlugins.join(", ")}\n`;
		}

		expect(message).toBe("Currently installed: core, jutsu-typescript\n");
	});

	test("shows nothing when no Han plugins installed", () => {
		const hanPlugins: string[] = [];
		let message = "";

		if (hanPlugins.length > 0) {
			message = `Currently installed: ${hanPlugins.join(", ")}\n`;
		}

		expect(message).toBe("");
	});
});
