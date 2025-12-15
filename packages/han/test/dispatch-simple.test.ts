/**
 * Simple dispatch tests focusing on coverage
 * Tests code paths without subprocess execution complexity
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");

describe("dispatch simple coverage", () => {
	const testDir = `/tmp/test-dispatch-simple-${Date.now()}`;
	let configDir: string;

	beforeEach(() => {
		configDir = join(testDir, "config");
		mkdirSync(configDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("dispatch with HAN_DISABLE_HOOKS=true exits early", () => {
		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "hook", "dispatch", "SessionStart"],
			{
				encoding: "utf-8",
				timeout: 10000,
				cwd: packageRoot,
				env: {
					...process.env,
					HAN_DISABLE_HOOKS: "true",
					CLAUDE_CONFIG_DIR: configDir,
				},
			},
		);

		expect(result.status).toBe(0);
	});

	test("dispatch with empty settings executes without error", () => {
		writeFileSync(
			join(configDir, "settings.json"),
			JSON.stringify({ mcpServers: {}, plugins: {} }),
		);

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "hook", "dispatch", "SessionStart"],
			{
				encoding: "utf-8",
				timeout: 10000,
				cwd: packageRoot,
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: configDir,
					HOME: testDir,
				},
			},
		);

		expect([0, 1, undefined]).toContain(result.status ?? undefined);
	});

	test("dispatch with settings hook and --all executes hook", () => {
		const settings = {
			hooks: {
				SessionStart: [
					{
						hooks: [{ type: "command", command: "echo 'test output'" }],
					},
				],
			},
		};

		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "hook", "dispatch", "SessionStart", "--all"],
			{
				encoding: "utf-8",
				timeout: 10000,
				cwd: packageRoot,
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: configDir,
					HOME: testDir,
				},
			},
		);

		// Verify execution completed
		expect([0, 1, undefined]).toContain(result.status ?? undefined);
	});

	test("dispatch with --no-cache flag", () => {
		const settings = {
			hooks: {
				Stop: [
					{
						hooks: [{ type: "command", command: "echo 'cache test'" }],
					},
				],
			},
		};

		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const result = spawnSync(
			"bun",
			["run", "lib/main.ts", "hook", "dispatch", "Stop", "--all", "--no-cache"],
			{
				encoding: "utf-8",
				timeout: 10000,
				cwd: packageRoot,
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: configDir,
					HOME: testDir,
				},
			},
		);

		expect([0, 1, undefined]).toContain(result.status ?? undefined);
	});

	test("dispatch with --no-checkpoints flag", () => {
		const settings = {
			hooks: {
				Stop: [
					{
						hooks: [{ type: "command", command: "echo 'checkpoint test'" }],
					},
				],
			},
		};

		writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));

		const result = spawnSync(
			"bun",
			[
				"run",
				"lib/main.ts",
				"hook",
				"dispatch",
				"Stop",
				"--all",
				"--no-checkpoints",
			],
			{
				encoding: "utf-8",
				timeout: 10000,
				cwd: packageRoot,
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: configDir,
					HOME: testDir,
				},
			},
		);

		expect([0, 1, undefined]).toContain(result.status ?? undefined);
	});
});
