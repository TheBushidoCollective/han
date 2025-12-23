import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

/**
 * Comprehensive tests for session tracking functionality
 *
 * These tests focus on the session management capabilities of the metrics storage system.
 * The session-tracking CLI module (lib/commands/metrics/session-tracking.ts) is a thin wrapper
 * around JsonlMetricsStorage, so we test the core functionality directly for better isolation.
 *
 * Tests cover:
 * 1. Start New Session - Creating fresh sessions with auto-generated IDs
 * 2. Resume Existing Session - Resuming sessions by ID
 * 3. End Session - Ending active sessions and handling edge cases
 * 4. Get Current Session - Getting active session info
 * 5. Session Metrics - Querying session statistics
 * 6. Edge Cases - Special scenarios and error handling
 */

let storage: JsonlMetricsStorage | null = null;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	const testDir = join(
		tmpdir(),
		`han-session-tracking-test-${Date.now()}-${random}`,
	);
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

describe.serial("Session Tracking - Start New Session", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("creates a new session with auto-generated ID when no ID provided", () => {
		const result = getStorage().startSession();

		expect(result.session_id).toBeTruthy();
		expect(result.session_id.startsWith("session-")).toBe(true);
		expect(result.resumed).toBe(false);
	});

	test("creates a new session with custom ID when provided", () => {
		const customId = "my-custom-session-id";
		const result = getStorage().startSession(customId);

		expect(result.session_id).toBe(customId);
		expect(result.resumed).toBe(false);
	});

	test("auto-generated session IDs are unique", () => {
		const sessionIds = new Set<string>();

		for (let i = 0; i < 10; i++) {
			const result = getStorage().startSession();
			expect(sessionIds.has(result.session_id)).toBe(false);
			sessionIds.add(result.session_id);
		}

		expect(sessionIds.size).toBe(10);
	});

	test("session ID format includes timestamp and random component", () => {
		const result = getStorage().startSession();

		// Format: session-{timestamp}-{random}
		const parts = result.session_id.split("-");
		expect(parts[0]).toBe("session");
		expect(parts.length).toBe(3);
		// Timestamp should be a valid number
		expect(Number.isNaN(Number.parseInt(parts[1], 10))).toBe(false);
	});

	test("creates multiple sessions sequentially", () => {
		const session1 = getStorage().startSession();
		const session2 = getStorage().startSession();
		const session3 = getStorage().startSession();

		expect(session1.session_id).not.toBe(session2.session_id);
		expect(session2.session_id).not.toBe(session3.session_id);
		expect(session1.session_id).not.toBe(session3.session_id);
	});
});

describe.serial("Session Tracking - Resume Existing Session", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("resumes existing session when same ID is provided", () => {
		const firstResult = getStorage().startSession();
		const firstSessionId = firstResult.session_id;

		// Close storage to simulate process restart
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Try to resume
		const resumeResult = getStorage().startSession(firstSessionId);

		expect(resumeResult.session_id).toBe(firstSessionId);
		expect(resumeResult.resumed).toBe(true);
	});

	test("does not resume non-existent session ID", () => {
		const result = getStorage().startSession("non-existent-session");

		// Should create a new session with the given ID
		expect(result.session_id).toBe("non-existent-session");
		expect(result.resumed).toBe(false);
	});

	test("resumes session correctly after multiple operations", () => {
		const sessionId = getStorage().startSession().session_id;

		// Do some operations
		getStorage().startTask({
			description: "Test task",
			type: "implementation",
		});

		// Close and reopen storage
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Resume should work
		const resumeResult = getStorage().startSession(sessionId);
		expect(resumeResult.resumed).toBe(true);
	});

	test("can resume session multiple times", () => {
		const sessionId = getStorage().startSession().session_id;

		// First resume
		getStorage().close();
		storage = new JsonlMetricsStorage();
		let result = getStorage().startSession(sessionId);
		expect(result.resumed).toBe(true);

		// Second resume
		getStorage().close();
		storage = new JsonlMetricsStorage();
		result = getStorage().startSession(sessionId);
		expect(result.resumed).toBe(true);
	});
});

describe.serial("Session Tracking - End Session", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("ends an active session successfully", () => {
		const { session_id } = getStorage().startSession();

		const result = getStorage().endSession(session_id);

		expect(result.success).toBe(true);
	});

	test("ending session clears current session state", () => {
		const { session_id } = getStorage().startSession();
		expect(getStorage().getCurrentSession()?.session_id).toBe(session_id);

		getStorage().endSession(session_id);

		expect(getStorage().getCurrentSession()).toBeNull();
	});

	test("handles ending non-existent session gracefully", () => {
		const result = getStorage().endSession("non-existent-session-id");

		// Should succeed without error
		expect(result.success).toBe(true);
	});

	test("records session metrics on end", () => {
		const { session_id } = getStorage().startSession();

		// Add some tasks
		const task = getStorage().startTask({
			description: "Test task",
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		getStorage().endSession(session_id);

		// Verify session was recorded with metrics
		const sessionMetrics = getStorage().querySessionMetrics("day", 10);
		expect(sessionMetrics.sessions.length).toBe(1);
		expect(sessionMetrics.sessions[0].session_id).toBe(session_id);
		expect(sessionMetrics.sessions[0].ended_at).not.toBeNull();
		expect(sessionMetrics.sessions[0].task_count).toBe(1);
		expect(sessionMetrics.sessions[0].success_count).toBe(1);
	});

	test("session end records hook statistics", () => {
		const { session_id } = getStorage().startSession();

		// Record some hook executions
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
		});

		getStorage().endSession(session_id);

		const sessionMetrics = getStorage().querySessionMetrics("day", 10);
		expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(1);
		expect(sessionMetrics.sessions[0].hooks_failed_count).toBe(1);
	});
});

describe.serial("Session Tracking - Get Current Session", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("returns active session when one exists", () => {
		const { session_id } = getStorage().startSession();

		const current = getStorage().getCurrentSession();

		expect(current).not.toBeNull();
		expect(current?.session_id).toBe(session_id);
	});

	test("returns null when no active session", () => {
		const current = getStorage().getCurrentSession();

		expect(current).toBeNull();
	});

	test("returns null after session is ended", () => {
		const { session_id } = getStorage().startSession();
		getStorage().endSession(session_id);

		const current = getStorage().getCurrentSession();

		expect(current).toBeNull();
	});

	test("returns most recent active session from multiple", () => {
		const _session1 = getStorage().startSession("session-1");
		const session2 = getStorage().startSession("session-2");

		const current = getStorage().getCurrentSession();

		// Most recently started session should be current
		expect(current?.session_id).toBe(session2.session_id);
	});

	test("persists current session across storage recreation", () => {
		const { session_id } = getStorage().startSession();

		// Recreate storage (simulates process restart)
		getStorage().close();
		storage = new JsonlMetricsStorage();

		const current = getStorage().getCurrentSession();

		expect(current?.session_id).toBe(session_id);
	});

	test("returns correct session after some are ended", () => {
		const _session1 = getStorage().startSession("session-1");
		const session2 = getStorage().startSession("session-2");
		const session3 = getStorage().startSession("session-3");

		// End session 2
		getStorage().endSession(session2.session_id);

		// Should still return session 3 (most recent unended)
		const current = getStorage().getCurrentSession();
		expect(current?.session_id).toBe(session3.session_id);
	});
});

describe.serial("Session Tracking - Session Lifecycle", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("complete lifecycle: start -> get -> end -> get", () => {
		// Start
		const { session_id } = getStorage().startSession();

		// Get current
		let current = getStorage().getCurrentSession();
		expect(current?.session_id).toBe(session_id);

		// End
		const endResult = getStorage().endSession(session_id);
		expect(endResult.success).toBe(true);

		// Get current - should be null
		current = getStorage().getCurrentSession();
		expect(current).toBeNull();
	});

	test("handles rapid session start/end cycles", () => {
		for (let i = 0; i < 5; i++) {
			const { session_id } = getStorage().startSession();
			expect(session_id.startsWith("session-")).toBe(true);
			getStorage().endSession(session_id);
		}

		// No active session at the end
		expect(getStorage().getCurrentSession()).toBeNull();
	});

	test("session with tasks preserves task associations", () => {
		const { session_id } = getStorage().startSession();

		// Create tasks
		const task1 = getStorage().startTask({
			description: "Task 1",
			type: "implementation",
		});
		const _task2 = getStorage().startTask({
			description: "Task 2",
			type: "fix",
		});

		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		getStorage().endSession(session_id);

		// Verify tasks were associated with session
		const metrics = getStorage().queryMetrics({});
		expect(metrics.tasks.length).toBe(2);
		expect(metrics.tasks.every((t) => t.session_id === session_id)).toBe(true);
	});

	test("orphaned tasks remain active after session end", () => {
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

describe.serial("Session Tracking - Session Metrics Query", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("queries session metrics for multiple sessions", () => {
		// Create and end session 1
		const session1 = getStorage().startSession();
		const task1 = getStorage().startTask({
			description: "Task 1",
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.9,
		});
		getStorage().endSession(session1.session_id);

		// Create and end session 2
		const session2 = getStorage().startSession();
		const task2 = getStorage().startTask({
			description: "Task 2",
			type: "fix",
		});
		getStorage().completeTask({
			task_id: task2.task_id,
			outcome: "failure",
			confidence: 0.5,
		});
		getStorage().endSession(session2.session_id);

		const sessionMetrics = getStorage().querySessionMetrics("week", 10);

		expect(sessionMetrics.sessions.length).toBe(2);
	});

	test("session metrics include trends", () => {
		// Need at least 2 sessions for trends
		const session1 = getStorage().startSession();
		getStorage().endSession(session1.session_id);

		const session2 = getStorage().startSession();
		getStorage().endSession(session2.session_id);

		const sessionMetrics = getStorage().querySessionMetrics("week", 10);

		expect(sessionMetrics.trends).toBeDefined();
		expect(["improving", "declining", "stable"]).toContain(
			sessionMetrics.trends.success_rate_trend,
		);
		expect(["improving", "declining", "stable"]).toContain(
			sessionMetrics.trends.calibration_trend,
		);
	});

	test("session metrics respect period filter", () => {
		const session = getStorage().startSession();
		getStorage().endSession(session.session_id);

		expect(getStorage().querySessionMetrics("day", 10).sessions.length).toBe(1);
		expect(getStorage().querySessionMetrics("week", 10).sessions.length).toBe(
			1,
		);
		expect(getStorage().querySessionMetrics("month", 10).sessions.length).toBe(
			1,
		);
	});

	test("session metrics respect limit parameter", () => {
		// Create multiple sessions
		for (let i = 0; i < 5; i++) {
			const session = getStorage().startSession();
			getStorage().endSession(session.session_id);
		}

		const limitedMetrics = getStorage().querySessionMetrics("week", 3);
		expect(limitedMetrics.sessions.length).toBe(3);
	});
});

// TODO: These methods are not yet implemented in JsonlMetricsStorage
describe.skip("Session Tracking - Tasks for Session", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("getTasksForSession returns tasks for specific session", () => {
		const { session_id } = getStorage().startSession();

		const _task1 = getStorage().startTask({
			description: "Task 1",
			type: "implementation",
		});
		const _task2 = getStorage().startTask({
			description: "Task 2",
			type: "fix",
		});

		const tasks = getStorage().getTasksForSession(session_id);

		expect(tasks.length).toBe(2);
		expect(tasks.every((t) => t.session_id === session_id)).toBe(true);
	});

	test("getActiveTasksForSession returns only active tasks", () => {
		const { session_id } = getStorage().startSession();

		const task1 = getStorage().startTask({
			description: "Completed task",
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		getStorage().startTask({
			description: "Active task",
			type: "fix",
		});

		const activeTasks = getStorage().getActiveTasksForSession(session_id);

		expect(activeTasks.length).toBe(1);
		expect(activeTasks[0].description).toBe("Active task");
	});

	test("returns empty array for session with no tasks", () => {
		const { session_id } = getStorage().startSession();

		const tasks = getStorage().getTasksForSession(session_id);

		expect(tasks).toEqual([]);
	});

	test("tasks from different sessions are isolated", () => {
		const session1 = getStorage().startSession("session-1");
		getStorage().startTask({
			description: "Session 1 task",
			type: "implementation",
		});

		const session2 = getStorage().startSession("session-2");
		getStorage().startTask({
			description: "Session 2 task",
			type: "fix",
		});

		const session1Tasks = getStorage().getTasksForSession(session1.session_id);
		const session2Tasks = getStorage().getTasksForSession(session2.session_id);

		expect(session1Tasks.length).toBe(1);
		expect(session1Tasks[0].description).toBe("Session 1 task");

		expect(session2Tasks.length).toBe(1);
		expect(session2Tasks[0].description).toBe("Session 2 task");
	});
});

describe.serial("Session Tracking - Hook Statistics", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("getAllHookStats returns overall hook statistics", () => {
		const { session_id } = getStorage().startSession();

		// Record various hook executions
		for (let i = 0; i < 5; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "biome-lint",
				hookSource: "jutsu-biome",
				durationMs: 100,
				exitCode: i < 3 ? 0 : 1,
				passed: i < 3,
			});
		}

		const stats = getStorage().getAllHookStats("week");

		expect(stats.totalExecutions).toBe(5);
		expect(stats.totalPassed).toBe(3);
		expect(stats.totalFailed).toBe(2);
		expect(stats.passRate).toBeCloseTo(0.6, 1);
		expect(stats.uniqueHooks).toBe(1);
	});

	test("getHookFailureStats returns hooks with high failure rate", () => {
		const { session_id } = getStorage().startSession();

		// Hook with high failure rate (75%)
		for (let i = 0; i < 4; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-check",
				hookSource: "jutsu-typescript",
				durationMs: 1000,
				exitCode: i < 3 ? 1 : 0,
				passed: i >= 3,
			});
		}

		// Hook with low failure rate (25%)
		for (let i = 0; i < 4; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "biome-lint",
				hookSource: "jutsu-biome",
				durationMs: 100,
				exitCode: i < 1 ? 1 : 0,
				passed: i >= 1,
			});
		}

		const failureStats = getStorage().getHookFailureStats("week");

		// Only high failure rate hook (>20%) should be included
		expect(failureStats.length).toBe(2);
		// First should be the one with higher failure rate
		expect(failureStats[0].name).toBe("typescript-check");
		expect(failureStats[0].failureRate).toBe(75);
	});
});

describe.serial("Session Tracking - Edge Cases", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("handles empty session ID string as new session", () => {
		// Empty string is falsy, so should generate new ID
		const result = getStorage().startSession("");

		expect(result.session_id).toBeTruthy();
		expect(result.session_id).not.toBe("");
		expect(result.resumed).toBe(false);
	});

	test("handles undefined session ID as new session", () => {
		const result = getStorage().startSession(undefined);

		expect(result.session_id.startsWith("session-")).toBe(true);
		expect(result.resumed).toBe(false);
	});

	test("session ID with special characters works", () => {
		const specialId = "session:with-special_chars.123";
		const result = getStorage().startSession(specialId);

		expect(result.session_id).toBe(specialId);
	});

	test("very long session ID works", () => {
		const longId = `session-${"a".repeat(200)}`;
		const result = getStorage().startSession(longId);

		expect(result.session_id).toBe(longId);
	});

	test("session data persists after storage close and reopen", () => {
		const { session_id } = getStorage().startSession();
		const task = getStorage().startTask({
			description: "Persistent task",
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.85,
		});
		getStorage().endSession(session_id);

		// Close and reopen
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Verify data persisted
		const sessionMetrics = getStorage().querySessionMetrics("day", 10);
		expect(sessionMetrics.sessions.length).toBe(1);
		expect(sessionMetrics.sessions[0].task_count).toBe(1);
		expect(sessionMetrics.sessions[0].success_count).toBe(1);
	});

	test("handles concurrent-like session operations", () => {
		// Simulate interleaved operations
		const session1 = getStorage().startSession("session-1");
		const session2 = getStorage().startSession("session-2");

		getStorage().startTask({
			description: "Task in session 2",
			type: "implementation",
			session_id: session2.session_id,
		});

		getStorage().startTask({
			description: "Task in session 1",
			type: "fix",
			session_id: session1.session_id,
		});

		getStorage().endSession(session1.session_id);

		// Session 2 should still be active
		const current = getStorage().getCurrentSession();
		expect(current?.session_id).toBe(session2.session_id);
	});
});

describe.serial("Session Tracking - Frustration Events", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("frustration events are tracked per session", () => {
		getStorage().startSession();

		getStorage().recordFrustration({
			frustration_level: "high",
			frustration_score: 8,
			user_message: "This is frustrating!",
			detected_signals: ["caps", "exclamation"],
		});

		const metrics = getStorage().queryMetrics({});
		expect(metrics.total_frustrations).toBe(1);
		expect(metrics.frustration_events[0].frustration_level).toBe("high");
	});

	test("frustration rate is calculated relative to tasks", () => {
		getStorage().startSession();

		// Add tasks
		for (let i = 0; i < 4; i++) {
			const task = getStorage().startTask({
				description: `Task ${i}`,
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});
		}

		// Add frustration events
		getStorage().recordFrustration({
			frustration_level: "moderate",
			frustration_score: 5,
			user_message: "Confusing",
			detected_signals: ["question marks"],
		});
		getStorage().recordFrustration({
			frustration_level: "low",
			frustration_score: 2,
			user_message: "Minor issue",
			detected_signals: ["mild"],
		});

		const metrics = getStorage().queryMetrics({});
		expect(metrics.frustration_rate).toBe(0.5); // 2 frustrations / 4 tasks
	});
});

describe.serial("Session Tracking - JSON Output Format Verification", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("startSession returns proper JSON structure", () => {
		const result = getStorage().startSession();

		// Verify the result structure matches what the CLI outputs
		expect(result).toHaveProperty("session_id");
		expect(result).toHaveProperty("resumed");
		expect(typeof result.session_id).toBe("string");
		expect(typeof result.resumed).toBe("boolean");
	});

	test("endSession returns proper JSON structure", () => {
		const { session_id } = getStorage().startSession();
		const result = getStorage().endSession(session_id);

		// Verify the result structure
		expect(result).toHaveProperty("success");
		expect(typeof result.success).toBe("boolean");
		expect(result.success).toBe(true);
	});

	test("getCurrentSession returns proper JSON structure when session exists", () => {
		const { session_id } = getStorage().startSession();
		const result = getStorage().getCurrentSession();

		// Verify the result structure
		expect(result).not.toBeNull();
		expect(result).toHaveProperty("session_id");
		expect(result?.session_id).toBe(session_id);
	});

	test("getCurrentSession returns null when no session exists", () => {
		const result = getStorage().getCurrentSession();

		// CLI outputs { session_id: null } but storage returns null
		expect(result).toBeNull();
	});
});
