/**
 * Activity Heatmap Component
 *
 * GitHub-style contribution chart showing activity over the past year.
 * Each cell represents a day, with color intensity indicating activity level.
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface DailyActivity {
	readonly date: string;
	readonly messageCount: number;
	readonly sessionCount: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
}

interface ActivityHeatmapProps {
	dailyActivity: ReadonlyArray<DailyActivity>;
	firstSessionDate?: string | null;
	streakDays: number;
	totalActiveDays: number;
}

// Claude orange color scale for activity levels
const COLORS = {
	empty: theme.colors.bg.tertiary,
	level1: "#4a2c1a", // Darkest orange
	level2: "#8b4a2a", // Dark orange
	level3: "#c96442", // Medium orange
	level4: "#da7756", // Claude orange
	level5: "#f5a580", // Bright orange
};

/**
 * Get color based on activity level
 */
function getActivityColor(messageCount: number, maxMessages: number): string {
	if (messageCount === 0) return COLORS.empty;
	const intensity = messageCount / maxMessages;
	if (intensity <= 0.2) return COLORS.level1;
	if (intensity <= 0.4) return COLORS.level2;
	if (intensity <= 0.6) return COLORS.level3;
	if (intensity <= 0.8) return COLORS.level4;
	return COLORS.level5;
}

/**
 * Format date for tooltip
 */
function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Organize daily activity into weeks (columns)
 */
function organizeIntoWeeks(
	dailyActivity: ReadonlyArray<DailyActivity>,
): DailyActivity[][] {
	const weeks: DailyActivity[][] = [];

	for (let i = 0; i < dailyActivity.length; i += 7) {
		weeks.push(dailyActivity.slice(i, i + 7) as DailyActivity[]);
	}

	return weeks;
}

export function ActivityHeatmap({
	dailyActivity,
	firstSessionDate,
	streakDays,
	totalActiveDays,
}: ActivityHeatmapProps): React.ReactElement {
	// Trim activity to start from the first session date
	const trimmedActivity = useMemo(() => {
		if (!firstSessionDate) return dailyActivity;
		return dailyActivity.filter((d) => d.date >= firstSessionDate);
	}, [dailyActivity, firstSessionDate]);

	// Calculate max messages for color scaling
	const maxMessages = useMemo(() => {
		return Math.max(...trimmedActivity.map((d) => d.messageCount), 1);
	}, [trimmedActivity]);

	// Organize into weeks (columns)
	const weeks = useMemo(
		() => organizeIntoWeeks(trimmedActivity),
		[trimmedActivity],
	);

	// Cell size for activity grid
	const cellSize = 12;
	const cellGap = 2;

	// Pad with empty weeks so the grid fills the container width.
	// We generate 52 weeks of padding (1 year) and rely on overflow:hidden
	// + justifyContent:flex-end to clip the excess on the left.
	const paddedWeeks = useMemo(() => {
		const padCount = Math.max(0, 52 - weeks.length);
		if (padCount === 0) return weeks;
		const emptyWeeks: DailyActivity[][] = Array.from(
			{ length: padCount },
			(_, wi) =>
				Array.from({ length: 7 }, (_, di) => ({
					date: `pad-${wi}-${di}`,
					messageCount: 0,
					sessionCount: 0,
					inputTokens: 0,
					outputTokens: 0,
				})),
		);
		return [...emptyWeeks, ...weeks];
	}, [weeks]);

	return (
		<VStack gap="sm" style={{ width: "100%" }}>
			{/* Stats row */}
			<HStack gap="lg">
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Current Streak
					</Text>
					<Text weight="semibold" size="lg">
						{streakDays} days
					</Text>
				</VStack>
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Active Days
					</Text>
					<Text weight="semibold" size="lg">
						{totalActiveDays}
					</Text>
				</VStack>
			</HStack>

			{/* Year and month labels */}
			<HStack gap="sm" align="flex-start" style={{ width: "100%" }}>
				<Box style={{ width: "28px", flexShrink: 0 }} />
				<Box
					style={{
						display: "flex",
						flexDirection: "row",
						gap: `${cellGap}px`,
						overflow: "hidden",
						flex: 1,
						minWidth: 0,
						justifyContent: "flex-end",
					}}
				>
					{paddedWeeks.map((week, weekIdx) => {
						// Find if this week starts a new year or month
						const firstDay = week[0];
						if (!firstDay) return null;
						// Skip labels for padding weeks (non-real dates)
						if (firstDay.date.startsWith("pad-")) {
							return (
								<Box
									key={`label-${firstDay.date}`}
									style={{
										width: cellSize,
										flexShrink: 0,
									}}
								/>
							);
						}
						const date = new Date(firstDay.date);
						const month = date.toLocaleDateString("en-US", {
							month: "short",
						});

						// Check if this is first week of data or new month
						const prevWeek = paddedWeeks[weekIdx - 1];
						const prevFirstDay = prevWeek?.[0];
						const prevIsPad = prevFirstDay?.date.startsWith("pad-");
						const isNewMonth =
							prevIsPad ||
							!prevFirstDay ||
							new Date(prevFirstDay.date).getMonth() !== date.getMonth();

						// Show year suffix only on January labels
						const isJanuary = date.getMonth() === 0;
						const label = isNewMonth
							? isJanuary
								? `Jan '${String(date.getFullYear()).slice(2)}`
								: month
							: null;

						return (
							<Box
								key={`label-${week[0]?.date ?? weekIdx}`}
								style={{
									width: cellSize,
									flexShrink: 0,
									overflow: "visible",
								}}
							>
								{label ? (
									<Text
										color={isJanuary ? "secondary" : "muted"}
										size="xs"
										style={{
											whiteSpace: "nowrap",
											...(isJanuary && { fontWeight: 600 }),
										}}
									>
										{label}
									</Text>
								) : null}
							</Box>
						);
					})}
				</Box>
			</HStack>

			{/* Heatmap grid */}
			<HStack gap="sm" align="flex-start" style={{ width: "100%" }}>
				{/* Day labels */}
				<Box
					style={{
						display: "flex",
						flexDirection: "column",
						gap: `${cellGap}px`,
						width: "28px",
						flexShrink: 0,
					}}
				>
					{[
						{ key: "sun", label: "" },
						{ key: "mon", label: "Mon" },
						{ key: "tue", label: "" },
						{ key: "wed", label: "Wed" },
						{ key: "thu", label: "" },
						{ key: "fri", label: "Fri" },
						{ key: "sat", label: "" },
					].map((day) => (
						<Text
							key={day.key}
							color="muted"
							size="xs"
							style={{
								height: `${cellSize}px`,
								lineHeight: `${cellSize}px`,
							}}
						>
							{day.label}
						</Text>
					))}
				</Box>

				{/* Grid of weeks */}
				<Box
					style={{
						display: "flex",
						flexDirection: "row",
						gap: `${cellGap}px`,
						overflow: "hidden",
						paddingBottom: 4,
						flex: 1,
						minWidth: 0,
						justifyContent: "flex-end",
					}}
				>
					{paddedWeeks.map((week) => (
						<Box
							key={`week-${week[0]?.date ?? "empty"}`}
							style={{
								display: "flex",
								flexDirection: "column",
								gap: `${cellGap}px`,
								flexShrink: 0,
							}}
						>
							{week.map((day) => (
								<div
									key={day.date}
									role="img"
									aria-label={`${formatDate(day.date)}: ${day.messageCount} messages, ${day.sessionCount} sessions`}
									title={`${formatDate(day.date)}: ${day.messageCount} messages, ${day.sessionCount} sessions`}
									style={{
										width: `${cellSize}px`,
										height: `${cellSize}px`,
										borderRadius: "2px",
										backgroundColor: getActivityColor(
											day.messageCount,
											maxMessages,
										),
										cursor: "default",
									}}
								/>
							))}
						</Box>
					))}
				</Box>
			</HStack>

			{/* Legend */}
			<HStack gap="sm" align="center" style={{ paddingLeft: "32px" }}>
				<Text color="muted" size="xs">
					Less
				</Text>
				{[
					COLORS.empty,
					COLORS.level1,
					COLORS.level2,
					COLORS.level3,
					COLORS.level4,
					COLORS.level5,
				].map((color) => (
					<Box
						key={color}
						style={{
							width: `${cellSize}px`,
							height: `${cellSize}px`,
							borderRadius: "2px",
							backgroundColor: color,
						}}
					/>
				))}
				<Text color="muted" size="xs">
					More
				</Text>
			</HStack>
		</VStack>
	);
}
