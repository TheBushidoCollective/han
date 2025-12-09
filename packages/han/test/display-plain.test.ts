/**
 * Tests for commands/metrics/display-plain.ts
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { renderPlainText } from "../lib/commands/metrics/display-plain.ts";
import type { MetricsResult } from "../lib/metrics/types.ts";

describe("display-plain.ts", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];

	beforeEach(() => {
		logs = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

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
		],
		frustration_events: [
			{
				id: 1,
				task_id: "task_2",
				timestamp: new Date().toISOString(),
				frustration_level: "moderate",
				frustration_score: 6,
				user_message: "This keeps failing",
				detected_signals: JSON.stringify(["negative sentiment"]),
				context: "Login bug",
			},
		],
	};

	const emptySessionMetrics = {
		sessions: [],
		trends: {
			success_rate_trend: "stable" as const,
			calibration_trend: "stable" as const,
		},
	};

	describe("renderPlainText - No Data", () => {
		test("shows no data message when empty", () => {
			renderPlainText(emptyResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No metrics tracked yet");
			expect(allLogs).toContain("han plugin install hashi-han-metrics");
		});

		test("shows header", () => {
			renderPlainText(emptyResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Agent Task Metrics Dashboard");
		});
	});

	describe("renderPlainText - With Data", () => {
		test("renders summary statistics", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Summary Statistics");
			expect(allLogs).toContain("Total Tasks:");
			expect(allLogs).toContain("15");
			expect(allLogs).toContain("Success Rate:");
			expect(allLogs).toContain("80%");
			expect(allLogs).toContain("Calibration Score:");
			expect(allLogs).toContain("85%");
		});

		test("renders tasks by type chart", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Tasks by Type");
			expect(allLogs).toContain("implementation");
			expect(allLogs).toContain("fix");
		});

		test("renders tasks by outcome chart", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Tasks by Outcome");
			expect(allLogs).toContain("success");
		});

		test("renders recent tasks table", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Recent Tasks");
			expect(allLogs).toContain("implementation");
			expect(allLogs).toContain("fix");
		});

		test("renders frustration insights when present", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("User Frustration Analysis");
			expect(allLogs).toContain("frustration events detected");
		});

		test("hides calibration by default", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("han metrics show --calibration");
		});

		test("shows calibration when enabled", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, true);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Calibration Analysis");
		});
	});

	describe("renderPlainText - Duration Formatting", () => {
		test("formats seconds correctly", () => {
			const shortResult = {
				...sampleResult,
				average_duration_seconds: 45,
			};
			renderPlainText(shortResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("45s");
		});

		test("formats minutes correctly", () => {
			renderPlainText(sampleResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("3m");
		});

		test("formats hours correctly", () => {
			const longResult = {
				...sampleResult,
				average_duration_seconds: 7200,
			};
			renderPlainText(longResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("2h");
		});
	});

	describe("renderPlainText - Hook Stats", () => {
		test("renders hook failure analysis", () => {
			const hookStats = [
				{
					name: "jutsu-typescript",
					source: "plugin",
					total: 10,
					failures: 6,
					failureRate: 60,
				},
			];

			renderPlainText(sampleResult, hookStats, emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Hook Failure Analysis");
			expect(allLogs).toContain("jutsu-typescript");
			expect(allLogs).toContain("60%");
		});

		test("shows critical warning for high failure hooks", () => {
			const hookStats = [
				{
					name: "failing-hook",
					source: "plugin",
					total: 10,
					failures: 8,
					failureRate: 80,
				},
			];

			renderPlainText(sampleResult, hookStats, emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Critical");
			expect(allLogs).toContain(">50%");
		});
	});

	describe("renderPlainText - Session Metrics", () => {
		test("renders session performance section", () => {
			const sessionMetrics = {
				sessions: [
					{
						session_id: "session-1",
						started_at: new Date().toISOString(),
						ended_at: new Date().toISOString(),
						duration_minutes: 30,
						task_count: 5,
						success_count: 4,
						hooks_passed_count: 5,
						hooks_failed_count: 0,
						average_calibration: 0.85,
					},
				],
				trends: {
					success_rate_trend: "improving" as const,
					calibration_trend: "stable" as const,
				},
			};

			renderPlainText(sampleResult, [], sessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Session Performance");
			expect(allLogs).toContain("Calibration Trend");
			expect(allLogs).toContain("Success Rate Trend");
		});

		test("shows trend indicators", () => {
			const sessionMetrics = {
				sessions: [
					{
						session_id: "session-1",
						started_at: new Date().toISOString(),
						ended_at: null,
						duration_minutes: null,
						task_count: 3,
						success_count: 2,
						hooks_passed_count: 3,
						hooks_failed_count: 0,
						average_calibration: 0.75,
					},
				],
				trends: {
					success_rate_trend: "declining" as const,
					calibration_trend: "improving" as const,
				},
			};

			renderPlainText(sampleResult, [], sessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("improving");
			expect(allLogs).toContain("declining");
		});
	});

	describe("renderPlainText - Calibration", () => {
		test("shows overconfident tasks", () => {
			const overconfidentResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Failed with high confidence",
						status: "completed",
						outcome: "failure",
						confidence: 0.95,
						duration_seconds: 120,
						hooks_passed: false,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
					},
				],
			};

			renderPlainText(overconfidentResult, [], emptySessionMetrics, true);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Overconfident Tasks");
		});

		test("shows underconfident tasks", () => {
			const underconfidentResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Succeeded with low confidence",
						status: "completed",
						outcome: "success",
						confidence: 0.3,
						duration_seconds: 120,
						hooks_passed: true,
						started_at: new Date().toISOString(),
						completed_at: new Date().toISOString(),
					},
				],
			};

			renderPlainText(underconfidentResult, [], emptySessionMetrics, true);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Underconfident Tasks");
		});

		test("shows well-calibrated message when no mismatches", () => {
			const wellCalibratedResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Success with appropriate confidence",
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

			renderPlainText(wellCalibratedResult, [], emptySessionMetrics, true);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Well-calibrated");
		});
	});

	describe("renderPlainText - Frustration", () => {
		test("does not show frustration section when no frustrations", () => {
			const noFrustrationResult = {
				...sampleResult,
				total_frustrations: 0,
				frustration_rate: 0,
				frustration_events: [],
			};

			renderPlainText(noFrustrationResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).not.toContain("User Frustration Analysis");
		});

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
						user_message: "This is very frustrating",
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Test",
					},
				],
			};

			renderPlainText(highFrustrationResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Recommendations");
		});

		test("groups frustration by level", () => {
			const mixedFrustrationResult: MetricsResult = {
				...sampleResult,
				total_frustrations: 3,
				frustration_rate: 0.2,
				frustration_events: [
					{
						id: 1,
						task_id: "task_1",
						timestamp: new Date().toISOString(),
						frustration_level: "high",
						frustration_score: 8,
						user_message: "High frustration",
						detected_signals: JSON.stringify(["negative sentiment"]),
						context: "Test",
					},
					{
						id: 2,
						task_id: "task_2",
						timestamp: new Date().toISOString(),
						frustration_level: "moderate",
						frustration_score: 5,
						user_message: "Moderate frustration",
						detected_signals: JSON.stringify(["repeated request"]),
						context: "Test",
					},
					{
						id: 3,
						task_id: "task_3",
						timestamp: new Date().toISOString(),
						frustration_level: "low",
						frustration_score: 3,
						user_message: "Low frustration",
						detected_signals: JSON.stringify(["mild concern"]),
						context: "Test",
					},
				],
			};

			renderPlainText(mixedFrustrationResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Frustration by Level");
			expect(allLogs).toContain("high");
			expect(allLogs).toContain("moderate");
			expect(allLogs).toContain("low");
		});
	});

	describe("renderPlainText - Edge Cases", () => {
		test("handles empty by_type gracefully", () => {
			const emptyTypeResult = {
				...sampleResult,
				by_type: {},
			};

			renderPlainText(emptyTypeResult, [], emptySessionMetrics, false);

			// Should not crash
			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Summary Statistics");
		});

		test("handles empty tasks array gracefully", () => {
			const noTasksResult = {
				...sampleResult,
				tasks: [],
			};

			renderPlainText(noTasksResult, [], emptySessionMetrics, false);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No tasks found");
		});

		test("handles tasks without confidence data in calibration", () => {
			const noConfidenceResult: MetricsResult = {
				...sampleResult,
				tasks: [
					{
						id: "task_1",
						type: "implementation",
						description: "Task without confidence",
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

			renderPlainText(noConfidenceResult, [], emptySessionMetrics, true);

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("No tasks with confidence data");
		});
	});
});
