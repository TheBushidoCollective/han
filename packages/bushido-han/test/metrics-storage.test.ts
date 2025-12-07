import { ok, strictEqual, throws } from "node:assert";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MetricsStorage } from "../lib/metrics/storage.js";

let testsPassed = 0;
let testsFailed = 0;
let storage: MetricsStorage | null = null;
let _testDbPath: string;

async function test(
	name: string,
	fn: () => void | Promise<void>,
): Promise<void> {
	try {
		await fn();
		console.log(`✓ ${name}`);
		testsPassed++;
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error(`  ${(error as Error).message}`);
		testsFailed++;
	}
}

function setup(): void {
	// Create test database in temp directory
	const testDir = join(tmpdir(), `han-metrics-test-${Date.now()}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	_testDbPath = join(testDir, "metrics", "metrics.db");

	storage = new MetricsStorage();
}

function getStorage(): MetricsStorage {
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

	// Clean up test database
	if (process.env.CLAUDE_CONFIG_DIR) {
		try {
			rmSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		delete process.env.CLAUDE_CONFIG_DIR;
	}
}

// ========== Session Tests ==========

await test("creates new session with unique ID", () => {
	setup();
	const result = getStorage().startSession();

	ok(result.session_id, "Session ID should be generated");
	ok(
		result.session_id.startsWith("session-"),
		"Session ID should have proper prefix",
	);
	strictEqual(result.resumed, false, "Should not be a resumed session");

	teardown();
});

await test("resumes existing session", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Close storage but keep the database
	const _testDir = process.env.CLAUDE_CONFIG_DIR;
	getStorage().close();
	storage = null;

	// Reopen storage and resume session
	storage = new MetricsStorage();
	const result = getStorage().startSession(session_id);

	strictEqual(result.session_id, session_id, "Should return same session ID");
	strictEqual(result.resumed, true, "Should be marked as resumed");

	teardown();
});

await test("gets current active session", () => {
	setup();
	const { session_id } = getStorage().startSession();

	const current = getStorage().getCurrentSession();

	ok(current, "Should find current session");
	strictEqual(
		current.session_id,
		session_id,
		"Should return correct session ID",
	);

	teardown();
});

await test("returns null when no active session", () => {
	setup();
	const current = getStorage().getCurrentSession();

	strictEqual(current, null, "Should return null when no active session");

	teardown();
});

await test("ends session and calculates metrics", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create some tasks
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
		error: "Test error",
	});

	// End session
	const result = getStorage().endSession(session_id);

	strictEqual(result.success, true, "Should successfully end session");

	// Query the session to verify metrics
	const sessions = getStorage().querySessionMetrics("week", 1);

	strictEqual(sessions.sessions.length, 1, "Should have one session");
	strictEqual(sessions.sessions[0].task_count, 1, "Should have 1 task");
	strictEqual(sessions.sessions[0].success_count, 1, "Should have 1 success");
	strictEqual(
		sessions.sessions[0].hooks_passed_count,
		1,
		"Should have 1 passed hook",
	);
	strictEqual(
		sessions.sessions[0].hooks_failed_count,
		1,
		"Should have 1 failed hook",
	);

	teardown();
});

await test("auto-fails orphaned tasks on session end", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create task but don't complete it
	getStorage().startTask({
		description: "Orphaned task",
		type: "fix",
	});

	// End session
	getStorage().endSession(session_id);

	// Query tasks
	const result = getStorage().queryMetrics({});

	strictEqual(result.total_tasks, 1, "Should have 1 task");
	const orphanedTask = result.tasks[0];
	strictEqual(orphanedTask.status, "failed", "Should be marked as failed");
	strictEqual(orphanedTask.outcome, "failure", "Should have failure outcome");
	ok(
		orphanedTask.failure_reason?.includes("Session ended"),
		"Should have appropriate failure reason",
	);

	teardown();
});

// ========== Task Tests ==========

await test("creates task and links to current session", () => {
	setup();
	const { session_id } = getStorage().startSession();

	const result = getStorage().startTask({
		description: "Test task",
		type: "implementation",
		estimated_complexity: "moderate",
	});

	ok(result.task_id, "Task ID should be generated");
	ok(result.task_id.startsWith("task-"), "Task ID should have proper prefix");

	// Verify task is linked to session
	const tasks = getStorage().queryMetrics({});
	strictEqual(tasks.tasks.length, 1, "Should have 1 task");
	strictEqual(
		tasks.tasks[0].session_id,
		session_id,
		"Task should be linked to session",
	);

	teardown();
});

await test("completes task successfully", () => {
	setup();
	getStorage().startSession();

	const { task_id } = getStorage().startTask({
		description: "Test task",
		type: "fix",
	});

	// Wait a tiny bit for duration calculation
	setTimeout(() => {}, 10);

	const result = getStorage().completeTask({
		task_id,
		outcome: "success",
		confidence: 0.85,
		files_modified: ["file1.ts", "file2.ts"],
		tests_added: 3,
		notes: "All tests passing",
	});

	strictEqual(result.success, true, "Should successfully complete task");

	const tasks = getStorage().queryMetrics({});
	const completedTask = tasks.tasks[0];

	strictEqual(
		completedTask.status,
		"completed",
		"Should have completed status",
	);
	strictEqual(completedTask.outcome, "success", "Should have success outcome");
	strictEqual(completedTask.confidence, 0.85, "Should store confidence");
	strictEqual(completedTask.tests_added, 3, "Should store tests added");
	ok(
		completedTask.duration_seconds !== null &&
			completedTask.duration_seconds !== undefined,
		"Should calculate duration",
	);

	teardown();
});

await test("fails task with reason and solutions", () => {
	setup();
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

	strictEqual(result.success, true, "Should successfully fail task");

	const tasks = getStorage().queryMetrics({});
	const failedTask = tasks.tasks[0];

	strictEqual(failedTask.status, "failed", "Should have failed status");
	strictEqual(failedTask.outcome, "failure", "Should have failure outcome");
	strictEqual(
		failedTask.failure_reason,
		"Type errors in code",
		"Should store failure reason",
	);

	const solutions = JSON.parse(failedTask.attempted_solutions ?? "[]");
	strictEqual(solutions.length, 2, "Should store attempted solutions");

	teardown();
});

await test("updates task with progress notes", () => {
	setup();
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

	strictEqual(result.success, true, "Should successfully update task");

	teardown();
});

// ========== Hook Tracking Tests ==========

await test("records hook execution", () => {
	setup();
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

	strictEqual(
		result.success,
		true,
		"Should successfully record hook execution",
	);

	// Query hook stats
	const hookStats = getStorage().getHookFailureStats("week");

	// Hook stats only show hooks with >20% failure rate, so this should be empty
	strictEqual(hookStats.length, 0, "Should have no failing hooks");

	teardown();
});

await test("tracks hook failures", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Record 3 failures and 1 success (75% failure rate)
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

	strictEqual(hookStats.length, 1, "Should have 1 failing hook");
	strictEqual(
		hookStats[0].name,
		"typescript-typecheck",
		"Should be typescript-typecheck",
	);
	strictEqual(hookStats[0].total, 4, "Should have 4 total executions");
	strictEqual(hookStats[0].failures, 3, "Should have 3 failures");
	strictEqual(hookStats[0].failureRate, 75, "Should have 75% failure rate");

	teardown();
});

// ========== Query Tests ==========

await test("queries metrics with filters", () => {
	setup();
	getStorage().startSession();

	// Create mixed tasks
	const task1 = getStorage().startTask({
		description: "Impl 1",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task1.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	const task2 = getStorage().startTask({ description: "Fix 1", type: "fix" });
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

	// Query by type
	const impls = getStorage().queryMetrics({ task_type: "implementation" });
	strictEqual(impls.total_tasks, 2, "Should filter by implementation type");
	strictEqual(impls.success_rate, 1.0, "Both implementations succeeded");

	// Query by outcome
	const successes = getStorage().queryMetrics({ outcome: "success" });
	strictEqual(successes.total_tasks, 2, "Should filter by success outcome");

	teardown();
});

await test("calculates calibration score correctly", () => {
	setup();
	getStorage().startSession();

	// Perfect calibration: high confidence + success
	const task1 = getStorage().startTask({ description: "Task 1", type: "fix" });
	getStorage().completeTask({
		task_id: task1.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	// Poor calibration: high confidence + failure
	const task2 = getStorage().startTask({ description: "Task 2", type: "fix" });
	getStorage().completeTask({
		task_id: task2.task_id,
		outcome: "failure",
		confidence: 0.9,
	});

	const metrics = getStorage().queryMetrics({});

	// Calibration should be 0.5 (average error of 0.5)
	// Task 1: |0.9 - 1.0| = 0.1
	// Task 2: |0.9 - 0.0| = 0.9
	// Average error: (0.1 + 0.9) / 2 = 0.5
	// Calibration score: 1 - 0.5 = 0.5
	strictEqual(
		metrics.calibration_score,
		0.5,
		"Should calculate calibration correctly",
	);

	teardown();
});

// ========== Session Metrics Tests ==========

await test("calculates session trends", () => {
	setup();

	// Create older session with poor performance
	const oldSession = getStorage().startSession();
	const oldTask1 = getStorage().startTask({
		description: "Old task 1",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: oldTask1.task_id,
		outcome: "failure",
		confidence: 0.8,
	});
	const oldTask2 = getStorage().startTask({
		description: "Old task 2",
		type: "fix",
	});
	getStorage().completeTask({
		task_id: oldTask2.task_id,
		outcome: "failure",
		confidence: 0.7,
	});
	getStorage().endSession(oldSession.session_id);

	// Wait a bit for timestamp difference
	setTimeout(() => {}, 10);

	// Create newer session with better performance
	const newSession = getStorage().startSession();
	const newTask1 = getStorage().startTask({
		description: "New task 1",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: newTask1.task_id,
		outcome: "success",
		confidence: 0.85,
	});
	const newTask2 = getStorage().startTask({
		description: "New task 2",
		type: "fix",
	});
	getStorage().completeTask({
		task_id: newTask2.task_id,
		outcome: "success",
		confidence: 0.9,
	});
	getStorage().endSession(newSession.session_id);

	const sessionMetrics = getStorage().querySessionMetrics("week", 10);

	// Should show improving trends
	ok(
		sessionMetrics.trends.success_rate_trend === "improving" ||
			sessionMetrics.trends.success_rate_trend === "stable",
		"Success rate should be improving or stable",
	);
	ok(
		sessionMetrics.trends.calibration_trend === "improving" ||
			sessionMetrics.trends.calibration_trend === "stable",
		"Calibration should be improving or stable",
	);

	strictEqual(sessionMetrics.sessions.length, 2, "Should have 2 sessions");

	teardown();
});

await test("handles empty data gracefully", () => {
	setup();

	const metrics = getStorage().queryMetrics({});
	strictEqual(metrics.total_tasks, 0, "Should have no tasks");
	strictEqual(
		metrics.calibration_score,
		0,
		"Calibration should be 0 with no data",
	);

	const hookStats = getStorage().getHookFailureStats("week");
	strictEqual(hookStats.length, 0, "Should have no hook stats");

	const sessionMetrics = getStorage().querySessionMetrics("week", 10);
	strictEqual(sessionMetrics.sessions.length, 0, "Should have no sessions");
	strictEqual(
		sessionMetrics.trends.calibration_trend,
		"stable",
		"Trend should be stable",
	);

	teardown();
});

// ========== Error Handling Tests ==========

await test("throws error when ending non-existent session", () => {
	setup();

	throws(
		() => getStorage().endSession("nonexistent-session"),
		/Session .* not found/,
		"Should throw error for non-existent session",
	);

	teardown();
});

await test("throws error when completing non-existent task", () => {
	setup();

	throws(
		() =>
			getStorage().completeTask({
				task_id: "nonexistent-task",
				outcome: "success",
				confidence: 0.9,
			}),
		/Task .* not found/,
		"Should throw error for non-existent task",
	);

	teardown();
});

await test("throws error when failing non-existent task", () => {
	setup();

	throws(
		() =>
			getStorage().failTask({
				task_id: "nonexistent-task",
				reason: "Test error",
			}),
		/Task .* not found/,
		"Should throw error for non-existent task",
	);

	teardown();
});

// ========== Summary ==========

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log("=".repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
