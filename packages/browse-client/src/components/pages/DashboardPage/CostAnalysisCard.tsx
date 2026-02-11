/**
 * Cost Analysis Card Component
 *
 * Cost tracking with subscription context. Shows utilization gauge,
 * cost metrics grid, and daily cost sparkline chart.
 * Supports per-config-dir tabbed view with full parity to "All" tab.
 */

import type React from "react";
import { useMemo, useState } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { SessionRow } from "@/components/molecules/SessionRow.tsx";

// =============================================================================
// Interfaces
// =============================================================================

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

interface ConfigDirBreakdown {
	readonly configDirId: string;
	readonly configDirName: string;
	readonly estimatedCostUsd: number;
	readonly isEstimated: boolean;
	readonly cacheSavingsUsd: number;
	readonly totalSessions: number;
	readonly totalMessages: number;
	readonly modelCount: number;
	readonly costPerSession: number;
	readonly cacheHitRate: number;
	readonly potentialSavingsUsd: number;
	readonly costUtilizationPercent: number;
	readonly dailyCostTrend: readonly DailyCost[];
	readonly weeklyCostTrend: readonly WeeklyCost[];
	readonly subscriptionComparisons: readonly SubscriptionComparison[];
	readonly breakEvenDailySpend: number;
	readonly topSessionsByCost: readonly SessionCost[];
}

interface CostAnalysis {
	readonly estimatedCostUsd: number;
	readonly isEstimated: boolean;
	readonly billingType: string | null;
	readonly cacheSavingsUsd: number;
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
	readonly configDirBreakdowns: readonly ConfigDirBreakdown[];
}

/**
 * Shared shape for both "All" and per-config-dir cost detail views
 */
interface CostViewData {
	readonly estimatedCostUsd: number;
	readonly isEstimated: boolean;
	readonly billingType: string | null;
	readonly cacheSavingsUsd: number;
	readonly maxSubscriptionCostUsd: number;
	readonly costUtilizationPercent: number;
	readonly costPerSession: number;
	readonly costPerCompletedTask: number;
	readonly cacheHitRate: number;
	readonly potentialSavingsUsd: number;
	readonly dailyCostTrend: readonly DailyCost[];
	readonly weeklyCostTrend: readonly WeeklyCost[];
	readonly topSessionsByCost: readonly SessionCost[];
	readonly subscriptionComparisons: readonly SubscriptionComparison[];
	readonly breakEvenDailySpend: number;
}

interface CostAnalysisCardProps {
	costAnalysis: CostAnalysis;
	onSessionClick?: (sessionId: string) => void;
}

// =============================================================================
// Formatting Helpers (locale-aware)
// =============================================================================

const currencyFormatter = new Intl.NumberFormat(undefined, {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const currencyFormatterWhole = new Intl.NumberFormat(undefined, {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat();

/**
 * Format currency with locale-aware separators
 */
function formatCost(usd: number): string {
	if (usd < 0.01) return "< $0.01";
	if (usd >= 100) return currencyFormatterWhole.format(usd);
	return currencyFormatter.format(usd);
}

/**
 * Format percentage with locale-aware separators
 */
function formatPercent(value: number): string {
	return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/**
 * Format an integer with locale-aware grouping (commas)
 */
function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

// =============================================================================
// Style Helpers
// =============================================================================

/**
 * Get utilization color based on percentage.
 * For subscriptions, HIGH utilization = GOOD (getting value for money).
 */
function getUtilizationColor(percent: number): string {
	if (percent >= 80) return "#10b981";
	if (percent >= 40) return "#f59e0b";
	return "#ef4444";
}

function getUtilizationBgColor(percent: number): string {
	if (percent >= 80) return "rgba(16, 185, 129, 0.15)";
	if (percent >= 40) return "rgba(245, 158, 11, 0.15)";
	return "rgba(239, 68, 68, 0.15)";
}

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

// =============================================================================
// Sub-Components
// =============================================================================

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
			<VStack gap="xs" style={{ flex: 1, minWidth: 70 }}>
				<Text weight="semibold" size="sm">
					{comparison.tierName}
				</Text>
				<Text color="muted" size="xs">
					{formatCost(comparison.monthlyCostUsd)}/mo
				</Text>
			</VStack>

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

function TabButton({
	label,
	isActive,
	onPress,
}: {
	label: string;
	isActive: boolean;
	onPress: () => void;
}): React.ReactElement {
	return (
		<Pressable onPress={onPress}>
			<Box
				style={{
					paddingHorizontal: theme.spacing.md,
					paddingVertical: theme.spacing.xs,
					backgroundColor: isActive
						? theme.colors.accent.primary
						: "transparent",
					borderRadius: theme.radii.full,
					borderWidth: isActive ? 0 : 1,
					borderColor: theme.colors.border.default,
				}}
			>
				<Text
					size="xs"
					weight={isActive ? "semibold" : "medium"}
					style={{
						color: isActive ? "#ffffff" : theme.colors.text.secondary,
					}}
				>
					{label}
				</Text>
			</Box>
		</Pressable>
	);
}

// =============================================================================
// Shared Cost Detail View (used by both "All" and per-config-dir tabs)
// =============================================================================

function CostDetailView({
	data,
	onSessionClick,
}: {
	data: CostViewData;
	onSessionClick?: (sessionId: string) => void;
}): React.ReactElement {
	const utilizationColor = getUtilizationColor(data.costUtilizationPercent);
	const utilizationBg = getUtilizationBgColor(data.costUtilizationPercent);
	const barPercent = Math.min(data.costUtilizationPercent, 100);

	const dailyBudget = useMemo(
		() => data.maxSubscriptionCostUsd / 30,
		[data.maxSubscriptionCostUsd],
	);

	const maxDailyCost = useMemo(() => {
		const costs = data.dailyCostTrend.map((d) => d.costUsd);
		return Math.max(...costs, dailyBudget, 0.01);
	}, [data.dailyCostTrend, dailyBudget]);

	const sparklineHeight = 60;

	return (
		<>
			{/* Cost accuracy and billing info */}
			<HStack gap="sm" align="center" wrap>
				{data.isEstimated && (
					<Box
						style={{
							paddingHorizontal: theme.spacing.sm,
							paddingVertical: 2,
							backgroundColor: "rgba(245, 158, 11, 0.15)",
							borderRadius: theme.radii.full,
						}}
					>
						<Text size="xs" weight="semibold" style={{ color: "#f59e0b" }}>
							Estimated (Sonnet rates)
						</Text>
					</Box>
				)}
				{!data.isEstimated && (
					<Box
						style={{
							paddingHorizontal: theme.spacing.sm,
							paddingVertical: 2,
							backgroundColor: "rgba(16, 185, 129, 0.15)",
							borderRadius: theme.radii.full,
						}}
					>
						<Text size="xs" weight="semibold" style={{ color: "#10b981" }}>
							Per-model pricing
						</Text>
					</Box>
				)}
				{data.billingType && (
					<Box
						style={{
							paddingHorizontal: theme.spacing.sm,
							paddingVertical: 2,
							backgroundColor: "rgba(99, 102, 241, 0.12)",
							borderRadius: theme.radii.full,
						}}
					>
						<Text size="xs" weight="semibold" style={{ color: "#6366f1" }}>
							{data.billingType === "stripe_subscription"
								? "Max Plan"
								: data.billingType}
						</Text>
					</Box>
				)}
			</HStack>

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
							{formatPercent(data.costUtilizationPercent)}
						</Text>
					</Box>
				</HStack>

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

				<HStack justify="space-between" align="center">
					<Text size="sm" weight="semibold">
						{formatCost(data.estimatedCostUsd)}
					</Text>
					<Text color="muted" size="xs">
						of {formatCost(data.maxSubscriptionCostUsd)} used
					</Text>
				</HStack>
			</VStack>

			{/* Cost metrics 2x2 grid */}
			<VStack gap="sm" style={{ width: "100%" }}>
				<HStack gap="sm" style={{ width: "100%" }}>
					<CostMetric
						label="Cost / Session"
						value={formatCost(data.costPerSession)}
					/>
					<CostMetric
						label="Cost / Task"
						value={formatCost(data.costPerCompletedTask)}
					/>
				</HStack>
				<HStack gap="sm" style={{ width: "100%" }}>
					<CostMetric
						label="Cache Hit Rate"
						value={formatPercent(data.cacheHitRate * 100)}
						subValue={
							data.cacheSavingsUsd > 0
								? `${formatCost(data.cacheSavingsUsd)} saved`
								: undefined
						}
					/>
					<CostMetric
						label="Potential Savings"
						value={formatCost(data.potentialSavingsUsd)}
						subValue="from optimizations"
					/>
				</HStack>
			</VStack>

			{/* Subscription vs API Credits comparison */}
			{data.subscriptionComparisons.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<HStack justify="space-between" align="center">
						<Text color="secondary" size="xs">
							Subscription vs API Credits
						</Text>
						<Text color="muted" size="xs">
							est.{" "}
							{formatCost(
								data.subscriptionComparisons[0]?.apiCreditCostUsd ?? 0,
							)}
							/mo on API
						</Text>
					</HStack>

					<VStack gap="xs" style={{ width: "100%" }}>
						{data.subscriptionComparisons.map((comparison) => (
							<TierComparisonRow
								key={comparison.tierName}
								comparison={comparison}
							/>
						))}
					</VStack>

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
							Your plan breaks even at {formatCost(data.breakEvenDailySpend)}
							/day in API credits
						</Text>
					</Box>
				</VStack>
			)}

			{/* Daily cost sparkline */}
			{data.dailyCostTrend.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Daily Cost (Last 30 Days)
					</Text>

					<Box style={{ width: "100%", position: "relative" }}>
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

						<HStack
							align="flex-end"
							style={{
								height: sparklineHeight,
								width: "100%",
							}}
						>
							{data.dailyCostTrend.map((day, idx) => {
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
									width: 10,
									height: 10,
									borderRadius: 2,
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
			{data.weeklyCostTrend.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Weekly Cost
					</Text>

					<VStack gap="xs" style={{ width: "100%" }}>
						{data.weeklyCostTrend.map((week) => {
							const weeklyBudget = data.maxSubscriptionCostUsd / 4.33;
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
												{formatNumber(week.sessionCount)} sessions
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
			{data.topSessionsByCost.length > 0 && (
				<VStack gap="sm" style={{ width: "100%" }}>
					<Text color="secondary" size="xs">
						Most Expensive Sessions
					</Text>

					<VStack gap="xs" style={{ width: "100%" }}>
						{data.topSessionsByCost.map((session, idx) => (
							<SessionRow
								key={session.sessionId}
								label={session.slug || session.sessionId.slice(0, 8)}
								rank={idx + 1}
								messageCount={session.messageCount}
								tokenCount={session.inputTokens + session.outputTokens}
								costUsd={session.costUsd}
								onPress={
									onSessionClick
										? () => onSessionClick(session.sessionId)
										: undefined
								}
							/>
						))}
					</VStack>
				</VStack>
			)}
		</>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostAnalysisCard({
	costAnalysis,
	onSessionClick,
}: CostAnalysisCardProps): React.ReactElement {
	const [activeTab, setActiveTab] = useState<string>("all");

	const hasMultipleDirs = costAnalysis.configDirBreakdowns.length > 1;

	const activeBreakdown =
		activeTab !== "all"
			? costAnalysis.configDirBreakdowns.find(
					(d) => d.configDirId === activeTab,
				)
			: null;

	// Build CostViewData for the active view
	const viewData: CostViewData = useMemo(() => {
		if (activeBreakdown) {
			return {
				estimatedCostUsd: activeBreakdown.estimatedCostUsd,
				isEstimated: activeBreakdown.isEstimated,
				billingType: costAnalysis.billingType,
				cacheSavingsUsd: activeBreakdown.cacheSavingsUsd,
				maxSubscriptionCostUsd: costAnalysis.maxSubscriptionCostUsd,
				costUtilizationPercent: activeBreakdown.costUtilizationPercent,
				costPerSession: activeBreakdown.costPerSession,
				costPerCompletedTask: 0,
				cacheHitRate: activeBreakdown.cacheHitRate,
				potentialSavingsUsd: activeBreakdown.potentialSavingsUsd,
				dailyCostTrend: activeBreakdown.dailyCostTrend,
				weeklyCostTrend: activeBreakdown.weeklyCostTrend,
				topSessionsByCost: activeBreakdown.topSessionsByCost,
				subscriptionComparisons: activeBreakdown.subscriptionComparisons,
				breakEvenDailySpend: activeBreakdown.breakEvenDailySpend,
			};
		}
		return {
			estimatedCostUsd: costAnalysis.estimatedCostUsd,
			isEstimated: costAnalysis.isEstimated,
			billingType: costAnalysis.billingType,
			cacheSavingsUsd: costAnalysis.cacheSavingsUsd,
			maxSubscriptionCostUsd: costAnalysis.maxSubscriptionCostUsd,
			costUtilizationPercent: costAnalysis.costUtilizationPercent,
			costPerSession: costAnalysis.costPerSession,
			costPerCompletedTask: costAnalysis.costPerCompletedTask,
			cacheHitRate: costAnalysis.cacheHitRate,
			potentialSavingsUsd: costAnalysis.potentialSavingsUsd,
			dailyCostTrend: costAnalysis.dailyCostTrend,
			weeklyCostTrend: costAnalysis.weeklyCostTrend,
			topSessionsByCost: costAnalysis.topSessionsByCost,
			subscriptionComparisons: costAnalysis.subscriptionComparisons,
			breakEvenDailySpend: costAnalysis.breakEvenDailySpend,
		};
	}, [costAnalysis, activeBreakdown]);

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Config dir tabs */}
			{hasMultipleDirs && (
				<HStack gap="xs" align="center" style={{ flexWrap: "wrap" }}>
					<TabButton
						label="All"
						isActive={activeTab === "all"}
						onPress={() => setActiveTab("all")}
					/>
					{costAnalysis.configDirBreakdowns.map((dir) => (
						<TabButton
							key={dir.configDirId}
							label={dir.configDirName}
							isActive={activeTab === dir.configDirId}
							onPress={() => setActiveTab(dir.configDirId)}
						/>
					))}
				</HStack>
			)}

			<CostDetailView data={viewData} onSessionClick={onSessionClick} />
		</VStack>
	);
}
