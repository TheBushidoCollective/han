import { Box, Text } from "ink";
import type React from "react";
import type { MetricsResult, Task } from "../../metrics/types.js";

interface MetricsDisplayProps {
	result: MetricsResult;
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
	showCalibration,
}) => {
	const hasData = result.total_tasks > 0;

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
					🤖 Agent Task Metrics Dashboard
				</Text>
			</Box>
			<Box marginBottom={2}>
				<Text bold color="cyan">
					═══════════════════════════════════════════════════════════════════
				</Text>
			</Box>

			{/* No data message */}
			{!hasData && (
				<Box flexDirection="column" marginBottom={2}>
					<Text bold color="yellow">
						⚠️ No metrics tracked yet
					</Text>
					<Box marginTop={1}>
						<Text dimColor>
							Agent task metrics will appear here once you start using the
						</Text>
					</Box>
					<Box>
						<Text dimColor>hashi-han-metrics plugin to track your work.</Text>
					</Box>
					<Box marginTop={1}>
						<Text dimColor>Install it with: </Text>
						<Text bold>han plugin install hashi-han-metrics</Text>
					</Box>
				</Box>
			)}

			{/* Summary Stats */}
			{hasData && <SummaryStats result={result} />}

			{/* Charts */}
			{hasData && Object.keys(result.by_type).length > 0 && (
				<TaskTypeChart result={result} />
			)}
			{hasData && Object.keys(result.by_outcome).length > 0 && (
				<TaskOutcomeChart result={result} />
			)}

			{/* Recent Tasks Table */}
			{hasData && <RecentTasksTable result={result} />}

			{/* Calibration Insights (optional) */}
			{hasData && showCalibration && <CalibrationInsights result={result} />}

			{/* Footer */}
			{hasData && (
				<Box marginTop={1}>
					<Text dimColor>
						Tip: Use --calibration to see detailed calibration analysis
					</Text>
				</Box>
			)}
		</Box>
	);
};
