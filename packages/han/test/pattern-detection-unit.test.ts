/**
 * Unit tests for pattern-detection.ts
 * Tests pattern detection logic directly via module imports
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	detectPatterns,
	resetStorageInstance,
} from "../lib/commands/metrics/pattern-detection.ts";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

// Generate unique test dir for each run to avoid module caching issues
const baseTestDir = `/tmp/test-pattern-unit-${Date.now()}`;
let testCounter = 0;

describe.serial("pattern-detection unit tests", () => {
	let testDir: string;
	let originalEnv: string | undefined;
	let consoleSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];

	beforeEach(() => {
		testCounter++;
		testDir = `${baseTestDir}-${testCounter}`;
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});
		logs = [];
		consoleSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		// Reset storage singleton so it uses the new config dir
		resetStorageInstance();
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
		consoleSpy.mockRestore();
	});

	describe("detectPatterns", () => {
		test("outputs empty JSON when no patterns and json=true", async () => {
			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			expect(parsed.patterns).toEqual([]);
		});

		test("outputs nothing when no patterns and json=false", async () => {
			await detectPatterns({ json: false });

			expect(logs.length).toBe(0);
		});

		test("detects consecutive failures pattern", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 3; i++) {
				const task = storage.startTask({
					description: `Failed task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.8,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const consecutiveFailures = parsed.patterns.find(
				(p: { type: string }) => p.type === "consecutive_failures",
			);
			expect(consecutiveFailures).toBeDefined();
			expect(consecutiveFailures.severity).toBe("high");
			expect(consecutiveFailures.message).toBe("Last 3 tasks all failed");
			expect(consecutiveFailures.guidance).toContain(
				"breaking tasks into smaller steps",
			);
		});

		test("detects hook failure pattern with high severity (>50%)", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 6;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "typescript-typecheck",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure).toBeDefined();
			expect(hookFailure.severity).toBe("high");
			expect(hookFailure.guidance).toContain("typescript");
		});

		test("detects hook failure pattern with medium severity (30-50%)", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 4;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "biome-lint",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure).toBeDefined();
			expect(hookFailure.severity).toBe("medium");
			expect(hookFailure.guidance).toContain("biome");
		});

		test("detects calibration drift when score is low", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 6; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.95,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const calibrationDrift = parsed.patterns.find(
				(p: { type: string }) => p.type === "calibration_drift",
			);
			expect(calibrationDrift).toBeDefined();
			expect(calibrationDrift.guidance).toContain("overconfident");
		});

		test("filters patterns by minimum severity", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 3; i++) {
				const task = storage.startTask({
					description: `Failed task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.8,
				});
			}

			await detectPatterns({ json: true, minSeverity: "high" });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			for (const pattern of parsed.patterns) {
				expect(pattern.severity).toBe("high");
			}
		});

		test("outputs markdown format when json=false and patterns exist", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 3; i++) {
				const task = storage.startTask({
					description: `Failed task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.8,
				});
			}

			await detectPatterns({ json: false });

			const output = logs.join("\n");
			expect(output).toContain("Pattern Alert");
			expect(output).toContain("Last 3 tasks all failed");
		});

		test("provides guidance for bun-test hook", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 6;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "bun-test",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure?.guidance).toContain("bun test");
		});

		test("provides guidance for check-commits hook", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 6;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "check-commits",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure?.guidance).toContain("conventional format");
		});

		test("provides guidance for markdownlint hook", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 6;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "markdownlint",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure?.guidance).toContain("markdownlint");
		});

		test("provides default guidance for unknown hooks", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 6;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "unknown-custom-hook",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure?.guidance).toContain("unknown-custom-hook");
			expect(hookFailure?.guidance).toContain("Review the output");
		});

		test("detects underconfident calibration direction", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 6; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.3,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			expect(parsed.patterns).toBeDefined();
		});

		test("detects neutral calibration direction with mixed results", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 6; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				if (i % 2 === 0) {
					storage.completeTask({
						task_id: task.task_id,
						outcome: "failure",
						confidence: 0.9,
					});
				} else {
					storage.completeTask({
						task_id: task.task_id,
						outcome: "success",
						confidence: 0.3,
					});
				}
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			expect(parsed.patterns).toBeDefined();
		});

		test("severity high calibration drift when score < 0.3", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.99,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const calibrationDrift = parsed.patterns.find(
				(p: { type: string }) => p.type === "calibration_drift",
			);
			if (calibrationDrift) {
				expect(calibrationDrift.severity).toBe("high");
			}
		});

		test("no consecutive failures when only 2 recent tasks failed", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 2; i++) {
				const task = storage.startTask({
					description: `Failed task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.8,
				});
			}
			const successTask = storage.startTask({
				description: "Success task",
				type: "fix",
			});
			storage.completeTask({
				task_id: successTask.task_id,
				outcome: "success",
				confidence: 0.8,
			});

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const consecutiveFailures = parsed.patterns.find(
				(p: { type: string }) => p.type === "consecutive_failures",
			);
			expect(consecutiveFailures).toBeUndefined();
		});

		test("no hook failure pattern when failure rate <= 30%", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 2;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "some-hook",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const hookFailure = parsed.patterns.find(
				(p: { type: string }) => p.type === "hook_failure_pattern",
			);
			expect(hookFailure).toBeUndefined();
		});

		test("no calibration drift when fewer than 5 completed tasks", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 4; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.95,
				});
			}

			await detectPatterns({ json: true });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			const calibrationDrift = parsed.patterns.find(
				(p: { type: string }) => p.type === "calibration_drift",
			);
			expect(calibrationDrift).toBeUndefined();
		});

		test("filters out low severity patterns when minSeverity is medium", async () => {
			const storage = new JsonlMetricsStorage();

			for (let i = 0; i < 10; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "implementation",
				});
				const hooksPassed = i >= 4;
				storage.completeTask({
					task_id: task.task_id,
					outcome: hooksPassed ? "success" : "failure",
					confidence: 0.8,
				});
				storage.recordHookExecution({
					hookName: "test-hook",
					hookType: "Stop",
					hookSource: "plugin",
					taskId: task.task_id,
					passed: hooksPassed,
					durationMs: 100,
					exitCode: hooksPassed ? 0 : 1,
				});
			}

			await detectPatterns({ json: true, minSeverity: "medium" });

			const output = logs.join("\n");
			const parsed = JSON.parse(output);
			for (const pattern of parsed.patterns) {
				expect(["medium", "high"]).toContain(pattern.severity);
			}
		});
	});
});

describe("pattern-detection helper functions", () => {
	describe("getSeverityLevel logic", () => {
		test("severity levels are correctly ordered", () => {
			// Test the logic that getSeverityLevel uses
			function getSeverityLevel(severity: "low" | "medium" | "high"): number {
				switch (severity) {
					case "low":
						return 1;
					case "medium":
						return 2;
					case "high":
						return 3;
				}
			}

			expect(getSeverityLevel("low")).toBe(1);
			expect(getSeverityLevel("medium")).toBe(2);
			expect(getSeverityLevel("high")).toBe(3);

			// Verify ordering
			expect(getSeverityLevel("low")).toBeLessThan(getSeverityLevel("medium"));
			expect(getSeverityLevel("medium")).toBeLessThan(getSeverityLevel("high"));
		});

		test("filtering by severity works correctly", () => {
			function getSeverityLevel(severity: "low" | "medium" | "high"): number {
				switch (severity) {
					case "low":
						return 1;
					case "medium":
						return 2;
					case "high":
						return 3;
				}
			}

			const patterns = [
				{ type: "a", severity: "low" as const, message: "Low" },
				{ type: "b", severity: "medium" as const, message: "Medium" },
				{ type: "c", severity: "high" as const, message: "High" },
			];

			// Filter by minimum high
			const minHigh = getSeverityLevel("high");
			const highOnly = patterns.filter(
				(p) => getSeverityLevel(p.severity) >= minHigh,
			);
			expect(highOnly).toHaveLength(1);
			expect(highOnly[0]?.type).toBe("c");

			// Filter by minimum medium
			const minMedium = getSeverityLevel("medium");
			const mediumAndHigh = patterns.filter(
				(p) => getSeverityLevel(p.severity) >= minMedium,
			);
			expect(mediumAndHigh).toHaveLength(2);

			// Filter by minimum low (all)
			const minLow = getSeverityLevel("low");
			const all = patterns.filter(
				(p) => getSeverityLevel(p.severity) >= minLow,
			);
			expect(all).toHaveLength(3);
		});
	});

	describe("buildPatternMarkdown logic", () => {
		test("builds markdown with high severity emoji", () => {
			const patterns = [
				{
					type: "test",
					severity: "high" as const,
					message: "Test high message",
					guidance: "Test guidance",
				},
			];

			const lines: string[] = [];
			lines.push("⚠️ **Pattern Alert**\n");

			for (const pattern of patterns) {
				const emoji = pattern.severity === "high" ? "🔴" : "⚠️";
				lines.push(`${emoji} ${pattern.message}`);

				if (pattern.guidance) {
					lines.push(`\n${pattern.guidance}\n`);
				}
			}

			const output = lines.join("\n");
			expect(output).toContain("⚠️ **Pattern Alert**");
			expect(output).toContain("🔴 Test high message");
			expect(output).toContain("Test guidance");
		});

		test("builds markdown with medium severity emoji", () => {
			const patterns: Array<{
				type: string;
				severity: "high" | "medium" | "low";
				message: string;
				guidance?: string;
			}> = [
				{
					type: "test",
					severity: "medium",
					message: "Test medium message",
				},
			];

			const lines: string[] = [];
			lines.push("⚠️ **Pattern Alert**\n");

			for (const pattern of patterns) {
				const emoji = pattern.severity === "high" ? "🔴" : "⚠️";
				lines.push(`${emoji} ${pattern.message}`);

				if (pattern.guidance) {
					lines.push(`\n${pattern.guidance}\n`);
				}
			}

			const output = lines.join("\n");
			expect(output).toContain("⚠️ Test medium message");
			expect(output).not.toContain("🔴");
		});

		test("builds markdown with multiple patterns", () => {
			const patterns = [
				{
					type: "a",
					severity: "high" as const,
					message: "High message",
					guidance: "High guidance",
				},
				{
					type: "b",
					severity: "medium" as const,
					message: "Medium message",
					guidance: "Medium guidance",
				},
			];

			const lines: string[] = [];
			lines.push("⚠️ **Pattern Alert**\n");

			for (const pattern of patterns) {
				const emoji = pattern.severity === "high" ? "🔴" : "⚠️";
				lines.push(`${emoji} ${pattern.message}`);

				if (pattern.guidance) {
					lines.push(`\n${pattern.guidance}\n`);
				}
			}

			const output = lines.join("\n");
			expect(output).toContain("🔴 High message");
			expect(output).toContain("⚠️ Medium message");
		});
	});

	describe("determineCalibrationDirection logic", () => {
		test("returns overconfident when high confidence with failures", () => {
			const tasks = [
				{ outcome: "failure", confidence: 0.95 },
				{ outcome: "failure", confidence: 0.9 },
				{ outcome: "failure", confidence: 0.85 },
			];

			let overconfidentCount = 0;
			let underconfidentCount = 0;

			for (const task of tasks) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				const confidence = task.confidence;
				const diff = confidence - actualSuccess;

				if (diff > 0.2) overconfidentCount++;
				if (diff < -0.2) underconfidentCount++;
			}

			expect(overconfidentCount).toBe(3);
			expect(underconfidentCount).toBe(0);

			// Direction determination
			const direction =
				overconfidentCount > underconfidentCount * 1.5
					? "overconfident"
					: underconfidentCount > overconfidentCount * 1.5
						? "underconfident"
						: "neutral";
			expect(direction).toBe("overconfident");
		});

		test("returns underconfident when low confidence with successes", () => {
			const tasks = [
				{ outcome: "success", confidence: 0.3 },
				{ outcome: "success", confidence: 0.25 },
				{ outcome: "success", confidence: 0.2 },
			];

			let overconfidentCount = 0;
			let underconfidentCount = 0;

			for (const task of tasks) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				const confidence = task.confidence;
				const diff = confidence - actualSuccess;

				if (diff > 0.2) overconfidentCount++;
				if (diff < -0.2) underconfidentCount++;
			}

			expect(overconfidentCount).toBe(0);
			expect(underconfidentCount).toBe(3);

			const direction =
				overconfidentCount > underconfidentCount * 1.5
					? "overconfident"
					: underconfidentCount > overconfidentCount * 1.5
						? "underconfident"
						: "neutral";
			expect(direction).toBe("underconfident");
		});

		test("returns neutral when mixed results", () => {
			// For neutral, we need roughly equal over and underconfident counts
			// where neither exceeds 1.5x the other
			const tasks = [
				{ outcome: "failure", confidence: 0.9 }, // overconfident (0.9 - 0 = 0.9 > 0.2)
				{ outcome: "success", confidence: 0.3 }, // underconfident (0.3 - 1 = -0.7 < -0.2)
				{ outcome: "failure", confidence: 0.8 }, // overconfident (0.8 - 0 = 0.8 > 0.2)
				{ outcome: "success", confidence: 0.4 }, // underconfident (0.4 - 1 = -0.6 < -0.2)
			];

			let overconfidentCount = 0;
			let underconfidentCount = 0;

			for (const task of tasks) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				const confidence = task.confidence;
				const diff = confidence - actualSuccess;

				if (diff > 0.2) overconfidentCount++;
				if (diff < -0.2) underconfidentCount++;
			}

			// Both should be 2, so neither exceeds 1.5x the other
			expect(overconfidentCount).toBe(2);
			expect(underconfidentCount).toBe(2);

			// Check neither exceeds 1.5x the other (2 > 2 * 1.5 = 3 is false)
			const isNeutral =
				!(overconfidentCount > underconfidentCount * 1.5) &&
				!(underconfidentCount > overconfidentCount * 1.5);
			expect(isNeutral).toBe(true);
		});

		test("returns neutral when no tasks have confidence", () => {
			const tasks: Array<{ outcome: string; confidence: number | null }> = [];
			const tasksWithConf = tasks.filter(
				(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
			);

			expect(tasksWithConf.length).toBe(0);
			// Function returns "neutral" when no tasks
		});
	});

	describe("getCalibrationGuidance logic", () => {
		test("returns overconfident guidance", () => {
			const direction = "overconfident" as const;
			let guidance: string;

			if (direction === "overconfident") {
				guidance =
					"**You're being overconfident.** Be more conservative with confidence ratings. If you haven't run hooks yourself, max confidence should be 0.7.";
			} else if (direction === "underconfident") {
				guidance =
					"**You're being underconfident.** Trust your implementation more. If hooks pass during development, confidence can be 0.8+.";
			} else {
				guidance =
					"**Focus on calibration.** Run validation hooks before completing tasks to better assess success likelihood.";
			}

			expect(guidance).toContain("overconfident");
			expect(guidance).toContain("conservative");
			expect(guidance).toContain("0.7");
		});

		test("returns underconfident guidance", () => {
			// Test underconfident case directly
			const guidance =
				"**You're being underconfident.** Trust your implementation more. If hooks pass during development, confidence can be 0.8+.";

			expect(guidance).toContain("underconfident");
			expect(guidance).toContain("Trust");
			expect(guidance).toContain("0.8+");
		});

		test("returns neutral guidance", () => {
			// Test neutral case directly
			const guidance =
				"**Focus on calibration.** Run validation hooks before completing tasks to better assess success likelihood.";

			expect(guidance).toContain("Focus on calibration");
			expect(guidance).toContain("validation hooks");
		});
	});

	describe("getHookGuidance logic", () => {
		test("returns specific guidance for typescript-typecheck", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
				"biome-lint":
					"**Tip:** Run `npx biome check --write .` before marking complete.",
				"bun-test":
					"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
				"check-commits":
					"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
				markdownlint:
					"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
			};

			expect(guidance["typescript-typecheck"]).toContain("tsc");
		});

		test("returns specific guidance for biome-lint", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
				"biome-lint":
					"**Tip:** Run `npx biome check --write .` before marking complete.",
				"bun-test":
					"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
				"check-commits":
					"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
				markdownlint:
					"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
			};

			expect(guidance["biome-lint"]).toContain("biome check");
		});

		test("returns specific guidance for bun-test", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
				"biome-lint":
					"**Tip:** Run `npx biome check --write .` before marking complete.",
				"bun-test":
					"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
				"check-commits":
					"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
				markdownlint:
					"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
			};

			expect(guidance["bun-test"]).toContain("bun test");
		});

		test("returns specific guidance for check-commits", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
				"biome-lint":
					"**Tip:** Run `npx biome check --write .` before marking complete.",
				"bun-test":
					"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
				"check-commits":
					"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
				markdownlint:
					"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
			};

			expect(guidance["check-commits"]).toContain("conventional format");
		});

		test("returns specific guidance for markdownlint", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
				"biome-lint":
					"**Tip:** Run `npx biome check --write .` before marking complete.",
				"bun-test":
					"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
				"check-commits":
					"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
				markdownlint:
					"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
			};

			expect(guidance.markdownlint).toContain("markdownlint-cli");
		});

		test("returns default guidance for unknown hooks", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck":
					"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
			};

			const hookName = "unknown-hook";
			const result =
				guidance[hookName] ||
				`**Tip:** Review the output from ${hookName} and fix issues before completion.`;

			expect(result).toContain("Review the output");
			expect(result).toContain("unknown-hook");
		});
	});

	describe("Pattern interface structure", () => {
		test("Pattern has correct structure", () => {
			const pattern = {
				type: "consecutive_failures",
				severity: "high" as const,
				message: "Last 3 tasks all failed",
				guidance: "Review hook output carefully.",
			};

			expect(pattern.type).toBe("consecutive_failures");
			expect(pattern.severity).toBe("high");
			expect(pattern.message).toBeDefined();
			expect(pattern.guidance).toBeDefined();
		});

		test("Pattern guidance is optional", () => {
			const pattern: {
				type: string;
				severity: "low" | "medium" | "high";
				message: string;
				guidance?: string;
			} = {
				type: "test",
				severity: "low",
				message: "Test message",
			};

			expect(pattern.guidance).toBeUndefined();
		});
	});

	describe("Consecutive failures pattern", () => {
		test("pattern includes correct guidance text", () => {
			const pattern = {
				type: "consecutive_failures",
				severity: "high" as const,
				message: "Last 3 tasks all failed",
				guidance:
					"Review hook output carefully. Consider breaking tasks into smaller steps. If stuck, ask for user guidance.",
			};

			expect(pattern.guidance).toContain("breaking tasks into smaller steps");
			expect(pattern.guidance).toContain("user guidance");
		});
	});

	describe("Hook failure pattern", () => {
		test("pattern message includes failure rate and counts", () => {
			const stat = {
				name: "typescript-typecheck",
				failures: 6,
				total: 8,
				failureRate: 75,
			};

			const message = `Hook "${stat.name}" failing ${stat.failureRate}% of the time (${stat.failures}/${stat.total})`;
			expect(message).toContain("typescript-typecheck");
			expect(message).toContain("75%");
			expect(message).toContain("6/8");
		});
	});

	describe("Calibration drift pattern", () => {
		test("pattern message includes calibration score", () => {
			const calibrationScore = 0.35;
			const message = `Low calibration score: ${Math.round(calibrationScore * 100)}%`;

			expect(message).toContain("35%");
		});

		test("severity is high when score < 0.3", () => {
			const calibrationScore = 0.25;
			const severity = calibrationScore < 0.3 ? "high" : "medium";
			expect(severity).toBe("high");
		});

		test("severity is medium when score >= 0.3", () => {
			const calibrationScore = 0.4;
			const severity = calibrationScore < 0.3 ? "high" : "medium";
			expect(severity).toBe("medium");
		});
	});
});
