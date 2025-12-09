/**
 * Tests for plugin-uninstall.ts
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { uninstallPlugin, uninstallPlugins } from "../lib/plugin-uninstall.ts";

describe("plugin-uninstall.ts", () => {
	const testDir = `/tmp/test-plugin-uninstall-${Date.now()}`;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];
	let errors: string[] = [];
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "user");
		mkdirSync(join(testDir, "user"), { recursive: true });

		logs = [];
		errors = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
			errors.push(args.join(" "));
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
	});

	describe("uninstallPlugins", () => {
		test("uninstalls a single plugin", async () => {
			// Setup settings with plugins
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
						"jutsu-react@han": true,
					},
				}),
			);

			await uninstallPlugins(["jutsu-typescript"], "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Uninstalled 1 plugin(s): jutsu-typescript");
			expect(allLogs).toContain("restart Claude Code");

			// Verify settings file
			const updatedSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
			expect(
				updatedSettings.enabledPlugins["jutsu-typescript@han"],
			).toBeUndefined();
			expect(updatedSettings.enabledPlugins["jutsu-react@han"]).toBe(true);
		});

		test("uninstalls multiple plugins", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
						"jutsu-react@han": true,
						"hashi-github@han": true,
					},
				}),
			);

			await uninstallPlugins(["jutsu-typescript", "jutsu-react"], "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Uninstalled 2 plugin(s)");
			expect(allLogs).toContain("jutsu-typescript");
			expect(allLogs).toContain("jutsu-react");

			const updatedSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
			expect(
				updatedSettings.enabledPlugins["jutsu-typescript@han"],
			).toBeUndefined();
			expect(updatedSettings.enabledPlugins["jutsu-react@han"]).toBeUndefined();
			expect(updatedSettings.enabledPlugins["hashi-github@han"]).toBe(true);
		});

		test("reports plugins that are not installed", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
				}),
			);

			await uninstallPlugins(["nonexistent-plugin"], "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Not installed: nonexistent-plugin");
		});

		test("handles mix of installed and not installed plugins", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
				}),
			);

			await uninstallPlugins(["jutsu-typescript", "nonexistent"], "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Uninstalled 1 plugin(s): jutsu-typescript");
			expect(allLogs).toContain("Not installed: nonexistent");
		});

		test("removes enabledPlugins object when empty", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
					otherSettings: "preserved",
				}),
			);

			await uninstallPlugins(["jutsu-typescript"], "user");

			const updatedSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
			expect(updatedSettings.enabledPlugins).toBeUndefined();
			expect(updatedSettings.otherSettings).toBe("preserved");
		});

		test("creates settings file if it does not exist", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			// Don't create settings file

			await uninstallPlugins(["jutsu-typescript"], "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Not installed: jutsu-typescript");

			// Settings file should be created
			expect(existsSync(settingsPath)).toBe(true);
		});
	});

	describe("uninstallPlugin", () => {
		test("is a convenience wrapper for uninstallPlugins", async () => {
			const settingsPath = join(testDir, "user", "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
				}),
			);

			await uninstallPlugin("jutsu-typescript", "user");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Uninstalled 1 plugin(s): jutsu-typescript");
		});
	});
});
