import type { Command } from "commander";
import { generateMemoryContext } from "../memory-context.ts";
import { generateSessionContext } from "./context-generation.ts";
import { recordHookExecution } from "./hook-tracking.ts";
import { detectPatterns } from "./pattern-detection.ts";
import {
	endSession,
	getCurrentSession,
	startSession,
} from "./session-tracking.ts";
import { showMetrics } from "./show.ts";

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

	// Memory context generation
	metricsCommand
		.command("memory-context")
		.description(
			"Generate memory context for SessionStart injection (recent work and in-progress items)",
		)
		.action(async () => {
			try {
				await generateMemoryContext();
				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error generating memory context:",
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

	// Default action: show metrics
	metricsCommand.action(async () => {
		try {
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
export function validatePeriod(value: string): "day" | "week" | "month" {
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
export function validateTaskType(
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
