/**
 * Tests for uninstall.ts
 * Tests the Han marketplace uninstallation functionality
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { uninstall } from "../lib/install/index.ts";

describe("uninstall.ts", () => {
	let testDir: string;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let processExitSpy: ReturnType<typeof spyOn>;
	let logs: string[];
	let errors: string[];
	let exitCode: number | null;
	let originalCwd: () => string;

	beforeEach(() => {
		// Create unique test directory
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-uninstall-test-${Date.now()}-${random}`);
		mkdirSync(join(testDir, ".claude"), { recursive: true });

		// Mock process.cwd
		originalCwd = process.cwd;
		process.cwd = () => testDir;

		// Capture console output
		logs = [];
		errors = [];
		exitCode = null;
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
			errors.push(args.join(" "));
		});
		processExitSpy = spyOn(process, "exit").mockImplementation((code) => {
			exitCode = code as number;
			throw new Error(`process.exit(${code})`);
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
		process.cwd = originalCwd;

		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("when settings file does not exist", () => {
		test("reports no settings file found", () => {
			// Remove the .claude directory
			rmSync(join(testDir, ".claude"), { recursive: true, force: true });

			try {
				uninstall();
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No .claude/settings.json found");
			expect(exitCode).toBe(0);
		});
	});

	describe("when settings file has no Han configuration", () => {
		test("reports nothing to uninstall", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					someOtherSetting: "value",
				}),
			);

			try {
				uninstall();
			} catch {
				// process.exit throws
			}

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No Han marketplace or plugins found");
			expect(exitCode).toBe(0);
		});
	});

	describe("when settings file has Han marketplace", () => {
		test("removes Han marketplace URL", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					extraMarketplaces: [
						"https://github.com/thebushidocollective/han",
						"https://other-marketplace.com",
					],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Removed Han marketplace");

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.extraMarketplaces).toEqual([
				"https://other-marketplace.com",
			]);
		});

		test("removes extraMarketplaces key if empty", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					extraMarketplaces: ["https://github.com/thebushidocollective/han"],
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.extraMarketplaces).toBeUndefined();
		});
	});

	describe("when settings file has Han plugins", () => {
		test("removes jutsu- plugins", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript", "jutsu-react", "other-plugin"],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Removed 2 Han plugin(s)");

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.plugins).toEqual(["other-plugin"]);
		});

		test("removes do- plugins", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["do-frontend-development", "do-accessibility", "other"],
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.plugins).toEqual(["other"]);
		});

		test("removes hashi- plugins", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["hashi-github", "hashi-playwright-mcp", "remaining"],
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.plugins).toEqual(["remaining"]);
		});

		test("removes bushido plugin", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["bushido", "other-plugin"],
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.plugins).toEqual(["other-plugin"]);
		});

		test("removes plugins key if empty", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript"],
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.plugins).toBeUndefined();
		});
	});

	describe("when settings file has both marketplace and plugins", () => {
		test("removes all Han configuration", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					extraMarketplaces: ["https://github.com/thebushidocollective/han"],
					plugins: [
						"jutsu-typescript",
						"do-accessibility",
						"hashi-github",
						"bushido",
					],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Removed Han marketplace");
			expect(allLogs).toContain("Removed 4 Han plugin(s)");
			expect(allLogs).toContain("Uninstallation complete");

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.extraMarketplaces).toBeUndefined();
			expect(settings.plugins).toBeUndefined();
		});

		test("preserves other settings", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					extraMarketplaces: ["https://github.com/thebushidocollective/han"],
					plugins: ["jutsu-typescript"],
					customSetting: "preserved",
					anotherSetting: 123,
				}),
			);

			uninstall();

			const settings = JSON.parse(
				readFileSync(join(testDir, ".claude", "settings.json"), "utf-8"),
			);
			expect(settings.customSetting).toBe("preserved");
			expect(settings.anotherSetting).toBe(123);
		});
	});

	describe("output messages", () => {
		test("shows uninstallation start message", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript"],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Removing Han marketplace and plugins");
		});

		test("shows remaining configuration after uninstall", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript", "other-plugin"],
					extraMarketplaces: [
						"https://github.com/thebushidocollective/han",
						"https://other.com",
					],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Remaining configuration");
			expect(allLogs).toContain("Plugins: 1");
			expect(allLogs).toContain("other-plugin");
			expect(allLogs).toContain("Marketplaces: 1");
			expect(allLogs).toContain("https://other.com");
		});

		test("shows restart message", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript"],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Restart Claude Code");
		});

		test("shows no plugins message when all removed", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					plugins: ["jutsu-typescript"],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No plugins configured");
		});

		test("shows no marketplaces message when all removed", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					extraMarketplaces: ["https://github.com/thebushidocollective/han"],
				}),
			);

			uninstall();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No extra marketplaces configured");
		});
	});

	describe("error handling", () => {
		test("handles invalid JSON gracefully", () => {
			writeFileSync(
				join(testDir, ".claude", "settings.json"),
				"not valid json",
			);

			try {
				uninstall();
			} catch {
				// process.exit throws
			}

			const allErrors = errors.join("\n");
			expect(allErrors).toContain("Error reading settings.json");
		});
	});
});
