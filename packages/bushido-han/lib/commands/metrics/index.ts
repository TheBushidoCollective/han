import type { Command } from "commander";

/**
 * Register metrics command
 */
export function registerMetricsCommand(program: Command): void {
	const metricsCommand = program
		.command("metrics")
		.description("Agent metrics, session tracking, and calibration analysis");

	// Main metrics display command
	metricsCommand
		.command("show")
		.description("Display agent task metrics and calibration analysis")
		.option(
			"--period <period>",
			"Filter by time period (day, week, month)",
			validatePeriod,
		)
		.option(
			"--type <type>",
			"Filter by task type (implementation, fix, refactor, research)",
			validateTaskType,
		)
		.option("--calibration", "Show detailed calibration analysis")
		.action(
			async (options: {
				period?: "day" | "week" | "month";
				type?: "implementation" | "fix" | "refactor" | "research";
				calibration?: boolean;
			}) => {
				try {
					const { showMetrics } = await import("./show.js");
					await showMetrics({
						period: options.period,
						taskType: options.type,
						showCalibration: options.calibration,
					});
					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error displaying metrics:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);

	// Session management commands
	metricsCommand
		.command("session-start")
		.description("Start a new session or resume an existing one")
		.option("--session-id <id>", "Resume a specific session ID")
		.action(async (options: { sessionId?: string }) => {
			try {
				const { startSession } = await import("./session-tracking.js");
				await startSession(options.sessionId);
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error starting session:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	metricsCommand
		.command("session-end")
		.description("End the current session")
		.option("--session-id <id>", "End a specific session ID")
		.action(async (options: { sessionId?: string }) => {
			try {
				const { endSession } = await import("./session-tracking.js");
				await endSession(options.sessionId);
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error ending session:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	metricsCommand
		.command("session-current")
		.description("Get the current active session ID")
		.action(async () => {
			try {
				const { getCurrentSession } = await import("./session-tracking.js");
				await getCurrentSession();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error getting current session:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Hook execution tracking
	metricsCommand
		.command("hook-exec")
		.description(
			"Record hook execution (internal - called by hook dispatch, reads from stdin)",
		)
		.action(async () => {
			try {
				const { recordHookExecution } = await import("./hook-tracking.js");
				await recordHookExecution();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error recording hook execution:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Session context generation
	metricsCommand
		.command("session-context")
		.description(
			"Generate performance context for SessionStart injection (markdown output)",
		)
		.action(async () => {
			try {
				const { generateSessionContext } = await import(
					"./context-generation.js"
				);
				await generateSessionContext();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error generating session context:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Pattern detection
	metricsCommand
		.command("detect-patterns")
		.description("Detect failure patterns and generate guidance")
		.option(
			"--min-severity <level>",
			"Minimum severity level: low, medium, high",
			"medium",
		)
		.option("--json", "Output as JSON instead of markdown")
		.action(async (options: { minSeverity?: string; json?: boolean }) => {
			try {
				const { detectPatterns } = await import("./pattern-detection.js");
				await detectPatterns({
					minSeverity: options.minSeverity as
						| "low"
						| "medium"
						| "high"
						| undefined,
					json: options.json,
				});
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error detecting patterns:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Frustration detection
	metricsCommand
		.command("detect-frustration")
		.description(
			"Detect user frustration from USER_MESSAGE environment variable",
		)
		.action(async () => {
			try {
				const { detectFrustrationFromEnv } = await import(
					"./detect-frustration.js"
				);
				await detectFrustrationFromEnv();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error detecting frustration:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Default action: show metrics
	metricsCommand.action(async () => {
		try {
			const { showMetrics } = await import("./show.js");
			await showMetrics({});
			process.exit(0);
		} catch (error: unknown) {
			console.error(
				"Error displaying metrics:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});
}

/**
 * Validate period option
 */
function validatePeriod(value: string): "day" | "week" | "month" {
	if (value !== "day" && value !== "week" && value !== "month") {
		throw new Error(
			`Invalid period "${value}". Must be one of: day, week, month`,
		);
	}
	return value;
}

/**
 * Validate task type option
 */
function validateTaskType(
	value: string,
): "implementation" | "fix" | "refactor" | "research" {
	if (
		value !== "implementation" &&
		value !== "fix" &&
		value !== "refactor" &&
		value !== "research"
	) {
		throw new Error(
			`Invalid task type "${value}". Must be one of: implementation, fix, refactor, research`,
		);
	}
	return value;
}
