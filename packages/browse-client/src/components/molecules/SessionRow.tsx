/**
 * SessionRow - Universal session row molecule
 *
 * A configurable row for displaying sessions across dashboard cards.
 * All fields are optional — only provided fields are rendered.
 */

import type React from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import {
	formatCost,
	formatRelativeDate,
	formatTokens,
	getScoreBgColor,
	getScoreColor,
} from "./session-utils.ts";

interface SessionRowProps {
	/** Primary display text (summary, slug, or truncated ID) */
	label: string;
	/** Secondary text shown below label (slug when summary is shown) */
	sublabel?: string;
	/** Session start timestamp for relative date display */
	startedAt?: string | null;
	/** Callback when the row is pressed */
	onPress?: () => void;

	/** Project name badge */
	projectName?: string;
	/** Git branch / worktree name */
	gitBranch?: string;
	/** Message count */
	messageCount?: number;

	/** Cost in USD (shown as right-side badge) */
	costUsd?: number;
	/** Token count (shown alongside cost) */
	tokenCount?: number;

	/** Effectiveness score 0-100 (shown as left-side badge) */
	effectivenessScore?: number;
	/** Sentiment trend arrow */
	sentimentTrend?: string;
	/** Task completion rate 0-1 */
	taskCompletionRate?: number;
	/** Turn count */
	turnCount?: number;

	/** Ranking number (e.g., 1, 2, 3 for "Most Expensive") */
	rank?: number;
}

function getTrendDisplay(trend: string): { arrow: string; color: string } {
	switch (trend) {
		case "improving":
			return { arrow: "\u2191", color: "#10b981" };
		case "declining":
			return { arrow: "\u2193", color: "#ef4444" };
		case "stable":
			return { arrow: "\u2192", color: "#6b7280" };
		default:
			return { arrow: "\u2014", color: "#6b7280" };
	}
}

export function SessionRow({
	label,
	sublabel,
	startedAt,
	onPress,
	messageCount,
	costUsd,
	tokenCount,
	effectivenessScore,
	sentimentTrend,
	taskCompletionRate,
	turnCount,
	rank,
}: SessionRowProps): React.ReactElement {
	const hasEffectiveness = effectivenessScore != null;
	const hasCost = costUsd != null;

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
			{/* Rank number (cost context) */}
			{rank != null && (
				<Text
					color="muted"
					size="xs"
					style={{ width: 18, textAlign: "right", flexShrink: 0 }}
				>
					{rank}.
				</Text>
			)}

			{/* Effectiveness score badge */}
			{hasEffectiveness && (
				<Box
					style={{
						width: 38,
						height: 26,
						backgroundColor: getScoreBgColor(effectivenessScore),
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
						style={{
							color: getScoreColor(effectivenessScore),
							textAlign: "center",
						}}
					>
						{Math.round(effectivenessScore)}
					</Text>
				</Box>
			)}

			{/* Session info */}
			<VStack
				gap="xs"
				style={{
					flex: 1,
					minWidth: 0,
				}}
			>
				<Text
					size="sm"
					weight={hasCost ? "medium" : undefined}
					numberOfLines={1}
				>
					{label}
				</Text>
				<HStack gap="sm" align="center">
					{startedAt && (
						<Text color="muted" size="xs">
							{formatRelativeDate(startedAt)}
						</Text>
					)}
					{sublabel && (
						<Text color="muted" size="xs" numberOfLines={1}>
							{sublabel}
						</Text>
					)}
					{messageCount != null && (
						<Text color="muted" size="xs">
							{messageCount} msgs
						</Text>
					)}
					{tokenCount != null && (
						<Text color="muted" size="xs">
							{formatTokens(tokenCount)} tokens
						</Text>
					)}
				</HStack>
			</VStack>

			{/* Right side: context-specific metrics */}
			{hasEffectiveness && (
				<HStack gap="sm" align="center" style={{ flexShrink: 0 }}>
					{turnCount != null && (
						<Text color="muted" size="xs">
							{turnCount}t
						</Text>
					)}
					{sentimentTrend && (
						<Text
							size="xs"
							style={{ color: getTrendDisplay(sentimentTrend).color }}
						>
							{getTrendDisplay(sentimentTrend).arrow}
						</Text>
					)}
					{taskCompletionRate != null && (
						<Text color="muted" size="xs">
							{Math.round(taskCompletionRate * 100)}%
						</Text>
					)}
				</HStack>
			)}

			{hasCost && (
				<Text weight="semibold" size="sm" style={{ flexShrink: 0 }}>
					{formatCost(costUsd)}
				</Text>
			)}
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
