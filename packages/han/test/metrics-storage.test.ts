import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getMetricsDir,
	getMetricsFilePath,
	JsonlMetricsStorage,
} from "../lib/metrics/jsonl-storage.ts";

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

describe.serial("JsonlMetricsStorage", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Session Tests", () => {
		test("creates new session with unique ID", () => {
			const result = getStorage().startSession();
			expect(result.session_id).toBeTruthy();
			expect(result.session_id.startsWith("session-")).toBe(true);
			expect(result.resumed).toBe(false);
		});

		test("resumes existing session", () => {
			const { session_id } = getStorage().startSession();
			getStorage().close();
			storage = null;
			storage = new JsonlMetricsStorage();
			const result = getStorage().startSession(session_id);
			expect(result.session_id).toBe(session_id);
			expect(result.resumed).toBe(true);
		});

		test("gets current active session", () => {
			const { session_id } = getStorage().startSession();
			const current = getStorage().getCurrentSession();
			expect(current).toBeTruthy();
			expect(current?.session_id).toBe(session_id);
		});

		test("returns null when no active session", () => {
			const current = getStorage().getCurrentSession();
			expect(current).toBeNull();
		});

		test("ends session and calculates metrics", () => {
			const { session_id } = getStorage().startSession();
			const task1 = getStorage().startTask({
				description: "Test task 1",
				type: "implementation",
				estimated_complexity: "simple",
			});
			getStorage().completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.9,
				files_modified: ["test.ts"],
				tests_added: 5,
			});
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "test-hook",
				hookSource: "core",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			});
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "test-hook-2",
				hookSource: "core",
				durationMs: 200,
				exitCode: 1,
				passed: false,
				error: "Test error",
			});
			const result = getStorage().endSession(session_id);
			expect(result.success).toBe(true);

			const sessions = getStorage().querySessionMetrics("week", 1);
			expect(sessions.sessions.length).toBe(1);
			expect(sessions.sessions[0].task_count).toBe(1);
			expect(sessions.sessions[0].success_count).toBe(1);
			expect(sessions.sessions[0].hooks_passed_count).toBe(1);
			expect(sessions.sessions[0].hooks_failed_count).toBe(1);
		});

		test("orphaned tasks remain active on session end", () => {
			const { session_id } = getStorage().startSession();
			getStorage().startTask({
				description: "Orphaned task",
				type: "fix",
			});
			getStorage().endSession(session_id);
			const result = getStorage().queryMetrics({});
			expect(result.total_tasks).toBe(1);
			expect(result.tasks[0].status).toBe("active");
		});
	});

	describe("Task Tests", () => {
		test("creates task and links to current session", () => {
			const { session_id } = getStorage().startSession();
			const result = getStorage().startTask({
				description: "Test task",
				type: "implementation",
				estimated_complexity: "moderate",
			});
			expect(result.task_id).toBeTruthy();
			expect(result.task_id.startsWith("task-")).toBe(true);
			const tasks = getStorage().queryMetrics({});
			expect(tasks.tasks.length).toBe(1);
			expect(tasks.tasks[0].session_id).toBe(session_id);
		});

		test("completes task successfully", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Test task",
				type: "fix",
			});
			const result = getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.85,
				files_modified: ["file1.ts", "file2.ts"],
				tests_added: 3,
				notes: "All tests passing",
			});
			expect(result.success).toBe(true);
			const tasks = getStorage().queryMetrics({});
			const completedTask = tasks.tasks[0];
			expect(completedTask.status).toBe("completed");
			expect(completedTask.outcome).toBe("success");
			expect(completedTask.confidence).toBe(0.85);
			expect(completedTask.tests_added).toBe(3);
			expect(completedTask.duration_seconds).toBeDefined();
		});

		test("fails task with reason and solutions", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Test task",
				type: "refactor",
			});
			const result = getStorage().failTask({
				task_id,
				reason: "Type errors in code",
				confidence: 0.6,
				attempted_solutions: ["Try type assertion", "Use generic constraints"],
				notes: "Need user guidance",
			});
			expect(result.success).toBe(true);
			const tasks = getStorage().queryMetrics({});
			const failedTask = tasks.tasks[0];
			expect(failedTask.status).toBe("failed");
			expect(failedTask.outcome).toBe("failure");
			expect(failedTask.failure_reason).toBe("Type errors in code");
			const solutions = JSON.parse(failedTask.attempted_solutions ?? "[]");
			expect(solutions.length).toBe(2);
		});

		test("updates task with progress notes", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Test task",
				type: "implementation",
			});
			const result = getStorage().updateTask({
				task_id,
				status: "active",
				notes: "Halfway done with implementation",
			});
			expect(result.success).toBe(true);
		});

		test("completes task after storage recreation (duration from events)", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Task across storage instances",
				type: "implementation",
			});
			getStorage().close();
			storage = new JsonlMetricsStorage();
			const result = getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});
			expect(result.success).toBe(true);
			const metrics = getStorage().queryMetrics({});
			expect(metrics.tasks[0].duration_seconds).toBeDefined();
		});

		test("fails task after storage recreation (duration from events)", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Task across storage instances",
				type: "fix",
			});
			getStorage().close();
			storage = new JsonlMetricsStorage();
			const result = getStorage().failTask({
				task_id,
				reason: "Test failure",
			});
			expect(result.success).toBe(true);
			const metrics = getStorage().queryMetrics({});
			expect(metrics.tasks[0].duration_seconds).toBeDefined();
		});
	});

	describe("Hook Tracking Tests", () => {
		test("records hook execution", () => {
			const { session_id } = getStorage().startSession();
			const result = getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "UserPromptSubmit",
				hookName: "professional-honesty",
				hookSource: "core",
				durationMs: 250,
				exitCode: 0,
				passed: true,
				output: "Hook passed successfully",
			});
			expect(result.success).toBe(true);
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(0);
		});

		test("tracks hook failures", () => {
			const { session_id } = getStorage().startSession();
			for (let i = 0; i < 3; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
					error: "Type error found",
				});
			}
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1000,
				exitCode: 0,
				passed: true,
			});
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].name).toBe("typescript-typecheck");
			expect(hookStats[0].total).toBe(4);
			expect(hookStats[0].failures).toBe(3);
			expect(hookStats[0].failureRate).toBe(75);
		});
	});

	describe("Query Tests", () => {
		test("queries metrics with filters", () => {
			getStorage().startSession();
			const task1 = getStorage().startTask({
				description: "Impl 1",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.9,
			});
			const task2 = getStorage().startTask({
				description: "Fix 1",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.5,
			});
			const task3 = getStorage().startTask({
				description: "Impl 2",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task3.task_id,
				outcome: "success",
				confidence: 0.8,
			});
			const impls = getStorage().queryMetrics({ task_type: "implementation" });
			expect(impls.total_tasks).toBe(2);
			expect(impls.success_rate).toBe(1.0);
			const successes = getStorage().queryMetrics({ outcome: "success" });
			expect(successes.total_tasks).toBe(2);
		});

		test("calculates calibration score correctly", () => {
			getStorage().startSession();
			const task1 = getStorage().startTask({
				description: "Task 1",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.9,
			});
			const task2 = getStorage().startTask({
				description: "Task 2",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.9,
			});
			const metrics = getStorage().queryMetrics({});
			expect(metrics.calibration_score).toBe(0.5);
		});
	});

	describe("Session Metrics Tests", () => {
		test("queries session metrics", () => {
			const session1 = getStorage().startSession();
			const task1 = getStorage().startTask({
				description: "Task 1",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.85,
			});
			const task2 = getStorage().startTask({
				description: "Task 2",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.7,
			});
			getStorage().endSession(session1.session_id);

			const session2 = getStorage().startSession();
			const task3 = getStorage().startTask({
				description: "Task 3",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task3.task_id,
				outcome: "success",
				confidence: 0.9,
			});
			getStorage().endSession(session2.session_id);

			const sessionMetrics = getStorage().querySessionMetrics("week", 10);
			expect(sessionMetrics.sessions.length).toBe(2);
			expect(["improving", "declining", "stable"]).toContain(
				sessionMetrics.trends.success_rate_trend,
			);
			expect(["improving", "declining", "stable"]).toContain(
				sessionMetrics.trends.calibration_trend,
			);
		});

		test("handles empty data gracefully", () => {
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_tasks).toBe(0);
			expect(metrics.calibration_score).toBe(0);
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(0);
			const sessionMetrics = getStorage().querySessionMetrics("week", 10);
			expect(sessionMetrics.sessions.length).toBe(0);
			expect(sessionMetrics.trends.calibration_trend).toBe("stable");
		});
	});

	describe("Frustration Tracking Tests", () => {
		test("records frustration event", () => {
			getStorage().startSession();
			const task = getStorage().startTask({
				description: "Frustrating task",
				type: "implementation",
			});
			const result = getStorage().recordFrustration({
				task_id: task.task_id,
				frustration_level: "high",
				frustration_score: 8,
				user_message: "This is not working at all!",
				detected_signals: ["caps", "punctuation", "negative sentiment"],
				context: "User struggling with type errors",
			});
			expect(result.success).toBe(true);
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_frustrations).toBe(1);
			expect(metrics.frustration_events.length).toBe(1);
			expect(metrics.frustration_events[0].frustration_level).toBe("high");
			expect(metrics.frustration_events[0].frustration_score).toBe(8);
		});

		test("calculates frustration rate correctly", () => {
			getStorage().startSession();
			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}
			getStorage().recordFrustration({
				frustration_level: "moderate",
				frustration_score: 5,
				user_message: "This is confusing",
				detected_signals: ["question marks", "confusion"],
			});
			getStorage().recordFrustration({
				frustration_level: "low",
				frustration_score: 3,
				user_message: "Minor annoyance",
				detected_signals: ["mild frustration"],
			});
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_tasks).toBe(3);
			expect(metrics.total_frustrations).toBe(2);
			expect(metrics.frustration_rate).toBeGreaterThan(0.66);
			expect(metrics.frustration_rate).toBeLessThan(0.68);
		});

		test("records frustration without task_id", () => {
			getStorage().startSession();
			const result = getStorage().recordFrustration({
				frustration_level: "low",
				frustration_score: 2,
				user_message: "General frustration",
				detected_signals: ["sigh"],
			});
			expect(result.success).toBe(true);
			const metrics = getStorage().queryMetrics({});
			expect(metrics.frustration_events[0].task_id).toBeUndefined();
		});
	});

	describe("Period Filtering Tests", () => {
		test("queryMetrics filters by day period", () => {
			getStorage().startSession();
			const task = getStorage().startTask({
				description: "Recent task",
				type: "fix",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});
			expect(getStorage().queryMetrics({ period: "day" }).total_tasks).toBe(1);
			expect(getStorage().queryMetrics({ period: "week" }).total_tasks).toBe(1);
			expect(getStorage().queryMetrics({ period: "month" }).total_tasks).toBe(
				1,
			);
		});

		test("getHookFailureStats respects period filter", () => {
			const { session_id } = getStorage().startSession();
			for (let i = 0; i < 3; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 500,
					exitCode: 1,
					passed: false,
				});
			}
			expect(getStorage().getHookFailureStats("day").length).toBe(1);
			expect(getStorage().getHookFailureStats("week").length).toBe(1);
			expect(getStorage().getHookFailureStats("month").length).toBe(1);
		});

		test("querySessionMetrics respects period filter", () => {
			const session = getStorage().startSession();
			getStorage().endSession(session.session_id);
			expect(getStorage().querySessionMetrics("day", 10).sessions.length).toBe(
				1,
			);
			expect(getStorage().querySessionMetrics("week", 10).sessions.length).toBe(
				1,
			);
			expect(
				getStorage().querySessionMetrics("month", 10).sessions.length,
			).toBe(1);
		});
	});

	describe("Graceful Handling Tests", () => {
		test("handles ending non-existent session gracefully", () => {
			const result = getStorage().endSession("nonexistent-session");
			expect(result.success).toBe(true);
		});

		test("handles completing non-existent task gracefully", () => {
			const result = getStorage().completeTask({
				task_id: "nonexistent-task",
				outcome: "success",
				confidence: 0.9,
			});
			expect(result.success).toBe(true);
		});

		test("handles failing non-existent task gracefully", () => {
			const result = getStorage().failTask({
				task_id: "nonexistent-task",
				reason: "Test error",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("Path Helper Tests", () => {
		test("getMetricsDir returns correct path", () => {
			const dir = getMetricsDir();
			expect(dir).toContain("han");
			expect(dir).toContain("metrics");
			expect(dir).toContain("jsonldb");
			expect(dir).toContain(process.env.CLAUDE_CONFIG_DIR || "");
		});

		test("getMetricsFilePath returns dated JSONL file path", () => {
			const filePath = getMetricsFilePath();
			expect(filePath.endsWith(".jsonl")).toBe(true);
			expect(filePath).toContain("metrics-");
			expect(filePath).toMatch(/metrics-\d{4}-\d{2}-\d{2}\.jsonl/);
		});

		test("getMetricsFilePath returns path for specific date", () => {
			const specificDate = new Date("2024-06-15T12:00:00Z");
			const filePath = getMetricsFilePath(specificDate);
			expect(filePath).toContain("metrics-2024-06-15.jsonl");
		});
	});

	describe("File Read/Write Coverage Tests", () => {
		test("writes and reads events from JSONL file", () => {
			const { session_id } = getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Test for file I/O",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});
			getStorage().close();
			storage = new JsonlMetricsStorage();
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_tasks).toBe(1);
			expect(metrics.tasks[0].description).toBe("Test for file I/O");
			const resumed = getStorage().startSession(session_id);
			expect(resumed.resumed).toBe(true);
		});

		test("reads events across multiple operations after storage recreation", () => {
			getStorage().startSession();
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id,
					outcome: i === 0 ? "failure" : "success",
					confidence: 0.7 + i * 0.1,
				});
			}
			const session = getStorage().getCurrentSession();
			if (session) {
				for (let i = 0; i < 2; i++) {
					getStorage().recordHookExecution({
						sessionId: session.session_id,
						hookType: "Stop",
						hookName: "test-hook",
						hookSource: "core",
						durationMs: 100,
						exitCode: i === 0 ? 1 : 0,
						passed: i !== 0,
					});
				}
			}
			getStorage().recordFrustration({
				frustration_level: "moderate",
				frustration_score: 5,
				user_message: "Test frustration",
				detected_signals: ["test signal"],
			});
			getStorage().close();
			storage = new JsonlMetricsStorage();
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_tasks).toBe(3);
			expect(metrics.total_frustrations).toBe(1);
			expect(metrics.calibration_score).toBeGreaterThan(0);
			const hookStats = getStorage().getHookFailureStats("week");
			expect(hookStats.length).toBe(1);
			expect(hookStats[0].failures).toBe(1);
			const sessionMetrics = getStorage().querySessionMetrics("week", 10);
			expect(sessionMetrics.sessions.length).toBe(1);
		});

		test("handles malformed JSONL lines gracefully", () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Valid task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});
			const filePath = getMetricsFilePath();
			appendFileSync(filePath, "this is not valid json\n");
			appendFileSync(filePath, '{"partial": true\n');
			getStorage().close();
			storage = new JsonlMetricsStorage();
			const metrics = getStorage().queryMetrics({});
			expect(metrics.total_tasks).toBe(1);
		});
	});
});
