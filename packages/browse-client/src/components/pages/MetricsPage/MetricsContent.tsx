/**
 * Metrics Content Component
 *
 * Displays metrics data using Relay.
 */

import type React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { Card } from "@/components/atoms/Card.tsx";
import { Heading } from "@/components/atoms/Heading.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { StatCard } from "@/components/organisms/StatCard.tsx";
import type { MetricsContentQuery as MetricsContentQueryType } from "./__generated__/MetricsContentQuery.graphql.ts";
import { OutcomeBadge } from "./OutcomeBadge.tsx";
import { TaskTypeBadge } from "./TaskTypeBadge.tsx";

type Period = "DAY" | "WEEK" | "MONTH";

const MetricsContentQueryDef = graphql`
  query MetricsContentQuery($period: MetricsPeriod) {
    metrics(period: $period) {
      totalTasks
      completedTasks
      successRate
      averageConfidence
      averageDuration
      calibrationScore
      significantFrustrations
      significantFrustrationRate
      tasksByType {
        type
        count
      }
      tasksByOutcome {
        outcome
        count
      }
    }
  }
`;

/**
 * Format percentage
 */
function formatPercent(value: number | null | undefined): string {
	if (value === null || value === undefined) return "-";
	return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined) return "-";
	if (seconds < 0.001) return "< 1ms";
	if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface MetricsContentProps {
	period: Period;
}

export function MetricsContent({
	period,
}: MetricsContentProps): React.ReactElement {
	const data = useLazyLoadQuery<MetricsContentQueryType>(
		MetricsContentQueryDef,
		{ period },
		{ fetchPolicy: "store-and-network" },
	);

	const metrics = data.metrics;

	if (!metrics) {
		return (
			<VStack gap="md" align="center" style={{ padding: theme.spacing.xl }}>
				<Text color="secondary">No metrics data available.</Text>
			</VStack>
		);
	}

	const tasksByType = metrics.tasksByType ?? [];
	const tasksByOutcome = metrics.tasksByOutcome ?? [];

	return (
		<VStack gap="lg">
			{/* Stats Grid */}
			<Box
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
					gap: theme.spacing.md,
				}}
			>
				<StatCard
					label="Total Tasks"
					value={metrics.totalTasks ?? 0}
					subValue={`${metrics.completedTasks ?? 0} completed`}
				/>
				<StatCard
					label="Success Rate"
					value={formatPercent(metrics.successRate)}
				/>
				<StatCard
					label="Avg Confidence"
					value={formatPercent(metrics.averageConfidence)}
				/>
				<StatCard
					label="Calibration"
					value={
						metrics.calibrationScore !== null
							? formatPercent(metrics.calibrationScore)
							: "-"
					}
					subValue="confidence vs outcome"
				/>
				<StatCard
					label="Avg Duration"
					value={formatDuration(metrics.averageDuration)}
				/>
				<StatCard
					label="Frustrations"
					value={metrics.significantFrustrations ?? 0}
					subValue={`${formatPercent(metrics.significantFrustrationRate)} rate`}
				/>
			</Box>

			{/* Breakdown Section */}
			<HStack gap="lg" wrap>
				<Card style={{ flex: 1, minWidth: "200px" }}>
					<VStack gap="md">
						<Heading size="sm" as="h3">
							By Type
						</Heading>
						<VStack gap="sm">
							{tasksByType.map((item) => (
								<HStack key={item.type} justify="space-between" align="center">
									<TaskTypeBadge type={item.type ?? "UNKNOWN"} />
									<Text weight="medium">{item.count ?? 0}</Text>
								</HStack>
							))}
						</VStack>
					</VStack>
				</Card>

				<Card style={{ flex: 1, minWidth: "200px" }}>
					<VStack gap="md">
						<Heading size="sm" as="h3">
							By Outcome
						</Heading>
						<VStack gap="sm">
							{tasksByOutcome.map((item) => (
								<HStack
									key={item.outcome}
									justify="space-between"
									align="center"
								>
									<OutcomeBadge outcome={item.outcome} />
									<Text weight="medium">{item.count ?? 0}</Text>
								</HStack>
							))}
						</VStack>
					</VStack>
				</Card>
			</HStack>
		</VStack>
	);
}
