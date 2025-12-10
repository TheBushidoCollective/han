/**
 * Ink render tests for metrics/display.tsx
 * Tests the MetricsDisplay component
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { MetricsDisplay } from "../lib/commands/metrics/display.tsx";
import type { MetricsResult } from "../lib/metrics/types.ts";

// Sample result with data
const sampleResult: MetricsResult = {
	total_tasks: 15,
	completed_tasks: 12,
	success_rate: 0.8,
	average_confidence: 0.75,
	average_duration_seconds: 180,
	calibration_score: 0.85,
	total_frustrations: 2,
	frustration_rate: 0.13,
	by_type: {
		implementation: 8,
		fix: 4,
		refactor: 2,
		research: 1,
	},
	by_outcome: {
		success: 9,
		partial: 2,
		failure: 1,
	},
	tasks: [
		{
			id: "task_1",
			type: "implementation",
			description: "Add user authentication",
			status: "completed",
			outcome: "success",
			confidence: 0.85,
			duration_seconds: 240,
			hooks_passed: true,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
		},
		{
			id: "task_2",
			type: "fix",
			description: "Fix login bug",
			status: "completed",
			outcome: "failure",
			confidence: 0.9,
			duration_seconds: 120,
			hooks_passed: false,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
		},
		{
			id: "task_3",
			type: "refactor",
			description: "Improve code structure",
			status: "completed",
			outcome: "success",
			confidence: 0.4,
			duration_seconds: 300,
			hooks_passed: true,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
		},
	],
	frustration_events: [
		{
			id: 1,
			task_id: "task_2",
			timestamp: new Date().toISOString(),
			frustration_level: "moderate",
			frustration_score: 6,
			user_message: "This keeps failing and I do not understand why",
			detected_signals: JSON.stringify([
				"negative sentiment",
				"repeated failure",
			]),
			context: "Login bug fix",
		},
	],
};

// Empty result for no data state
const emptyResult: MetricsResult = {
	total_tasks: 0,
	completed_tasks: 0,
	success_rate: 0,
	average_confidence: 0,
	average_duration_seconds: 0,
	calibration_score: 0,
	total_frustrations: 0,
	frustration_rate: 0,
	by_type: {},
	by_outcome: {},
	tasks: [],
	frustration_events: [],
};

describe("metrics/display.tsx", () => {
	describe("MetricsDisplay - No Data", () => {
		test("shows no data message when empty", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("No metrics tracked yet");
			expect(output).toContain("MCP tools in the core plugin");
			expect(output).toContain("start_task()");
		});
	});

	describe("MetricsDisplay - With Data", () => {
		test("renders header", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Agent Task Metrics Dashboard");
		});

		test("renders summary statistics", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Summary Statistics");
			expect(output).toContain("Total Tasks:");
			expect(output).toContain("15");
			expect(output).toContain("Success Rate:");
			expect(output).toContain("80%");
			expect(output).toContain("Calibration Score:");
			expect(output).toContain("85%");
		});

		test("renders tasks by type chart", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Tasks by Type");
			expect(output).toContain("implementation");
			expect(output).toContain("fix");
		});

		test("renders tasks by outcome chart", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Tasks by Outcome");
			expect(output).toContain("success");
		});

		test("renders recent tasks table", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Recent Tasks");
			expect(output).toContain("implementation");
			expect(output).toContain("fix");
		});

		test("renders frustration insights when present", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("User Frustration Analysis");
			expect(output).toContain("frustration events detected");
		});

		test("hides calibration by default", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("han metrics show --calibration");
		});

		test("shows calibration when enabled", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={true}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Calibration Analysis");
		});

		test("shows overconfident tasks in calibration", () => {
			// Task 2 has 90% confidence but failed
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={true}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Overconfident Tasks");
		});

		test("shows underconfident tasks in calibration", () => {
			// Task 3 has 40% confidence but succeeded
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={true}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Underconfident Tasks");
		});
	});

	describe("MetricsDisplay - Duration Formatting", () => {
		test("formats seconds correctly", () => {
			const shortResult = {
				...sampleResult,
				average_duration_seconds: 45,
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={shortResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("45s");
		});

		test("formats minutes correctly", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("3m");
		});

		test("formats hours correctly", () => {
			const longResult = {
				...sampleResult,
				average_duration_seconds: 7200,
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={longResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("2h");
		});
	});

	describe("MetricsDisplay - No Frustration", () => {
		test("does not show frustration section when no frustrations", () => {
			const noFrustrationResult = {
				...sampleResult,
				total_frustrations: 0,
				frustration_rate: 0,
				frustration_events: [],
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={noFrustrationResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).not.toContain("User Frustration Analysis");
		});
	});

	describe("MetricsDisplay - High Frustration", () => {
		test("shows recommendations when frustration rate is high", () => {
			const highFrustrationResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 10,
				frustration_rate: 0.4,
				frustration_events: [
					{
						id: 1,
						task_id: "task_1",
						timestamp: new Date().toISOString(),
						frustration_level: "high",
						frustration_score: 8,
						user_message: "This is terrible and broken",
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Test",
					},
				],
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={highFrustrationResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Recommendations");
		});
	});

	describe("MetricsDisplay - Empty Charts", () => {
		test("handles empty by_type gracefully", () => {
			const emptyTypeResult = {
				...sampleResult,
				by_type: {},
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyTypeResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			// Should not crash, just not show the chart
			expect(output).toContain("Summary Statistics");
		});

		test("handles empty tasks array gracefully", () => {
			const noTasksResult = {
				...sampleResult,
				tasks: [],
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={noTasksResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={false}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("No tasks found");
		});
	});

	describe("MetricsDisplay - Calibration Edge Cases", () => {
		test("shows well-calibrated message when no mismatches", () => {
			const wellCalibratedResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Test task",
						status: "completed",
						outcome: "success",
						confidence: 0.85,
						duration_seconds: 120,
						hooks_passed: true,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
					},
				],
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={wellCalibratedResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={true}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("Well-calibrated");
		});

		test("shows no calibration data message when no tasks with confidence", () => {
			const noConfidenceResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Test task",
						status: "active",
						outcome: undefined,
						confidence: undefined,
						duration_seconds: 120,
						hooks_passed: undefined,
						started_at: new Date().toISOString(),
						completed_at: undefined,
					},
				],
			};
			const { lastFrame } = render(
				<MetricsDisplay
					result={noConfidenceResult}
					hookStats={[]}
					sessionMetrics={{
						sessions: [],
						trends: {
							success_rate_trend: "stable",
							calibration_trend: "stable",
						},
					}}
					showCalibration={true}
				/>,
			);
			const output = lastFrame();
			expect(output).toContain("No tasks with confidence data");
		});
	});
});
