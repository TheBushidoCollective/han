/**
 * Tests for exported helper functions in context-generation.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import {
	buildContextMarkdown,
	getBestTaskType,
	getCalibrationDirection,
	getCalibrationEmoji,
	getCalibrationGuidance,
	getHookSpecificGuidance,
	getWeakestTaskType,
	type HookFailureStats,
} from "../lib/commands/metrics/context-generation.ts";

// Mock metrics structure for testing
function createMockMetrics(overrides: {
	total_tasks?: number;
	completed_tasks?: number;
	success_rate?: number;
	calibration_score?: number;
	tasks?: Array<{
		type: string;
		outcome: string;
		confidence?: number | null;
	}>;
}) {
	return {
		total_tasks: overrides.total_tasks ?? 10,
		completed_tasks: overrides.completed_tasks ?? 8,
		success_rate: overrides.success_rate ?? 0.8,
		calibration_score: overrides.calibration_score ?? 0.75,
		tasks: overrides.tasks ?? [],
		failed_tasks: 0,
		partial_tasks: 0,
		avg_confidence: 0.8,
		by_type: {},
		frustration_events: [],
	};
}

describe("context-generation.ts helper functions", () => {
	describe("getCalibrationEmoji", () => {
		test("returns target emoji for score >= 85", () => {
			expect(getCalibrationEmoji(85)).toBe("🎯");
			expect(getCalibrationEmoji(90)).toBe("🎯");
			expect(getCalibrationEmoji(100)).toBe("🎯");
		});

		test("returns chart emoji for score >= 70", () => {
			expect(getCalibrationEmoji(70)).toBe("📈");
			expect(getCalibrationEmoji(84)).toBe("📈");
		});

		test("returns warning emoji for score >= 50", () => {
			expect(getCalibrationEmoji(50)).toBe("⚠️");
			expect(getCalibrationEmoji(69)).toBe("⚠️");
		});

		test("returns red circle for score < 50", () => {
			expect(getCalibrationEmoji(49)).toBe("🔴");
			expect(getCalibrationEmoji(0)).toBe("🔴");
			expect(getCalibrationEmoji(25)).toBe("🔴");
		});
	});

	describe("getBestTaskType", () => {
		test("returns null when no task types have enough samples", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "implementation", outcome: "success" },
					{ type: "fix", outcome: "success" },
				],
			});
			expect(getBestTaskType(metrics)).toBeNull();
		});

		test("returns best performing task type with >= 3 samples", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "implementation", outcome: "success" },
					{ type: "implementation", outcome: "success" },
					{ type: "implementation", outcome: "failure" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
				],
			});
			const result = getBestTaskType(metrics);
			expect(result).not.toBeNull();
			expect(result?.type).toBe("fix");
			expect(result?.successRate).toBe(1);
		});

		test("handles tie by returning first found", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "implementation", outcome: "success" },
					{ type: "implementation", outcome: "success" },
					{ type: "implementation", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
				],
			});
			const result = getBestTaskType(metrics);
			expect(result).not.toBeNull();
			expect(result?.successRate).toBe(1);
		});

		test("calculates correct success rate", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "refactor", outcome: "success" },
					{ type: "refactor", outcome: "success" },
					{ type: "refactor", outcome: "failure" },
					{ type: "refactor", outcome: "failure" },
				],
			});
			const result = getBestTaskType(metrics);
			expect(result).not.toBeNull();
			expect(result?.type).toBe("refactor");
			expect(result?.successRate).toBe(0.5);
		});
	});

	describe("getWeakestTaskType", () => {
		test("returns null when no task types have enough samples", () => {
			const metrics = createMockMetrics({
				tasks: [{ type: "implementation", outcome: "success" }],
			});
			expect(getWeakestTaskType(metrics)).toBeNull();
		});

		test("returns worst performing task type with >= 3 samples", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "implementation", outcome: "success" },
					{ type: "implementation", outcome: "failure" },
					{ type: "implementation", outcome: "failure" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
				],
			});
			const result = getWeakestTaskType(metrics);
			expect(result).not.toBeNull();
			expect(result?.type).toBe("implementation");
			expect(result?.successRate).toBeCloseTo(0.333, 2);
		});

		test("handles all failures", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "research", outcome: "failure" },
					{ type: "research", outcome: "failure" },
					{ type: "research", outcome: "failure" },
				],
			});
			const result = getWeakestTaskType(metrics);
			expect(result).not.toBeNull();
			expect(result?.type).toBe("research");
			expect(result?.successRate).toBe(0);
		});
	});

	describe("getCalibrationDirection", () => {
		test("returns neutral when no tasks with confidence", () => {
			const metrics = createMockMetrics({ tasks: [] });
			expect(getCalibrationDirection(metrics)).toBe("neutral");
		});

		test("returns overconfident when confidence consistently exceeds outcomes", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "fix", outcome: "failure", confidence: 0.9 },
					{ type: "fix", outcome: "failure", confidence: 0.8 },
					{ type: "fix", outcome: "failure", confidence: 0.85 },
					{ type: "fix", outcome: "success", confidence: 0.5 },
				],
			});
			expect(getCalibrationDirection(metrics)).toBe("overconfident");
		});

		test("returns underconfident when confidence consistently below outcomes", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "fix", outcome: "success", confidence: 0.3 },
					{ type: "fix", outcome: "success", confidence: 0.2 },
					{ type: "fix", outcome: "success", confidence: 0.4 },
					{ type: "fix", outcome: "failure", confidence: 0.9 },
				],
			});
			expect(getCalibrationDirection(metrics)).toBe("underconfident");
		});

		test("returns neutral when balanced", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "fix", outcome: "success", confidence: 0.9 },
					{ type: "fix", outcome: "failure", confidence: 0.1 },
					{ type: "fix", outcome: "success", confidence: 0.8 },
					{ type: "fix", outcome: "failure", confidence: 0.2 },
				],
			});
			expect(getCalibrationDirection(metrics)).toBe("neutral");
		});

		test("handles null confidence values", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "fix", outcome: "success", confidence: null },
					{ type: "fix", outcome: "failure", confidence: undefined },
				],
			});
			expect(getCalibrationDirection(metrics)).toBe("neutral");
		});

		test("filters out tasks without outcomes", () => {
			const metrics = createMockMetrics({
				tasks: [
					{ type: "fix", outcome: "", confidence: 0.9 },
					{ type: "fix", outcome: "success", confidence: 0.9 },
					{ type: "fix", outcome: "success", confidence: 0.9 },
				],
			});
			// Only 2 valid tasks, both overconfident but not enough to meet 1.5x threshold
			expect(getCalibrationDirection(metrics)).toBe("neutral");
		});
	});

	describe("getCalibrationGuidance", () => {
		test("returns overconfident guidance", () => {
			const guidance = getCalibrationGuidance("overconfident", 45);
			expect(guidance).toContain("overconfident");
			expect(guidance).toContain("conservative");
			expect(guidance).toContain("0.7");
		});

		test("returns underconfident guidance", () => {
			const guidance = getCalibrationGuidance("underconfident", 45);
			expect(guidance).toContain("underconfident");
			expect(guidance).toContain("Trust");
			expect(guidance).toContain("0.8");
		});

		test("returns neutral guidance with score", () => {
			const guidance = getCalibrationGuidance("neutral", 45);
			expect(guidance).toContain("45%");
			expect(guidance).toContain("validation hooks");
		});
	});

	describe("getHookSpecificGuidance", () => {
		test("returns typescript guidance", () => {
			const guidance = getHookSpecificGuidance("typescript-typecheck");
			expect(guidance).not.toBeNull();
			expect(guidance).toContain("TypeScript");
			expect(guidance).toContain("tsc");
		});

		test("returns biome guidance", () => {
			const guidance = getHookSpecificGuidance("biome-lint");
			expect(guidance).not.toBeNull();
			expect(guidance).toContain("Biome");
			expect(guidance).toContain("biome check");
		});

		test("returns bun test guidance", () => {
			const guidance = getHookSpecificGuidance("bun-test");
			expect(guidance).not.toBeNull();
			expect(guidance).toContain("Testing");
			expect(guidance).toContain("bun test");
		});

		test("returns commit message guidance", () => {
			const guidance = getHookSpecificGuidance("check-commits");
			expect(guidance).not.toBeNull();
			expect(guidance).toContain("Commit");
			expect(guidance).toContain("conventional");
		});

		test("returns markdown guidance", () => {
			const guidance = getHookSpecificGuidance("markdownlint");
			expect(guidance).not.toBeNull();
			expect(guidance).toContain("Markdown");
			expect(guidance).toContain("markdownlint");
		});

		test("returns null for unknown hook", () => {
			expect(getHookSpecificGuidance("unknown-hook")).toBeNull();
			expect(getHookSpecificGuidance("")).toBeNull();
			expect(getHookSpecificGuidance("random")).toBeNull();
		});
	});

	describe("buildContextMarkdown", () => {
		test("returns getting started message when no tasks", () => {
			const metrics = createMockMetrics({ total_tasks: 0 });
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("Getting Started");
			expect(result).toContain("No tasks tracked");
		});

		test("includes performance header", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				completed_tasks: 8,
				success_rate: 0.8,
				calibration_score: 0.75,
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("Recent Performance");
			expect(result).toContain("Last 7 Days");
		});

		test("includes task stats", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				completed_tasks: 8,
				success_rate: 0.8,
				calibration_score: 0.75,
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("8 completed");
			expect(result).toContain("80% success");
		});

		test("includes calibration score with emoji", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				calibration_score: 0.9,
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("90%");
			expect(result).toContain("🎯");
		});

		test("includes best task type when available", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				tasks: [
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
				],
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("Best at");
			expect(result).toContain("fix");
		});

		test("includes weakest task type when different from best", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				tasks: [
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "fix", outcome: "success" },
					{ type: "implementation", outcome: "failure" },
					{ type: "implementation", outcome: "failure" },
					{ type: "implementation", outcome: "success" },
				],
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("Needs improvement");
			expect(result).toContain("implementation");
		});

		test("includes hook failure stats when present", () => {
			const metrics = createMockMetrics({ total_tasks: 10 });
			const hookStats: HookFailureStats[] = [
				{
					name: "typescript-typecheck",
					source: "jutsu-typescript",
					total: 10,
					failures: 3,
					failureRate: 30,
				},
			];
			const result = buildContextMarkdown(metrics, hookStats);
			expect(result).toContain("Hook Failures");
			expect(result).toContain("typescript-typecheck");
			expect(result).toContain("30%");
			expect(result).toContain("3/10");
		});

		test("includes hook-specific guidance for most problematic hook", () => {
			const metrics = createMockMetrics({ total_tasks: 10 });
			const hookStats: HookFailureStats[] = [
				{
					name: "typescript-typecheck",
					source: "jutsu-typescript",
					total: 10,
					failures: 5,
					failureRate: 50,
				},
			];
			const result = buildContextMarkdown(metrics, hookStats);
			expect(result).toContain("TypeScript Tip");
		});

		test("includes calibration tips for low scores", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				calibration_score: 0.4,
				tasks: [
					{ type: "fix", outcome: "failure", confidence: 0.9 },
					{ type: "fix", outcome: "failure", confidence: 0.9 },
					{ type: "fix", outcome: "failure", confidence: 0.9 },
				],
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).toContain("Calibration Tips");
		});

		test("does not include calibration tips for good scores", () => {
			const metrics = createMockMetrics({
				total_tasks: 10,
				calibration_score: 0.85,
			});
			const result = buildContextMarkdown(metrics, []);
			expect(result).not.toContain("Calibration Tips");
		});
	});
});
