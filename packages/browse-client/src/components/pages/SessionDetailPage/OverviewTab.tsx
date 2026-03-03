/**
 * Overview Tab
 *
 * Executive summary of a session: stats, task progress, hook health,
 * file impact, and sentiment (if detected).
 */

import type React from "react";
import { type ReactElement, Suspense } from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Spinner } from "@/components/atoms/Spinner.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import {
	formatDuration,
	formatWholeNumber,
} from "@/components/helpers/formatters.ts";
import { StatusItem } from "@/components/molecules/StatusItem.tsx";
import { SectionCard } from "@/components/organisms/SectionCard.tsx";
import { StatCard } from "@/components/organisms/StatCard.tsx";
import { colors, radii, spacing } from "@/theme.ts";
import type { OverviewTab_session$key } from "./__generated__/OverviewTab_session.graphql.ts";
import { formatMs } from "./utils.ts";

/**
 * Fragment for overview tab data (summary-level, no pagination)
 */
const OverviewTabFragment = graphql`
  fragment OverviewTab_session on Session {
    messageCount
    turnCount
    duration
    estimatedCostUsd
    compactionCount
    version
    startedAt
    updatedAt
    status
    hookStats {
      totalHooks
      passedHooks
      failedHooks
      totalDurationMs
      passRate
      byHookType {
        hookType
        total
        passed
      }
    }
    frustrationSummary {
      totalAnalyzed
      moderateCount
      highCount
      overallLevel
      averageScore
      peakScore
      topSignals
    }
    todoCounts {
      total
      pending
      inProgress
      completed
    }
    nativeTasks {
      id
      status
      subject
      activeForm
    }
    fileChangeCount
  }
`;

interface OverviewTabProps {
	fragmentRef: OverviewTab_session$key;
	onSwitchTab: (tab: "tasks" | "files") => void;
}

function OverviewTabContent({
	fragmentRef,
	onSwitchTab,
}: OverviewTabProps): ReactElement {
	const data = useFragment(OverviewTabFragment, fragmentRef);

	const hookStats = data.hookStats;
	const frustrationSummary = data.frustrationSummary;
	const todoCounts = data.todoCounts;

	// Native tasks breakdown
	const nativeTasks = (data.nativeTasks ?? []).filter(
		(t): t is NonNullable<typeof t> & { id: string; status: string } =>
			t != null && !!t.id && !!t.status,
	);
	const completedTasks = nativeTasks.filter(
		(t) => t.status === "completed",
	).length;
	const activeTasks = nativeTasks.filter((t) => t.status === "in_progress");
	const pendingTasks = nativeTasks.filter((t) => t.status === "pending").length;
	const totalTasks = nativeTasks.length;

	// Task progress percentage
	const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

	return (
		<Box
			style={{
				flex: 1,
				overflowY: "auto",
				padding: spacing.lg,
			}}
		>
			<VStack gap="lg">
				{/* Stats Row */}
				<HStack gap="sm" style={{ flexWrap: "wrap" }}>
					<StatCard
						value={formatWholeNumber(data.messageCount ?? 0)}
						label="Messages"
						variant="value-first"
						compact
					/>
					{(data.turnCount ?? 0) > 0 && (
						<StatCard
							value={data.turnCount ?? 0}
							label="Turns"
							variant="value-first"
							compact
						/>
					)}
					{(data.duration ?? 0) > 0 && (
						<StatCard
							value={formatDuration(data.duration ?? 0)}
							label="Duration"
							variant="value-first"
							compact
						/>
					)}
					{(data.estimatedCostUsd ?? 0) >= 0.01 && (
						<StatCard
							value={`$${(data.estimatedCostUsd ?? 0).toFixed(2)}`}
							label="Cost"
							variant="value-first"
							compact
						/>
					)}
					{(data.compactionCount ?? 0) > 0 && (
						<StatCard
							value={data.compactionCount ?? 0}
							label="Compactions"
							variant="value-first"
							compact
						/>
					)}
				</HStack>

				{/* Cost Breakdown + Effectiveness Metrics - side by side */}
				<HStack gap="lg" style={{ alignItems: "stretch" }}>
					<Box style={{ flex: 1 }}>
						<SectionCard title="Cost Breakdown" style={{ height: "100%" }}>
							<VStack gap="md">
								<HStack gap="sm" align="center">
									<Text
										size="xl"
										weight="bold"
										style={{ fontVariantNumeric: "tabular-nums" }}
									>
										${(data.estimatedCostUsd != null && data.estimatedCostUsd >= 0.01)
											? data.estimatedCostUsd.toFixed(2)
											: "0.00"}
									</Text>
									<Badge variant="info">Estimated</Badge>
								</HStack>
								<Text size="xs" color="muted">
									Based on token usage and published model pricing
								</Text>
							</VStack>
						</SectionCard>
					</Box>
					<Box style={{ flex: 1 }}>
						<SectionCard title="Effectiveness Metrics" style={{ height: "100%" }}>
							<VStack gap="sm">
								<StatusItem
									label="Turns"
									value={data.turnCount ?? 0}
								/>
								<StatusItem
									label="Tasks"
									value={`${completedTasks}/${totalTasks}`}
								/>
								<HStack justify="space-between" align="center">
									<Text color="secondary" size="sm">
										Compactions
									</Text>
									<Badge
										variant={
											(data.compactionCount ?? 0) === 0
												? "success"
												: (data.compactionCount ?? 0) <= 2
													? "warning"
													: "danger"
										}
									>
										{data.compactionCount ?? 0}
									</Badge>
								</HStack>
								{frustrationSummary?.overallLevel && (
									<HStack justify="space-between" align="center">
										<Text color="secondary" size="sm">
											Frustration
										</Text>
										<Badge
											variant={
												frustrationSummary.overallLevel === "high"
													? "danger"
													: frustrationSummary.overallLevel === "moderate"
														? "warning"
														: "success"
											}
										>
											{frustrationSummary.overallLevel}
										</Badge>
									</HStack>
								)}
								{hookStats && (hookStats.totalHooks ?? 0) > 0 && (
									<StatusItem
										label="Hook Pass Rate"
										value={`${(hookStats.passRate ?? 0).toFixed(0)}%`}
									/>
								)}
							</VStack>
						</SectionCard>
					</Box>
				</HStack>

				{/* Activity Summary - full width */}
				<SectionCard title="Activity Summary">
					<HStack gap="lg" style={{ flexWrap: "wrap" }}>
						<VStack gap="sm" style={{ flex: 1, minWidth: 180 }}>
							<StatusItem
								label="Duration"
								value={
									(data.duration ?? 0) > 0
										? formatDuration(data.duration ?? 0)
										: "-"
								}
							/>
							<StatusItem
								label="Messages"
								value={formatWholeNumber(data.messageCount ?? 0)}
							/>
							<HStack justify="space-between" align="center">
								<Text color="secondary" size="sm">
									Status
								</Text>
								<Badge
									variant={
										data.status === "active"
											? "success"
											: "default"
									}
								>
									{data.status ?? "unknown"}
								</Badge>
							</HStack>
						</VStack>
						<VStack gap="sm" style={{ flex: 1, minWidth: 180 }}>
							<StatusItem
								label="Files Changed"
								value={data.fileChangeCount ?? 0}
							/>
							{data.version && (
								<StatusItem
									label="Claude Code"
									value={`v${data.version}`}
								/>
							)}
						</VStack>
					</HStack>
				</SectionCard>

				{/* Task Progress */}
				{totalTasks > 0 && (
					<SectionCard
						title="Task Progress"
						onViewAll={() => onSwitchTab("tasks")}
					>
						<VStack gap="sm">
							{/* Progress bar */}
							<HStack gap="sm" align="center">
								<Box
									style={{
										flex: 1,
										height: 8,
										backgroundColor: colors.bg.tertiary,
										borderRadius: radii.full,
										overflow: "hidden",
									}}
								>
									<Box
										style={{
											width: `${taskProgress}%`,
											height: "100%",
											backgroundColor: colors.success,
											borderRadius: radii.full,
											transition: "width 0.3s ease",
										}}
									/>
								</Box>
								<Text size="sm" weight="medium">
									{completedTasks}/{totalTasks}
								</Text>
							</HStack>

							{/* Active task indicator */}
							{activeTasks.length > 0 && (
								<HStack gap="xs" align="center">
									<Box
										style={{
											width: 6,
											height: 6,
											borderRadius: "50%",
											backgroundColor: colors.primary,
										}}
									/>
									<Text size="sm" color="secondary" truncate>
										{activeTasks[0].activeForm ?? activeTasks[0].subject}
									</Text>
								</HStack>
							)}

							{/* Summary counts */}
							<Text size="xs" color="muted">
								{completedTasks} done
								{activeTasks.length > 0 && ` · ${activeTasks.length} active`}
								{pendingTasks > 0 && ` · ${pendingTasks} pending`}
							</Text>
						</VStack>
					</SectionCard>
				)}

				{/* Todo Progress (if any, separate from native tasks) */}
				{(todoCounts?.total ?? 0) > 0 && (
					<SectionCard
						title="Todo Progress"
						onViewAll={() => onSwitchTab("tasks")}
					>
						<VStack gap="sm">
							<HStack gap="sm" align="center">
								<Box
									style={{
										flex: 1,
										height: 8,
										backgroundColor: colors.bg.tertiary,
										borderRadius: radii.full,
										overflow: "hidden",
									}}
								>
									<Box
										style={{
											width: `${((todoCounts?.completed ?? 0) / (todoCounts?.total ?? 1)) * 100}%`,
											height: "100%",
											backgroundColor: colors.success,
											borderRadius: radii.full,
											transition: "width 0.3s ease",
										}}
									/>
								</Box>
								<Text size="sm" weight="medium">
									{todoCounts?.completed ?? 0}/{todoCounts?.total ?? 0}
								</Text>
							</HStack>
							<Text size="xs" color="muted">
								{todoCounts?.completed ?? 0} done
								{(todoCounts?.inProgress ?? 0) > 0 &&
									` · ${todoCounts?.inProgress} active`}
								{(todoCounts?.pending ?? 0) > 0 &&
									` · ${todoCounts?.pending} pending`}
							</Text>
						</VStack>
					</SectionCard>
				)}

				{/* Hook Health */}
				{hookStats && (hookStats.totalHooks ?? 0) > 0 && (
					<SectionCard title="Hook Health">
						<VStack gap="sm">
							<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
								<Text
									size="sm"
									weight="medium"
									style={{
										color:
											(hookStats.passRate ?? 0) >= 90
												? colors.success
												: (hookStats.passRate ?? 0) >= 70
													? colors.warning
													: colors.danger,
									}}
								>
									{(hookStats.passRate ?? 0).toFixed(0)}% pass rate
								</Text>
								<Text size="xs" color="muted">
									{hookStats.passedHooks ?? 0}/{hookStats.totalHooks ?? 0}{" "}
									passed
								</Text>
								<Text size="xs" color="muted">
									{formatMs(hookStats.totalDurationMs ?? 0)} total
								</Text>
							</HStack>

							{/* Show failed hook count */}
							{(hookStats.failedHooks ?? 0) > 0 && (
								<HStack gap="xs" align="center">
									<Text size="xs" style={{ color: colors.danger }}>
										✗ {hookStats.failedHooks} failure
										{(hookStats.failedHooks ?? 0) !== 1 ? "s" : ""}
									</Text>
								</HStack>
							)}
						</VStack>
					</SectionCard>
				)}

				{/* File Impact */}
				{(data.fileChangeCount ?? 0) > 0 && (
					<SectionCard
						title="File Impact"
						onViewAll={() => onSwitchTab("files")}
					>
						<Text size="sm" color="secondary">
							{data.fileChangeCount} file
							{(data.fileChangeCount ?? 0) !== 1 ? "s" : ""} changed
						</Text>
					</SectionCard>
				)}

				{/* Sentiment (only if frustration detected) */}
				{frustrationSummary &&
					(frustrationSummary.overallLevel === "moderate" ||
						frustrationSummary.overallLevel === "high") && (
						<SectionCard title="Sentiment">
							<VStack gap="sm">
								<HStack gap="sm" align="center">
									<Badge
										variant={
											frustrationSummary.overallLevel === "high"
												? "danger"
												: "warning"
										}
									>
										{frustrationSummary.overallLevel === "high"
											? "High Frustration"
											: "Moderate Frustration"}
									</Badge>
									{frustrationSummary.peakScore != null && (
										<Text size="xs" color="muted">
											Peak: {frustrationSummary.peakScore.toFixed(1)}
										</Text>
									)}
								</HStack>
								{(frustrationSummary.topSignals?.length ?? 0) > 0 && (
									<HStack gap="xs" style={{ flexWrap: "wrap" }}>
										{(frustrationSummary.topSignals ?? [])
											.slice(0, 3)
											.map((signal) => (
												<Box
													key={signal}
													style={{
														backgroundColor: colors.bg.tertiary,
														borderRadius: radii.sm,
														padding: `${spacing.xs}px ${spacing.sm}px`,
													}}
												>
													<Text size="xs" color="muted">
														{signal}
													</Text>
												</Box>
											))}
									</HStack>
								)}
							</VStack>
						</SectionCard>
					)}
			</VStack>
		</Box>
	);
}

export function OverviewTab(props: OverviewTabProps): React.ReactElement {
	return (
		<Suspense
			fallback={
				<VStack align="center" gap="sm" style={{ padding: spacing.lg }}>
					<Spinner size="sm" />
					<Text color="muted" size="sm">
						Loading overview...
					</Text>
				</VStack>
			}
		>
			<OverviewTabContent {...props} />
		</Suspense>
	);
}
