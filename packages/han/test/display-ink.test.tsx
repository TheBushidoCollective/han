/**
 * Tests for commands/metrics/display.tsx
 * Tests the Ink UI components using ink-testing-library
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { MetricsDisplay } from "../lib/commands/metrics/display.tsx";
import type { MetricsResult } from "../lib/metrics/types.ts";

const emptyResult: MetricsResult = {
	total_tasks: 0,
	completed_tasks: 0,
	success_rate: 0,
	average_confidence: 0,
	calibration_score: 0,
	average_duration_seconds: 0,
	total_frustrations: 0,
	frustration_rate: 0,
	by_type: {},
	by_outcome: {},
	tasks: [],
	frustration_events: [],
};

const sampleResult: MetricsResult = {
	total_tasks: 15,
	completed_tasks: 12,
	success_rate: 0.8,
	average_confidence: 0.75,
	calibration_score: 0.85,
	average_duration_seconds: 180,
	total_frustrations: 0,
	frustration_rate: 0,
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
			id: "task-1",
			description: "Add user authentication",
			type: "implementation",
			status: "completed",
			outcome: "success",
			confidence: 0.85,
			duration_seconds: 240,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
			hooks_passed: true,
		},
		{
			id: "task-2",
			description: "Fix login bug",
			type: "fix",
			status: "completed",
			outcome: "failure",
			confidence: 0.9,
			duration_seconds: 120,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
			hooks_passed: false,
		},
		{
			id: "task-3",
			description: "Refactor auth module",
			type: "refactor",
			status: "completed",
			outcome: "partial",
			confidence: 0.6,
			duration_seconds: 300,
			started_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
			hooks_passed: undefined,
		},
	],
	frustration_events: [],
};

const emptySessionMetrics = {
	sessions: [],
	trends: {
		success_rate_trend: "stable" as const,
		calibration_trend: "stable" as const,
	},
};

const emptyAllHookStats = {
	totalExecutions: 0,
	totalPassed: 0,
	totalFailed: 0,
	passRate: 0,
	uniqueHooks: 0,
	byHookType: {},
};

describe("MetricsDisplay component", () => {
	describe("no data state", () => {
		test("renders no metrics message when empty", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("No metrics tracked yet");
			expect(lastFrame()).toContain("MCP tools in the core plugin");
			expect(lastFrame()).toContain("Hook executions and task data");
		});

		test("renders dashboard header", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Agent Metrics Dashboard");
		});
	});

	describe("with data", () => {
		test("renders summary statistics", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Summary Statistics");
			expect(lastFrame()).toContain("Total Tasks:");
			expect(lastFrame()).toContain("15");
			expect(lastFrame()).toContain("Success Rate:");
			expect(lastFrame()).toContain("80%");
		});

		test("renders task type chart", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Tasks by Type");
			expect(lastFrame()).toContain("implementation");
		});

		test("renders task outcome chart", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Tasks by Outcome");
			expect(lastFrame()).toContain("success");
		});

		test("renders recent tasks table", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Recent Tasks");
			expect(lastFrame()).toContain("implementation");
		});

		test("shows calibration tip when not showing calibration", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("han metrics show --calibration");
		});
	});

	describe("calibration display", () => {
		test("renders calibration analysis when showCalibration is true", () => {
			const { lastFrame } = render(
				<MetricsDisplay
					result={sampleResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Calibration Analysis");
		});

		test("shows overconfident tasks", () => {
			const overconfidentResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task-1",
						description: "Failed with high confidence",
						type: "implementation",
						status: "completed",
						outcome: "failure",
						confidence: 0.95,
						duration_seconds: 120,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
						hooks_passed: false,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={overconfidentResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Overconfident Tasks");
		});

		test("shows underconfident tasks", () => {
			const underconfidentResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task-1",
						description: "Succeeded with low confidence",
						type: "implementation",
						status: "completed",
						outcome: "success",
						confidence: 0.3,
						duration_seconds: 120,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
						hooks_passed: true,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={underconfidentResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Underconfident Tasks");
		});

		test("shows well-calibrated message when no calibration issues", () => {
			const wellCalibratedResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task-1",
						description: "Success with appropriate confidence",
						type: "implementation",
						status: "completed",
						outcome: "success",
						confidence: 0.85,
						duration_seconds: 120,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
						hooks_passed: true,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={wellCalibratedResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Well-calibrated");
		});

		test("shows no confidence data message", () => {
			const noConfidenceResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task-1",
						description: "Task without confidence",
						type: "implementation",
						status: "active",
						outcome: undefined,
						confidence: undefined,
						duration_seconds: 120,
						started_at: new Date().toISOString(),
						completed_at: undefined,
						hooks_passed: undefined,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={noConfidenceResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("No tasks with confidence data");
		});
	});

	describe("frustration display", () => {
		test("renders frustration insights when frustrations exist", () => {
			const frustrationResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 3,
				frustration_rate: 0.2,
				frustration_events: [
					{
						id: 1,
						timestamp: new Date().toISOString(),
						user_message: "This is frustrating",
						frustration_level: "high",
						frustration_score: 8,
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Testing",
						task_id: "task-1",
					},
					{
						id: 2,
						timestamp: new Date().toISOString(),
						user_message: "Somewhat annoying",
						frustration_level: "moderate",
						frustration_score: 5,
						detected_signals: JSON.stringify(["repeated request"]),
						context: "Testing",
						task_id: "task-2",
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={frustrationResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("User Frustration Analysis");
			expect(lastFrame()).toContain("frustration events detected");
		});

		test("shows recommendations for high frustration rate", () => {
			const highFrustrationResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 10,
				frustration_rate: 0.4,
				frustration_events: [
					{
						id: 1,
						timestamp: new Date().toISOString(),
						user_message: "Very frustrating experience",
						frustration_level: "high",
						frustration_score: 9,
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Testing",
						task_id: undefined,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={highFrustrationResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Recommendations");
		});

		test("does not show frustration section when no frustrations", () => {
			const noFrustrationResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 0,
				frustration_rate: 0,
				frustration_events: [],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={noFrustrationResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).not.toContain("User Frustration Analysis");
		});
	});

	describe("edge cases", () => {
		test("handles empty tasks array", () => {
			const noTasksResult: MetricsResult = {
				...sampleResult,
				tasks: [],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={noTasksResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("No tasks found");
		});

		test("handles empty by_type", () => {
			const emptyTypeResult: MetricsResult = {
				...sampleResult,
				by_type: {},
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyTypeResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			// Should not crash
			expect(lastFrame()).toContain("Summary Statistics");
		});

		test("handles empty by_outcome", () => {
			const emptyOutcomeResult: MetricsResult = {
				...sampleResult,
				by_outcome: {},
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={emptyOutcomeResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			// Should not crash
			expect(lastFrame()).toContain("Summary Statistics");
		});

		test("handles tasks with undefined values", () => {
			const undefinedTasksResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task-1",
						description: "Task with undefined values",
						type: "fix",
						status: "active",
						outcome: undefined,
						confidence: undefined,
						duration_seconds: undefined,
						started_at: new Date().toISOString(),
						completed_at: undefined,
						hooks_passed: undefined,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={undefinedTasksResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			// Should render the task table
			expect(lastFrame()).toContain("Recent Tasks");
		});

		test("formats short duration correctly", () => {
			const shortDurationResult: MetricsResult = {
				...sampleResult,
				average_duration_seconds: 45,
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={shortDurationResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("45s");
		});

		test("formats hour duration correctly", () => {
			const hourDurationResult: MetricsResult = {
				...sampleResult,
				average_duration_seconds: 7200,
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={hourDurationResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("2h");
		});

		test("handles many overconfident tasks with truncation", () => {
			const manyOverconfident = Array.from({ length: 10 }, (_, i) => ({
				id: `task-${i}`,
				description: `Overconfident task ${i} with a very long description that goes on and on`,
				type: "fix" as const,
				status: "completed" as const,
				outcome: "failure" as const,
				confidence: 0.95,
				duration_seconds: 60,
				started_at: new Date().toISOString(),
				completed_at: new Date().toISOString(),
				hooks_passed: false,
			}));

			const manyOverconfidentResult: MetricsResult = {
				...sampleResult,
				tasks: manyOverconfident,
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={manyOverconfidentResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={true}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("Overconfident Tasks");
			expect(lastFrame()).toContain("... and");
		});

		test("handles frustration events with many signals", () => {
			const manySignalsResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 1,
				frustration_rate: 0.1,
				frustration_events: [
					{
						id: 1,
						timestamp: new Date().toISOString(),
						user_message: "Frustrating",
						frustration_level: "high",
						frustration_score: 8,
						detected_signals: JSON.stringify([
							"signal1",
							"signal2",
							"signal3",
							"signal4",
							"signal5",
						]),
						context: "Testing",
						task_id: undefined,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={manySignalsResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("+2 more");
		});

		test("truncates long frustration messages", () => {
			const longMessageResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 1,
				frustration_rate: 0.1,
				frustration_events: [
					{
						id: 1,
						timestamp: new Date().toISOString(),
						user_message:
							"This is a very very very long frustration message that exceeds the sixty character limit and should be truncated",
						frustration_level: "moderate",
						frustration_score: 5,
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Testing",
						task_id: undefined,
					},
				],
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={longMessageResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("...");
		});
	});

	describe("bar chart edge cases", () => {
		test("handles zero max value in bar chart", () => {
			const zeroMaxResult: MetricsResult = {
				...sampleResult,
				by_type: { fix: 0, implementation: 0 },
				by_outcome: { success: 0 },
			};

			const { lastFrame } = render(
				<MetricsDisplay
					result={zeroMaxResult}
					hookStats={[]}
					sessionMetrics={emptySessionMetrics}
					showCalibration={false}
					allHookStats={emptyAllHookStats}
				/>,
			);

			expect(lastFrame()).toContain("No data available");
		});
	});
});
