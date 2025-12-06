import type { MetricsResult } from "../../metrics/types.js";

/**
 * ANSI color codes
 */
const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
};

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${Math.round(seconds)}s`;
	}
	if (seconds < 3600) {
		const minutes = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return `${minutes}m ${secs}s`;
	}
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

/**
 * Create a simple bar chart using Unicode characters
 */
function renderBarChart(data: Record<string, number>, maxWidth = 40): void {
	const entries = Object.entries(data);
	if (entries.length === 0) {
		console.log(`  ${colors.dim}No data available${colors.reset}`);
		return;
	}

	const maxValue = Math.max(...entries.map(([, value]) => value));
	if (maxValue === 0) {
		console.log(`  ${colors.dim}No data available${colors.reset}`);
		return;
	}

	for (const [label, value] of entries) {
		const barWidth = Math.round((value / maxValue) * maxWidth);
		const bar = "█".repeat(barWidth);
		const paddedLabel = label.padEnd(20);
		console.log(
			`  ${paddedLabel}  ${colors.cyan}${bar}${colors.reset}${colors.dim} ${value}${colors.reset}`,
		);
	}
}

/**
 * Render summary stats section
 */
function renderSummaryStats(result: MetricsResult): void {
	console.log(
		`${colors.bold}${colors.cyan}📊 Summary Statistics${colors.reset}`,
	);
	console.log();

	const stats = [
		["Total Tasks:", result.total_tasks.toString()],
		["Completed Tasks:", result.completed_tasks.toString()],
		[
			"Success Rate:",
			`${colors.bold}${result.success_rate > 0.7 ? colors.green : colors.yellow}${formatPercent(result.success_rate)}${colors.reset}`,
		],
		[
			"Average Confidence:",
			`${colors.bold}${formatPercent(result.average_confidence)}${colors.reset}`,
		],
		[
			"Calibration Score:",
			`${colors.bold}${result.calibration_score > 0.7 ? colors.green : colors.yellow}${formatPercent(result.calibration_score)}${colors.reset}`,
		],
		[
			"Average Duration:",
			`${colors.bold}${formatDuration(result.average_duration_seconds)}${colors.reset}`,
		],
	];

	for (const [label, value] of stats) {
		console.log(`  ${colors.dim}${label.padEnd(25)}${colors.reset}${value}`);
	}
	console.log();
}

/**
 * Render task type distribution chart
 */
function renderTaskTypeChart(result: MetricsResult): void {
	console.log(`${colors.bold}${colors.cyan}📈 Tasks by Type${colors.reset}`);
	console.log();
	renderBarChart(result.by_type);
	console.log();
}

/**
 * Render task outcome distribution chart
 */
function renderTaskOutcomeChart(result: MetricsResult): void {
	console.log(`${colors.bold}${colors.cyan}✅ Tasks by Outcome${colors.reset}`);
	console.log();
	renderBarChart(result.by_outcome);
	console.log();

	const coloredData = Object.entries(result.by_outcome);
	if (coloredData.length > 0) {
		const outcomes = coloredData.map(([outcome, count]) => {
			const color =
				outcome === "success"
					? colors.green
					: outcome === "failure"
						? colors.red
						: colors.yellow;
			const symbol =
				outcome === "success" ? "✓" : outcome === "failure" ? "✗" : "◐";
			return `  ${color}${symbol}${colors.reset} ${colors.dim}${outcome}: ${colors.reset}${count}`;
		});
		console.log(outcomes.join("   "));
		console.log();
	}
}

/**
 * Render recent tasks table
 */
function renderRecentTasksTable(result: MetricsResult): void {
	const recentTasks = result.tasks.slice(0, 10);

	console.log(
		`${colors.bold}${colors.cyan}📋 Recent Tasks (last ${recentTasks.length})${colors.reset}`,
	);
	console.log();

	if (recentTasks.length === 0) {
		console.log(`  ${colors.dim}No tasks found${colors.reset}`);
		console.log();
		return;
	}

	// Header
	const headers = ["Type", "Outcome", "Confidence", "Duration", "Hooks"];
	const widths = [18, 12, 14, 12, 12];
	const headerRow = headers
		.map(
			(h, i) =>
				`${colors.bold}${colors.dim}${h.padEnd(widths[i])}${colors.reset}`,
		)
		.join("");
	console.log(`  ${headerRow}`);
	console.log(`  ${colors.dim}${"─".repeat(68)}${colors.reset}`);

	// Rows
	for (const task of recentTasks) {
		const outcomeColor =
			task.outcome === "success"
				? colors.green
				: task.outcome === "failure"
					? colors.red
					: task.outcome === "partial"
						? colors.yellow
						: "";

		const hooksColor =
			task.hooks_passed === true
				? colors.green
				: task.hooks_passed === false
					? colors.red
					: "";

		const cells = [
			task.type.padEnd(widths[0]),
			`${outcomeColor}${(task.outcome || "—").padEnd(widths[1])}${colors.reset}`,
			(task.confidence ? formatPercent(task.confidence) : "—").padEnd(
				widths[2],
			),
			(task.duration_seconds
				? formatDuration(task.duration_seconds)
				: "—"
			).padEnd(widths[3]),
			`${hooksColor}${(task.hooks_passed === true ? "✓" : task.hooks_passed === false ? "✗" : "—").padEnd(widths[4])}${colors.reset}`,
		];

		console.log(`  ${cells.join("")}`);
	}
	console.log();
}

/**
 * Render calibration insights section
 */
function renderCalibrationInsights(result: MetricsResult): void {
	console.log(
		`${colors.bold}${colors.cyan}🎯 Calibration Analysis${colors.reset}`,
	);
	console.log();

	const tasksWithCalibration = result.tasks.filter(
		(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
	);

	if (tasksWithCalibration.length === 0) {
		console.log(
			`  ${colors.dim}No tasks with confidence data yet${colors.reset}`,
		);
		console.log();
		return;
	}

	console.log(
		`  ${colors.dim}Calibration measures how well confidence matches actual outcomes.${colors.reset}`,
	);
	console.log(
		`  ${colors.dim}Score: ${colors.reset}${colors.bold}${result.calibration_score > 0.7 ? colors.green : colors.yellow}${formatPercent(result.calibration_score)}${colors.reset} ${colors.dim}(${result.calibration_score > 0.7 ? "Good" : "Needs improvement"})${colors.reset}`,
	);
	console.log();

	// Find overconfident tasks (high confidence but failed)
	const overconfident = tasksWithCalibration.filter(
		(t) => (t.confidence ?? 0) > 0.7 && t.outcome === "failure",
	);

	// Find underconfident tasks (low confidence but succeeded)
	const underconfident = tasksWithCalibration.filter(
		(t) => (t.confidence ?? 0) < 0.5 && t.outcome === "success",
	);

	if (overconfident.length > 0) {
		console.log(
			`${colors.bold}${colors.red}⚠️  Overconfident Tasks (${overconfident.length})${colors.reset}`,
		);
		console.log(
			`${colors.dim}High confidence but failed - consider being more cautious:${colors.reset}`,
		);
		for (const task of overconfident.slice(0, 5)) {
			const desc =
				task.description.length > 50
					? `${task.description.substring(0, 50)}...`
					: task.description;
			console.log(
				`  ${colors.dim}• ${task.type}: ${desc} (conf: ${formatPercent(task.confidence ?? 0)})${colors.reset}`,
			);
		}
		if (overconfident.length > 5) {
			console.log(
				`  ${colors.dim}... and ${overconfident.length - 5} more${colors.reset}`,
			);
		}
		console.log();
	}

	if (underconfident.length > 0) {
		console.log(
			`${colors.bold}${colors.yellow}💪 Underconfident Tasks (${underconfident.length})${colors.reset}`,
		);
		console.log(
			`${colors.dim}Low confidence but succeeded - you're more capable than you think:${colors.reset}`,
		);
		for (const task of underconfident.slice(0, 5)) {
			const desc =
				task.description.length > 50
					? `${task.description.substring(0, 50)}...`
					: task.description;
			console.log(
				`  ${colors.dim}• ${task.type}: ${desc} (conf: ${formatPercent(task.confidence ?? 0)})${colors.reset}`,
			);
		}
		if (underconfident.length > 5) {
			console.log(
				`  ${colors.dim}... and ${underconfident.length - 5} more${colors.reset}`,
			);
		}
		console.log();
	}

	if (overconfident.length === 0 && underconfident.length === 0) {
		console.log(
			`  ${colors.green}✓ Well-calibrated! Confidence matches outcomes.${colors.reset}`,
		);
		console.log();
	}
}

/**
 * Render plain text metrics display (for compiled binaries where Ink doesn't work)
 */
export function renderPlainText(
	result: MetricsResult,
	showCalibration: boolean,
): void {
	const hasData = result.total_tasks > 0;

	// Header
	console.log();
	console.log(
		`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}`,
	);
	console.log(
		`${colors.bold}${colors.cyan}🤖 Agent Task Metrics Dashboard${colors.reset}`,
	);
	console.log(
		`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}`,
	);
	console.log();

	// No data message
	if (!hasData) {
		console.log(
			`${colors.bold}${colors.yellow}⚠️  No metrics tracked yet${colors.reset}`,
		);
		console.log();
		console.log(
			`  ${colors.dim}Agent task metrics will appear here once you start using the${colors.reset}`,
		);
		console.log(
			`  ${colors.dim}hashi-han-metrics plugin to track your work.${colors.reset}`,
		);
		console.log();
		console.log(
			`  ${colors.dim}Install it with: ${colors.reset}${colors.bold}han plugin install hashi-han-metrics${colors.reset}`,
		);
		console.log();
		return;
	}

	// Summary Stats
	renderSummaryStats(result);

	// Charts
	if (Object.keys(result.by_type).length > 0) {
		renderTaskTypeChart(result);
	}
	if (Object.keys(result.by_outcome).length > 0) {
		renderTaskOutcomeChart(result);
	}

	// Recent Tasks Table
	renderRecentTasksTable(result);

	// Calibration Insights (optional)
	if (showCalibration) {
		renderCalibrationInsights(result);
	}

	// Footer
	if (!showCalibration) {
		console.log(
			`${colors.dim}Tip: Use --calibration to see detailed calibration analysis${colors.reset}`,
		);
		console.log();
	}
}
