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
		[
			"Frustration Events:",
			`${colors.bold}${result.total_frustrations > 0 ? colors.yellow : colors.green}${result.total_frustrations}${colors.reset}`,
		],
		[
			"Frustration Rate:",
			`${colors.bold}${result.frustration_rate > 0.3 ? colors.red : result.frustration_rate > 0.1 ? colors.yellow : colors.green}${formatPercent(result.frustration_rate)}${colors.reset}`,
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
 * Render frustration insights section
 */
function renderFrustrationInsights(result: MetricsResult): void {
	if (result.total_frustrations === 0) {
		return;
	}

	console.log(
		`${colors.bold}${colors.cyan}😤 User Frustration Analysis${colors.reset}`,
	);
	console.log();

	console.log(
		`  ${colors.dim}Total frustration events detected: ${colors.reset}${colors.bold}${result.total_frustrations > 5 ? colors.red : result.total_frustrations > 2 ? colors.yellow : colors.green}${result.total_frustrations}${colors.reset}`,
	);
	console.log(
		`  ${colors.dim}Frustration rate: ${colors.reset}${colors.bold}${result.frustration_rate > 0.3 ? colors.red : result.frustration_rate > 0.1 ? colors.yellow : colors.green}${formatPercent(result.frustration_rate)}${colors.reset} ${colors.dim}(frustrations per task)${colors.reset}`,
	);
	console.log();

	// Group by frustration level
	const byLevel: Record<string, number> = {};
	result.frustration_events.forEach((event) => {
		byLevel[event.frustration_level] =
			(byLevel[event.frustration_level] || 0) + 1;
	});

	if (Object.keys(byLevel).length > 0) {
		console.log(`${colors.bold}Frustration by Level:${colors.reset}`);
		for (const [level, count] of Object.entries(byLevel)) {
			const levelColor =
				level === "high"
					? colors.red
					: level === "moderate"
						? colors.yellow
						: colors.green;
			console.log(
				`  ${levelColor}${level.padEnd(10)}${colors.reset} ${colors.dim}${count} event${count !== 1 ? "s" : ""}${colors.reset}`,
			);
		}
		console.log();
	}

	// Show recent frustration events
	const recentFrustrations = result.frustration_events.slice(0, 5);
	if (recentFrustrations.length > 0) {
		console.log(
			`${colors.bold}Recent Frustration Events (last ${recentFrustrations.length}):${colors.reset}`,
		);
		for (const event of recentFrustrations) {
			const levelColor =
				event.frustration_level === "high"
					? colors.red
					: event.frustration_level === "moderate"
						? colors.yellow
						: colors.green;
			const message =
				event.user_message.length > 60
					? `${event.user_message.substring(0, 60)}...`
					: event.user_message;

			console.log(
				`  ${levelColor}[${event.frustration_level}]${colors.reset} ${colors.dim}${message}${colors.reset}`,
			);

			// Show detected signals
			const signals = JSON.parse(event.detected_signals);
			if (signals.length > 0) {
				console.log(
					`    ${colors.dim}Signals: ${signals.slice(0, 3).join(", ")}${signals.length > 3 ? ` +${signals.length - 3} more` : ""}${colors.reset}`,
				);
			}
		}
		console.log();
	}

	// Recommendations
	if (result.frustration_rate > 0.2) {
		console.log(
			`${colors.bold}${colors.yellow}⚠️  Recommendations:${colors.reset}`,
		);
		console.log(
			`  ${colors.dim}• High frustration rate detected - review recent interactions${colors.reset}`,
		);
		console.log(
			`  ${colors.dim}• Consider improving error messages and guidance${colors.reset}`,
		);
		console.log(
			`  ${colors.dim}• Look for patterns in frustration triggers${colors.reset}`,
		);
		console.log();
	}
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
 * Render hook failure statistics
 */
function renderHookFailureStats(
	hookStats: Array<{
		name: string;
		source: string;
		total: number;
		failures: number;
		failureRate: number;
	}>,
): void {
	if (hookStats.length === 0) {
		return;
	}

	console.log(
		`${colors.bold}${colors.cyan}🔧 Hook Failure Analysis${colors.reset}`,
	);
	console.log();

	console.log(
		`  ${colors.dim}Hooks with >20% failure rate (${hookStats.length} detected):${colors.reset}`,
	);
	console.log();

	// Header
	const headers = ["Hook Name", "Source", "Failures", "Rate"];
	const widths = [30, 20, 12, 10];
	const headerRow = headers
		.map(
			(h, i) =>
				`${colors.bold}${colors.dim}${h.padEnd(widths[i])}${colors.reset}`,
		)
		.join("");
	console.log(`  ${headerRow}`);
	console.log(`  ${colors.dim}${"─".repeat(72)}${colors.reset}`);

	// Rows
	for (const hook of hookStats) {
		const rateColor =
			hook.failureRate > 50
				? colors.red
				: hook.failureRate > 30
					? colors.yellow
					: colors.green;

		const cells = [
			hook.name.padEnd(widths[0]),
			hook.source.padEnd(widths[1]),
			`${hook.failures}/${hook.total}`.padEnd(widths[2]),
			`${rateColor}${hook.failureRate}%${colors.reset}`.padEnd(widths[3] + 10), // +10 for ANSI codes
		];

		console.log(`  ${cells.join("")}`);
	}
	console.log();

	// Recommendations
	const criticalHooks = hookStats.filter((h) => h.failureRate > 50);
	if (criticalHooks.length > 0) {
		console.log(
			`${colors.bold}${colors.red}⚠️  Critical: ${criticalHooks.length} hook${criticalHooks.length !== 1 ? "s" : ""} failing >50% of the time${colors.reset}`,
		);
		for (const hook of criticalHooks) {
			console.log(
				`  ${colors.dim}• ${hook.name}: Review and fix before continuing work${colors.reset}`,
			);
		}
		console.log();
	}
}

/**
 * Render session metrics and trends
 */
function renderSessionMetrics(sessionMetrics: {
	sessions: Array<{
		session_id: string;
		started_at: string;
		ended_at: string | null;
		duration_minutes: number | null;
		task_count: number;
		success_count: number;
		hooks_passed_count: number;
		hooks_failed_count: number;
		average_calibration: number | null;
	}>;
	trends: {
		calibration_trend: "improving" | "declining" | "stable";
		success_rate_trend: "improving" | "declining" | "stable";
	};
}): void {
	if (sessionMetrics.sessions.length === 0) {
		return;
	}

	console.log(
		`${colors.bold}${colors.cyan}📊 Session Performance & Trends${colors.reset}`,
	);
	console.log();

	// Trends
	const calibTrendIcon =
		sessionMetrics.trends.calibration_trend === "improving"
			? `${colors.green}↗${colors.reset}`
			: sessionMetrics.trends.calibration_trend === "declining"
				? `${colors.red}↘${colors.reset}`
				: `${colors.yellow}→${colors.reset}`;

	const successTrendIcon =
		sessionMetrics.trends.success_rate_trend === "improving"
			? `${colors.green}↗${colors.reset}`
			: sessionMetrics.trends.success_rate_trend === "declining"
				? `${colors.red}↘${colors.reset}`
				: `${colors.yellow}→${colors.reset}`;

	console.log(
		`  ${colors.dim}Calibration Trend:${colors.reset} ${calibTrendIcon} ${sessionMetrics.trends.calibration_trend}`,
	);
	console.log(
		`  ${colors.dim}Success Rate Trend:${colors.reset} ${successTrendIcon} ${sessionMetrics.trends.success_rate_trend}`,
	);
	console.log();

	// Recent sessions table
	console.log(
		`${colors.bold}Recent Sessions (last ${sessionMetrics.sessions.length}):${colors.reset}`,
	);
	console.log();

	// Header
	const headers = ["Duration", "Tasks", "Success", "Hooks", "Calibration"];
	const widths = [12, 10, 12, 12, 14];
	const headerRow = headers
		.map(
			(h, i) =>
				`${colors.bold}${colors.dim}${h.padEnd(widths[i])}${colors.reset}`,
		)
		.join("");
	console.log(`  ${headerRow}`);
	console.log(`  ${colors.dim}${"─".repeat(60)}${colors.reset}`);

	// Rows
	for (const session of sessionMetrics.sessions.slice(0, 5)) {
		const successRate =
			session.task_count > 0
				? Math.round((session.success_count / session.task_count) * 100)
				: 0;

		const successColor =
			successRate > 70
				? colors.green
				: successRate > 40
					? colors.yellow
					: colors.red;

		const hookStatus =
			session.hooks_failed_count === 0
				? `${colors.green}✓${colors.reset}`
				: `${colors.red}${session.hooks_failed_count} failed${colors.reset}`;

		const cells = [
			(session.duration_minutes
				? `${session.duration_minutes}m`
				: "active"
			).padEnd(widths[0]),
			session.task_count.toString().padEnd(widths[1]),
			`${successColor}${successRate}%${colors.reset}`.padEnd(widths[2] + 10),
			hookStatus.padEnd(widths[3] + 10),
			(session.average_calibration
				? formatPercent(session.average_calibration)
				: "—"
			).padEnd(widths[4]),
		];

		console.log(`  ${cells.join("")}`);
	}
	console.log();
}

/**
 * Render plain text metrics display (for compiled binaries where Ink doesn't work)
 */
export function renderPlainText(
	result: MetricsResult,
	hookStats: Array<{
		name: string;
		source: string;
		total: number;
		failures: number;
		failureRate: number;
	}>,
	sessionMetrics: {
		sessions: Array<{
			session_id: string;
			started_at: string;
			ended_at: string | null;
			duration_minutes: number | null;
			task_count: number;
			success_count: number;
			hooks_passed_count: number;
			hooks_failed_count: number;
			average_calibration: number | null;
		}>;
		trends: {
			calibration_trend: "improving" | "declining" | "stable";
			success_rate_trend: "improving" | "declining" | "stable";
		};
	},
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

	// Session Performance & Trends
	renderSessionMetrics(sessionMetrics);

	// Hook Failure Analysis
	renderHookFailureStats(hookStats);

	// Charts
	if (Object.keys(result.by_type).length > 0) {
		renderTaskTypeChart(result);
	}
	if (Object.keys(result.by_outcome).length > 0) {
		renderTaskOutcomeChart(result);
	}

	// Recent Tasks Table
	renderRecentTasksTable(result);

	// Frustration Insights
	if (result.total_frustrations > 0) {
		renderFrustrationInsights(result);
	}

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
