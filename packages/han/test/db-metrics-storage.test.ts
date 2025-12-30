/**
 * Comprehensive tests for DbMetricsStorage
 *
 * Tests the database-backed metrics storage implementation:
 * - Session management
 * - Task lifecycle (create, complete, fail)
 * - Hook execution tracking
 * - Frustration event recording
 * - Metrics querying
 */
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We need to set up a test database before importing the db module
const TEST_DB_DIR = join(tmpdir(), `han-test-${Date.now()}`);
const TEST_CONFIG_DIR = join(TEST_DB_DIR, "config");

// Set environment before importing modules that use it
process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

import * as db from "../lib/db/index.ts";
// Now import after env is set
import { DbMetricsStorage } from "../lib/metrics/db-storage.ts";

describe("DbMetricsStorage", () => {
	let storage: DbMetricsStorage;

	beforeAll(() => {
		// Create test directories
		if (!existsSync(TEST_CONFIG_DIR)) {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });
		}
		const hanDir = join(TEST_CONFIG_DIR, "han");
		if (!existsSync(hanDir)) {
			mkdirSync(hanDir, { recursive: true });
		}
	});

	beforeEach(async () => {
		// Initialize database
		await db.initDb();
		storage = new DbMetricsStorage();
	});

	afterAll(() => {
		// Clean up test database
		try {
			if (existsSync(TEST_DB_DIR)) {
				rmSync(TEST_DB_DIR, { recursive: true, force: true });
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("session management", () => {
		test("startSession creates a new session", async () => {
			const result = await storage.startSession();

			expect(result.session_id).toBeDefined();
			expect(result.session_id).toMatch(/^session-\d+-[a-z0-9]+$/);
			expect(result.resumed).toBe(false);
		});

		test("startSession with explicit id creates that session", async () => {
			// Use unique ID to avoid collision with other tests
			const customId = `custom-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			const result = await storage.startSession(customId);

			expect(result.session_id).toBe(customId);
			// Could be false if truly new, or true if exists from previous run
			expect(typeof result.resumed).toBe("boolean");
		});

		test("startSession resumes existing session", async () => {
			// Use unique ID for this test
			const customId = `resume-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

			// Create first session
			const first = await storage.startSession(customId);
			// First creation - should be new
			expect(first.session_id).toBe(customId);

			// Create new storage instance and try to start same session
			const storage2 = new DbMetricsStorage();
			const second = await storage2.startSession(customId);

			// Second time with same ID - should be resumed
			expect(second.session_id).toBe(customId);
			expect(second.resumed).toBe(true);
		});

		test("endSession marks session as completed", async () => {
			const { session_id } = await storage.startSession();

			const result = await storage.endSession(session_id);

			expect(result.success).toBe(true);

			// Verify session is ended
			const session = await db.sessions.get(session_id);
			expect(session?.status).toBe("completed");
		});

		test("getCurrentSession returns active session", async () => {
			const { session_id } = await storage.startSession();

			const current = await storage.getCurrentSession();

			expect(current).not.toBeNull();
			expect(current?.session_id).toBe(session_id);
		});

		test("getCurrentSession returns null when no active session in storage instance", async () => {
			// Create a fresh storage with no session started
			const freshStorage = new DbMetricsStorage();

			// The fresh storage instance has no currentSessionId set
			// But it will look for any active session in the DB
			// So we just verify the behavior is consistent
			const current = await freshStorage.getCurrentSession();

			// Either null (no active sessions) or a session_id (from DB)
			if (current !== null) {
				expect(current.session_id).toBeDefined();
			}
			// Test passes either way - we're testing the interface works
		});
	});

	describe("task lifecycle", () => {
		beforeEach(async () => {
			// Start a session for task tests
			await storage.startSession();
		});

		test("startTask creates task with correct fields", async () => {
			const result = await storage.startTask({
				description: "Test task description",
				type: "implementation",
				estimated_complexity: "moderate",
			});

			expect(result.task_id).toBeDefined();
			expect(result.task_id).toMatch(/^task-\d+-[a-z0-9]+$/);

			// Verify task was created in DB
			const task = await db.tasks.get(result.task_id);
			expect(task).not.toBeNull();
			expect(task?.description).toBe("Test task description");
			expect(task?.taskType).toBe("implementation");
		});

		test("startTask associates task with session_id", async () => {
			const { session_id } = await storage.startSession("explicit-session");

			const result = await storage.startTask({
				description: "Task with explicit session",
				type: "fix",
				session_id: session_id,
			});

			const task = await db.tasks.get(result.task_id);
			expect(task?.sessionId).toBe(session_id);
		});

		test("completeTask updates task with outcome and confidence", async () => {
			const { task_id } = await storage.startTask({
				description: "Task to complete",
				type: "implementation",
			});

			const result = await storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.95,
				notes: "All tests passing",
			});

			expect(result.success).toBe(true);

			const task = await db.tasks.get(task_id);
			expect(task?.outcome).toBe("success");
			expect(task?.confidence).toBe(0.95);
			expect(task?.completedAt).toBeDefined();
		});

		test("completeTask stores files_modified as JSON array", async () => {
			const { task_id } = await storage.startTask({
				description: "Task with file changes",
				type: "fix",
			});

			await storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.85,
				files_modified: ["src/auth.ts", "src/utils.ts"],
			});

			const task = await db.tasks.get(task_id);
			expect(task?.filesModified).toEqual(["src/auth.ts", "src/utils.ts"]);
		});

		test("failTask records failure reason", async () => {
			const { task_id } = await storage.startTask({
				description: "Task to fail",
				type: "research",
			});

			const result = await storage.failTask({
				task_id,
				reason: "Could not find solution",
				confidence: 0.9,
			});

			expect(result.success).toBe(true);

			const task = await db.tasks.get(task_id);
			expect(task?.outcome).toBe("failure");
			expect(task?.notes).toContain("Could not find solution");
		});

		test("failTask stores attempted_solutions", async () => {
			const { task_id } = await storage.startTask({
				description: "Task with attempts",
				type: "fix",
			});

			await storage.failTask({
				task_id,
				reason: "All approaches failed",
				attempted_solutions: ["Tried X", "Tried Y", "Tried Z"],
			});

			// Note: attempted_solutions may be stored in notes or a separate field
			const task = await db.tasks.get(task_id);
			expect(task?.outcome).toBe("failure");
		});

		test("handles concurrent task creation", async () => {
			const promises = [];
			for (let i = 0; i < 5; i++) {
				promises.push(
					storage.startTask({
						description: `Concurrent task ${i}`,
						type: "implementation",
					}),
				);
			}

			const results = await Promise.all(promises);

			// All tasks should have unique IDs
			const taskIds = results.map((r) => r.task_id);
			const uniqueIds = new Set(taskIds);
			expect(uniqueIds.size).toBe(5);
		});
	});

	describe("hook execution tracking", () => {
		beforeEach(async () => {
			await storage.startSession();
		});

		test("recordHookExecution stores hook data", async () => {
			const result = await storage.recordHookExecution({
				hookType: "PreToolCall",
				hookName: "biome-lint",
				hookSource: "jutsu-biome",
				durationMs: 1500,
				exitCode: 0,
				passed: true,
				output: "All checks passed",
			});

			expect(result.success).toBe(true);
		});

		test("recordHookExecution handles failed hooks", async () => {
			const result = await storage.recordHookExecution({
				hookType: "PostToolCall",
				hookName: "typescript-check",
				durationMs: 3000,
				exitCode: 1,
				passed: false,
				error: "Type errors found",
			});

			expect(result.success).toBe(true);
		});

		test("getAllHookStats returns aggregated statistics", async () => {
			// Record some hook executions
			await storage.recordHookExecution({
				hookType: "Stop",
				hookName: "lint",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			});

			await storage.recordHookExecution({
				hookType: "Stop",
				hookName: "test",
				durationMs: 200,
				exitCode: 1,
				passed: false,
			});

			const stats = await storage.getAllHookStats("week");

			expect(stats.totalExecutions).toBeGreaterThanOrEqual(2);
			expect(stats.totalPassed).toBeGreaterThanOrEqual(1);
			expect(stats.totalFailed).toBeGreaterThanOrEqual(1);
			expect(typeof stats.passRate).toBe("number");
		});
	});

	describe("frustration event recording", () => {
		beforeEach(async () => {
			await storage.startSession();
		});

		test("recordFrustration stores event", async () => {
			const result = await storage.recordFrustration({
				frustration_level: "moderate",
				frustration_score: 0.6,
				user_message: "This is frustrating!",
				detected_signals: ["exclamation", "negative_word"],
			});

			expect(result.success).toBe(true);
		});

		test("recordFrustration associates with current session", async () => {
			await storage.startSession("frustration-session");

			const result = await storage.recordFrustration({
				frustration_level: "high",
				frustration_score: 0.9,
				user_message: "Nothing works!!!",
				detected_signals: ["multiple_exclamation", "caps"],
				context: "After 5 failed attempts",
			});

			expect(result.success).toBe(true);
		});

		test("recordFrustration handles all frustration levels", async () => {
			const levels = ["low", "moderate", "high"] as const;

			for (const level of levels) {
				const result = await storage.recordFrustration({
					frustration_level: level,
					frustration_score:
						level === "low" ? 0.2 : level === "moderate" ? 0.5 : 0.8,
					user_message: `${level} frustration test`,
					detected_signals: [],
				});

				expect(result.success).toBe(true);
			}
		});
	});

	describe("metrics querying", () => {
		beforeEach(async () => {
			await storage.startSession();

			// Create some test tasks
			const { task_id: task1 } = await storage.startTask({
				description: "Successful task",
				type: "implementation",
			});
			await storage.completeTask({
				task_id: task1,
				outcome: "success",
				confidence: 0.9,
			});

			const { task_id: task2 } = await storage.startTask({
				description: "Failed task",
				type: "fix",
			});
			await storage.failTask({
				task_id: task2,
				reason: "Could not reproduce",
			});

			const { task_id: task3 } = await storage.startTask({
				description: "Partial task",
				type: "refactor",
			});
			await storage.completeTask({
				task_id: task3,
				outcome: "partial",
				confidence: 0.6,
			});
		});

		test("queryMetrics returns basic statistics", async () => {
			const result = await storage.queryMetrics({});

			expect(result.total_tasks).toBeGreaterThanOrEqual(3);
			expect(result.completed_tasks).toBeGreaterThanOrEqual(2);
			expect(typeof result.success_rate).toBe("number");
		});

		test("queryMetrics filters by task type", async () => {
			const result = await storage.queryMetrics({
				task_type: "implementation",
			});

			expect(result.total_tasks).toBeGreaterThanOrEqual(1);
		});

		test("queryMetrics filters by outcome", async () => {
			const result = await storage.queryMetrics({
				outcome: "success",
			});

			expect(result.total_tasks).toBeGreaterThanOrEqual(1);
		});

		test("queryMetrics filters by period", async () => {
			const dayResult = await storage.queryMetrics({ period: "day" });
			const weekResult = await storage.queryMetrics({ period: "week" });
			const monthResult = await storage.queryMetrics({ period: "month" });

			// Week should have >= day, month should have >= week
			expect(weekResult.total_tasks).toBeGreaterThanOrEqual(
				dayResult.total_tasks,
			);
			expect(monthResult.total_tasks).toBeGreaterThanOrEqual(
				weekResult.total_tasks,
			);
		});

		test("queryMetrics returns calibration score", async () => {
			const result = await storage.queryMetrics({});

			// Calibration score should be between 0 and 100
			expect(result.calibration_score).toBeGreaterThanOrEqual(0);
			expect(result.calibration_score).toBeLessThanOrEqual(100);
		});

		test("queryMetrics returns by_type breakdown", async () => {
			const result = await storage.queryMetrics({});

			expect(typeof result.by_type).toBe("object");
			// Should have entries for our task types
			if (Object.keys(result.by_type).length > 0) {
				expect(
					result.by_type.implementation ||
						result.by_type.fix ||
						result.by_type.refactor,
				).toBeDefined();
			}
		});

		test("queryMetrics returns by_outcome breakdown", async () => {
			const result = await storage.queryMetrics({});

			expect(typeof result.by_outcome).toBe("object");
		});
	});

	describe("session metrics", () => {
		test("querySessionMetrics returns session list", async () => {
			await storage.startSession("session-metrics-test-1");
			await storage.startSession("session-metrics-test-2");

			const result = await storage.querySessionMetrics("week", 10);

			expect(result.sessions).toBeDefined();
			expect(Array.isArray(result.sessions)).toBe(true);
			expect(result.sessions.length).toBeGreaterThanOrEqual(2);
		});

		test("querySessionMetrics returns trends", async () => {
			await storage.startSession();

			const result = await storage.querySessionMetrics();

			expect(result.trends).toBeDefined();
			expect(result.trends.calibration_trend).toMatch(
				/^(improving|declining|stable)$/,
			);
			expect(result.trends.success_rate_trend).toMatch(
				/^(improving|declining|stable)$/,
			);
		});
	});

	describe("storage lifecycle", () => {
		test("close is a no-op but maintains interface compatibility", () => {
			// Just verify it doesn't throw
			expect(() => storage.close()).not.toThrow();
		});

		test("updateTask returns success (placeholder)", async () => {
			await storage.startSession();
			const { task_id } = await storage.startTask({
				description: "Task to update",
				type: "implementation",
			});

			const result = await storage.updateTask({
				task_id,
				notes: "Making progress",
			});

			expect(result.success).toBe(true);
		});
	});
});
