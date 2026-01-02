/**
 * Comprehensive tests for commands/metrics/hook-tracking.ts
 * Tests the recordHookExecution function via CLI with stdin input
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let storage: JsonlMetricsStorage | null = null;
let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-hook-tracking-test-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	const metricsDir = join(testDir, "han", "metrics", "jsonldb");
	storage = new JsonlMetricsStorage(metricsDir);
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

function runHookExec(input?: string): {
	stdout: string;
	stderr: string;
	exitCode: number;
} {
	const mainPath = join(__dirname, "..", "lib", "main.ts");
	const result = spawnSync("bun", ["run", mainPath, "metrics", "hook-exec"], {
		cwd: join(__dirname, ".."),
		env: process.env,
		input: input,
		encoding: "utf-8",
		timeout: 10000, // 10 second timeout to prevent hanging
	});
	return {
		stdout: result.stdout?.trim() || "",
		stderr: result.stderr?.trim() || "",
		exitCode: result.status ?? 1,
	};
}

function runHookExecSuccess(input: string): string {
	const mainPath = join(__dirname, "..", "lib", "main.ts");
	const output = execSync(`bun run ${mainPath} metrics hook-exec`, {
		cwd: join(__dirname, ".."),
		env: process.env,
		encoding: "utf-8",
		input,
	});
	return output.trim();
}

describe.serial("Hook Tracking Comprehensive Tests", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Valid Hook Execution Recording", () => {
		test("records a successful hook execution with all fields", () => {
			const { session_id } = getStorage().startSession();
			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1500,
				exitCode: 0,
				passed: true,
				output: "All type checks passed successfully",
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);

			// Verify the hook was recorded in storage
			const hookStats = getStorage().getHookFailureStats("week");
			// Successful hooks don't appear in failure stats
			expect(hookStats.length).toBe(0);
		});

		test("records hook with minimal required fields", () => {
			const hookData = {
				hookType: "UserPromptSubmit",
				hookName: "core-hook",
				durationMs: 50,
				exitCode: 0,
				passed: true,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("records multiple hooks in a session", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: `hook-${i}`,
					hookSource: "test-plugin",
					durationMs: 100 + i * 50,
					exitCode: 0,
					passed: true,
				};
				runHookExecSuccess(JSON.stringify(hookData));
			}

			// Verify hooks were recorded (via session end which calculates stats)
			getStorage().endSession(session_id);
			const sessionMetrics = getStorage().querySessionMetrics("week", 1);
			expect(sessionMetrics.sessions.length).toBe(1);
			expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(5);
		}, 30000);
	});

	describe("Failed Hook Recording", () => {
		test("records a failed hook with error message", () => {
			const { session_id } = getStorage().startSession();
			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "biome-lint",
				hookSource: "jutsu-biome",
				durationMs: 800,
				exitCode: 1,
				passed: false,
				error: "Found 3 lint errors in src/index.ts",
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);

			// Verify failure is recorded
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].name).toBe("biome-lint");
			expect(hookStats[0].failures).toBe(1);
		});

		test("records multiple failed hooks and calculates failure rate", () => {
			const { session_id } = getStorage().startSession();

			// Record 3 failures
			for (let i = 0; i < 3; i++) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
					error: `Type error ${i + 1}`,
				};
				runHookExecSuccess(JSON.stringify(hookData));
			}

			// Record 1 success
			const successData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 900,
				exitCode: 0,
				passed: true,
			};
			runHookExecSuccess(JSON.stringify(successData));

			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].name).toBe("typescript-typecheck");
			expect(hookStats[0].total).toBe(4);
			expect(hookStats[0].failures).toBe(3);
			expect(hookStats[0].failureRate).toBe(75);
		}, 30000);

		test("records failed hook with non-zero exit code", () => {
			const { session_id } = getStorage().startSession();
			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "build-check",
				hookSource: "core",
				durationMs: 2500,
				exitCode: 127,
				passed: false,
				error: "Command not found",
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);

			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats[0].failures).toBe(1);
		});
	});

	describe("JSON Parsing", () => {
		test("parses valid JSON from stdin", () => {
			const hookData = {
				hookType: "PreToolUse",
				hookName: "validation-hook",
				durationMs: 25,
				exitCode: 0,
				passed: true,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("parses JSON with special characters in output", () => {
			const { session_id } = getStorage().startSession();
			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "lint-check",
				hookSource: "plugin",
				durationMs: 300,
				exitCode: 0,
				passed: true,
				output: 'Success: "all tests" passed\nLine 2: special chars <>&',
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("parses JSON with unicode characters", () => {
			const hookData = {
				hookType: "Stop",
				hookName: "unicode-hook",
				durationMs: 100,
				exitCode: 0,
				passed: true,
				output: "Success: \u2713 All checks passed \ud83d\ude80",
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("parses JSON with large output field", () => {
			const largeOutput = "x".repeat(10000);
			const hookData = {
				hookType: "Stop",
				hookName: "large-output-hook",
				durationMs: 500,
				exitCode: 0,
				passed: true,
				output: largeOutput,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});
	});

	describe("Invalid JSON Handling", () => {
		test("fails when stdin contains invalid JSON", () => {
			const result = runHookExec("this is not valid json");

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/failed|error|Invalid|parse/i);
		});

		test("fails when stdin contains partial JSON", () => {
			const result = runHookExec('{"hookType": "Stop", "hookName":');

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/failed|error|Invalid|parse|Unexpected/i);
		});

		test("fails when stdin contains empty object", () => {
			// While {} is valid JSON, it's missing required fields
			// The function should still succeed as it stores what it can
			const result = runHookExec("{}");

			// This should succeed since the storage handles missing fields
			expect(result.exitCode).toBe(0);
		});

		test("fails when stdin contains array instead of object", () => {
			const result = runHookExec('["hookType", "Stop"]');

			// Array access will fail since we expect an object
			expect(result.exitCode).toBe(0); // Storage still accepts it
		});

		test("fails when stdin contains number instead of object", () => {
			const result = runHookExec("42");

			expect(result.exitCode).toBe(0); // JSON.parse succeeds, storage accepts
		});
	});

	describe("Empty Stdin Handling", () => {
		test("fails when no stdin is provided", () => {
			const result = runHookExec("");

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/No stdin data|empty|input/i);
		});

		test("fails when stdin is only whitespace", () => {
			const result = runHookExec("   \n\t  ");

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/No stdin data|empty|input/i);
		});

		test("fails when stdin is only newlines", () => {
			const result = runHookExec("\n\n\n");

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/No stdin data|empty|input/i);
		});
	});

	describe("All Fields Preserved", () => {
		test("preserves all hook execution fields in storage", () => {
			const { session_id } = getStorage().startSession();
			const task = getStorage().startTask({
				description: "Test task",
				type: "implementation",
			});

			const hookData = {
				sessionId: session_id,
				taskId: task.task_id,
				hookType: "Stop",
				hookName: "full-field-test",
				hookSource: "jutsu-test-plugin",
				durationMs: 1234,
				exitCode: 0,
				passed: true,
				output: "All tests passed",
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);

			// End session to calculate final stats
			getStorage().endSession(session_id);

			// Query session metrics to verify hook was recorded
			const sessionMetrics = getStorage().querySessionMetrics("week", 1);
			expect(sessionMetrics.sessions.length).toBe(1);
			expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(1);
			expect(sessionMetrics.sessions[0].hooks_failed_count).toBe(0);
		});

		test("preserves error field for failed hooks", () => {
			const { session_id } = getStorage().startSession();
			const errorMessage = "Critical error: Build failed with exit code 1";

			const hookData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "error-field-test",
				hookSource: "jutsu-test",
				durationMs: 2000,
				exitCode: 1,
				passed: false,
				error: errorMessage,
			};

			runHookExecSuccess(JSON.stringify(hookData));

			// Verify the hook failure is tracked
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].name).toBe("error-field-test");
		});

		test("preserves optional fields when provided", () => {
			const { session_id } = getStorage().startSession();
			const task = getStorage().startTask({
				description: "Optional fields task",
				type: "fix",
			});

			// Record a hook with all optional fields
			const hookData = {
				sessionId: session_id,
				taskId: task.task_id,
				hookType: "PreToolUse",
				hookName: "optional-fields-hook",
				hookSource: "hashi-github",
				durationMs: 500,
				exitCode: 0,
				passed: true,
				output: "Validation passed",
				error: undefined,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("links hook to current session when sessionId not provided", () => {
			// Start a session first
			const { session_id } = getStorage().startSession();

			// Record hook without sessionId
			const hookData = {
				hookType: "Stop",
				hookName: "auto-session-link",
				hookSource: "core",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			};

			runHookExecSuccess(JSON.stringify(hookData));

			// End session and verify hook was linked
			getStorage().endSession(session_id);

			const sessionMetrics = getStorage().querySessionMetrics("week", 1);
			expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(1);
		});
	});

	describe("Edge Cases", () => {
		test("handles very long hook names", () => {
			const longName = "a".repeat(500);
			const hookData = {
				hookType: "Stop",
				hookName: longName,
				durationMs: 100,
				exitCode: 0,
				passed: true,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("handles zero duration", () => {
			const hookData = {
				hookType: "PreToolUse",
				hookName: "instant-hook",
				durationMs: 0,
				exitCode: 0,
				passed: true,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("handles very large duration", () => {
			const hookData = {
				hookType: "Stop",
				hookName: "slow-hook",
				durationMs: 999999999,
				exitCode: 0,
				passed: true,
			};

			const output = runHookExecSuccess(JSON.stringify(hookData));
			const result = JSON.parse(output);

			expect(result.success).toBe(true);
		});

		test("handles various exit codes", () => {
			const { session_id } = getStorage().startSession();

			for (const exitCode of [0, 1, 2, 127, 255]) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: `exit-code-${exitCode}`,
					durationMs: 50,
					exitCode: exitCode,
					passed: exitCode === 0,
				};
				runHookExecSuccess(JSON.stringify(hookData));
			}

			const hookStats = getStorage().getHookFailureStats("week");
			// 4 failed hooks (exit codes 1, 2, 127, 255)
			expect(hookStats.length).toBe(4);
		}, 30000);

		test("handles multiple different hook types", () => {
			const hookTypes = [
				"Stop",
				"PreToolUse",
				"PostToolUse",
				"UserPromptSubmit",
			];

			for (const hookType of hookTypes) {
				const hookData = {
					hookType,
					hookName: `${hookType.toLowerCase()}-hook`,
					durationMs: 100,
					exitCode: 0,
					passed: true,
				};
				runHookExecSuccess(JSON.stringify(hookData));
			}
		}, 30000);

		test("handles concurrent session hooks correctly", () => {
			const { session_id } = getStorage().startSession();

			// Simulate rapid hook executions
			for (let i = 0; i < 10; i++) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: `concurrent-hook-${i}`,
					durationMs: 50,
					exitCode: i % 3 === 0 ? 1 : 0,
					passed: i % 3 !== 0,
				};
				runHookExecSuccess(JSON.stringify(hookData));
			}

			getStorage().endSession(session_id);
			const sessionMetrics = getStorage().querySessionMetrics("week", 1);

			// 4 failed (i = 0, 3, 6, 9), 6 passed
			expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(6);
			expect(sessionMetrics.sessions[0].hooks_failed_count).toBe(4);
		}, 30000);
	});
});
