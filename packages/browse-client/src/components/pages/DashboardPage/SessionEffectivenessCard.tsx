/**
 * Session Effectiveness Card Component
 *
 * Shows top and bottom sessions ranked by effectiveness score.
 * Each row displays score badge, summary (or slug fallback), date, and inline metrics.
 */

import type React from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface SessionEffectiveness {
	readonly sessionId: string;
	readonly slug: string | null;
	readonly summary: string | null;
	readonly score: number;
	readonly sentimentTrend: string;
	readonly avgSentimentScore: number;
	readonly turnCount: number;
	readonly taskCompletionRate: number;
	readonly compactionCount: number;
	readonly focusScore: number;
	readonly startedAt: string | null;
}

interface SessionEffectivenessCardProps {
	topSessions: readonly SessionEffectiveness[];
	bottomSessions: readonly SessionEffectiveness[];
	onSessionClick?: (sessionId: string) => void;
}

/**
 * Get color for score badge
 */
function getScoreColor(score: number): string {
	if (score > 70) return "#10b981"; // Green
	if (score >= 40) return "#f59e0b"; // Amber
	return "#ef4444"; // Red
}

/**
 * Get background color for score badge
 */
function getScoreBgColor(score: number): string {
	if (score > 70) return "rgba(16, 185, 129, 0.15)";
	if (score >= 40) return "rgba(245, 158, 11, 0.15)";
	return "rgba(239, 68, 68, 0.15)";
}

/**
 * Get trend arrow and color
 */
function getTrendDisplay(trend: string): { arrow: string; color: string } {
	switch (trend) {
		case "improving":
			return { arrow: "\u2191", color: "#10b981" }; // Up arrow, green
		case "declining":
			return { arrow: "\u2193", color: "#ef4444" }; // Down arrow, red
		case "stable":
			return { arrow: "\u2192", color: "#6b7280" }; // Right arrow, gray
		default:
			return { arrow: "\u2014", color: "#6b7280" }; // Em dash, gray
	}
}

/**
 * Format date for display (relative or short date)
 */
function formatSessionDate(dateStr: string | null): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Get session display label - prefer summary over slug
 */
function getSessionLabel(session: SessionEffectiveness): string {
	if (session.summary) return session.summary;
	if (session.slug) return session.slug;
	return `${session.sessionId.slice(0, 12)}...`;
}

/**
 * A single session row with two-line layout
 */
function SessionRow({
	session,
	onPress,
}: {
	session: SessionEffectiveness;
	onPress?: () => void;
}): React.ReactElement {
	const scoreColor = getScoreColor(session.score);
	const scoreBg = getScoreBgColor(session.score);
	const trend = getTrendDisplay(session.sentimentTrend);
	const hasSummary = !!session.summary;

	const content = (
		<HStack
			gap="sm"
			align="center"
			style={{
				width: "100%",
				paddingVertical: theme.spacing.sm,
				paddingHorizontal: theme.spacing.sm,
				borderRadius: theme.radii.md,
			}}
		>
			{/* Score badge */}
			<Box
				style={{
					width: 38,
					height: 26,
					backgroundColor: scoreBg,
					borderRadius: theme.radii.sm,
					alignItems: "center",
					justifyContent: "center",
					display: "flex",
					flexShrink: 0,
				}}
			>
				<Text
					size="xs"
					weight="bold"
					style={{ color: scoreColor, textAlign: "center" }}
				>
					{Math.round(session.score)}
				</Text>
			</Box>

			{/* Session info - summary/slug + date */}
			<VStack
				gap="xs"
				style={{
					flex: 1,
					minWidth: 0,
				}}
			>
				<Text
					size="sm"
					style={{
						overflow: "hidden",
					}}
					numberOfLines={1}
				>
					{getSessionLabel(session)}
				</Text>
				<HStack gap="sm" align="center">
					{session.startedAt && (
						<Text color="muted" size="xs">
							{formatSessionDate(session.startedAt)}
						</Text>
					)}
					{hasSummary && session.slug && (
						<Text color="muted" size="xs" numberOfLines={1}>
							{session.slug}
						</Text>
					)}
				</HStack>
			</VStack>

			{/* Inline metrics */}
			<HStack gap="sm" align="center" style={{ flexShrink: 0 }}>
				{/* Turns */}
				<Text color="muted" size="xs">
					{session.turnCount}t
				</Text>

				{/* Sentiment trend */}
				<Text size="xs" style={{ color: trend.color }}>
					{trend.arrow}
				</Text>

				{/* Task completion */}
				<Text color="muted" size="xs">
					{Math.round(session.taskCompletionRate * 100)}%
				</Text>
			</HStack>
		</HStack>
	);

	if (onPress) {
		return (
			<Pressable onPress={onPress} style={{ width: "100%" }}>
				{content}
			</Pressable>
		);
	}

	return content;
}

export function SessionEffectivenessCard({
	topSessions,
	bottomSessions,
	onSessionClick,
}: SessionEffectivenessCardProps): React.ReactElement {
	// No data state
	if (topSessions.length === 0 && bottomSessions.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No session effectiveness data available
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Most Effective section */}
			{topSessions.length > 0 && (
				<VStack gap="xs" style={{ width: "100%" }}>
					<HStack gap="xs" align="center">
						<Box
							style={{
								width: 8,
								height: 8,
								borderRadius: 4,
								backgroundColor: "#10b981",
							}}
						/>
						<Text color="secondary" size="xs" weight="semibold">
							Most Effective
						</Text>
					</HStack>
					<VStack style={{ width: "100%", gap: 2 }}>
						{topSessions.map((session) => (
							<SessionRow
								key={session.sessionId}
								session={session}
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

			{/* Divider */}
			{topSessions.length > 0 && bottomSessions.length > 0 && (
				<Box
					style={{
						width: "100%",
						height: 1,
						backgroundColor: theme.colors.border.subtle,
					}}
				/>
			)}

			{/* Needs Improvement section */}
			{bottomSessions.length > 0 && (
				<VStack gap="xs" style={{ width: "100%" }}>
					<HStack gap="xs" align="center">
						<Box
							style={{
								width: 8,
								height: 8,
								borderRadius: 4,
								backgroundColor: "#f59e0b",
							}}
						/>
						<Text color="secondary" size="xs" weight="semibold">
							Needs Improvement
						</Text>
					</HStack>
					<VStack style={{ width: "100%", gap: 2 }}>
						{bottomSessions.map((session) => (
							<SessionRow
								key={session.sessionId}
								session={session}
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

			{/* Legend */}
			<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
				<Text color="muted" size="xs">
					Score (0-100)
				</Text>
				<Text color="muted" size="xs">
					t = turns
				</Text>
				<HStack gap="xs" align="center">
					<Text size="xs" style={{ color: "#10b981" }}>
						{"\u2191"}
					</Text>
					<Text color="muted" size="xs">
						improving
					</Text>
				</HStack>
				<HStack gap="xs" align="center">
					<Text size="xs" style={{ color: "#ef4444" }}>
						{"\u2193"}
					</Text>
					<Text color="muted" size="xs">
						declining
					</Text>
				</HStack>
				<Text color="muted" size="xs">
					% = task completion
				</Text>
			</HStack>
		</VStack>
	);
}
