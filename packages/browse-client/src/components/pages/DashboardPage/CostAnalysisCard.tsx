/**
 * Cost Analysis Card Component
 *
 * Cost tracking with subscription context. Shows utilization gauge,
 * cost metrics grid, and daily cost sparkline chart.
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface DailyCost {
	readonly date: string;
	readonly costUsd: number;
	readonly sessionCount: number;
}

interface SubscriptionComparison {
	readonly tierName: string;
	readonly monthlyCostUsd: number;
	readonly apiCreditCostUsd: number;
	readonly savingsUsd: number;
	readonly savingsPercent: number;
	readonly recommendation: string;
}

interface WeeklyCost {
	readonly weekStart: string;
	readonly weekLabel: string;
	readonly costUsd: number;
	readonly sessionCount: number;
	readonly avgDailyCost: number;
}

interface SessionCost {
	readonly sessionId: string;
	readonly slug: string | null;
	readonly costUsd: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly cacheReadTokens: number;
	readonly messageCount: number;
	readonly startedAt: string | null;
}

interface CostAnalysis {
	readonly estimatedCostUsd: number;
	readonly maxSubscriptionCostUsd: number;
	readonly costUtilizationPercent: number;
	readonly dailyCostTrend: readonly DailyCost[];
	readonly weeklyCostTrend: readonly WeeklyCost[];
	readonly topSessionsByCost: readonly SessionCost[];
	readonly costPerSession: number;
	readonly costPerCompletedTask: number;
	readonly cacheHitRate: number;
	readonly potentialSavingsUsd: number;
	readonly subscriptionComparisons: readonly SubscriptionComparison[];
	readonly breakEvenDailySpend: number;
}

interface CostAnalysisCardProps {
	costAnalysis: CostAnalysis;
	onSessionClick?: (sessionId: string) => void;
}

/**
 * Format token count compactly (e.g., 1.2M, 450K)
 */
function formatTokens(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
	return `${count}`;
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
 * Get recommendation badge styling
 */
function getRecommendationStyle(recommendation: string): {
	color: string;
	bg: string;
	label: string;
} {
	switch (recommendation) {
		case "recommended":
			return {
				color: "#10b981",
				bg: "rgba(16, 185, 129, 0.15)",
				label: "Saves money",
			};
		case "good_value":
			return {
				color: "#f59e0b",
				bg: "rgba(245, 158, 11, 0.15)",
				label: "Close to break-even",
			};
		default:
			return {
				color: "#6b7280",
				bg: "rgba(107, 114, 128, 0.15)",
				label: "API cheaper",
			};
	}
}

/**
 * Single row for subscription tier comparison
 */
function TierComparisonRow({
	comparison,
}: {
	comparison: SubscriptionComparison;
}): React.ReactElement {
	const style = getRecommendationStyle(comparison.recommendation);
	const isSaving = comparison.savingsUsd > 0;

	return (
		<HStack
			gap="sm"
			align="center"
			style={{
				padding: theme.spacing.sm,
				backgroundColor: theme.colors.bg.tertiary,
				borderRadius: theme.radii.md,
			}}
		>
			{/* Tier name */}
			<VStack gap="xs" style={{ flex: 1, minWidth: 70 }}>
				<Text weight="semibold" size="sm">
					{comparison.tierName}
				</Text>
				<Text color="muted" size="xs">
					{formatCost(comparison.monthlyCostUsd)}/mo
				</Text>
			</VStack>

			{/* Savings amount */}
			<VStack gap="xs" align="center" style={{ flex: 1 }}>
				<Text
					weight="semibold"
					size="sm"
					style={{
						color: isSaving ? "#10b981" : "#ef4444",
					}}
				>
					{isSaving ? "+" : ""}
					{formatCost(Math.abs(comparison.savingsUsd))}
				</Text>
				<Text color="muted" size="xs">
					{isSaving ? "saved" : "extra"}
				</Text>
			</VStack>

			{/* Recommendation badge */}
			<Box
				style={{
					paddingHorizontal: theme.spacing.sm,
					paddingVertical: 2,
					backgroundColor: style.bg,
					borderRadius: theme.radii.full,
				}}
			>
				<Text size="xs" weight="semibold" style={{ color: style.color }}>
					{style.label}
				</Text>
			</Box>
		</HStack>
	);
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
	onSessionClick,
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

			{/* Max vs API Credits comparison */}
			{costAnalysis.subscriptionComparisons.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<HStack justify="space-between" align="center">
						<Text color="secondary" size="xs">
							Subscription vs API Credits
						</Text>
						<Text color="muted" size="xs">
							est.{" "}
							{formatCost(
								costAnalysis.subscriptionComparisons[0]?.apiCreditCostUsd ?? 0,
							)}
							/mo on API
						</Text>
					</HStack>

					<VStack gap="xs" style={{ width: "100%" }}>
						{costAnalysis.subscriptionComparisons.map((comparison) => (
							<TierComparisonRow
								key={comparison.tierName}
								comparison={comparison}
							/>
						))}
					</VStack>

					{/* Break-even insight */}
					<Box
						style={{
							padding: theme.spacing.sm,
							backgroundColor: "rgba(99, 102, 241, 0.08)",
							borderRadius: theme.radii.md,
							borderLeftWidth: 3,
							borderLeftColor: "#6366f1",
						}}
					>
						<Text color="muted" size="xs">
							Your plan breaks even at{" "}
							{formatCost(costAnalysis.breakEvenDailySpend)}/day in API credits
						</Text>
					</Box>
				</VStack>
			)}

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
								bottom: (dailyBudget / maxDailyCost) * sparklineHeight,
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

			{/* Weekly cost trend */}
			{costAnalysis.weeklyCostTrend.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Weekly Cost
					</Text>

					<VStack gap="xs" style={{ width: "100%" }}>
						{costAnalysis.weeklyCostTrend.map((week) => {
							const weeklyBudget = costAnalysis.maxSubscriptionCostUsd / 4.33;
							const overBudget = week.costUsd > weeklyBudget;
							const barWidth =
								weeklyBudget > 0
									? Math.min((week.costUsd / weeklyBudget) * 100, 100)
									: 0;

							return (
								<VStack
									key={week.weekStart}
									gap="xs"
									style={{
										padding: theme.spacing.sm,
										backgroundColor: theme.colors.bg.tertiary,
										borderRadius: theme.radii.md,
									}}
								>
									<HStack justify="space-between" align="center">
										<Text size="xs" weight="medium">
											{week.weekLabel}
										</Text>
										<HStack gap="sm" align="center">
											<Text
												size="xs"
												weight="semibold"
												style={{
													color: overBudget
														? "#ef4444"
														: theme.colors.text.primary,
												}}
											>
												{formatCost(week.costUsd)}
											</Text>
											<Text color="muted" size="xs">
												{week.sessionCount} sessions
											</Text>
										</HStack>
									</HStack>
									<Box
										style={{
											width: "100%",
											height: 4,
											backgroundColor: theme.colors.bg.secondary,
											borderRadius: theme.radii.full,
											overflow: "hidden",
										}}
									>
										<Box
											style={{
												width: `${barWidth}%`,
												height: "100%",
												backgroundColor: overBudget
													? "#ef4444"
													: theme.colors.accent.primary,
												borderRadius: theme.radii.full,
											}}
										/>
									</Box>
								</VStack>
							);
						})}
					</VStack>
				</VStack>
			)}

			{/* Top sessions by cost */}
			{costAnalysis.topSessionsByCost.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Most Expensive Sessions
					</Text>

					<VStack gap="xs" style={{ width: "100%" }}>
						{costAnalysis.topSessionsByCost.map((session, idx) => (
							<Box
								key={session.sessionId}
								onClick={() => onSessionClick?.(session.sessionId)}
								style={{
									padding: theme.spacing.sm,
									backgroundColor: theme.colors.bg.tertiary,
									borderRadius: theme.radii.md,
									cursor: onSessionClick ? "pointer" : "default",
								}}
							>
								<HStack justify="space-between" align="center">
									<HStack
										gap="sm"
										align="center"
										style={{ flex: 1, minWidth: 0 }}
									>
										<Text
											color="muted"
											size="xs"
											style={{ width: 18, textAlign: "right" }}
										>
											{idx + 1}.
										</Text>
										<VStack gap="xs" style={{ flex: 1, minWidth: 0 }}>
											<Text size="sm" weight="medium" numberOfLines={1}>
												{session.slug || session.sessionId.slice(0, 8)}
											</Text>
											<HStack gap="sm">
												<Text color="muted" size="xs">
													{session.messageCount} msgs
												</Text>
												<Text color="muted" size="xs">
													{formatTokens(
														session.inputTokens + session.outputTokens,
													)}{" "}
													tokens
												</Text>
											</HStack>
										</VStack>
									</HStack>
									<Text weight="semibold" size="sm">
										{formatCost(session.costUsd)}
									</Text>
								</HStack>
							</Box>
						))}
					</VStack>
				</VStack>
			)}
		</VStack>
	);
}
