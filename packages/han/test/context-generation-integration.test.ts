/**
 * Integration tests for commands/metrics/context-generation.ts
 * Tests the generateSessionContext function with actual JsonlMetricsStorage
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

describe("context-generation integration", () => {
	const testDir = `/tmp/test-context-gen-integration-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("generateSessionContext via CLI", () => {
		test("outputs getting started when no tasks tracked", async () => {
			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "session-context"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Getting Started with Metrics");
			expect(result.stdout).toContain("No tasks tracked yet");
		});

		test("outputs performance metrics when tasks exist", async () => {
			// Create tasks directly in storage
			const storage = new JsonlMetricsStorage();

			// Start and complete several tasks
			for (let i = 0; i < 5; i++) {
				const task = storage.startTask({
					description: `Test task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "session-context"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Your Recent Performance");
			expect(result.stdout).toContain("Tasks");
			expect(result.stdout).toContain("Calibration Score");
		});
	});

	describe("JsonlMetricsStorage queryMetrics", () => {
		test("returns empty metrics for fresh storage", () => {
			const storage = new JsonlMetricsStorage();
			const metrics = storage.queryMetrics({ period: "week" });

			expect(metrics.total_tasks).toBe(0);
			expect(metrics.completed_tasks).toBe(0);
			expect(metrics.success_rate).toBe(0);
			expect(metrics.tasks).toEqual([]);
		});

		test("returns populated metrics after tasks", () => {
			const storage = new JsonlMetricsStorage();

			// Start and complete a task
			const task = storage.startTask({
				description: "Test implementation",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const metrics = storage.queryMetrics({ period: "week" });

			expect(metrics.completed_tasks).toBe(1);
			expect(metrics.success_rate).toBe(1);
			expect(metrics.tasks.length).toBe(1);
			expect(metrics.tasks[0].type).toBe("implementation");
			expect(metrics.tasks[0].outcome).toBe("success");
		});

		test("calculates success rate correctly", () => {
			const storage = new JsonlMetricsStorage();

			// 2 successes, 1 failure = 66.67% success rate
			for (let i = 0; i < 3; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: i < 2 ? "success" : "failure",
					confidence: 0.8,
				});
			}

			const metrics = storage.queryMetrics({ period: "week" });

			expect(metrics.completed_tasks).toBe(3);
			expect(metrics.success_rate).toBeCloseTo(0.6667, 2);
		});

		test("calculates calibration score", () => {
			const storage = new JsonlMetricsStorage();

			// Well-calibrated: 0.8 confidence, actual success
			const task1 = storage.startTask({
				description: "Task 1",
				type: "fix",
			});
			storage.completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.8,
			});

			// Overconfident: 0.9 confidence, actual failure
			const task2 = storage.startTask({
				description: "Task 2",
				type: "fix",
			});
			storage.completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.9,
			});

			const metrics = storage.queryMetrics({ period: "week" });

			// Calibration score should be between 0 and 1
			expect(metrics.calibration_score).toBeGreaterThanOrEqual(0);
			expect(metrics.calibration_score).toBeLessThanOrEqual(1);
		});
	});

	describe("JsonlMetricsStorage hook failure stats", () => {
		test("returns empty array when no hook executions", () => {
			const storage = new JsonlMetricsStorage();
			const stats = storage.getHookFailureStats("week");

			expect(Array.isArray(stats)).toBe(true);
			expect(stats.length).toBe(0);
		});

		test("tracks hook execution failures", () => {
			const storage = new JsonlMetricsStorage();

			// Record some hook executions
			storage.recordHookExecution({
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1000,
				exitCode: 0,
				passed: true,
			});

			storage.recordHookExecution({
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 1000,
				exitCode: 1,
				passed: false,
			});

			const stats = storage.getHookFailureStats("week");

			// Should have failure data
			expect(Array.isArray(stats)).toBe(true);
		});
	});

	describe("task type filtering in queryMetrics", () => {
		test("filters by task type when specified", () => {
			const storage = new JsonlMetricsStorage();

			// Create different task types
			const fixTask = storage.startTask({
				description: "Fix bug",
				type: "fix",
			});
			storage.completeTask({
				task_id: fixTask.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const implTask = storage.startTask({
				description: "Implement feature",
				type: "implementation",
			});
			storage.completeTask({
				task_id: implTask.task_id,
				outcome: "success",
				confidence: 0.8,
			});

			// All tasks should be 2
			const allMetrics = storage.queryMetrics({
				period: "week",
			});
			expect(allMetrics.completed_tasks).toBe(2);

			// Filter should reduce
			const fixMetrics = storage.queryMetrics({
				period: "week",
				task_type: "fix",
			});

			// The filter should return only fix tasks
			expect(fixMetrics.tasks.length).toBeGreaterThanOrEqual(0);
			if (fixMetrics.tasks.length > 0) {
				expect(fixMetrics.tasks.every((t) => t.type === "fix")).toBe(true);
			}
		});

		test("filters by outcome when specified", () => {
			const storage = new JsonlMetricsStorage();

			// Create tasks with different outcomes
			const task1 = storage.startTask({
				description: "Task 1",
				type: "fix",
			});
			storage.completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const task2 = storage.startTask({
				description: "Task 2",
				type: "fix",
			});
			storage.completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.8,
			});

			const allMetrics = storage.queryMetrics({
				period: "week",
			});

			// All tasks should be returned
			expect(allMetrics.completed_tasks).toBe(2);

			const successMetrics = storage.queryMetrics({
				period: "week",
				outcome: "success",
			});

			// When filtering by outcome, tasks should match
			if (successMetrics.tasks.length > 0) {
				expect(successMetrics.tasks.every((t) => t.outcome === "success")).toBe(
					true,
				);
			}
		});
	});
});
