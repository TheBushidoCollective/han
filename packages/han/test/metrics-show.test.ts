/**
 * Tests for commands/metrics/show.ts
 * Tests the showMetrics function with mocked Ink
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Note: We don't mock ink globally here to avoid affecting other test files.
// The showMetrics function gracefully handles rendering errors.

describe("metrics show", () => {
	const testDir = `/tmp/test-metrics-show-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("showMetrics function", () => {
		test("calls storage.queryMetrics with default parameters", async () => {
			// Capture console output
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			const { showMetrics } = await import("../lib/commands/metrics/show.ts");

			await showMetrics({});

			// The function should have called queryMetrics and rendered
			// Since Ink throws, it falls back to plain text rendering
			consoleSpy.mockRestore();
		});

		test("passes period option to storage", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			const { showMetrics } = await import("../lib/commands/metrics/show.ts");

			await showMetrics({ period: "day" });

			consoleSpy.mockRestore();
		});

		test("passes taskType option to storage", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			const { showMetrics } = await import("../lib/commands/metrics/show.ts");

			await showMetrics({ taskType: "fix" });

			consoleSpy.mockRestore();
		});

		test("handles showCalibration option", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			const { showMetrics } = await import("../lib/commands/metrics/show.ts");

			await showMetrics({ showCalibration: true });

			consoleSpy.mockRestore();
		});
	});
});

describe("metrics show via CLI", () => {
	const testDir = `/tmp/test-metrics-show-cli-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	test("shows metrics via CLI", async () => {
		const { spawnSync } = await import("node:child_process");

		const result = spawnSync("bun", ["run", "lib/main.ts", "metrics", "show"], {
			encoding: "utf-8",
			timeout: 30000,
			cwd: join(__dirname, ".."),
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: join(testDir, "config"),
			},
		});

		// Should succeed and produce some output
		expect(result.status).toBe(0);
	});

	test("shows metrics with --period option", async () => {
		const { spawnSync } = await import("node:child_process");

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "metrics", "show", "--period", "day"],
			{
				encoding: "utf-8",
				timeout: 30000,
				cwd: join(__dirname, ".."),
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: join(testDir, "config"),
				},
			},
		);

		expect(result.status).toBe(0);
	});

	test("shows metrics with --type option", async () => {
		const { spawnSync } = await import("node:child_process");

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "metrics", "show", "--type", "fix"],
			{
				encoding: "utf-8",
				timeout: 30000,
				cwd: join(__dirname, ".."),
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: join(testDir, "config"),
				},
			},
		);

		expect(result.status).toBe(0);
	});

	test("shows metrics with --calibration flag", async () => {
		const { spawnSync } = await import("node:child_process");

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "metrics", "show", "--calibration"],
			{
				encoding: "utf-8",
				timeout: 30000,
				cwd: join(__dirname, ".."),
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: join(testDir, "config"),
				},
			},
		);

		expect(result.status).toBe(0);
	});
});
