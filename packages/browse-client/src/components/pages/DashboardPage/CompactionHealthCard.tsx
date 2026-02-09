/**
 * Compaction Health Card Component
 *
 * Displays compaction metrics as an indicator of context efficiency.
 * Shows health badge, visual ratio bar, stats, and type breakdown.
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface CompactionStats {
	readonly totalCompactions: number;
	readonly sessionsWithCompactions: number;
	readonly sessionsWithoutCompactions: number;
	readonly avgCompactionsPerSession: number;
	readonly autoCompactCount: number;
	readonly manualCompactCount: number;
	readonly continuationCount: number;
}

interface CompactionHealthCardProps {
	compactionStats: CompactionStats;
}

/**
 * Health level thresholds and display config
 */
interface HealthLevel {
	readonly label: string;
	readonly color: string;
	readonly bgColor: string;
}

function getHealthLevel(avgPerSession: number): HealthLevel {
	if (avgPerSession < 0.5) {
		return {
			label: "Excellent",
			color: "#10b981",
			bgColor: "rgba(16, 185, 129, 0.15)",
		};
	}
	if (avgPerSession <= 1.5) {
		return {
			label: "Good",
			color: "#3b82f6",
			bgColor: "rgba(59, 130, 246, 0.15)",
		};
	}
	if (avgPerSession <= 3) {
		return {
			label: "Moderate",
			color: "#f59e0b",
			bgColor: "rgba(245, 158, 11, 0.15)",
		};
	}
	return {
		label: "High Usage",
		color: "#f97316",
		bgColor: "rgba(249, 115, 22, 0.15)",
	};
}

export function CompactionHealthCard({
	compactionStats,
}: CompactionHealthCardProps): React.ReactElement {
	const health = useMemo(
		() => getHealthLevel(compactionStats.avgCompactionsPerSession),
		[compactionStats.avgCompactionsPerSession],
	);

	// Session ratio for the visual bar
	const totalSessions =
		compactionStats.sessionsWithCompactions +
		compactionStats.sessionsWithoutCompactions;
	const withPercent =
		totalSessions > 0
			? (compactionStats.sessionsWithCompactions / totalSessions) * 100
			: 0;
	const withoutPercent =
		totalSessions > 0
			? (compactionStats.sessionsWithoutCompactions / totalSessions) * 100
			: 0;

	// Breakdown max for scaling the type bars
	const typeMax = useMemo(
		() =>
			Math.max(
				compactionStats.autoCompactCount,
				compactionStats.manualCompactCount,
				compactionStats.continuationCount,
				1,
			),
		[compactionStats],
	);

	const typeBreakdown = [
		{
			label: "Auto Compact",
			count: compactionStats.autoCompactCount,
			color: "#f59e0b",
		},
		{
			label: "Manual Compact",
			count: compactionStats.manualCompactCount,
			color: "#8b5cf6",
		},
		{
			label: "Continuation",
			count: compactionStats.continuationCount,
			color: "#3b82f6",
		},
	];

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Health indicator badge */}
			<HStack justify="space-between" align="center">
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Context Efficiency
					</Text>
					<Text weight="semibold" size="lg">
						{compactionStats.totalCompactions} compactions
					</Text>
				</VStack>
				<Box
					style={{
						paddingHorizontal: theme.spacing.md,
						paddingVertical: theme.spacing.xs,
						backgroundColor: health.bgColor,
						borderRadius: theme.radii.full,
					}}
				>
					<Text weight="semibold" size="sm" style={{ color: health.color }}>
						{health.label}
					</Text>
				</Box>
			</HStack>

			{/* Session ratio bar */}
			<VStack gap="xs" style={{ width: "100%" }}>
				<HStack justify="space-between" align="center">
					<Text color="muted" size="xs">
						Sessions without compactions
					</Text>
					<Text color="muted" size="xs">
						Sessions with compactions
					</Text>
				</HStack>
				<Box
					style={{
						display: "flex",
						flexDirection: "row",
						height: 12,
						borderRadius: theme.radii.md,
						overflow: "hidden",
						backgroundColor: theme.colors.bg.tertiary,
						width: "100%",
					}}
				>
					{withoutPercent > 0 && (
						<Box
							style={{
								width: `${withoutPercent}%`,
								height: "100%",
								backgroundColor: "#10b981",
							}}
						/>
					)}
					{withPercent > 0 && (
						<Box
							style={{
								width: `${withPercent}%`,
								height: "100%",
								backgroundColor: "#f59e0b",
							}}
						/>
					)}
				</Box>
				<HStack justify="space-between" align="center">
					<Text size="xs" style={{ color: "#10b981" }}>
						{compactionStats.sessionsWithoutCompactions} (
						{withoutPercent.toFixed(0)}%)
					</Text>
					<Text size="xs" style={{ color: "#f59e0b" }}>
						{compactionStats.sessionsWithCompactions} ({withPercent.toFixed(0)}
						%)
					</Text>
				</HStack>
			</VStack>

			{/* Stats */}
			<HStack gap="lg">
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Total Compactions
					</Text>
					<Text weight="semibold" size="lg">
						{compactionStats.totalCompactions}
					</Text>
				</VStack>
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Avg per Session
					</Text>
					<Text weight="semibold" size="lg">
						{compactionStats.avgCompactionsPerSession.toFixed(1)}
					</Text>
				</VStack>
			</HStack>

			{/* Type breakdown bars */}
			<VStack gap="sm" style={{ width: "100%" }}>
				<Text color="secondary" size="xs">
					Breakdown by Type
				</Text>
				{typeBreakdown.map((entry) => (
					<HStack
						key={entry.label}
						gap="sm"
						align="center"
						style={{ width: "100%" }}
					>
						<Text size="xs" color="muted" style={{ width: 110, flexShrink: 0 }}>
							{entry.label}
						</Text>
						<Box
							style={{
								flex: 1,
								height: 8,
								backgroundColor: theme.colors.bg.tertiary,
								borderRadius: theme.radii.sm,
								overflow: "hidden",
							}}
						>
							<Box
								style={{
									width: `${Math.max((entry.count / typeMax) * 100, entry.count > 0 ? 2 : 0)}%`,
									height: "100%",
									backgroundColor: entry.color,
									borderRadius: theme.radii.sm,
								}}
							/>
						</Box>
						<Text
							size="xs"
							weight="semibold"
							style={{ width: 30, textAlign: "right" }}
						>
							{entry.count}
						</Text>
					</HStack>
				))}
			</VStack>

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
					Lower compaction rates indicate better use of subagents and focused
					conversations
				</Text>
			</Box>
		</VStack>
	);
}
