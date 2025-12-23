/**
 * Comprehensive tests for Browse GraphQL metrics types
 *
 * Tests the GraphQL layer that the browse UI uses to query metrics.
 * Ensures the metrics are correctly exposed via the GraphQL schema.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getMetricsStorage,
	queryMetrics,
} from "../lib/commands/browse/graphql/types/metrics.ts";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

// Store original environment
const originalEnv = { ...process.env };
let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-browse-metrics-test-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
}

function teardown(): void {
	process.env = { ...originalEnv };

	if (testDir) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe.serial("Browse GraphQL Metrics Types", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getMetricsStorage", () => {
		test("returns a JsonlMetricsStorage instance", () => {
			const storage = getMetricsStorage();
			expect(storage).toBeInstanceOf(JsonlMetricsStorage);
		});

		test("creates new instance on each call", () => {
			const storage1 = getMetricsStorage();
			const storage2 = getMetricsStorage();
			// Each call creates a new instance (not a singleton)
			expect(storage1).not.toBe(storage2);
		});
	});

	describe("queryMetrics", () => {
		test("returns empty metrics when no data exists", () => {
			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(0);
			expect(result.completed_tasks).toBe(0);
			expect(result.success_rate).toBe(0);
			expect(result.average_confidence).toBe(0);
			expect(result.tasks).toEqual([]);
			expect(result.calibration_score).toBe(0);
		});

		test("returns metrics for DAY period", () => {
			// Create test data
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Test task",
				type: "implementation",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const result = queryMetrics("DAY");

			expect(result.total_tasks).toBe(1);
			expect(result.completed_tasks).toBe(1);
			expect(result.success_rate).toBe(1);
		});

		test("returns metrics for WEEK period", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// Create multiple tasks
			for (let i = 0; i < 3; i++) {
				const { task_id } = storage.startTask({
					description: `Task ${i + 1}`,
					type: i === 0 ? "implementation" : i === 1 ? "fix" : "refactor",
				});
				storage.completeTask({
					task_id,
					outcome: i === 2 ? "failure" : "success",
					confidence: 0.7 + i * 0.1,
				});
			}

			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(3);
			expect(result.completed_tasks).toBe(3);
			expect(result.by_type).toHaveProperty("implementation", 1);
			expect(result.by_type).toHaveProperty("fix", 1);
			expect(result.by_type).toHaveProperty("refactor", 1);
			expect(result.by_outcome).toHaveProperty("success", 2);
			expect(result.by_outcome).toHaveProperty("failure", 1);
		});

		test("returns metrics for MONTH period", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Monthly task",
				type: "research",
			});
			storage.completeTask({
				task_id,
				outcome: "partial",
				confidence: 0.6,
			});

			const result = queryMetrics("MONTH");

			expect(result.total_tasks).toBe(1);
			expect(result.by_outcome).toHaveProperty("partial", 1);
		});

		test("returns metrics with undefined period (defaults to week)", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Default period task",
				type: "fix",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.85,
			});

			const result = queryMetrics(undefined);

			expect(result.total_tasks).toBe(1);
		});

		test("calculates average confidence correctly", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const confidences = [0.6, 0.8, 1.0];
			for (let i = 0; i < confidences.length; i++) {
				const { task_id } = storage.startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: confidences[i],
				});
			}

			const result = queryMetrics("WEEK");

			// Average of 0.6, 0.8, 1.0 = 0.8
			expect(result.average_confidence).toBeCloseTo(0.8, 2);
		});

		test("calculates calibration score correctly", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// Perfect calibration: high confidence + success
			const task1 = storage.startTask({
				description: "High confidence success",
				type: "implementation",
			});
			storage.completeTask({
				task_id: task1.task_id,
				outcome: "success",
				confidence: 1.0,
			});

			// Perfect calibration: low confidence + failure
			const task2 = storage.startTask({
				description: "Low confidence failure",
				type: "fix",
			});
			storage.completeTask({
				task_id: task2.task_id,
				outcome: "failure",
				confidence: 0.0,
			});

			const result = queryMetrics("WEEK");

			// Perfect calibration should be 1.0 (no error)
			expect(result.calibration_score).toBeCloseTo(1.0, 2);
		});

		test("returns tasks sorted by started_at descending", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const tasks = ["First", "Second", "Third"];
			for (const desc of tasks) {
				const { task_id } = storage.startTask({
					description: desc,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const result = queryMetrics("WEEK");

			// Tasks are sorted by started_at descending
			// When created in same millisecond, order may be unstable
			expect(result.tasks.length).toBe(3);

			// Verify they are sorted (each timestamp >= next timestamp)
			for (let i = 0; i < result.tasks.length - 1; i++) {
				const current = new Date(result.tasks[i].started_at).getTime();
				const next = new Date(result.tasks[i + 1].started_at).getTime();
				expect(current).toBeGreaterThanOrEqual(next);
			}
		});

		test("includes files_modified as JSON string", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Task with files",
				type: "implementation",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
				files_modified: ["src/main.ts", "src/utils.ts"],
			});

			const result = queryMetrics("WEEK");

			expect(result.tasks[0].files_modified).toBe(
				'["src/main.ts","src/utils.ts"]',
			);
		});

		test("includes failure_reason for failed tasks", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Failed task",
				type: "fix",
			});
			storage.failTask({
				task_id,
				reason: "Type errors persist",
				attempted_solutions: ["Try A", "Try B"],
			});

			const result = queryMetrics("WEEK");

			expect(result.tasks[0].failure_reason).toBe("Type errors persist");
			expect(result.tasks[0].attempted_solutions).toBe('["Try A","Try B"]');
		});

		test("tracks frustration events", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Frustrating task",
				type: "implementation",
			});

			storage.recordFrustration({
				task_id,
				frustration_level: "high",
				frustration_score: 8,
				user_message: "This is not working!",
				detected_signals: ["caps", "punctuation"],
			});

			storage.completeTask({
				task_id,
				outcome: "partial",
				confidence: 0.5,
			});

			const result = queryMetrics("WEEK");

			expect(result.total_frustrations).toBe(1);
			expect(result.significant_frustrations).toBe(1);
			expect(result.frustration_events.length).toBe(1);
			expect(result.frustration_events[0].frustration_level).toBe("high");
		});

		test("calculates significant frustration rate", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// Create 2 tasks with 1 moderate frustration
			for (let i = 0; i < 2; i++) {
				const { task_id } = storage.startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			storage.recordFrustration({
				frustration_level: "moderate",
				frustration_score: 5,
				user_message: "This is confusing",
				detected_signals: ["confusion"],
			});

			storage.recordFrustration({
				frustration_level: "low",
				frustration_score: 2,
				user_message: "Minor issue",
				detected_signals: ["minor"],
			});

			const result = queryMetrics("WEEK");

			// 2 total frustrations, 1 significant (moderate), 2 tasks
			expect(result.total_frustrations).toBe(2);
			expect(result.significant_frustrations).toBe(1);
			expect(result.significant_frustration_rate).toBeCloseTo(0.5, 2);
		});

		test("tracks frustration by level", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const levels = ["low", "moderate", "high"] as const;
			for (const level of levels) {
				storage.recordFrustration({
					frustration_level: level,
					frustration_score: level === "low" ? 2 : level === "moderate" ? 5 : 8,
					user_message: `${level} frustration`,
					detected_signals: [level],
				});
			}

			const result = queryMetrics("WEEK");

			expect(result.frustration_by_level.low).toBe(1);
			expect(result.frustration_by_level.moderate).toBe(1);
			expect(result.frustration_by_level.high).toBe(1);
		});
	});

	describe("Data Persistence", () => {
		test("reads data across storage instances", () => {
			// First instance creates data
			const storage1 = getMetricsStorage();
			storage1.startSession();
			const { task_id } = storage1.startTask({
				description: "Persistent task",
				type: "implementation",
			});
			storage1.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});
			storage1.close();

			// Second instance should read the same data
			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(1);
			expect(result.tasks[0].description).toBe("Persistent task");
		});

		test("handles concurrent reads correctly", () => {
			// Create test data
			const storage = getMetricsStorage();
			storage.startSession();
			for (let i = 0; i < 5; i++) {
				const { task_id } = storage.startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}
			storage.close();

			// Multiple concurrent reads
			const results = [
				queryMetrics("DAY"),
				queryMetrics("WEEK"),
				queryMetrics("MONTH"),
			];

			// All should have the same data
			for (const result of results) {
				expect(result.total_tasks).toBe(5);
			}
		});
	});

	describe("Edge Cases", () => {
		test("handles empty directory gracefully", () => {
			// Just query without any data
			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(0);
			expect(result.tasks).toEqual([]);
			expect(result.frustration_events).toEqual([]);
		});

		test("handles active (uncompleted) tasks", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// Start task but don't complete it
			storage.startTask({
				description: "Active task",
				type: "implementation",
			});

			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(1);
			expect(result.completed_tasks).toBe(0);
			expect(result.tasks[0].status).toBe("active");
		});

		test("handles task with no confidence", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			storage.startTask({
				description: "Task without confidence",
				type: "implementation",
			});

			// Active task has no confidence yet
			const result = queryMetrics("WEEK");

			expect(result.tasks[0].confidence).toBeUndefined();
		});

		test("handles task with no files_modified", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Task without files",
				type: "fix",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
				// No files_modified
			});

			const result = queryMetrics("WEEK");

			expect(result.tasks[0].files_modified).toBeUndefined();
		});

		test("handles very long task descriptions", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const longDescription = "A".repeat(1000);
			const { task_id } = storage.startTask({
				description: longDescription,
				type: "implementation",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const result = queryMetrics("WEEK");

			expect(result.tasks[0].description).toBe(longDescription);
		});

		test("handles special characters in descriptions", () => {
			const storage = getMetricsStorage();
			storage.startSession();
			const specialDesc =
				'Task with "quotes" and\nnewlines and <html> & symbols';
			const { task_id } = storage.startTask({
				description: specialDesc,
				type: "implementation",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const result = queryMetrics("WEEK");

			expect(result.tasks[0].description).toBe(specialDesc);
		});

		test("handles all task types", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const types = ["implementation", "fix", "refactor", "research"] as const;
			for (const type of types) {
				const { task_id } = storage.startTask({
					description: `${type} task`,
					type,
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const result = queryMetrics("WEEK");

			expect(Object.keys(result.by_type).length).toBe(4);
			for (const type of types) {
				expect(result.by_type[type]).toBe(1);
			}
		});

		test("handles all outcome types", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const outcomes = ["success", "partial", "failure"] as const;
			for (const outcome of outcomes) {
				const { task_id } = storage.startTask({
					description: `${outcome} task`,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome,
					confidence: 0.5,
				});
			}

			const result = queryMetrics("WEEK");

			expect(Object.keys(result.by_outcome).length).toBe(3);
			for (const outcome of outcomes) {
				expect(result.by_outcome[outcome]).toBe(1);
			}
		});

		test("handles all complexity levels", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			const complexities = ["simple", "moderate", "complex"] as const;
			for (const complexity of complexities) {
				const { task_id } = storage.startTask({
					description: `${complexity} task`,
					type: "implementation",
					estimated_complexity: complexity,
				});
				storage.completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const result = queryMetrics("WEEK");

			expect(result.total_tasks).toBe(3);
			// Verify complexities are stored
			const complexitiesFound = result.tasks.map((t) => t.complexity);
			expect(complexitiesFound).toContain("simple");
			expect(complexitiesFound).toContain("moderate");
			expect(complexitiesFound).toContain("complex");
		});
	});

	describe("Calculations", () => {
		test("success_rate is calculated correctly", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// 2 success, 1 failure = 66.67% success rate among completed
			const outcomes = ["success", "success", "failure"] as const;
			for (const outcome of outcomes) {
				const { task_id } = storage.startTask({
					description: `${outcome} task`,
					type: "implementation",
				});
				storage.completeTask({
					task_id,
					outcome,
					confidence: 0.5,
				});
			}

			const result = queryMetrics("WEEK");

			expect(result.success_rate).toBeCloseTo(2 / 3, 2);
		});

		test("average_duration_seconds is calculated correctly", () => {
			// This is tricky to test since duration depends on timing
			// But we can at least verify the structure is correct
			const storage = getMetricsStorage();
			storage.startSession();
			const { task_id } = storage.startTask({
				description: "Timed task",
				type: "implementation",
			});
			storage.completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			const result = queryMetrics("WEEK");

			// Duration should be a number (might be 0 if completed instantly)
			expect(typeof result.average_duration_seconds).toBe("number");
			expect(result.average_duration_seconds).toBeGreaterThanOrEqual(0);
		});

		test("weighted_frustration_score excludes low frustrations", () => {
			const storage = getMetricsStorage();
			storage.startSession();

			// Low frustration (score 2) - should NOT contribute to weighted
			storage.recordFrustration({
				frustration_level: "low",
				frustration_score: 2,
				user_message: "Minor annoyance",
				detected_signals: ["minor"],
			});

			// Moderate frustration (score 5) - SHOULD contribute
			storage.recordFrustration({
				frustration_level: "moderate",
				frustration_score: 5,
				user_message: "Confusing",
				detected_signals: ["confusion"],
			});

			// High frustration (score 8) - SHOULD contribute
			storage.recordFrustration({
				frustration_level: "high",
				frustration_score: 8,
				user_message: "Very frustrated!",
				detected_signals: ["caps"],
			});

			const result = queryMetrics("WEEK");

			// Weighted score should be 5 + 8 = 13 (excludes low of 2)
			expect(result.weighted_frustration_score).toBe(13);
		});
	});
});
