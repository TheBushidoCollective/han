import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let storage: JsonlMetricsStorage | null = null;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	const testDir = join(tmpdir(), `han-metrics-test-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	storage = new JsonlMetricsStorage();
}

function getStorage(): JsonlMetricsStorage {
	if (!storage) {
		throw new Error("Storage not initialized - call setup() first");
	}
	return storage;
}

function teardown(): void {
	if (storage) {
		storage.close();
		storage = null;
	}
	if (process.env.CLAUDE_CONFIG_DIR) {
		try {
			rmSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		delete process.env.CLAUDE_CONFIG_DIR;
	}
}

function runCommand(command: string, input?: string): string {
	const mainPath = join(__dirname, "..", "lib", "main.ts");
	const output = execSync(`bun run ${mainPath} metrics ${command}`, {
		cwd: join(__dirname, ".."),
		env: process.env,
		encoding: "utf-8",
		input,
	});
	return output.trim();
}

describe("Metrics CLI Commands", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Session Start Command", () => {
		test("session-start creates new session", () => {
			const output = runCommand("session-start");
			const result = JSON.parse(output);
			expect(result.session_id).toBeTruthy();
			expect(result.session_id.startsWith("session-")).toBe(true);
			expect(result.resumed).toBe(false);
		});

		test("session-start with --session-id resumes session", () => {
			const firstOutput = runCommand("session-start");
			const firstResult = JSON.parse(firstOutput);
			const sessionId = firstResult.session_id;

			const resumeOutput = runCommand(
				`session-start --session-id ${sessionId}`,
			);
			const resumeResult = JSON.parse(resumeOutput);

			expect(resumeResult.session_id).toBe(sessionId);
			expect(resumeResult.resumed).toBe(true);
		});

		test("session-start creates new session for non-existent session ID", () => {
			const output = runCommand(
				"session-start --session-id nonexistent-session-123",
			);
			const result = JSON.parse(output);
			expect(result.session_id).toBeTruthy();
			expect(result.session_id).toBe("nonexistent-session-123");
			expect(result.resumed).toBe(false);
		});
	});

	describe("Session Current Command", () => {
		test("session-current returns active session", () => {
			const startOutput = runCommand("session-start");
			const startResult = JSON.parse(startOutput);

			const currentOutput = runCommand("session-current");
			const currentResult = JSON.parse(currentOutput);

			expect(currentResult.session_id).toBe(startResult.session_id);
		});

		test("session-current returns null when no active session", () => {
			const output = runCommand("session-current");
			const result = JSON.parse(output);
			expect(result.session_id).toBeNull();
		});
	});

	describe("Session End Command", () => {
		test("session-end ends active session", () => {
			const startOutput = runCommand("session-start");
			const startResult = JSON.parse(startOutput);

			const endOutput = runCommand("session-end");
			const endResult = JSON.parse(endOutput);

			expect(endResult.success).toBe(true);
			expect(endResult.session_id).toBe(startResult.session_id);

			const currentOutput = runCommand("session-current");
			const currentResult = JSON.parse(currentOutput);
			expect(currentResult.session_id).toBeNull();
		});

		test("session-end with --session-id ends specific session", () => {
			const startOutput = runCommand("session-start");
			const startResult = JSON.parse(startOutput);
			const sessionId = startResult.session_id;

			const endOutput = runCommand(`session-end --session-id ${sessionId}`);
			const endResult = JSON.parse(endOutput);

			expect(endResult.success).toBe(true);
			expect(endResult.session_id).toBe(sessionId);
		});

		test("session-end fails when no active session", () => {
			expect(() => runCommand("session-end")).toThrow(/No active session/);
		});
	});

	describe("Hook Execution Command", () => {
		test("hook-exec records hook execution via stdin", () => {
			const { session_id } = getStorage().startSession();
			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1200,
				exitCode: 0,
				passed: true,
				output: "All types valid",
			};

			const output = runCommand("hook-exec", JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(0);
		});

		test("hook-exec records hook failure via stdin", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 500,
					exitCode: 1,
					passed: false,
					error: "Linting errors found",
				};
				runCommand("hook-exec", JSON.stringify(hookData));
			}

			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].name).toBe("biome-lint");
			expect(hookStats[0].failures).toBe(3);
		});

		test("hook-exec handles missing sessionId", () => {
			const hookData = {
				hookType: "UserPromptSubmit",
				hookName: "professional-honesty",
				hookSource: "core",
				durationMs: 150,
				exitCode: 0,
				passed: true,
			};

			const output = runCommand("hook-exec", JSON.stringify(hookData));
			const result = JSON.parse(output);
			expect(result.success).toBe(true);
		});

		test("hook-exec validates JSON input", () => {
			expect(() => runCommand("hook-exec", "invalid json")).toThrow(
				/failed|Invalid/i,
			);
		});
	});

	describe("Session Context Command", () => {
		test("session-context generates context output", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const output = runCommand("session-context");
			expect(output.length).toBeGreaterThan(0);
			expect(
				output.includes("Your Recent Performance") ||
					output.includes("Getting Started"),
			).toBe(true);
		});

		test("session-context handles empty data", () => {
			const output = runCommand("session-context");
			expect(output).toContain("Getting Started");
			expect(output).toContain("No tasks tracked yet");
		});
	});

	describe("Detect Patterns Command", () => {
		test("detect-patterns returns JSON format", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.8,
				});
			}

			const output = runCommand("detect-patterns --json");
			const result = JSON.parse(output);
			const patterns = result.patterns;

			expect(Array.isArray(patterns)).toBe(true);
			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns[0].type).toBeTruthy();
			expect(patterns[0].severity).toBeTruthy();
			expect(patterns[0].message).toBeTruthy();
			expect(patterns[0].guidance).toBeTruthy();
		});

		test("detect-patterns filters by min-severity", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "core",
					durationMs: 500,
					exitCode: 1,
					passed: false,
				});
			}

			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "core",
					durationMs: 450,
					exitCode: 0,
					passed: true,
				});
			}

			const highOutput = runCommand(
				"detect-patterns --min-severity high --json",
			);
			const highResult = JSON.parse(highOutput);
			const hookPattern = highResult.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeUndefined();

			const mediumOutput = runCommand(
				"detect-patterns --min-severity medium --json",
			);
			const mediumResult = JSON.parse(mediumOutput);
			const mediumHookPattern = mediumResult.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(mediumHookPattern).toBeTruthy();
		});

		test("detect-patterns returns empty array with no patterns", () => {
			const output = runCommand("detect-patterns --json");
			const result = JSON.parse(output);
			expect(result.patterns.length).toBe(0);
		});
	});

	describe("Command Initialization", () => {
		test("commands handle missing storage gracefully", () => {
			const output = runCommand("session-current");
			const result = JSON.parse(output);
			expect(result.session_id).toBeNull();
		});
	});
});
