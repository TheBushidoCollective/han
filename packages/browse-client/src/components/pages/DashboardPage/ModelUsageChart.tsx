/**
 * Model Usage Chart Component
 *
 * Stacked bar chart showing token usage by model over time.
 * Uses distinct colors for each model family (Opus, Sonnet, Haiku).
 */

import type React from "react";
import { useMemo } from "react";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface ModelTokenEntry {
	readonly model: string;
	readonly displayName: string;
	readonly tokens: number;
}

interface DailyModelTokens {
	readonly date: string;
	readonly models: ReadonlyArray<ModelTokenEntry>;
	readonly totalTokens: number;
}

interface ModelUsageStats {
	readonly model: string;
	readonly displayName: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheCreationTokens: number;
	readonly totalTokens: number;
}

interface ModelUsageChartProps {
	dailyModelTokens: ReadonlyArray<DailyModelTokens>;
	modelUsage: ReadonlyArray<ModelUsageStats>;
}

// Base hues for model families (HSL hue values)
const FAMILY_HUES: Record<string, number> = {
	opus: 265, // Purple
	sonnet: 217, // Blue
	haiku: 160, // Green
};

const DEFAULT_COLOR = "#6b7280"; // Gray fallback

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}K`;
	}
	return num.toString();
}

/**
 * Format date as compact string (e.g., "12/1")
 */
function formatShortDate(dateStr: string): string {
	const date = new Date(dateStr);
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format date range as compact string (e.g., "12/1-7" or "12/28-1/3")
 */
function formatDateRange(startStr: string, endStr: string): string {
	const start = new Date(startStr);
	const end = new Date(endStr);

	const startMonth = start.getMonth() + 1;
	const endMonth = end.getMonth() + 1;

	if (startMonth === endMonth) {
		// Same month: "12/1-7"
		return `${startMonth}/${start.getDate()}-${end.getDate()}`;
	}
	// Different months: "12/28-1/3"
	return `${formatShortDate(startStr)}-${formatShortDate(endStr)}`;
}

/**
 * Get color for a model based on family hue and version.
 * Higher minor versions produce darker shades.
 */
function getModelColor(displayName: string): string {
	const family = displayName.split(" ")[0]?.toLowerCase() ?? "";
	const hue = FAMILY_HUES[family];
	if (hue === undefined) return DEFAULT_COLOR;

	// Parse version: "Opus 4.6" -> 4.6, "Opus 4" -> 4.0
	const versionMatch = displayName.match(/(\d+)(?:\.(\d+))?/);
	const minor = versionMatch?.[2] ? Number.parseInt(versionMatch[2], 10) : 0;

	// Higher minor = darker: lightness goes from 65% (minor 0) down to 35% (minor 6+)
	const lightness = Math.max(35, 65 - minor * 5);
	return `hsl(${hue}, 70%, ${lightness}%)`;
}

/**
 * Aggregate daily data into weeks for cleaner visualization
 */
function aggregateToWeeks(dailyData: ReadonlyArray<DailyModelTokens>): Array<{
	startDate: string;
	endDate: string;
	modelTotals: Map<string, { displayName: string; tokens: number }>;
	totalTokens: number;
}> {
	const weeks: Array<{
		startDate: string;
		endDate: string;
		modelTotals: Map<string, { displayName: string; tokens: number }>;
		totalTokens: number;
	}> = [];

	for (let i = 0; i < dailyData.length; i += 7) {
		const weekSlice = dailyData.slice(i, i + 7);
		if (weekSlice.length === 0) continue;

		const modelTotals = new Map<
			string,
			{ displayName: string; tokens: number }
		>();
		let totalTokens = 0;

		for (const day of weekSlice) {
			for (const model of day.models) {
				const existing = modelTotals.get(model.displayName);
				if (existing) {
					existing.tokens += model.tokens;
				} else {
					modelTotals.set(model.displayName, {
						displayName: model.displayName,
						tokens: model.tokens,
					});
				}
				totalTokens += model.tokens;
			}
		}

		weeks.push({
			startDate: weekSlice[0].date,
			endDate: weekSlice[weekSlice.length - 1].date,
			modelTotals,
			totalTokens,
		});
	}

	return weeks;
}

export function ModelUsageChart({
	dailyModelTokens,
	modelUsage,
}: ModelUsageChartProps): React.ReactElement {
	// Aggregate into weeks
	const weeks = useMemo(
		() => aggregateToWeeks(dailyModelTokens),
		[dailyModelTokens],
	);

	// Get all unique models for legend
	const allModels = useMemo(() => {
		const models = new Set<string>();
		for (const day of dailyModelTokens) {
			for (const m of day.models) {
				models.add(m.displayName);
			}
		}
		// Sort by model family priority (Opus > Sonnet > Haiku)
		return Array.from(models).sort((a, b) => {
			const priority = ["Opus", "Sonnet", "Haiku"];
			const aFamily = priority.findIndex((p) => a.includes(p));
			const bFamily = priority.findIndex((p) => b.includes(p));
			if (aFamily !== bFamily) return aFamily - bFamily;
			return b.localeCompare(a); // Higher version first
		});
	}, [dailyModelTokens]);

	// Calculate max for scaling
	const maxWeeklyTokens = useMemo(() => {
		let max = 1;
		for (const w of weeks) {
			max = Math.max(max, w.totalTokens);
		}
		return max;
	}, [weeks]);

	// Calculate totals per model
	const totalsByModel = useMemo(() => {
		const totals = new Map<string, number>();
		for (const m of modelUsage) {
			totals.set(m.displayName, m.totalTokens);
		}
		return totals;
	}, [modelUsage]);

	const chartHeight = 100;

	// If no data, show placeholder
	if (dailyModelTokens.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No model usage data available
				</Text>
				<Text color="muted" size="xs">
					Usage data from ~/.claude/stats-cache.json
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Model totals summary */}
			<HStack gap="lg" style={{ flexWrap: "wrap" }}>
				{allModels.slice(0, 4).map((modelName) => (
					<VStack key={modelName} gap="xs">
						<HStack gap="xs" align="center">
							<Box
								style={{
									width: "8px",
									height: "8px",
									borderRadius: "2px",
									backgroundColor: getModelColor(modelName),
								}}
							/>
							<Text color="secondary" size="xs">
								{modelName}
							</Text>
						</HStack>
						<Text weight="semibold" size="sm">
							{formatNumber(totalsByModel.get(modelName) || 0)}
						</Text>
					</VStack>
				))}
			</HStack>

			{/* Stacked bar chart with date labels */}
			<VStack gap="xs" style={{ width: "100%" }}>
				<HStack
					align="flex-end"
					style={{
						height: chartHeight,
						width: "100%",
					}}
				>
					{weeks.map((week, idx) => {
						const heightRatio = week.totalTokens / maxWeeklyTokens;
						const totalHeight = Math.max(
							heightRatio * chartHeight,
							week.totalTokens > 0 ? 4 : 0,
						);

						// Build stacked segments
						const segments: Array<{
							displayName: string;
							height: number;
							color: string;
						}> = [];

						for (const modelName of allModels) {
							const modelData = week.modelTotals.get(modelName);
							if (modelData && modelData.tokens > 0) {
								const segmentHeight =
									(modelData.tokens / week.totalTokens) * totalHeight;
								segments.push({
									displayName: modelName,
									height: segmentHeight,
									color: getModelColor(modelName),
								});
							}
						}

						return (
							<VStack
								key={`week-${week.startDate}-${idx}`}
								justify="flex-end"
								style={{
									flex: 1,
									height: totalHeight,
									borderRadius: 2,
									overflow: "hidden",
									opacity: week.totalTokens > 0 ? 1 : 0.2,
									marginHorizontal: 1,
								}}
							>
								{segments.map((seg, segIdx) => (
									<Box
										key={`seg-${seg.displayName}-${segIdx}`}
										style={{
											height: seg.height,
											backgroundColor: seg.color,
											minHeight: seg.height > 0 ? 2 : 0,
										}}
									/>
								))}
							</VStack>
						);
					})}
				</HStack>

				{/* Date labels */}
				<HStack style={{ width: "100%" }}>
					{weeks.map((week, idx) => (
						<Text
							key={`label-${week.startDate}-${idx}`}
							size="xs"
							color="muted"
							style={{
								flex: 1,
								textAlign: "center",
								overflow: "hidden",
							}}
						>
							{formatDateRange(week.startDate, week.endDate)}
						</Text>
					))}
				</HStack>
			</VStack>

			{/* Legend */}
			<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
				{allModels.map((modelName) => (
					<HStack key={modelName} gap="xs" align="center">
						<Box
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "2px",
								backgroundColor: getModelColor(modelName),
							}}
						/>
						<Text color="muted" size="xs">
							{modelName}
						</Text>
					</HStack>
				))}
			</HStack>
		</VStack>
	);
}
