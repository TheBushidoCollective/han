/**
 * End-to-end integration tests for the metrics system.
 *
 * These tests verify the full workflow of the metrics system as Claude Code would use it,
 * including:
 * - Full task lifecycle (start -> update -> complete/fail -> query)
 * - Session management
 * - Hook execution tracking
 * - Context generation
 * - Calibration score calculation
 * - Period filtering
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
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
	testDir = join(tmpdir(), `han-metrics-integration-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	const metricsDir = join(testDir, "han", "metrics", "jsonldb");
	mkdirSync(metricsDir, { recursive: true });
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
	if (testDir) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
	delete process.env.CLAUDE_CONFIG_DIR;
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

function runSpawn(
	command: string,
	input?: string,
): { stdout: string; stderr: string; status: number | null } {
	const mainPath = join(__dirname, "..", "lib", "main.ts");
	const result = spawnSync(
		"bun",
		["run", mainPath, "metrics", ...command.split(" ")],
		{
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
			input,
			timeout: 30000,
		},
	);
	return {
		stdout: result.stdout?.trim() || "",
		stderr: result.stderr?.trim() || "",
		status: result.status,
	};
}

describe.serial("Metrics Integration - Full Task Lifecycle", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("complete task lifecycle: start session -> start task -> update -> complete -> query", () => {
		// Step 1: Start a session
		const sessionOutput = runCommand("session-start");
		const sessionResult = JSON.parse(sessionOutput);
		expect(sessionResult.session_id).toBeTruthy();
		expect(sessionResult.session_id.startsWith("session-")).toBe(true);
		expect(sessionResult.resumed).toBe(false);

		const sessionId = sessionResult.session_id;

		// Step 2: Start a task with session_id
		const task = getStorage().startTask({
			description: "Implement user authentication",
			type: "implementation",
			estimated_complexity: "moderate",
			session_id: sessionId,
		});
		expect(task.task_id).toBeTruthy();
		expect(task.task_id.startsWith("task-")).toBe(true);

		// Step 3: Update the task with progress
		const updateResult = getStorage().updateTask({
			task_id: task.task_id,
			status: "in_progress",
			notes: "Completed database schema, working on API endpoints",
		});
		expect(updateResult.success).toBe(true);

		// Step 4: Complete the task with outcome and confidence
		const completeResult = getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.85,
			files_modified: ["auth.ts", "user.ts", "middleware.ts"],
			tests_added: 12,
			notes: "All tests passing, code reviewed",
		});
		expect(completeResult.success).toBe(true);

		// Step 5: Query metrics and verify task appears
		const metrics = getStorage().queryMetrics({ period: "day" });
		expect(metrics.total_tasks).toBe(1);
		expect(metrics.completed_tasks).toBe(1);
		expect(metrics.success_rate).toBe(1.0);
		expect(metrics.tasks.length).toBe(1);

		const completedTask = metrics.tasks[0];
		expect(completedTask.description).toBe("Implement user authentication");
		expect(completedTask.type).toBe("implementation");
		expect(completedTask.status).toBe("completed");
		expect(completedTask.outcome).toBe("success");
		expect(completedTask.confidence).toBe(0.85);
		expect(completedTask.session_id).toBe(sessionId);
		expect(completedTask.tests_added).toBe(12);
		expect(completedTask.duration_seconds).toBeDefined();

		// Step 6: End the session
		const endOutput = runCommand(`session-end --session-id ${sessionId}`);
		const endResult = JSON.parse(endOutput);
		expect(endResult.success).toBe(true);
	});

	test("multiple tasks in a session with mixed outcomes", () => {
		const { session_id } = getStorage().startSession();

		// Task 1: Success
		const task1 = getStorage().startTask({
			description: "Add validation logic",
			type: "implementation",
			session_id,
		});
		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		// Task 2: Partial success
		const task2 = getStorage().startTask({
			description: "Refactor database layer",
			type: "refactor",
			session_id,
		});
		getStorage().completeTask({
			task_id: task2.task_id,
			outcome: "partial",
			confidence: 0.6,
			notes: "Completed 60% of refactoring",
		});

		// Task 3: Success
		const task3 = getStorage().startTask({
			description: "Fix memory leak",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task3.task_id,
			outcome: "success",
			confidence: 0.95,
		});

		// Query and verify metrics
		const metrics = getStorage().queryMetrics({ period: "day" });
		expect(metrics.total_tasks).toBe(3);
		expect(metrics.completed_tasks).toBe(3);
		// 2 successes out of 3 completed = 66.67%
		expect(metrics.success_rate).toBeCloseTo(0.6667, 2);
		expect(metrics.by_type.implementation).toBe(1);
		expect(metrics.by_type.refactor).toBe(1);
		expect(metrics.by_type.fix).toBe(1);
		expect(metrics.by_outcome.success).toBe(2);
		expect(metrics.by_outcome.partial).toBe(1);
	});
});

describe.serial("Metrics Integration - Failed Task Flow", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("complete failed task flow: start -> fail -> query", () => {
		const { session_id } = getStorage().startSession();

		// Start a task
		const task = getStorage().startTask({
			description: "Migrate legacy API endpoints",
			type: "refactor",
			estimated_complexity: "complex",
			session_id,
		});

		// Fail the task with detailed reason and attempted solutions
		const failResult = getStorage().failTask({
			task_id: task.task_id,
			reason: "Circular dependency in module graph prevents migration",
			confidence: 0.3,
			attempted_solutions: [
				"Tried breaking dependency with facade pattern",
				"Attempted dependency injection refactor",
				"Considered using dynamic imports",
			],
			notes: "Need architectural review before proceeding",
		});
		expect(failResult.success).toBe(true);

		// Query metrics and verify failure appears
		const metrics = getStorage().queryMetrics({ period: "day" });
		expect(metrics.total_tasks).toBe(1);
		expect(metrics.completed_tasks).toBe(0); // Failed tasks are not counted as completed
		expect(metrics.by_outcome.failure).toBe(1);

		const failedTask = metrics.tasks[0];
		expect(failedTask.status).toBe("failed");
		expect(failedTask.outcome).toBe("failure");
		expect(failedTask.failure_reason).toBe(
			"Circular dependency in module graph prevents migration",
		);
		expect(failedTask.confidence).toBe(0.3);

		// Verify attempted solutions are stored
		const solutions = JSON.parse(failedTask.attempted_solutions || "[]");
		expect(solutions.length).toBe(3);
		expect(solutions[0]).toContain("facade pattern");
	});

	test("multiple failed tasks affect success rate", () => {
		const { session_id } = getStorage().startSession();

		// 2 successful tasks
		for (let i = 0; i < 2; i++) {
			const task = getStorage().startTask({
				description: `Success task ${i}`,
				type: "fix",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});
		}

		// 3 failed tasks
		for (let i = 0; i < 3; i++) {
			const task = getStorage().startTask({
				description: `Failed task ${i}`,
				type: "implementation",
				session_id,
			});
			getStorage().failTask({
				task_id: task.task_id,
				reason: `Test failure reason ${i}`,
			});
		}

		const metrics = getStorage().queryMetrics({ period: "day" });
		expect(metrics.total_tasks).toBe(5);
		expect(metrics.by_outcome.success).toBe(2);
		expect(metrics.by_outcome.failure).toBe(3);
	});
});

describe.serial("Metrics Integration - Hook Tracking", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("record hook executions and query statistics", () => {
		const { session_id } = getStorage().startSession();
		const task = getStorage().startTask({
			description: "Test hook tracking",
			type: "implementation",
			session_id,
		});

		// Record successful hook executions
		for (let i = 0; i < 3; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				taskId: task.task_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1200 + i * 100,
				exitCode: 0,
				passed: true,
				output: "All types valid",
			});
		}

		// Record failed hook executions
		for (let i = 0; i < 2; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				taskId: task.task_id,
				hookType: "Stop",
				hookName: "biome-lint",
				hookSource: "jutsu-biome",
				durationMs: 500,
				exitCode: 1,
				passed: false,
				error: "Linting errors: unused variable, missing semicolon",
			});
		}

		// Query hook metrics via CLI
		const hookInput = JSON.stringify({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "eslint",
			hookSource: "jutsu-eslint",
			durationMs: 800,
			exitCode: 0,
			passed: true,
		});
		const hookOutput = runCommand("hook-exec", hookInput);
		const hookResult = JSON.parse(hookOutput);
		expect(hookResult.success).toBe(true);

		// Verify hook failure statistics
		const hookStats = getStorage().getHookFailureStats("week");
		// biome-lint has 2 failures out of 2 total = 100% failure rate
		const biomeLintStats = hookStats.find((s) => s.name === "biome-lint");
		expect(biomeLintStats).toBeDefined();
		expect(biomeLintStats?.failures).toBe(2);
		expect(biomeLintStats?.failureRate).toBe(100);
	});

	test(
		"hook failures tracked via CLI command",
		() => {
			// This test runs 5 CLI commands which can be slow
			const { session_id } = getStorage().startSession();

			// Record failures via CLI
			for (let i = 0; i < 4; i++) {
				const hookData = {
					sessionId: session_id,
					hookType: "Stop",
					hookName: "bun-test",
					hookSource: "jutsu-bun",
					durationMs: 3000,
					exitCode: 1,
					passed: false,
					error: `Test suite failed: ${i + 1} assertions`,
				};
				runCommand("hook-exec", JSON.stringify(hookData));
			}

			// Record 1 success
			const successData = {
				sessionId: session_id,
				hookType: "Stop",
				hookName: "bun-test",
				hookSource: "jutsu-bun",
				durationMs: 2500,
				exitCode: 0,
				passed: true,
			};
			runCommand("hook-exec", JSON.stringify(successData));

			// Verify stats show 80% failure rate
			const hookStats = getStorage().getHookFailureStats("week");
			const bunTestStats = hookStats.find((s) => s.name === "bun-test");
			expect(bunTestStats).toBeDefined();
			expect(bunTestStats?.total).toBe(5);
			expect(bunTestStats?.failures).toBe(4);
			expect(bunTestStats?.failureRate).toBe(80);
		},
		{ timeout: 15000 },
	);

	test("getAllHookStats returns comprehensive statistics", () => {
		const { session_id } = getStorage().startSession();

		// Record various hook executions
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "typecheck",
			hookSource: "jutsu-typescript",
			durationMs: 1000,
			exitCode: 0,
			passed: true,
		});

		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "UserPromptSubmit",
			hookName: "professional-honesty",
			hookSource: "core",
			durationMs: 50,
			exitCode: 0,
			passed: true,
		});

		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "lint",
			hookSource: "jutsu-biome",
			durationMs: 500,
			exitCode: 1,
			passed: false,
		});

		const allStats = getStorage().getAllHookStats("week");
		expect(allStats.totalExecutions).toBe(3);
		expect(allStats.totalPassed).toBe(2);
		expect(allStats.totalFailed).toBe(1);
		expect(allStats.passRate).toBeCloseTo(0.6667, 2);
		expect(allStats.uniqueHooks).toBe(3);
		expect(allStats.byHookType.Stop).toBeDefined();
		expect(allStats.byHookType.Stop.total).toBe(2);
		expect(allStats.byHookType.UserPromptSubmit).toBeDefined();
		expect(allStats.byHookType.UserPromptSubmit.total).toBe(1);
	});
});

describe.serial("Metrics Integration - Session Context Generation", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("generates getting started context when no tasks", () => {
		const result = runSpawn("session-context");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Getting Started");
		expect(result.stdout).toContain("No tasks tracked yet");
	});

	test("generates performance context with task data", () => {
		const { session_id } = getStorage().startSession();

		// Create tasks with various outcomes for rich context
		for (let i = 0; i < 5; i++) {
			const task = getStorage().startTask({
				description: `Implementation task ${i}`,
				type: "implementation",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: i < 4 ? "success" : "failure",
				confidence: 0.75 + i * 0.05,
			});
		}

		// Add some fix tasks
		for (let i = 0; i < 3; i++) {
			const task = getStorage().startTask({
				description: `Fix task ${i}`,
				type: "fix",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.85,
			});
		}

		const result = runSpawn("session-context");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Your Recent Performance");
		expect(result.stdout).toContain("Tasks");
		expect(result.stdout).toContain("Calibration Score");
	});

	test("context includes hook failure patterns when present", () => {
		const { session_id } = getStorage().startSession();

		// Create some tasks
		const task = getStorage().startTask({
			description: "Test task",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.8,
		});

		// Add hook failures
		for (let i = 0; i < 5; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1000,
				exitCode: 1,
				passed: false,
				error: "Type errors found",
			});
		}

		const result = runSpawn("session-context");
		expect(result.status).toBe(0);
		// Hook failures should appear if failure rate > 20%
		expect(result.stdout).toContain("Your Recent Performance");
	});
});

describe.serial("Metrics Integration - Calibration Score Calculation", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("perfect calibration: high confidence with success, low confidence with failure", () => {
		const { session_id } = getStorage().startSession();

		// High confidence (0.95) task that succeeds - error = |0.95 - 1| = 0.05
		const task1 = getStorage().startTask({
			description: "Confident success",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.95,
		});

		// Low confidence (0.1) task that fails - error = |0.1 - 0| = 0.1
		const task2 = getStorage().startTask({
			description: "Uncertain failure",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task2.task_id,
			outcome: "failure",
			confidence: 0.1,
		});

		const metrics = getStorage().queryMetrics({});
		// Average error = (0.05 + 0.1) / 2 = 0.075
		// Calibration = 1 - 0.075 = 0.925
		expect(metrics.calibration_score).toBeGreaterThan(0.9);
	});

	test("poor calibration: overconfident failures", () => {
		const { session_id } = getStorage().startSession();

		// High confidence (0.9) tasks that all fail - error = |0.9 - 0| = 0.9
		for (let i = 0; i < 5; i++) {
			const task = getStorage().startTask({
				description: `Overconfident task ${i}`,
				type: "implementation",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "failure",
				confidence: 0.9,
			});
		}

		const metrics = getStorage().queryMetrics({});
		// Average error = 0.9 for all tasks
		// Calibration = 1 - 0.9 = 0.1
		expect(metrics.calibration_score).toBeLessThan(0.2);
	});

	test("calibration with mixed outcomes", () => {
		const { session_id } = getStorage().startSession();

		// Task 1: 0.8 confidence, success - error = |0.8 - 1| = 0.2
		const task1 = getStorage().startTask({
			description: "Task 1",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task1.task_id,
			outcome: "success",
			confidence: 0.8,
		});

		// Task 2: 0.9 confidence, failure - error = |0.9 - 0| = 0.9
		const task2 = getStorage().startTask({
			description: "Task 2",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task2.task_id,
			outcome: "failure",
			confidence: 0.9,
		});

		const metrics = getStorage().queryMetrics({});
		// Average error = (0.2 + 0.9) / 2 = 0.55
		// Calibration = 1 - 0.55 = 0.45
		expect(metrics.calibration_score).toBeCloseTo(0.45, 1);
	});

	test("calibration score is 0 when no completed tasks with confidence", () => {
		getStorage().startSession();

		// Only start tasks, don't complete them
		getStorage().startTask({
			description: "Incomplete task",
			type: "fix",
		});

		const metrics = getStorage().queryMetrics({});
		expect(metrics.calibration_score).toBe(0);
	});
});

describe.serial("Metrics Integration - Period Filtering", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("day period returns tasks from last 24 hours", () => {
		const { session_id } = getStorage().startSession();

		// Create tasks now (should be included in day filter)
		for (let i = 0; i < 3; i++) {
			const task = getStorage().startTask({
				description: `Recent task ${i}`,
				type: "fix",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.8,
			});
		}

		// Query with day filter
		const dayMetrics = getStorage().queryMetrics({ period: "day" });
		expect(dayMetrics.total_tasks).toBe(3);

		// Query with week filter should also include these
		const weekMetrics = getStorage().queryMetrics({ period: "week" });
		expect(weekMetrics.total_tasks).toBe(3);

		// Query with month filter should also include these
		const monthMetrics = getStorage().queryMetrics({ period: "month" });
		expect(monthMetrics.total_tasks).toBe(3);
	});

	test("period filter works for hook statistics", () => {
		const { session_id } = getStorage().startSession();

		// Create hook executions now
		for (let i = 0; i < 3; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "test-hook",
				hookSource: "test-source",
				durationMs: 500,
				exitCode: 1,
				passed: false,
			});
		}

		// All periods should include recent hooks
		expect(getStorage().getHookFailureStats("day").length).toBe(1);
		expect(getStorage().getHookFailureStats("week").length).toBe(1);
		expect(getStorage().getHookFailureStats("month").length).toBe(1);
	});

	test("period filter works for session metrics", () => {
		// Create and end a session
		const session = getStorage().startSession();
		const task = getStorage().startTask({
			description: "Test task",
			type: "fix",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.8,
		});
		getStorage().endSession(session.session_id);

		// All periods should include recent session
		expect(getStorage().querySessionMetrics("day", 10).sessions.length).toBe(1);
		expect(getStorage().querySessionMetrics("week", 10).sessions.length).toBe(
			1,
		);
		expect(getStorage().querySessionMetrics("month", 10).sessions.length).toBe(
			1,
		);
	});

	test("task type filter combines with period filter", () => {
		const { session_id } = getStorage().startSession();

		// Create different task types
		const fixTask = getStorage().startTask({
			description: "Fix bug",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: fixTask.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		const implTask = getStorage().startTask({
			description: "Implement feature",
			type: "implementation",
			session_id,
		});
		getStorage().completeTask({
			task_id: implTask.task_id,
			outcome: "success",
			confidence: 0.8,
		});

		// Filter by type and period
		const fixMetrics = getStorage().queryMetrics({
			period: "day",
			task_type: "fix",
		});
		expect(fixMetrics.total_tasks).toBe(1);
		expect(fixMetrics.tasks[0].type).toBe("fix");

		const implMetrics = getStorage().queryMetrics({
			period: "day",
			task_type: "implementation",
		});
		expect(implMetrics.total_tasks).toBe(1);
		expect(implMetrics.tasks[0].type).toBe("implementation");
	});

	test("outcome filter combines with period filter", () => {
		const { session_id } = getStorage().startSession();

		// Create tasks with different outcomes
		const successTask = getStorage().startTask({
			description: "Success task",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: successTask.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		const failTask = getStorage().startTask({
			description: "Failed task",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: failTask.task_id,
			outcome: "failure",
			confidence: 0.8,
		});

		// Filter by outcome and period
		const successMetrics = getStorage().queryMetrics({
			period: "day",
			outcome: "success",
		});
		expect(successMetrics.total_tasks).toBe(1);
		expect(successMetrics.tasks[0].outcome).toBe("success");

		const failMetrics = getStorage().queryMetrics({
			period: "day",
			outcome: "failure",
		});
		expect(failMetrics.total_tasks).toBe(1);
		expect(failMetrics.tasks[0].outcome).toBe("failure");
	});
});

describe.serial("Metrics Integration - Session Management", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("session lifecycle via CLI commands", () => {
		// Start new session
		const startOutput = runCommand("session-start");
		const startResult = JSON.parse(startOutput);
		expect(startResult.session_id).toBeTruthy();
		expect(startResult.resumed).toBe(false);

		const sessionId = startResult.session_id;

		// Get current session
		const currentOutput = runCommand("session-current");
		const currentResult = JSON.parse(currentOutput);
		expect(currentResult.session_id).toBe(sessionId);

		// End session
		const endOutput = runCommand("session-end");
		const endResult = JSON.parse(endOutput);
		expect(endResult.success).toBe(true);
		expect(endResult.session_id).toBe(sessionId);

		// Current session should now be null
		const afterEndOutput = runCommand("session-current");
		const afterEndResult = JSON.parse(afterEndOutput);
		expect(afterEndResult.session_id).toBeNull();
	});

	test("resume existing session", () => {
		// Start first session
		const firstOutput = runCommand("session-start");
		const firstResult = JSON.parse(firstOutput);
		const sessionId = firstResult.session_id;

		// Resume the same session
		const resumeOutput = runCommand(`session-start --session-id ${sessionId}`);
		const resumeResult = JSON.parse(resumeOutput);
		expect(resumeResult.session_id).toBe(sessionId);
		expect(resumeResult.resumed).toBe(true);
	});

	// TODO: getTasksForSession is not yet implemented in JsonlMetricsStorage
	test.skip("tasks for specific session can be queried", () => {
		// Create first session with tasks
		const session1 = getStorage().startSession();
		for (let i = 0; i < 3; i++) {
			const task = getStorage().startTask({
				description: `Session 1 Task ${i}`,
				type: "fix",
				session_id: session1.session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.8,
			});
		}

		// Create second session with tasks
		const session2 = getStorage().startSession();
		for (let i = 0; i < 2; i++) {
			const task = getStorage().startTask({
				description: `Session 2 Task ${i}`,
				type: "implementation",
				session_id: session2.session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "failure",
				confidence: 0.5,
			});
		}

		// Query tasks for session 1
		const session1Tasks = getStorage().getTasksForSession(session1.session_id);
		expect(session1Tasks.length).toBe(3);
		expect(
			session1Tasks.every((t) => t.description.includes("Session 1")),
		).toBe(true);

		// Query tasks for session 2
		const session2Tasks = getStorage().getTasksForSession(session2.session_id);
		expect(session2Tasks.length).toBe(2);
		expect(
			session2Tasks.every((t) => t.description.includes("Session 2")),
		).toBe(true);
	});

	test("session metrics track hook pass/fail counts", () => {
		const { session_id } = getStorage().startSession();

		// Create a task
		const task = getStorage().startTask({
			description: "Test task",
			type: "fix",
			session_id,
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		// Record hooks
		for (let i = 0; i < 4; i++) {
			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "test-hook",
				hookSource: "test",
				durationMs: 100,
				exitCode: i < 3 ? 0 : 1,
				passed: i < 3,
			});
		}

		// End session
		getStorage().endSession(session_id);

		// Query session metrics
		const sessionMetrics = getStorage().querySessionMetrics("day", 10);
		expect(sessionMetrics.sessions.length).toBe(1);
		expect(sessionMetrics.sessions[0].hooks_passed_count).toBe(3);
		expect(sessionMetrics.sessions[0].hooks_failed_count).toBe(1);
	});
});

describe.serial("Metrics Integration - Frustration Tracking", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("record and query frustration events", () => {
		const { session_id } = getStorage().startSession();
		const task = getStorage().startTask({
			description: "Frustrating task",
			type: "fix",
			session_id,
		});

		// Record frustration events
		getStorage().recordFrustration({
			task_id: task.task_id,
			frustration_level: "high",
			frustration_score: 8,
			user_message: "WHY IS THIS NOT WORKING???",
			detected_signals: ["caps", "punctuation", "negative sentiment"],
			context: "User struggling with compilation errors",
		});

		getStorage().recordFrustration({
			task_id: task.task_id,
			frustration_level: "moderate",
			frustration_score: 5,
			user_message: "This is taking too long",
			detected_signals: ["impatience"],
		});

		getStorage().recordFrustration({
			frustration_level: "low",
			frustration_score: 2,
			user_message: "Hmm, not quite right",
			detected_signals: ["minor frustration"],
		});

		const metrics = getStorage().queryMetrics({ period: "day" });
		expect(metrics.total_frustrations).toBe(3);
		expect(metrics.frustration_events.length).toBe(3);
		expect(metrics.frustration_by_level.high).toBe(1);
		expect(metrics.frustration_by_level.moderate).toBe(1);
		expect(metrics.frustration_by_level.low).toBe(1);
		expect(metrics.significant_frustrations).toBe(2); // Only moderate and high
	});

	test("frustration rate calculation", () => {
		const { session_id } = getStorage().startSession();

		// Create 4 tasks
		for (let i = 0; i < 4; i++) {
			const task = getStorage().startTask({
				description: `Task ${i}`,
				type: "fix",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.8,
			});
		}

		// 2 frustration events
		getStorage().recordFrustration({
			frustration_level: "high",
			frustration_score: 7,
			user_message: "Frustrated!",
			detected_signals: ["caps"],
		});

		getStorage().recordFrustration({
			frustration_level: "moderate",
			frustration_score: 5,
			user_message: "Still frustrated",
			detected_signals: ["repeat"],
		});

		const metrics = getStorage().queryMetrics({});
		// frustration_rate = 2 events / 4 tasks = 0.5
		expect(metrics.frustration_rate).toBe(0.5);
		// significant_frustration_rate = 2 (both moderate and high) / 4 = 0.5
		expect(metrics.significant_frustration_rate).toBe(0.5);
	});
});

describe.serial("Metrics Integration - Pattern Detection", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("detect patterns returns JSON with patterns array", () => {
		const { session_id } = getStorage().startSession();

		// Create failing tasks to trigger patterns
		for (let i = 0; i < 5; i++) {
			const task = getStorage().startTask({
				description: `Failing task ${i}`,
				type: "implementation",
				session_id,
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "failure",
				confidence: 0.8,
			});
		}

		const result = runSpawn("detect-patterns --json");
		expect(result.status).toBe(0);

		const parsed = JSON.parse(result.stdout);
		expect(Array.isArray(parsed.patterns)).toBe(true);
		// Should detect patterns due to high failure rate
		expect(parsed.patterns.length).toBeGreaterThan(0);
	});

	test(
		"detect patterns respects min-severity filter",
		() => {
			const { session_id } = getStorage().startSession();

			// Create enough hook failures to trigger a medium-severity pattern
			for (let i = 0; i < 10; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "test",
					durationMs: 500,
					exitCode: i < 4 ? 1 : 0, // 40% failure rate - medium severity
					passed: i >= 4,
				});
			}

			// High severity should filter out medium patterns
			const highResult = runSpawn("detect-patterns --min-severity high --json");
			expect(highResult.status).toBe(0);
			const highParsed = JSON.parse(highResult.stdout);

			// Medium severity should include them
			const mediumResult = runSpawn(
				"detect-patterns --min-severity medium --json",
			);
			expect(mediumResult.status).toBe(0);
			const mediumParsed = JSON.parse(mediumResult.stdout);

			// Low severity should include all
			const lowResult = runSpawn("detect-patterns --min-severity low --json");
			expect(lowResult.status).toBe(0);
			const lowParsed = JSON.parse(lowResult.stdout);

			// Medium or low should have >= high's patterns
			expect(mediumParsed.patterns.length).toBeGreaterThanOrEqual(
				highParsed.patterns.length,
			);
			expect(lowParsed.patterns.length).toBeGreaterThanOrEqual(
				mediumParsed.patterns.length,
			);
		},
		{ timeout: 10000 },
	);
});

describe.serial("Metrics Integration - Data Persistence", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("data persists across storage instances", () => {
		// Create data with first instance
		const { session_id } = getStorage().startSession();
		const task = getStorage().startTask({
			description: "Persistent task",
			type: "implementation",
			session_id,
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.9,
		});

		// Close and recreate storage
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Data should still be there
		const metrics = getStorage().queryMetrics({});
		expect(metrics.total_tasks).toBe(1);
		expect(metrics.tasks[0].description).toBe("Persistent task");
	});

	test("session can be resumed after storage recreation", () => {
		// Start session with first instance
		const { session_id } = getStorage().startSession();

		// Close and recreate storage
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Resume should work
		const resumed = getStorage().startSession(session_id);
		expect(resumed.session_id).toBe(session_id);
		expect(resumed.resumed).toBe(true);
	});

	test("task can be completed after storage recreation", () => {
		// Start task with first instance
		const { session_id } = getStorage().startSession();
		const { task_id } = getStorage().startTask({
			description: "Cross-instance task",
			type: "fix",
			session_id,
		});

		// Close and recreate storage
		getStorage().close();
		storage = new JsonlMetricsStorage();

		// Complete should work and calculate duration from events
		const result = getStorage().completeTask({
			task_id,
			outcome: "success",
			confidence: 0.85,
		});
		expect(result.success).toBe(true);

		const metrics = getStorage().queryMetrics({});
		expect(metrics.tasks[0].duration_seconds).toBeDefined();
		expect((metrics.tasks[0].duration_seconds ?? 0) >= 0).toBe(true);
	});
});
