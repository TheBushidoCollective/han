/**
 * Unit tests for JsonlMetricsStorage.
 * Tests metrics storage functionality with file-based JSONL storage.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

let testDir: string;
let originalConfigDir: string | undefined;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-jsonl-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });

	// Save original and set test config dir
	originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
	process.env.CLAUDE_CONFIG_DIR = testDir;
}

function teardown(): void {
	// Restore original config dir
	if (originalConfigDir !== undefined) {
		process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
	} else {
		delete process.env.CLAUDE_CONFIG_DIR;
	}

	// Clean up test directory
	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

function getMetricsDir(): string {
	return join(testDir, "han", "metrics", "jsonldb");
}

function getMetricsFile(): string {
	const dateStr = new Date().toISOString().split("T")[0];
	return join(getMetricsDir(), `metrics-${dateStr}.jsonl`);
}

function readMetricsEvents(): unknown[] {
	const file = getMetricsFile();
	if (!existsSync(file)) return [];

	const content = readFileSync(file, "utf-8");
	return content
		.trim()
		.split("\n")
		.filter((line) => line)
		.map((line) => JSON.parse(line));
}

describe("JsonlMetricsStorage", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("constructor", () => {
		test("creates metrics directory on initialization", () => {
			new JsonlMetricsStorage();
			expect(existsSync(getMetricsDir())).toBe(true);
		});

		test("reuses existing metrics directory", () => {
			mkdirSync(getMetricsDir(), { recursive: true });
			writeFileSync(join(getMetricsDir(), "test.txt"), "test");

			new JsonlMetricsStorage();

			expect(existsSync(join(getMetricsDir(), "test.txt"))).toBe(true);
		});
	});

	describe("session management", () => {
		test("startSession creates new session", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.startSession();

			expect(result.session_id).toMatch(/^session-\d+-[a-z0-9]+$/);
			expect(result.resumed).toBe(false);

			const events = readMetricsEvents();
			expect(events.length).toBe(1);
			expect((events[0] as { type: string }).type).toBe("session_start");
		});

		test("startSession with provided ID creates session with that ID", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.startSession("my-session-123");

			expect(result.session_id).toBe("my-session-123");
			expect(result.resumed).toBe(false);
		});

		test("startSession resumes existing session", () => {
			const storage = new JsonlMetricsStorage();
			const first = storage.startSession("test-session");
			expect(first.resumed).toBe(false);

			// Start again with same ID
			const second = storage.startSession("test-session");
			expect(second.session_id).toBe("test-session");
			expect(second.resumed).toBe(true);

			const events = readMetricsEvents();
			expect(
				events.filter((e) => (e as { type: string }).type === "session_start")
					.length,
			).toBe(1);
			expect(
				events.filter((e) => (e as { type: string }).type === "session_resume")
					.length,
			).toBe(1);
		});

		test("endSession records session end", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();

			const result = storage.endSession(session_id);
			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const endEvent = events.find(
				(e) => (e as { type: string }).type === "session_end",
			);
			expect(endEvent).toBeDefined();
			expect((endEvent as { session_id: string }).session_id).toBe(session_id);
		});

		test("getCurrentSession returns active session", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();

			const current = storage.getCurrentSession();
			expect(current).not.toBeNull();
			expect(current?.session_id).toBe(session_id);
		});

		test("getCurrentSession returns null after session ends", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();
			storage.endSession(session_id);

			// Create a new storage instance to test file-based lookup
			const storage2 = new JsonlMetricsStorage();
			const current = storage2.getCurrentSession();
			expect(current).toBeNull();
		});
	});

	describe("task management", () => {
		test("startTask creates new task", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.startTask({
				description: "Test task",
				type: "implementation",
				estimated_complexity: "simple",
			});

			expect(result.task_id).toMatch(/^task-\d+-[a-z0-9]+$/);

			const events = readMetricsEvents();
			const taskEvent = events.find(
				(e) => (e as { type: string }).type === "task_start",
			);
			expect(taskEvent).toBeDefined();
			expect((taskEvent as { description: string }).description).toBe(
				"Test task",
			);
			expect((taskEvent as { task_type: string }).task_type).toBe(
				"implementation",
			);
		});

		test("startTask associates with current session", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();
			storage.startTask({
				description: "Test task",
				type: "fix",
			});

			const events = readMetricsEvents();
			const taskEvent = events.find(
				(e) => (e as { type: string }).type === "task_start",
			);
			expect((taskEvent as { session_id: string }).session_id).toBe(session_id);
		});

		test("updateTask records task update", () => {
			const storage = new JsonlMetricsStorage();
			const { task_id } = storage.startTask({
				description: "Test task",
				type: "implementation",
			});

			const result = storage.updateTask({
				task_id,
				status: "in_progress",
				notes: "Working on it",
			});

			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const updateEvent = events.find(
				(e) => (e as { type: string }).type === "task_update",
			);
			expect(updateEvent).toBeDefined();
			expect((updateEvent as { task_id: string }).task_id).toBe(task_id);
			expect((updateEvent as { notes: string }).notes).toBe("Working on it");
		});

		test("completeTask records successful completion", () => {
			const storage = new JsonlMetricsStorage();
			const { task_id } = storage.startTask({
				description: "Test task",
				type: "implementation",
			});

			const result = storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
				files_modified: ["src/test.ts"],
				tests_added: 5,
				notes: "Done",
			});

			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const completeEvent = events.find(
				(e) => (e as { type: string }).type === "task_complete",
			);
			expect(completeEvent).toBeDefined();
			expect((completeEvent as { outcome: string }).outcome).toBe("success");
			expect((completeEvent as { confidence: number }).confidence).toBe(0.9);
			expect(
				(completeEvent as { files_modified: string[] }).files_modified,
			).toEqual(["src/test.ts"]);
		});

		test("failTask records task failure", () => {
			const storage = new JsonlMetricsStorage();
			const { task_id } = storage.startTask({
				description: "Test task",
				type: "implementation",
			});

			const result = storage.failTask({
				task_id,
				reason: "Could not resolve dependency",
				confidence: 0.8,
				attempted_solutions: ["Updated package.json", "Cleared cache"],
			});

			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const failEvent = events.find(
				(e) => (e as { type: string }).type === "task_fail",
			);
			expect(failEvent).toBeDefined();
			expect((failEvent as { reason: string }).reason).toBe(
				"Could not resolve dependency",
			);
			expect(
				(failEvent as { attempted_solutions: string[] }).attempted_solutions,
			).toHaveLength(2);
		});
	});

	describe("hook execution recording", () => {
		test("recordHookExecution records hook success", () => {
			const storage = new JsonlMetricsStorage();

			const result = storage.recordHookExecution({
				hookType: "Stop",
				hookName: "lint",
				hookSource: "jutsu-biome",
				durationMs: 1500,
				exitCode: 0,
				passed: true,
			});

			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const hookEvent = events.find(
				(e) => (e as { type: string }).type === "hook_execution",
			);
			expect(hookEvent).toBeDefined();
			expect((hookEvent as { hook_name: string }).hook_name).toBe("lint");
			expect((hookEvent as { passed: boolean }).passed).toBe(true);
		});

		test("recordHookExecution records hook failure", () => {
			const storage = new JsonlMetricsStorage();

			storage.recordHookExecution({
				hookType: "Stop",
				hookName: "test",
				durationMs: 5000,
				exitCode: 1,
				passed: false,
				error: "Tests failed",
			});

			const events = readMetricsEvents();
			const hookEvent = events.find(
				(e) => (e as { type: string }).type === "hook_execution",
			);
			expect((hookEvent as { passed: boolean }).passed).toBe(false);
			expect((hookEvent as { error: string }).error).toBe("Tests failed");
		});

		test("recordHookExecution with session and task", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();
			const { task_id } = storage.startTask({
				description: "Test",
				type: "fix",
			});

			storage.recordHookExecution({
				sessionId: session_id,
				taskId: task_id,
				hookType: "Stop",
				hookName: "lint",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			});

			const events = readMetricsEvents();
			const hookEvent = events.find(
				(e) => (e as { type: string }).type === "hook_execution",
			);
			expect((hookEvent as { session_id: string }).session_id).toBe(session_id);
			expect((hookEvent as { task_id: string }).task_id).toBe(task_id);
		});
	});

	describe("frustration recording", () => {
		test("recordFrustration records frustration event", () => {
			const storage = new JsonlMetricsStorage();

			const result = storage.recordFrustration({
				frustration_level: "moderate",
				frustration_score: 4.5,
				user_message: "This is frustrating!!",
				detected_signals: ["Multiple punctuation", "Negative sentiment"],
			});

			expect(result.success).toBe(true);

			const events = readMetricsEvents();
			const frustrationEvent = events.find(
				(e) => (e as { type: string }).type === "frustration",
			);
			expect(frustrationEvent).toBeDefined();
			expect(
				(frustrationEvent as { frustration_level: string }).frustration_level,
			).toBe("moderate");
			expect(
				(frustrationEvent as { frustration_score: number }).frustration_score,
			).toBe(4.5);
		});

		test("recordFrustration with task association", () => {
			const storage = new JsonlMetricsStorage();
			const { task_id } = storage.startTask({
				description: "Frustrating task",
				type: "fix",
			});

			storage.recordFrustration({
				task_id,
				frustration_level: "high",
				frustration_score: 8,
				user_message: "WHY DOESNT THIS WORK!!",
				detected_signals: ["ALL CAPS", "Multiple punctuation"],
				context: "After multiple failed attempts",
			});

			const events = readMetricsEvents();
			const frustrationEvent = events.find(
				(e) => (e as { type: string }).type === "frustration",
			);
			expect((frustrationEvent as { task_id: string }).task_id).toBe(task_id);
			expect((frustrationEvent as { context: string }).context).toBe(
				"After multiple failed attempts",
			);
		});
	});

	describe("queryMetrics", () => {
		test("queryMetrics returns empty result with no data", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.queryMetrics({});

			expect(result.total_tasks).toBe(0);
			expect(result.tasks).toHaveLength(0);
			expect(result.frustration_events).toHaveLength(0);
		});

		test("queryMetrics returns task statistics", () => {
			const storage = new JsonlMetricsStorage();

			// Create some tasks
			const { task_id: task1 } = storage.startTask({
				description: "Task 1",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task1,
				outcome: "success",
				confidence: 0.9,
			});

			const { task_id: task2 } = storage.startTask({
				description: "Task 2",
				type: "fix",
			});
			storage.completeTask({
				task_id: task2,
				outcome: "success",
				confidence: 0.8,
			});

			const { task_id: task3 } = storage.startTask({
				description: "Task 3",
				type: "implementation",
			});
			storage.failTask({
				task_id: task3,
				reason: "Failed",
			});

			const result = storage.queryMetrics({ period: "day" });

			expect(result.total_tasks).toBe(3);
			expect(result.completed_tasks).toBe(2);
			expect(result.success_rate).toBeCloseTo(1, 1); // 2/2 completed were successful
			expect(result.by_type.implementation).toBe(2);
			expect(result.by_type.fix).toBe(1);
		});

		test("queryMetrics filters by task type", () => {
			const storage = new JsonlMetricsStorage();

			storage.startTask({ description: "Impl 1", type: "implementation" });
			storage.startTask({ description: "Fix 1", type: "fix" });
			storage.startTask({ description: "Impl 2", type: "implementation" });

			const result = storage.queryMetrics({
				period: "day",
				task_type: "implementation",
			});

			expect(result.total_tasks).toBe(2);
		});

		test("queryMetrics filters by outcome", () => {
			const storage = new JsonlMetricsStorage();

			const { task_id: task1 } = storage.startTask({
				description: "Task 1",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task1,
				outcome: "success",
				confidence: 0.9,
			});

			const { task_id: task2 } = storage.startTask({
				description: "Task 2",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task2,
				outcome: "partial",
				confidence: 0.6,
			});

			const result = storage.queryMetrics({
				period: "day",
				outcome: "success",
			});

			expect(result.total_tasks).toBe(1);
		});

		test("queryMetrics calculates calibration score", () => {
			const storage = new JsonlMetricsStorage();

			// High confidence, success -> good calibration
			const { task_id: task1 } = storage.startTask({
				description: "Task 1",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task1,
				outcome: "success",
				confidence: 0.95,
			});

			// Low confidence, failure -> good calibration
			const { task_id: task2 } = storage.startTask({
				description: "Task 2",
				type: "implementation",
			});
			storage.failTask({ task_id: task2, reason: "Failed", confidence: 0.2 });

			const result = storage.queryMetrics({ period: "day" });

			// Both predictions were well-calibrated
			expect(result.calibration_score).toBeGreaterThan(0.7);
		});

		test("queryMetrics includes frustration events", () => {
			const storage = new JsonlMetricsStorage();

			storage.recordFrustration({
				frustration_level: "low",
				frustration_score: 2,
				user_message: "hmm",
				detected_signals: ["terse"],
			});

			storage.recordFrustration({
				frustration_level: "high",
				frustration_score: 8,
				user_message: "THIS IS BROKEN!!",
				detected_signals: ["caps", "punctuation"],
			});

			const result = storage.queryMetrics({ period: "day" });

			expect(result.total_frustrations).toBe(2);
			expect(result.frustration_events).toHaveLength(2);
		});
	});

	describe("getHookFailureStats", () => {
		test("returns empty array with no hook data", () => {
			const storage = new JsonlMetricsStorage();
			const stats = storage.getHookFailureStats();
			expect(stats).toHaveLength(0);
		});

		test("filters hooks with low failure rate", () => {
			const storage = new JsonlMetricsStorage();

			// Hook with 100% pass rate (0% failure)
			for (let i = 0; i < 10; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "lint",
					hookSource: "jutsu-biome",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			const stats = storage.getHookFailureStats();
			// Should be filtered out because failure rate is 0%
			expect(stats.filter((s) => s.name === "lint")).toHaveLength(0);
		});

		test("returns hooks with high failure rate", () => {
			const storage = new JsonlMetricsStorage();

			// Hook with 50% failure rate
			for (let i = 0; i < 5; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "test",
					hookSource: "jutsu-bun",
					durationMs: 1000,
					exitCode: 0,
					passed: true,
				});
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "test",
					hookSource: "jutsu-bun",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
				});
			}

			const stats = storage.getHookFailureStats();
			expect(stats.length).toBeGreaterThan(0);
			expect(stats[0].name).toBe("test");
			expect(stats[0].failureRate).toBe(50);
		});

		test("sorts by failure rate descending", () => {
			const storage = new JsonlMetricsStorage();

			// Hook A: 30% failure
			for (let i = 0; i < 7; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "hookA",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}
			for (let i = 0; i < 3; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "hookA",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}

			// Hook B: 80% failure
			for (let i = 0; i < 2; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "hookB",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}
			for (let i = 0; i < 8; i++) {
				storage.recordHookExecution({
					hookType: "Stop",
					hookName: "hookB",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}

			const stats = storage.getHookFailureStats();
			expect(stats[0].name).toBe("hookB");
			expect(stats[0].failureRate).toBe(80);
		});
	});

	describe("querySessionMetrics", () => {
		test("returns empty result with no sessions", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.querySessionMetrics();

			expect(result.sessions).toHaveLength(0);
			expect(result.trends.calibration_trend).toBe("stable");
			expect(result.trends.success_rate_trend).toBe("stable");
		});

		test("returns session statistics", () => {
			const storage = new JsonlMetricsStorage();

			const { session_id } = storage.startSession();
			const { task_id } = storage.startTask({
				description: "Test",
				type: "implementation",
			});
			storage.completeTask({ task_id, outcome: "success", confidence: 0.9 });
			storage.endSession(session_id);

			const result = storage.querySessionMetrics();

			expect(result.sessions.length).toBeGreaterThan(0);
			const session = result.sessions.find((s) => s.session_id === session_id);
			expect(session).toBeDefined();
		});

		test("tracks hook counts per session", () => {
			const storage = new JsonlMetricsStorage();
			const { session_id } = storage.startSession();

			storage.recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "lint",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			});

			storage.recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "test",
				durationMs: 1000,
				exitCode: 1,
				passed: false,
			});

			const result = storage.querySessionMetrics();
			const session = result.sessions.find((s) => s.session_id === session_id);

			expect(session?.hooks_passed_count).toBe(1);
			expect(session?.hooks_failed_count).toBe(1);
		});
	});

	describe("close", () => {
		test("close is a no-op but does not error", () => {
			const storage = new JsonlMetricsStorage();
			storage.startSession();

			// Should not throw
			expect(() => storage.close()).not.toThrow();
		});
	});
});
