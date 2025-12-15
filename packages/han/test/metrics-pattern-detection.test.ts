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
let testDir: string;

function getMetricsDir(): string {
	return join(testDir, "han", "metrics", "jsonldb");
}

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-metrics-test-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	storage = new JsonlMetricsStorage(getMetricsDir());
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

function detectPatterns(minSeverity?: "low" | "medium" | "high"): Array<{
	type: string;
	severity: string;
	message: string;
	guidance: string;
}> {
	const mainPath = join(__dirname, "..", "lib", "main.ts");
	const cmd = minSeverity
		? `bun run ${mainPath} metrics detect-patterns --min-severity ${minSeverity} --json`
		: `bun run ${mainPath} metrics detect-patterns --json`;

	try {
		const output = execSync(cmd, {
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
		});
		const result = JSON.parse(output);
		return result.patterns || [];
	} catch {
		return [];
	}
}

describe("Metrics Pattern Detection", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Consecutive Failure Detection", () => {
		test("detects consecutive failures (high severity)", () => {
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

			const patterns = detectPatterns();
			expect(patterns.length).toBeGreaterThan(0);

			const consecutiveFailure = patterns.find(
				(p) => p.type === "consecutive_failures",
			);
			expect(consecutiveFailure).toBeTruthy();
			expect(consecutiveFailure?.severity).toBe("high");
			expect(consecutiveFailure?.message).toContain("Last 3 tasks");
		});

		test("does not detect consecutive failures with success", () => {
			getStorage().startSession();

			const task1 = getStorage().startTask({
				description: "Task 1",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task1.task_id,
				outcome: "failure",
				confidence: 0.7,
			});

			const task2 = getStorage().startTask({
				description: "Task 2",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task2.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const task3 = getStorage().startTask({
				description: "Task 3",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task3.task_id,
				outcome: "failure",
				confidence: 0.6,
			});

			const patterns = detectPatterns();
			const consecutiveFailure = patterns.find(
				(p) => p.type === "consecutive_failures",
			);
			expect(consecutiveFailure).toBeUndefined();
		});
	});

	describe("Hook Failure Pattern Detection", () => {
		test("detects high hook failure rate (>50%)", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
					error: "Type error",
				});
			}

			for (let i = 0; i < 2; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 800,
					exitCode: 0,
					passed: true,
				});
			}

			const patterns = detectPatterns();
			const hookPattern = patterns.find(
				(p) => p.type === "hook_failure_pattern",
			);

			expect(hookPattern).toBeTruthy();
			expect(hookPattern?.severity).toBe("high");
			expect(hookPattern?.message).toContain("typescript-typecheck");
			expect(hookPattern?.message).toContain("75%");
		});

		test("detects medium hook failure rate (30-50%)", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 500,
					exitCode: 1,
					passed: false,
					error: "Linting error",
				});
			}

			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 450,
					exitCode: 0,
					passed: true,
				});
			}

			const patterns = detectPatterns();
			const hookPattern = patterns.find(
				(p) => p.type === "hook_failure_pattern",
			);

			expect(hookPattern).toBeTruthy();
			expect(hookPattern?.severity).toBe("medium");
			expect(hookPattern?.message).toContain("40%");
		});

		test("filters patterns by minimum severity", () => {
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

			const highPatterns = detectPatterns("high");
			const hookPattern = highPatterns.find(
				(p) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeUndefined();

			const mediumPatterns = detectPatterns("medium");
			const mediumHookPattern = mediumPatterns.find(
				(p) => p.type === "hook_failure_pattern",
			);
			expect(mediumHookPattern).toBeTruthy();
		});
	});

	describe("Calibration Drift Detection", () => {
		test("detects high calibration drift (<30%)", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.9,
				});
			}

			const patterns = detectPatterns();
			const calibrationPattern = patterns.find(
				(p) => p.type === "calibration_drift",
			);

			expect(calibrationPattern).toBeTruthy();
			expect(calibrationPattern?.severity).toBe("high");
			expect(
				calibrationPattern?.guidance.includes("overconfident") ||
					calibrationPattern?.guidance.includes("calibration"),
			).toBe(true);
		});

		test("detects medium calibration drift (30-50%)", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.85,
				});
			}

			for (let i = 0; i < 2; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 4}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const patterns = detectPatterns();
			const calibrationPattern = patterns.find(
				(p) => p.type === "calibration_drift",
			);

			expect(calibrationPattern).toBeTruthy();
			expect(calibrationPattern?.severity).toBe("medium");
		});

		test("does not detect calibration drift with good calibration", () => {
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

			const patterns = detectPatterns();
			const calibrationPattern = patterns.find(
				(p) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeUndefined();
		});
	});

	describe("Guidance Content Tests", () => {
		test("provides specific guidance for consecutive failures", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.7,
				});
			}

			const patterns = detectPatterns();
			const pattern = patterns.find((p) => p.type === "consecutive_failures");

			expect(pattern?.guidance.length).toBeGreaterThan(0);
			expect(
				pattern?.guidance.includes("Review") ||
					pattern?.guidance.includes("Consider") ||
					pattern?.guidance.includes("breaking"),
			).toBe(true);
		});

		test("provides specific guidance for hook failures", () => {
			const { session_id } = getStorage().startSession();

			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "bun-test",
					hookSource: "jutsu-bun",
					durationMs: 2000,
					exitCode: 1,
					passed: false,
				});
			}

			for (let i = 0; i < 2; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "bun-test",
					hookSource: "jutsu-bun",
					durationMs: 1800,
					exitCode: 0,
					passed: true,
				});
			}

			const patterns = detectPatterns();
			const pattern = patterns.find((p) => p.type === "hook_failure_pattern");

			expect(pattern?.guidance.length).toBeGreaterThan(0);
			expect(
				pattern?.guidance.includes("Run") || pattern?.guidance.includes("test"),
			).toBe(true);
		});
	});

	describe("Empty Data Handling", () => {
		test("handles no data gracefully", () => {
			const patterns = detectPatterns();
			expect(patterns.length).toBe(0);
		});

		test("handles insufficient data gracefully", () => {
			getStorage().startSession();

			const task = getStorage().startTask({
				description: "Single task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "failure",
				confidence: 0.8,
			});

			const patterns = detectPatterns();
			const consecutivePattern = patterns.find(
				(p) => p.type === "consecutive_failures",
			);
			expect(consecutivePattern).toBeUndefined();
		});
	});
});
