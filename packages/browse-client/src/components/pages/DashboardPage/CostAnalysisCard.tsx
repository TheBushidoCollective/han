/**
 * Cost Analysis Card Component
 *
 * Cost tracking with subscription context. Shows utilization gauge,
 * cost metrics grid, and daily cost sparkline chart.
 */

import type React from "react";
import { useMemo } from "react";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { theme } from "@/components/atoms";

interface DailyCost {
	readonly date: string;
	readonly costUsd: number;
	readonly sessionCount: number;
}

interface CostAnalysis {
	readonly estimatedCostUsd: number;
	readonly maxSubscriptionCostUsd: number;
	readonly costUtilizationPercent: number;
	readonly dailyCostTrend: readonly DailyCost[];
	readonly costPerSession: number;
	readonly costPerCompletedTask: number;
	readonly cacheHitRate: number;
	readonly potentialSavingsUsd: number;
}

interface CostAnalysisCardProps {
	costAnalysis: CostAnalysis;
}

/**
 * Format currency
 */
function formatCost(usd: number): string {
	if (usd < 0.01) return "< $0.01";
	if (usd < 1) return `$${usd.toFixed(2)}`;
	if (usd < 100) return `$${usd.toFixed(2)}`;
	return `$${usd.toFixed(0)}`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

/**
 * Get utilization color based on percentage
 */
function getUtilizationColor(percent: number): string {
	if (percent < 60) return "#10b981"; // Green
	if (percent <= 85) return "#f59e0b"; // Amber
	return "#ef4444"; // Red
}

/**
 * Get utilization background color
 */
function getUtilizationBgColor(percent: number): string {
	if (percent < 60) return "rgba(16, 185, 129, 0.15)";
	if (percent <= 85) return "rgba(245, 158, 11, 0.15)";
	return "rgba(239, 68, 68, 0.15)";
}

/**
 * Cost metric item for the 2x2 grid
 */
function CostMetric({
	label,
	value,
	subValue,
}: {
	label: string;
	value: string;
	subValue?: string;
}): React.ReactElement {
	return (
		<VStack
			gap="xs"
			style={{
				flex: 1,
				minWidth: 100,
				padding: theme.spacing.sm,
				backgroundColor: theme.colors.bg.tertiary,
				borderRadius: theme.radii.md,
			}}
		>
			<Text color="muted" size="xs">
				{label}
			</Text>
			<Text weight="semibold" size="lg">
				{value}
			</Text>
			{subValue && (
				<Text color="muted" size="xs">
					{subValue}
				</Text>
			)}
		</VStack>
	);
}

export function CostAnalysisCard({
	costAnalysis,
}: CostAnalysisCardProps): React.ReactElement {
	const utilizationColor = getUtilizationColor(
		costAnalysis.costUtilizationPercent,
	);
	const utilizationBg = getUtilizationBgColor(
		costAnalysis.costUtilizationPercent,
	);

	// Daily budget line
	const dailyBudget = useMemo(
		() => costAnalysis.maxSubscriptionCostUsd / 30,
		[costAnalysis.maxSubscriptionCostUsd],
	);

	// Max daily cost for sparkline scaling
	const maxDailyCost = useMemo(() => {
		const costs = costAnalysis.dailyCostTrend.map((d) => d.costUsd);
		return Math.max(...costs, dailyBudget, 0.01);
	}, [costAnalysis.dailyCostTrend, dailyBudget]);

	const sparklineHeight = 60;

	// Clamp utilization to 100 for the bar width
	const barPercent = Math.min(costAnalysis.costUtilizationPercent, 100);

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Subscription utilization gauge */}
			<VStack gap="sm" style={{ width: "100%" }}>
				<HStack justify="space-between" align="center">
					<Text color="secondary" size="xs">
						Subscription Utilization
					</Text>
					<Box
						style={{
							paddingHorizontal: theme.spacing.sm,
							paddingVertical: 2,
							backgroundColor: utilizationBg,
							borderRadius: theme.radii.full,
						}}
					>
						<Text
							size="xs"
							weight="semibold"
							style={{ color: utilizationColor }}
						>
							{formatPercent(costAnalysis.costUtilizationPercent)}
						</Text>
					</Box>
				</HStack>

				{/* Progress bar */}
				<Box
					style={{
						width: "100%",
						height: 12,
						backgroundColor: theme.colors.bg.tertiary,
						borderRadius: theme.radii.md,
						overflow: "hidden",
					}}
				>
					<Box
						style={{
							width: `${barPercent}%`,
							height: "100%",
							backgroundColor: utilizationColor,
							borderRadius: theme.radii.md,
						}}
					/>
				</Box>

				{/* Usage text */}
				<HStack justify="space-between" align="center">
					<Text size="sm" weight="semibold">
						{formatCost(costAnalysis.estimatedCostUsd)}
					</Text>
					<Text color="muted" size="xs">
						of {formatCost(costAnalysis.maxSubscriptionCostUsd)} used
					</Text>
				</HStack>
			</VStack>

			{/* Cost metrics 2x2 grid */}
			<VStack gap="sm" style={{ width: "100%" }}>
				<HStack gap="sm" style={{ width: "100%" }}>
					<CostMetric
						label="Cost / Session"
						value={formatCost(costAnalysis.costPerSession)}
					/>
					<CostMetric
						label="Cost / Task"
						value={formatCost(costAnalysis.costPerCompletedTask)}
					/>
				</HStack>
				<HStack gap="sm" style={{ width: "100%" }}>
					<CostMetric
						label="Cache Hit Rate"
						value={formatPercent(costAnalysis.cacheHitRate * 100)}
					/>
					<CostMetric
						label="Potential Savings"
						value={formatCost(costAnalysis.potentialSavingsUsd)}
						subValue="from optimizations"
					/>
				</HStack>
			</VStack>

			{/* Daily cost sparkline */}
			{costAnalysis.dailyCostTrend.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Daily Cost (Last 30 Days)
					</Text>

					{/* Sparkline chart */}
					<Box style={{ width: "100%", position: "relative" }}>
						{/* Budget line */}
						<Box
							style={{
								position: "absolute",
								width: "100%",
								height: 1,
								backgroundColor: "#f59e0b",
								opacity: 0.5,
								bottom:
									(dailyBudget / maxDailyCost) * sparklineHeight,
							}}
						/>

						{/* Bars */}
						<HStack
							align="flex-end"
							style={{
								height: sparklineHeight,
								width: "100%",
							}}
						>
							{costAnalysis.dailyCostTrend.map((day, idx) => {
								const barHeight = Math.max(
									(day.costUsd / maxDailyCost) * sparklineHeight,
									day.costUsd > 0 ? 2 : 1,
								);
								const overBudget = day.costUsd > dailyBudget;

								return (
									<Box
										key={`cost-${day.date}-${idx}`}
										style={{
											flex: 1,
											height: barHeight,
											backgroundColor: overBudget
												? "#ef4444"
												: theme.colors.accent.primary,
											borderRadius: 1,
											opacity: day.costUsd > 0 ? 1 : 0.2,
											marginHorizontal: 0.5,
										}}
									/>
								);
							})}
						</HStack>
					</Box>

					{/* Budget line legend */}
					<HStack gap="md" align="center">
						<HStack gap="xs" align="center">
							<Box
								style={{
									width: 16,
									height: 1,
									backgroundColor: "#f59e0b",
								}}
							/>
							<Text color="muted" size="xs">
								Daily budget ({formatCost(dailyBudget)}/day)
							</Text>
						</HStack>
						<HStack gap="xs" align="center">
							<Box
								style={{
									width: "10px",
									height: "10px",
									borderRadius: "2px",
									backgroundColor: "#ef4444",
								}}
							/>
							<Text color="muted" size="xs">
								Over budget
							</Text>
						</HStack>
					</HStack>
				</VStack>
			)}
		</VStack>
	);
}
