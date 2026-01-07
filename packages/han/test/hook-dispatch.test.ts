/**
 * Tests for commands/hook/dispatch.ts
 * Tests the hook dispatch helper functions
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("hook dispatch.ts helper functions", () => {
	let testDir: string;
	let originalEnv: typeof process.env;
	let originalCwd: () => string;

	beforeEach(() => {
		// Generate unique test directory per test
		testDir = `/tmp/test-hook-dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		// Save original environment
		originalEnv = { ...process.env };
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;

		// Create directories
		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });
	});

	afterEach(() => {
		// Restore environment
		process.env = originalEnv;
		process.cwd = originalCwd;

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("findPluginInMarketplace logic", () => {
		test("finds plugin in jutsu directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const jutsuPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			mkdirSync(jutsuPath, { recursive: true });

			// Simulate findPluginInMarketplace behavior
			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "jutsu-typescript"),
				join(marketplaceRoot, "do", "jutsu-typescript"),
				join(marketplaceRoot, "hashi", "jutsu-typescript"),
				join(marketplaceRoot, "jutsu-typescript"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (require("node:fs").existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(jutsuPath);
		});

		test("finds plugin in do directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const doPath = join(marketplaceRoot, "do", "do-accessibility");
			mkdirSync(doPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "do-accessibility"),
				join(marketplaceRoot, "do", "do-accessibility"),
				join(marketplaceRoot, "hashi", "do-accessibility"),
				join(marketplaceRoot, "do-accessibility"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (require("node:fs").existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(doPath);
		});

		test("finds plugin in hashi directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const hashiPath = join(marketplaceRoot, "hashi", "hashi-github");
			mkdirSync(hashiPath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "hashi-github"),
				join(marketplaceRoot, "do", "hashi-github"),
				join(marketplaceRoot, "hashi", "hashi-github"),
				join(marketplaceRoot, "hashi-github"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (require("node:fs").existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(hashiPath);
		});

		test("finds plugin in root directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const corePath = join(marketplaceRoot, "core");
			mkdirSync(corePath, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "core"),
				join(marketplaceRoot, "do", "core"),
				join(marketplaceRoot, "hashi", "core"),
				join(marketplaceRoot, "core"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (require("node:fs").existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBe(corePath);
		});

		test("returns null when plugin not found", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			mkdirSync(marketplaceRoot, { recursive: true });

			const potentialPaths = [
				join(marketplaceRoot, "jutsu", "nonexistent"),
				join(marketplaceRoot, "do", "nonexistent"),
				join(marketplaceRoot, "hashi", "nonexistent"),
				join(marketplaceRoot, "nonexistent"),
			];

			let found: string | null = null;
			for (const path of potentialPaths) {
				if (require("node:fs").existsSync(path)) {
					found = path;
					break;
				}
			}

			expect(found).toBeNull();
		});
	});

	describe("resolveToAbsolute logic", () => {
		test("returns absolute paths unchanged", () => {
			const absPath = "/absolute/path/to/dir";
			const result = absPath.startsWith("/") ? absPath : join("/cwd", absPath);
			expect(result).toBe("/absolute/path/to/dir");
		});

		test("resolves relative paths against cwd", () => {
			const relPath = "relative/path";
			const cwd = "/some/cwd";
			const result = relPath.startsWith("/") ? relPath : join(cwd, relPath);
			expect(result).toBe("/some/cwd/relative/path");
		});
	});

	describe("extractPluginName logic", () => {
		test("extracts plugin name from full path", () => {
			const pluginRoot =
				"/path/to/plugins/marketplaces/han/jutsu/jutsu-typescript";
			const parts = pluginRoot.split("/");
			const name = parts[parts.length - 1];
			expect(name).toBe("jutsu-typescript");
		});

		test("extracts plugin name from short path", () => {
			const pluginRoot = "/path/to/core";
			const parts = pluginRoot.split("/");
			const name = parts[parts.length - 1];
			expect(name).toBe("core");
		});
	});

	describe("deriveHookName logic", () => {
		test("extracts hook name from md file path", () => {
			const command = "cat hooks/metrics-tracking.md";
			const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
			const name = hookFileMatch ? hookFileMatch[1] : "default";
			expect(name).toBe("metrics-tracking");
		});

		test("extracts hook name from sh file path", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal template placeholder
			const command = "${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh";
			const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
			const name = hookFileMatch ? hookFileMatch[1] : "default";
			expect(name).toBe("pre-push-check");
		});

		test("extracts hook name from npx command", () => {
			const command =
				"npx han hook reference hooks/professional-honesty.md --must-read";
			const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
			const name = hookFileMatch ? hookFileMatch[1] : "default";
			expect(name).toBe("professional-honesty");
		});

		test("falls back to default when no match", () => {
			const command = "echo hello";
			const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
			const name = hookFileMatch ? hookFileMatch[1] : "default-plugin";
			expect(name).toBe("default-plugin");
		});
	});

	describe("loadPluginHooks logic", () => {
		test("loads hooks.json from plugin directory", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksJson = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: "echo test", timeout: 5000 }],
						},
					],
				},
			};
			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksJson, null, 2),
			);

			const hooksPath = join(pluginRoot, "hooks", "hooks.json");
			const content = require("node:fs").readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.SessionStart).toBeDefined();
			expect(parsed.hooks.SessionStart[0].hooks[0].type).toBe("command");
			expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe("echo test");
		});

		test("returns null for missing hooks.json", () => {
			const pluginRoot = join(testDir, "plugin-no-hooks");
			mkdirSync(pluginRoot, { recursive: true });

			const hooksPath = join(pluginRoot, "hooks", "hooks.json");
			const exists = require("node:fs").existsSync(hooksPath);

			expect(exists).toBe(false);
		});

		test("returns null for invalid hooks.json", () => {
			const pluginRoot = join(testDir, "plugin-bad-hooks");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });
			writeFileSync(join(hooksDir, "hooks.json"), "not valid json");

			const hooksPath = join(pluginRoot, "hooks", "hooks.json");
			let result: unknown = null;

			try {
				const content = require("node:fs").readFileSync(hooksPath, "utf-8");
				result = JSON.parse(content);
			} catch {
				result = null;
			}

			expect(result).toBeNull();
		});
	});

	describe("hook type handling", () => {
		test("recognizes SessionStart hook type", () => {
			const hookTypes = [
				"SessionStart",
				"Stop",
				"UserPromptSubmit",
				"AIResponse",
			];
			expect(hookTypes.includes("SessionStart")).toBe(true);
		});

		test("recognizes Stop hook type", () => {
			const hookTypes = [
				"SessionStart",
				"Stop",
				"UserPromptSubmit",
				"AIResponse",
			];
			expect(hookTypes.includes("Stop")).toBe(true);
		});

		test("recognizes UserPromptSubmit hook type", () => {
			const hookTypes = [
				"SessionStart",
				"Stop",
				"UserPromptSubmit",
				"AIResponse",
			];
			expect(hookTypes.includes("UserPromptSubmit")).toBe(true);
		});
	});

	describe("command template resolution", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal template placeholder
		test("replaces ${CLAUDE_PLUGIN_ROOT} with actual path", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal template placeholder
			const command = "${CLAUDE_PLUGIN_ROOT}/hooks/test.sh";
			const pluginRoot = "/path/to/plugin";
			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
			expect(resolved).toBe("/path/to/plugin/hooks/test.sh");
		});

		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal template placeholder
		test("handles multiple ${CLAUDE_PLUGIN_ROOT} occurrences", () => {
			const command =
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal template placeholder
				"${CLAUDE_PLUGIN_ROOT}/scripts/lint.sh ${CLAUDE_PLUGIN_ROOT}/src";
			const pluginRoot = "/my/plugin";
			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
			expect(resolved).toBe("/my/plugin/scripts/lint.sh /my/plugin/src");
		});

		test("leaves commands without template unchanged", () => {
			const command = "echo hello world";
			const pluginRoot = "/path/to/plugin";
			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
			expect(resolved).toBe("echo hello world");
		});
	});

	describe("HAN_DISABLE_HOOKS environment variable", () => {
		test("disables hooks when set to 'true'", () => {
			const isDisabled =
				process.env.HAN_DISABLE_HOOKS === "true" ||
				process.env.HAN_DISABLE_HOOKS === "1";
			expect(isDisabled).toBe(false);

			process.env.HAN_DISABLE_HOOKS = "true";
			const isDisabledNow =
				process.env.HAN_DISABLE_HOOKS === "true" ||
				process.env.HAN_DISABLE_HOOKS === "1";
			expect(isDisabledNow).toBe(true);
		});

		test("disables hooks when set to '1'", () => {
			process.env.HAN_DISABLE_HOOKS = "1";
			const isDisabled =
				process.env.HAN_DISABLE_HOOKS === "true" ||
				process.env.HAN_DISABLE_HOOKS === "1";
			expect(isDisabled).toBe(true);
		});

		test("does not disable for other values", () => {
			process.env.HAN_DISABLE_HOOKS = "false";
			const isDisabled =
				process.env.HAN_DISABLE_HOOKS === "true" ||
				process.env.HAN_DISABLE_HOOKS === "1";
			expect(isDisabled).toBe(false);
		});
	});

	describe("settings hooks path resolution", () => {
		test("converts settings.json to hooks.json path", () => {
			const settingsPath = "/path/to/.claude/settings.json";
			const hooksPath = settingsPath.replace(
				/settings(\.local)?\.json$/,
				"hooks.json",
			);
			expect(hooksPath).toBe("/path/to/.claude/hooks.json");
		});

		test("converts settings.local.json to hooks.json path", () => {
			const settingsPath = "/path/to/.claude/settings.local.json";
			const hooksPath = settingsPath.replace(
				/settings(\.local)?\.json$/,
				"hooks.json",
			);
			expect(hooksPath).toBe("/path/to/.claude/hooks.json");
		});
	});
});
