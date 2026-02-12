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
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { SessionRow } from "@/components/molecules/SessionRow.tsx";

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

function getSessionLabel(session: SessionEffectiveness): string {
	if (session.summary) return session.summary;
	if (session.slug) return session.slug;
	return `${session.sessionId.slice(0, 12)}...`;
}

export function SessionEffectivenessCard({
	topSessions,
	bottomSessions,
	onSessionClick,
}: SessionEffectivenessCardProps): React.ReactElement {
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
								label={getSessionLabel(session)}
								sublabel={
									session.summary && session.slug ? session.slug : undefined
								}
								startedAt={session.startedAt}
								effectivenessScore={session.score}
								sentimentTrend={session.sentimentTrend}
								taskCompletionRate={session.taskCompletionRate}
								turnCount={session.turnCount}
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
								label={getSessionLabel(session)}
								sublabel={
									session.summary && session.slug ? session.slug : undefined
								}
								startedAt={session.startedAt}
								effectivenessScore={session.score}
								sentimentTrend={session.sentimentTrend}
								taskCompletionRate={session.taskCompletionRate}
								turnCount={session.turnCount}
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
