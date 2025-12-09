/**
 * Tests for plugin-list.ts
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Mock only the marketplace-cache module to avoid network calls
// This is safer than mocking shared.ts which is used by many other tests
mock.module("../lib/marketplace-cache.ts", () => ({
	getMarketplacePlugins: mock(() =>
		Promise.resolve({
			plugins: [
				{
					name: "jutsu-typescript",
					description: "TypeScript support",
					category: "jutsu",
				},
				{
					name: "jutsu-react",
					description: "React support",
					category: "jutsu",
				},
				{
					name: "hashi-github",
					description: "GitHub integration",
					category: "hashi",
				},
			],
			fromCache: true,
		}),
	),
}));

// Must import listPlugins AFTER setting up mocks
import { listPlugins } from "../lib/plugin-list.ts";

describe("plugin-list.ts", () => {
	const testDir = `/tmp/test-plugin-list-${Date.now()}`;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];
	let errors: string[] = [];
	let originalEnv: NodeJS.ProcessEnv;
	let originalCwd: () => string;

	beforeEach(() => {
		// Save original environment and cwd
		originalEnv = { ...process.env };
		originalCwd = process.cwd;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "user");
		process.cwd = () => join(testDir, "project");

		// Create directories
		mkdirSync(join(testDir, "user"), { recursive: true });
		mkdirSync(join(testDir, "project", ".claude"), { recursive: true });

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

		// Restore environment and cwd
		process.env = originalEnv;
		process.cwd = originalCwd;

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("listPlugins", () => {
		test("shows no plugins message when none installed", async () => {
			await listPlugins("all");

			expect(logs.some((l) => l.includes("No plugins installed"))).toBe(true);
			expect(logs.some((l) => l.includes("han plugin install"))).toBe(true);
		});

		test("lists plugins from user scope", async () => {
			// Create user settings with plugins
			writeFileSync(
				join(testDir, "user", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
						"jutsu-react@han": true,
					},
				}),
			);

			await listPlugins("user");

			// Should show the table with plugins
			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Fetching plugin information");
			expect(allLogs).toContain("2 plugin(s) installed");
		});

		test("lists plugins from project scope", async () => {
			writeFileSync(
				join(testDir, "project", ".claude", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"hashi-github@han": true,
					},
				}),
			);

			await listPlugins("project");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("1 plugin(s) installed");
		});

		test("lists plugins from all scopes", async () => {
			writeFileSync(
				join(testDir, "user", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
				}),
			);
			writeFileSync(
				join(testDir, "project", ".claude", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"hashi-github@han": true,
					},
				}),
			);

			await listPlugins("all");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("2 plugin(s) installed");
		});

		test("skips non-existent settings files", async () => {
			// Only create user settings
			writeFileSync(
				join(testDir, "user", "settings.json"),
				JSON.stringify({
					enabledPlugins: {
						"jutsu-typescript@han": true,
					},
				}),
			);

			await listPlugins("all");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("1 plugin(s) installed");
		});
	});
});
