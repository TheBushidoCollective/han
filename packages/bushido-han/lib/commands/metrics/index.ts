import type { Command } from "commander";

/**
 * Register metrics command
 */
export function registerMetricsCommand(program: Command): void {
	program
		.command("metrics")
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
