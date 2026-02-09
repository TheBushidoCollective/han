/**
 * Subagent Usage Chart Component
 *
 * Horizontal bar chart showing which subagent types are used most.
 * Color-coded by agent type with total summary.
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface SubagentUsageStats {
	readonly subagentType: string;
	readonly count: number;
}

interface SubagentUsageChartProps {
	subagentUsage: readonly SubagentUsageStats[];
}

/**
 * Color mapping for known subagent types
 */
const AGENT_COLORS: Record<string, string> = {
	Explore: "#3b82f6", // Blue
	Plan: "#8b5cf6", // Purple
	Bash: "#10b981", // Green
	"general-purpose": "#f59e0b", // Amber
	haiku: "#06b6d4", // Cyan
	sonnet: "#3b82f6", // Blue
	opus: "#a855f7", // Violet
};

const DEFAULT_COLOR = "#6b7280"; // Gray

/**
 * Get color for an agent type
 */
function getAgentColor(agentType: string): string {
	// Check exact match first
	if (AGENT_COLORS[agentType]) return AGENT_COLORS[agentType];

	// Check if the type contains a known keyword (case-insensitive)
	const lower = agentType.toLowerCase();
	for (const [key, color] of Object.entries(AGENT_COLORS)) {
		if (lower.includes(key.toLowerCase())) return color;
	}

	return DEFAULT_COLOR;
}

/**
 * Format count with K/M suffix
 */
function formatCount(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1)}K`;
	}
	return num.toString();
}

export function SubagentUsageChart({
	subagentUsage,
}: SubagentUsageChartProps): React.ReactElement {
	// Sort by count descending
	const sorted = useMemo(
		() => [...subagentUsage].sort((a, b) => b.count - a.count),
		[subagentUsage],
	);

	// Calculate total
	const total = useMemo(
		() => sorted.reduce((sum, s) => sum + s.count, 0),
		[sorted],
	);

	// Max count for bar scaling
	const maxCount = useMemo(
		() => (sorted.length > 0 ? sorted[0].count : 1),
		[sorted],
	);

	// No data state
	if (subagentUsage.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No subagent usage tracked
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Summary */}
			<Text color="secondary" size="xs">
				Total: {formatCount(total)} subagent calls
			</Text>

			{/* Horizontal bar chart */}
			<VStack gap="sm" style={{ width: "100%" }}>
				{sorted.map((entry) => {
					const barWidth =
						maxCount > 0 ? Math.max((entry.count / maxCount) * 100, 2) : 0;
					const color = getAgentColor(entry.subagentType);

					return (
						<VStack key={entry.subagentType} gap="xs" style={{ width: "100%" }}>
							<HStack
								justify="space-between"
								align="center"
								style={{ width: "100%" }}
							>
								<Text size="xs" color="secondary">
									{entry.subagentType}
								</Text>
								<Text size="xs" weight="semibold">
									{formatCount(entry.count)}
								</Text>
							</HStack>
							<Box
								style={{
									width: "100%",
									height: 8,
									backgroundColor: theme.colors.bg.tertiary,
									borderRadius: theme.radii.sm,
									overflow: "hidden",
								}}
							>
								<Box
									style={{
										width: `${barWidth}%`,
										height: "100%",
										backgroundColor: color,
										borderRadius: theme.radii.sm,
									}}
								/>
							</Box>
						</VStack>
					);
				})}
			</VStack>

			{/* Legend */}
			<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
				{sorted.map((entry) => (
					<HStack key={`legend-${entry.subagentType}`} gap="xs" align="center">
						<Box
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "2px",
								backgroundColor: getAgentColor(entry.subagentType),
							}}
						/>
						<Text color="muted" size="xs">
							{entry.subagentType}
						</Text>
					</HStack>
				))}
			</HStack>
		</VStack>
	);
}
