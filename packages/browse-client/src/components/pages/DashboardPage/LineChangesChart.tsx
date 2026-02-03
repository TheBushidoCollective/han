/**
 * Line Changes Chart Component
 *
 * Bar chart showing lines added and removed over time.
 * Uses green for additions and red for deletions, GitHub-style.
 */

import type React from "react";
import { useMemo } from "react";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface DailyActivity {
	readonly date: string;
	readonly linesAdded: number;
	readonly linesRemoved: number;
	readonly filesChanged: number;
}

interface LineChangesChartProps {
	dailyActivity: ReadonlyArray<DailyActivity>;
}

// GitHub-style colors for line changes
const COLORS = {
	added: "#22c55e", // Green for additions
	removed: "#ef4444", // Red for removals
	neutral: "#6b7280", // Gray for no changes
};

/**
 * Format number with K suffix for thousands
 */
function formatNumber(num: number): string {
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}k`;
	}
	return num.toString();
}

/**
 * Aggregate daily activity into weeks for cleaner visualization
 */
function aggregateToWeeks(dailyActivity: ReadonlyArray<DailyActivity>): Array<{
	startDate: string;
	endDate: string;
	linesAdded: number;
	linesRemoved: number;
	filesChanged: number;
}> {
	const weeks: Array<{
		startDate: string;
		endDate: string;
		linesAdded: number;
		linesRemoved: number;
		filesChanged: number;
	}> = [];

	for (let i = 0; i < dailyActivity.length; i += 7) {
		const weekSlice = dailyActivity.slice(i, i + 7);
		if (weekSlice.length === 0) continue;

		const linesAdded = weekSlice.reduce((sum, d) => sum + d.linesAdded, 0);
		const linesRemoved = weekSlice.reduce((sum, d) => sum + d.linesRemoved, 0);
		const filesChanged = weekSlice.reduce((sum, d) => sum + d.filesChanged, 0);

		weeks.push({
			startDate: weekSlice[0].date,
			endDate: weekSlice[weekSlice.length - 1].date,
			linesAdded,
			linesRemoved,
			filesChanged,
		});
	}

	return weeks;
}

export function LineChangesChart({
	dailyActivity,
}: LineChangesChartProps): React.ReactElement {
	// Aggregate into weeks for cleaner visualization
	const weeks = useMemo(() => aggregateToWeeks(dailyActivity), [dailyActivity]);

	// Calculate totals
	const totals = useMemo(() => {
		let added = 0;
		let removed = 0;
		let files = 0;
		for (const d of dailyActivity) {
			added += d.linesAdded;
			removed += d.linesRemoved;
			files += d.filesChanged;
		}
		return { added, removed, files };
	}, [dailyActivity]);

	// Calculate max for scaling
	const maxChange = useMemo(() => {
		let max = 1;
		for (const w of weeks) {
			max = Math.max(max, w.linesAdded, w.linesRemoved);
		}
		return max;
	}, [weeks]);

	const chartHeight = 80;
	const barHeight = chartHeight / 2;

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Stats row */}
			<HStack gap="lg">
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Lines Added
					</Text>
					<Text weight="semibold" size="lg" style={{ color: COLORS.added }}>
						+{formatNumber(totals.added)}
					</Text>
				</VStack>
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Lines Removed
					</Text>
					<Text weight="semibold" size="lg" style={{ color: COLORS.removed }}>
						-{formatNumber(totals.removed)}
					</Text>
				</VStack>
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Files Changed
					</Text>
					<Text weight="semibold" size="lg">
						{formatNumber(totals.files)}
					</Text>
				</VStack>
			</HStack>

			{/* Bar chart - additions above, removals below */}
			<VStack style={{ width: "100%" }}>
				{/* Additions (above baseline) */}
				<HStack
					align="flex-end"
					style={{
						height: barHeight,
						width: "100%",
					}}
				>
					{weeks.map((w, idx) => {
						const height = Math.max(
							(w.linesAdded / maxChange) * barHeight,
							w.linesAdded > 0 ? 2 : 0,
						);
						return (
							<Box
								key={`add-${w.startDate}-${idx}`}
								style={{
									flex: 1,
									height,
									backgroundColor: COLORS.added,
									borderRadius: 2,
									opacity: w.linesAdded > 0 ? 1 : 0.2,
									marginHorizontal: 0.5,
								}}
							/>
						);
					})}
				</HStack>

				{/* Baseline */}
				<Box
					style={{
						width: "100%",
						height: 1,
						backgroundColor: "#374151",
					}}
				/>

				{/* Removals (below baseline) */}
				<HStack
					align="flex-start"
					style={{
						height: barHeight,
						width: "100%",
					}}
				>
					{weeks.map((w, idx) => {
						const height = Math.max(
							(w.linesRemoved / maxChange) * barHeight,
							w.linesRemoved > 0 ? 2 : 0,
						);
						return (
							<Box
								key={`rem-${w.startDate}-${idx}`}
								style={{
									flex: 1,
									height,
									backgroundColor: COLORS.removed,
									borderRadius: 2,
									opacity: w.linesRemoved > 0 ? 1 : 0.2,
									marginHorizontal: 0.5,
								}}
							/>
						);
					})}
				</HStack>
			</VStack>

			{/* Legend */}
			<HStack gap="md" align="center">
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: "10px",
							height: "10px",
							borderRadius: "2px",
							backgroundColor: COLORS.added,
						}}
					/>
					<Text color="muted" size="xs">
						Added
					</Text>
				</HStack>
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: "10px",
							height: "10px",
							borderRadius: "2px",
							backgroundColor: COLORS.removed,
						}}
					/>
					<Text color="muted" size="xs">
						Removed
					</Text>
				</HStack>
			</HStack>
		</VStack>
	);
}
