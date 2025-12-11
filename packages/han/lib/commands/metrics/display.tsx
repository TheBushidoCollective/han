import { Box, Text } from "ink";
import type React from "react";
import type { MetricsResult } from "../../metrics/types.ts";

interface HookFailureStat {
	name: string;
	source: string;
	total: number;
	failures: number;
	failureRate: number;
}

interface AllHookStats {
	totalExecutions: number;
	totalPassed: number;
	totalFailed: number;
	passRate: number;
	uniqueHooks: number;
	byHookType: Record<string, { total: number; passed: number }>;
}

interface SessionMetrics {
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
		success_rate_trend: "improving" | "declining" | "stable";
		calibration_trend: "improving" | "declining" | "stable";
	};
}

interface MetricsDisplayProps {
	result: MetricsResult;
	hookStats: HookFailureStat[];
	allHookStats: AllHookStats;
	sessionMetrics: SessionMetrics;
	showCalibration: boolean;
}

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
function BarChart({
	data,
	maxWidth = 40,
}: {
	data: Record<string, number>;
	maxWidth?: number;
}) {
	const entries = Object.entries(data);
	if (entries.length === 0) {
		return <Text dimColor>No data available</Text>;
	}

	const maxValue = Math.max(...entries.map(([, value]) => value));
	if (maxValue === 0) {
		return <Text dimColor>No data available</Text>;
	}

	return (
		<Box flexDirection="column">
			{entries.map(([label, value]) => {
				const barWidth = Math.round((value / maxValue) * maxWidth);
				const bar = "█".repeat(barWidth);
				return (
					<Box key={label}>
						<Box width={20}>
							<Text>{label}</Text>
						</Box>
						<Box marginLeft={2}>
							<Text color="cyan">{bar}</Text>
							<Text dimColor> {value}</Text>
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}

/**
 * Summary stats section
 */
function SummaryStats({ result }: { result: MetricsResult }) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				📊 Summary Statistics
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Box>
					<Box width={25}>
						<Text dimColor>Total Tasks:</Text>
					</Box>
					<Text bold>{result.total_tasks}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Completed Tasks:</Text>
					</Box>
					<Text bold>{result.completed_tasks}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Success Rate:</Text>
					</Box>
					<Text bold color={result.success_rate > 0.7 ? "green" : "yellow"}>
						{formatPercent(result.success_rate)}
					</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Average Confidence:</Text>
					</Box>
					<Text bold>{formatPercent(result.average_confidence)}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Calibration Score:</Text>
					</Box>
					<Text
						bold
						color={result.calibration_score > 0.7 ? "green" : "yellow"}
					>
						{formatPercent(result.calibration_score)}
					</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Average Duration:</Text>
					</Box>
					<Text bold>{formatDuration(result.average_duration_seconds)}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Frustration Events:</Text>
					</Box>
					<Text bold color={result.total_frustrations > 0 ? "yellow" : "green"}>
						{result.total_frustrations}
					</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Frustration Rate:</Text>
					</Box>
					<Text
						bold
						color={
							result.frustration_rate > 0.3
								? "red"
								: result.frustration_rate > 0.1
									? "yellow"
									: "green"
						}
					>
						{formatPercent(result.frustration_rate)}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

/**
 * Task type distribution chart
 */
function TaskTypeChart({ result }: { result: MetricsResult }) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				📈 Tasks by Type
			</Text>
			<Box marginTop={1}>
				<BarChart data={result.by_type} />
			</Box>
		</Box>
	);
}

/**
 * Task outcome distribution chart
 */
function TaskOutcomeChart({ result }: { result: MetricsResult }) {
	const coloredData = Object.entries(result.by_outcome);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				✅ Tasks by Outcome
			</Text>
			<Box marginTop={1}>
				<BarChart data={result.by_outcome} />
			</Box>
			{coloredData.length > 0 && (
				<Box marginTop={1}>
					{coloredData.map(([outcome, count]) => (
						<Box key={outcome} marginRight={3}>
							<Text
								color={
									outcome === "success"
										? "green"
										: outcome === "failure"
											? "red"
											: "yellow"
								}
							>
								{outcome === "success" && "✓"}
								{outcome === "failure" && "✗"}
								{outcome === "partial" && "◐"}
							</Text>
							<Text dimColor> {outcome}: </Text>
							<Text>{count}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}

/**
 * Recent tasks table
 */
function RecentTasksTable({ result }: { result: MetricsResult }) {
	const recentTasks = result.tasks.slice(0, 10);

	if (recentTasks.length === 0) {
		return (
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="cyan">
					📋 Recent Tasks
				</Text>
				<Box marginTop={1}>
					<Text dimColor>No tasks found</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				📋 Recent Tasks (last {recentTasks.length})
			</Text>
			<Box marginTop={1} flexDirection="column">
				{/* Header */}
				<Box>
					<Box width={18}>
						<Text bold dimColor>
							Type
						</Text>
					</Box>
					<Box width={12}>
						<Text bold dimColor>
							Outcome
						</Text>
					</Box>
					<Box width={14}>
						<Text bold dimColor>
							Confidence
						</Text>
					</Box>
					<Box width={12}>
						<Text bold dimColor>
							Duration
						</Text>
					</Box>
					<Box width={12}>
						<Text bold dimColor>
							Hooks
						</Text>
					</Box>
				</Box>

				{/* Divider */}
				<Box>
					<Text dimColor>{"─".repeat(68)}</Text>
				</Box>

				{/* Rows */}
				{recentTasks.map((task) => (
					<Box key={task.id}>
						<Box width={18}>
							<Text>{task.type}</Text>
						</Box>
						<Box width={12}>
							<Text
								color={
									task.outcome === "success"
										? "green"
										: task.outcome === "failure"
											? "red"
											: task.outcome === "partial"
												? "yellow"
												: undefined
								}
							>
								{task.outcome || "—"}
							</Text>
						</Box>
						<Box width={14}>
							<Text>
								{task.confidence ? formatPercent(task.confidence) : "—"}
							</Text>
						</Box>
						<Box width={12}>
							<Text>
								{task.duration_seconds
									? formatDuration(task.duration_seconds)
									: "—"}
							</Text>
						</Box>
						<Box width={12}>
							<Text
								color={
									task.hooks_passed === true
										? "green"
										: task.hooks_passed === false
											? "red"
											: undefined
								}
							>
								{task.hooks_passed === true
									? "✓"
									: task.hooks_passed === false
										? "✗"
										: "—"}
							</Text>
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}

/**
 * Frustration insights section
 */
function FrustrationInsights({ result }: { result: MetricsResult }) {
	if (result.total_frustrations === 0) {
		return null;
	}

	// Group by frustration level
	const byLevel: Record<string, number> = {};
	result.frustration_events.forEach((event) => {
		byLevel[event.frustration_level] =
			(byLevel[event.frustration_level] || 0) + 1;
	});

	const recentFrustrations = result.frustration_events.slice(0, 5);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				😤 User Frustration Analysis
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Box>
					<Text dimColor>Total frustration events detected: </Text>
					<Text
						bold
						color={
							result.total_frustrations > 5
								? "red"
								: result.total_frustrations > 2
									? "yellow"
									: "green"
						}
					>
						{result.total_frustrations}
					</Text>
				</Box>
				<Box>
					<Text dimColor>Frustration rate: </Text>
					<Text
						bold
						color={
							result.frustration_rate > 0.3
								? "red"
								: result.frustration_rate > 0.1
									? "yellow"
									: "green"
						}
					>
						{formatPercent(result.frustration_rate)}
					</Text>
					<Text dimColor> (frustrations per task)</Text>
				</Box>

				{Object.keys(byLevel).length > 0 && (
					<Box marginTop={1} flexDirection="column">
						<Text bold>Frustration by Level:</Text>
						{Object.entries(byLevel).map(([level, count]) => (
							<Box key={level} marginLeft={2}>
								<Box width={10}>
									<Text
										color={
											level === "high"
												? "red"
												: level === "moderate"
													? "yellow"
													: "green"
										}
									>
										{level}
									</Text>
								</Box>
								<Text dimColor>
									{count} event{count !== 1 ? "s" : ""}
								</Text>
							</Box>
						))}
					</Box>
				)}

				{recentFrustrations.length > 0 && (
					<Box marginTop={1} flexDirection="column">
						<Text bold>
							Recent Frustration Events (last {recentFrustrations.length}):
						</Text>
						{recentFrustrations.map((event) => {
							const signals = JSON.parse(event.detected_signals);
							const message =
								event.user_message.length > 60
									? `${event.user_message.substring(0, 60)}...`
									: event.user_message;

							return (
								<Box key={event.id} marginLeft={2} flexDirection="column">
									<Box>
										<Text
											color={
												event.frustration_level === "high"
													? "red"
													: event.frustration_level === "moderate"
														? "yellow"
														: "green"
											}
										>
											[{event.frustration_level}]
										</Text>
										<Text dimColor> {message}</Text>
									</Box>
									{signals.length > 0 && (
										<Box marginLeft={2}>
											<Text dimColor>
												Signals: {signals.slice(0, 3).join(", ")}
												{signals.length > 3
													? ` +${signals.length - 3} more`
													: ""}
											</Text>
										</Box>
									)}
								</Box>
							);
						})}
					</Box>
				)}

				{result.frustration_rate > 0.2 && (
					<Box marginTop={1} flexDirection="column">
						<Text bold color="yellow">
							⚠️ Recommendations:
						</Text>
						<Box marginLeft={2}>
							<Text dimColor>
								• High frustration rate detected - review recent interactions
							</Text>
						</Box>
						<Box marginLeft={2}>
							<Text dimColor>
								• Consider improving error messages and guidance
							</Text>
						</Box>
						<Box marginLeft={2}>
							<Text dimColor>• Look for patterns in frustration triggers</Text>
						</Box>
					</Box>
				)}
			</Box>
		</Box>
	);
}

/**
 * Hook execution summary section
 */
function HookSummary({ allHookStats }: { allHookStats: AllHookStats }) {
	if (allHookStats.totalExecutions === 0) {
		return null;
	}

	const hookTypes = Object.entries(allHookStats.byHookType);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				🔧 Hook Execution Summary
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Box>
					<Box width={25}>
						<Text dimColor>Total Executions:</Text>
					</Box>
					<Text bold>{allHookStats.totalExecutions}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Passed:</Text>
					</Box>
					<Text color="green">{allHookStats.totalPassed}</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Failed:</Text>
					</Box>
					<Text color={allHookStats.totalFailed > 0 ? "red" : "green"}>
						{allHookStats.totalFailed}
					</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Pass Rate:</Text>
					</Box>
					<Text
						bold
						color={
							allHookStats.passRate > 0.9
								? "green"
								: allHookStats.passRate > 0.7
									? "yellow"
									: "red"
						}
					>
						{formatPercent(allHookStats.passRate)}
					</Text>
				</Box>
				<Box>
					<Box width={25}>
						<Text dimColor>Unique Hooks:</Text>
					</Box>
					<Text>{allHookStats.uniqueHooks}</Text>
				</Box>
			</Box>

			{hookTypes.length > 0 && (
				<Box marginTop={1} flexDirection="column">
					<Text bold>By Hook Type:</Text>
					{hookTypes.map(([hookType, data]) => {
						const passRate = data.total > 0 ? data.passed / data.total : 0;
						return (
							<Box key={hookType} marginLeft={2}>
								<Box width={20}>
									<Text dimColor>{hookType}</Text>
								</Box>
								<Text dimColor>{data.total} runs, </Text>
								<Text
									color={
										passRate > 0.9 ? "green" : passRate > 0.7 ? "yellow" : "red"
									}
								>
									{formatPercent(passRate)}
								</Text>
								<Text dimColor> pass</Text>
							</Box>
						);
					})}
				</Box>
			)}
		</Box>
	);
}

/**
 * Calibration insights section
 */
function CalibrationInsights({ result }: { result: MetricsResult }) {
	const tasksWithCalibration = result.tasks.filter(
		(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
	);

	// Find overconfident tasks (high confidence but failed)
	const overconfident = tasksWithCalibration.filter(
		(t) => (t.confidence ?? 0) > 0.7 && t.outcome === "failure",
	);

	// Find underconfident tasks (low confidence but succeeded)
	const underconfident = tasksWithCalibration.filter(
		(t) => (t.confidence ?? 0) < 0.5 && t.outcome === "success",
	);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color="cyan">
				🎯 Calibration Analysis
			</Text>

			{tasksWithCalibration.length === 0 ? (
				<Box marginTop={1}>
					<Text dimColor>No tasks with confidence data yet</Text>
				</Box>
			) : (
				<Box marginTop={1} flexDirection="column">
					<Box>
						<Text dimColor>
							Calibration measures how well confidence matches actual outcomes.
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text dimColor>Score: </Text>
						<Text
							bold
							color={result.calibration_score > 0.7 ? "green" : "yellow"}
						>
							{formatPercent(result.calibration_score)}
						</Text>
						<Text dimColor>
							{" "}
							({result.calibration_score > 0.7 ? "Good" : "Needs improvement"})
						</Text>
					</Box>

					{overconfident.length > 0 && (
						<Box marginTop={1} flexDirection="column">
							<Text bold color="red">
								⚠️ Overconfident Tasks ({overconfident.length})
							</Text>
							<Text dimColor>
								High confidence but failed - consider being more cautious:
							</Text>
							{overconfident.slice(0, 5).map((task) => (
								<Box key={task.id} marginLeft={2}>
									<Text dimColor>• </Text>
									<Text>{task.type}: </Text>
									<Text dimColor>
										{task.description.substring(0, 50)}
										{task.description.length > 50 ? "..." : ""}
									</Text>
									<Text dimColor>
										{" "}
										(conf: {formatPercent(task.confidence ?? 0)})
									</Text>
								</Box>
							))}
							{overconfident.length > 5 && (
								<Box marginLeft={2}>
									<Text dimColor>... and {overconfident.length - 5} more</Text>
								</Box>
							)}
						</Box>
					)}

					{underconfident.length > 0 && (
						<Box marginTop={1} flexDirection="column">
							<Text bold color="yellow">
								💪 Underconfident Tasks ({underconfident.length})
							</Text>
							<Text dimColor>
								Low confidence but succeeded - you're more capable than you
								think:
							</Text>
							{underconfident.slice(0, 5).map((task) => (
								<Box key={task.id} marginLeft={2}>
									<Text dimColor>• </Text>
									<Text>{task.type}: </Text>
									<Text dimColor>
										{task.description.substring(0, 50)}
										{task.description.length > 50 ? "..." : ""}
									</Text>
									<Text dimColor>
										{" "}
										(conf: {formatPercent(task.confidence ?? 0)})
									</Text>
								</Box>
							))}
							{underconfident.length > 5 && (
								<Box marginLeft={2}>
									<Text dimColor>... and {underconfident.length - 5} more</Text>
								</Box>
							)}
						</Box>
					)}

					{overconfident.length === 0 && underconfident.length === 0 && (
						<Box marginTop={1}>
							<Text color="green">
								✓ Well-calibrated! Confidence matches outcomes.
							</Text>
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
}

/**
 * Main metrics display component
 */
export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
	result,
	allHookStats,
	sessionMetrics,
	showCalibration,
}) => {
	const hasTaskData = result.total_tasks > 0;
	const hasHookData = allHookStats.totalExecutions > 0;
	const hasSessionData = sessionMetrics.sessions.length > 0;
	const hasAnyData = hasTaskData || hasHookData || hasSessionData;

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color="cyan">
					═══════════════════════════════════════════════════════════════════
				</Text>
			</Box>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🤖 Agent Metrics Dashboard
				</Text>
			</Box>
			<Box marginBottom={2}>
				<Text bold color="cyan">
					═══════════════════════════════════════════════════════════════════
				</Text>
			</Box>

			{/* No data message - only when there's truly no data */}
			{!hasAnyData && (
				<Box flexDirection="column" marginBottom={2}>
					<Text bold color="yellow">
						⚠️ No metrics tracked yet
					</Text>
					<Box marginTop={1}>
						<Text dimColor>
							Metrics are tracked automatically via MCP tools in the core
							plugin.
						</Text>
					</Box>
					<Box>
						<Text dimColor>
							Hook executions and task data will appear here after your first
							session.
						</Text>
					</Box>
				</Box>
			)}

			{/* Hook Execution Summary (always show if there's hook data) */}
			{hasHookData && <HookSummary allHookStats={allHookStats} />}

			{/* Task-specific sections */}
			{hasTaskData && (
				<>
					{/* Summary Stats */}
					<SummaryStats result={result} />

					{/* Charts */}
					{Object.keys(result.by_type).length > 0 && (
						<TaskTypeChart result={result} />
					)}
					{Object.keys(result.by_outcome).length > 0 && (
						<TaskOutcomeChart result={result} />
					)}

					{/* Recent Tasks Table */}
					<RecentTasksTable result={result} />

					{/* Frustration Insights */}
					{result.total_frustrations > 0 && (
						<FrustrationInsights result={result} />
					)}

					{/* Calibration Insights (optional) */}
					{showCalibration && <CalibrationInsights result={result} />}

					{/* Footer */}
					{!showCalibration && (
						<Box marginTop={1}>
							<Text dimColor>
								Tip: Use{" "}
								<Text bold dimColor>
									han metrics show --calibration
								</Text>{" "}
								to see detailed calibration analysis
							</Text>
						</Box>
					)}
				</>
			)}

			{/* Show task tracking message when we have hooks but no tasks */}
			{!hasTaskData && hasAnyData && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color="cyan">
						📋 Task Tracking
					</Text>
					<Box marginTop={1}>
						<Text dimColor>
							No tasks tracked yet. Use{" "}
							<Text bold dimColor>
								start_task()
							</Text>{" "}
							MCP tool to track work.
						</Text>
					</Box>
					<Box>
						<Text dimColor>
							Task metrics will show success rates, calibration, and more.
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};
