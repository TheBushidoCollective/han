/**
 * Tool Usage Chart Component
 *
 * Horizontal bar chart of most-used tools, color-coded by category.
 * Shows percentage of total usage next to each bar. Limited to top 10 tools.
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { formatCount } from "@/components/helpers/formatters.ts";

interface ToolUsageStats {
	readonly toolName: string;
	readonly count: number;
}

interface ToolUsageChartProps {
	toolUsage: readonly ToolUsageStats[];
}

/**
 * Tool category color mapping
 */
const TOOL_CATEGORY_COLORS: Record<string, string> = {
	// Search/Read tools (blue)
	Read: "#3b82f6",
	Grep: "#3b82f6",
	Glob: "#3b82f6",
	// Modify tools (green)
	Edit: "#10b981",
	Write: "#10b981",
	NotebookEdit: "#10b981",
	// Execute tools (amber)
	Bash: "#f59e0b",
	// Delegate tools (purple)
	Task: "#8b5cf6",
	// Plan tools (pink)
	TodoWrite: "#ec4899",
	TodoRead: "#ec4899",
};

const DEFAULT_TOOL_COLOR = "#6b7280"; // Gray

/**
 * Get color for a tool based on its category
 */
function getToolColor(toolName: string): string {
	return TOOL_CATEGORY_COLORS[toolName] || DEFAULT_TOOL_COLOR;
}

/**
 * Get category label for legend
 */
const CATEGORY_LEGEND: Array<{ label: string; color: string }> = [
	{ label: "Search/Read", color: "#3b82f6" },
	{ label: "Modify", color: "#10b981" },
	{ label: "Execute", color: "#f59e0b" },
	{ label: "Delegate", color: "#8b5cf6" },
	{ label: "Plan", color: "#ec4899" },
	{ label: "Other", color: "#6b7280" },
];

export function ToolUsageChart({
	toolUsage,
}: ToolUsageChartProps): React.ReactElement {
	// Sort by count descending and take top 10
	const sorted = useMemo(
		() => [...toolUsage].sort((a, b) => b.count - a.count).slice(0, 10),
		[toolUsage],
	);

	// Total across ALL tools (not just top 10)
	const total = useMemo(
		() => toolUsage.reduce((sum, t) => sum + t.count, 0),
		[toolUsage],
	);

	// Max count for bar scaling (from top 10)
	const maxCount = useMemo(
		() => (sorted.length > 0 ? sorted[0].count : 1),
		[sorted],
	);

	// No data state
	if (toolUsage.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No tool usage data available
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Summary */}
			<Text color="secondary" size="xs">
				Top {sorted.length} of {toolUsage.length} tools ({formatCount(total)}{" "}
				total calls)
			</Text>

			{/* Horizontal bar chart */}
			<VStack gap="sm" style={{ width: "100%" }}>
				{sorted.map((entry) => {
					const barWidth =
						maxCount > 0 ? Math.max((entry.count / maxCount) * 100, 2) : 0;
					const percentage =
						total > 0 ? ((entry.count / total) * 100).toFixed(1) : "0";
					const color = getToolColor(entry.toolName);

					return (
						<HStack
							key={entry.toolName}
							gap="sm"
							align="center"
							style={{ width: "100%" }}
						>
							{/* Tool name */}
							<Text
								size="xs"
								color="secondary"
								style={{
									width: 90,
									flexShrink: 0,
								}}
								numberOfLines={1}
							>
								{entry.toolName}
							</Text>

							{/* Bar */}
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
										width: `${barWidth}%`,
										height: "100%",
										backgroundColor: color,
										borderRadius: theme.radii.sm,
									}}
								/>
							</Box>

							{/* Count and percentage */}
							<HStack
								gap="xs"
								align="center"
								style={{ flexShrink: 0, width: 70, justifyContent: "flex-end" }}
							>
								<Text size="xs" weight="semibold">
									{formatCount(entry.count)}
								</Text>
								<Text color="muted" size="xs">
									({percentage}%)
								</Text>
							</HStack>
						</HStack>
					);
				})}
			</VStack>

			{/* Category legend */}
			<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
				{CATEGORY_LEGEND.map((cat) => (
					<HStack key={cat.label} gap="xs" align="center">
						<Box
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "2px",
								backgroundColor: cat.color,
							}}
						/>
						<Text color="muted" size="xs">
							{cat.label}
						</Text>
					</HStack>
				))}
			</HStack>
		</VStack>
	);
}
