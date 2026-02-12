/**
 * Performance Trend Chart Component
 *
 * Visualizes session efficiency metrics over time as weekly bars.
 * Three metrics are shown side-by-side per week:
 * - Avg Turns/Session (amber) — lower is better
 * - Avg Compactions/Session (orange) — lower is better
 * - Avg Effectiveness Score (green) — higher is better
 *
 * Trend arrows show improvement/regression vs the prior week.
 */

import type React from "react";
import { useMemo, useState } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface SessionPerformancePoint {
	readonly weekStart: string;
	readonly weekLabel: string;
	readonly sessionCount: number;
	readonly avgTurns: number;
	readonly avgCompactions: number;
	readonly avgEffectiveness: number;
}

interface PerformanceTrendChartProps {
	performanceTrend: readonly SessionPerformancePoint[];
}

const COLORS = {
	turns: "#f59e0b", // Amber
	compactions: "#f97316", // Orange
	effectiveness: "#10b981", // Green
	improvingBg: "rgba(16, 185, 129, 0.12)",
	decliningBg: "rgba(239, 68, 68, 0.12)",
};

type MetricKey = "avgTurns" | "avgCompactions" | "avgEffectiveness";

interface MetricConfig {
	key: MetricKey;
	label: string;
	shortLabel: string;
	color: string;
	lowerIsBetter: boolean;
	format: (v: number) => string;
}

const METRICS: MetricConfig[] = [
	{
		key: "avgTurns",
		label: "Avg Turns / Session",
		shortLabel: "Turns",
		color: COLORS.turns,
		lowerIsBetter: true,
		format: (v: number) => v.toFixed(1),
	},
	{
		key: "avgCompactions",
		label: "Avg Compactions / Session",
		shortLabel: "Compactions",
		color: COLORS.compactions,
		lowerIsBetter: true,
		format: (v: number) => v.toFixed(2),
	},
	{
		key: "avgEffectiveness",
		label: "Avg Effectiveness Score",
		shortLabel: "Score",
		color: COLORS.effectiveness,
		lowerIsBetter: false,
		format: (v: number) => v.toFixed(0),
	},
];

function getTrendInfo(
	current: number,
	previous: number,
	lowerIsBetter: boolean,
): { arrow: string; color: string; improved: boolean } | null {
	if (previous === 0 && current === 0) return null;
	const diff = current - previous;
	if (Math.abs(diff) < 0.01) return null;

	const isUp = diff > 0;
	const improved = lowerIsBetter ? !isUp : isUp;

	return {
		arrow: isUp ? "\u2191" : "\u2193",
		color: improved ? "#10b981" : "#ef4444",
		improved,
	};
}

export function PerformanceTrendChart({
	performanceTrend,
}: PerformanceTrendChartProps): React.ReactElement {
	const [activeMetric, setActiveMetric] = useState<MetricKey>("avgTurns");

	const metric = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0];

	// Compute current averages and trend vs previous week
	const summary = useMemo(() => {
		if (performanceTrend.length === 0) return null;

		const latest = performanceTrend[performanceTrend.length - 1];
		const previous =
			performanceTrend.length >= 2
				? performanceTrend[performanceTrend.length - 2]
				: null;

		return METRICS.map((m) => {
			const currentVal = latest[m.key];
			const previousVal = previous ? previous[m.key] : null;
			const trend =
				previousVal != null
					? getTrendInfo(currentVal, previousVal, m.lowerIsBetter)
					: null;

			return {
				...m,
				currentVal,
				trend,
			};
		});
	}, [performanceTrend]);

	// Compute max value for scaling the bar chart
	const maxValue = useMemo(() => {
		let max = 1;
		for (const p of performanceTrend) {
			max = Math.max(max, p[metric.key]);
		}
		return max;
	}, [performanceTrend, metric.key]);

	const chartHeight = 80;

	if (performanceTrend.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No performance data available yet
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Summary stats row — one per metric */}
			{summary && (
				<HStack gap="lg" style={{ flexWrap: "wrap" }}>
					{summary.map((s) => (
						<VStack key={s.key} gap="xs">
							<Text color="secondary" size="xs">
								{s.label}
							</Text>
							<HStack gap="xs" align="center">
								<Text weight="semibold" size="lg" style={{ color: s.color }}>
									{s.format(s.currentVal)}
								</Text>
								{s.trend && (
									<Text
										size="sm"
										weight="semibold"
										style={{ color: s.trend.color }}
									>
										{s.trend.arrow}
									</Text>
								)}
							</HStack>
						</VStack>
					))}
				</HStack>
			)}

			{/* Metric selector tabs */}
			<HStack gap="xs" align="center" style={{ flexWrap: "wrap" }}>
				{METRICS.map((m) => (
					<Pressable key={m.key} onPress={() => setActiveMetric(m.key)}>
						<Box
							style={{
								paddingHorizontal: theme.spacing.md,
								paddingVertical: theme.spacing.xs,
								backgroundColor:
									activeMetric === m.key ? m.color : "transparent",
								borderRadius: theme.radii.full,
								borderWidth: activeMetric === m.key ? 0 : 1,
								borderColor: theme.colors.border.default,
							}}
						>
							<Text
								size="xs"
								weight={activeMetric === m.key ? "semibold" : "medium"}
								style={{
									color:
										activeMetric === m.key
											? "#ffffff"
											: theme.colors.text.secondary,
								}}
							>
								{m.shortLabel}
							</Text>
						</Box>
					</Pressable>
				))}
			</HStack>

			{/* Bar chart */}
			<HStack
				align="flex-end"
				style={{
					height: chartHeight,
					width: "100%",
				}}
			>
				{performanceTrend.map((point, idx) => {
					const value = point[metric.key];
					const barHeight = Math.max(
						(value / maxValue) * chartHeight,
						value > 0 ? 2 : 1,
					);

					// Color intensity based on whether this week improved
					const prev = idx > 0 ? performanceTrend[idx - 1] : null;
					let barColor = metric.color;
					if (prev) {
						const trend = getTrendInfo(
							value,
							prev[metric.key],
							metric.lowerIsBetter,
						);
						if (trend && !trend.improved) {
							barColor = "#ef4444"; // Red for regression
						}
					}

					return (
						<Box
							key={`perf-${point.weekStart}-${idx}`}
							style={{
								flex: 1,
								height: barHeight,
								backgroundColor: barColor,
								borderRadius: 2,
								opacity: value > 0 ? 1 : 0.2,
								marginHorizontal: 1,
							}}
						/>
					);
				})}
			</HStack>

			{/* Week labels */}
			<HStack style={{ width: "100%" }}>
				{performanceTrend.map((point, idx) => {
					// Show label for first week and every ~4th week
					const showLabel = idx === 0 || idx % 4 === 0;
					return (
						<Box
							key={`label-${point.weekStart}`}
							style={{ flex: 1, overflow: "visible" }}
						>
							{showLabel ? (
								<Text color="muted" size="xs" style={{ whiteSpace: "nowrap" }}>
									{point.weekLabel.split(" - ")[0]}
								</Text>
							) : null}
						</Box>
					);
				})}
			</HStack>

			{/* Legend */}
			<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: 10,
							height: 10,
							borderRadius: 2,
							backgroundColor: metric.color,
						}}
					/>
					<Text color="muted" size="xs">
						{metric.lowerIsBetter ? "On track" : "Improving"}
					</Text>
				</HStack>
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: 10,
							height: 10,
							borderRadius: 2,
							backgroundColor: "#ef4444",
						}}
					/>
					<Text color="muted" size="xs">
						Regression
					</Text>
				</HStack>
				<Text color="muted" size="xs">
					{metric.lowerIsBetter ? "Lower is better" : "Higher is better"}
				</Text>
			</HStack>

			{/* Callout */}
			<Box
				style={{
					padding: theme.spacing.sm,
					backgroundColor: "rgba(59, 130, 246, 0.1)",
					borderRadius: theme.borderRadius.md,
					borderLeftWidth: 3,
					borderLeftColor: "#3b82f6",
				}}
			>
				<Text size="xs" color="muted">
					Fewer turns and compactions indicate more focused, efficient sessions.
					Use subagents and clear prompts to improve.
				</Text>
			</Box>
		</VStack>
	);
}
