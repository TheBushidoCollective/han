/**
 * Metrics Content Component
 *
 * Displays metrics data using Relay.
 */

import type React from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { MetricsContentQuery as MetricsContentQueryType } from './__generated__/MetricsContentQuery.graphql.ts';
import { OutcomeBadge } from './OutcomeBadge.tsx';
import { StatCard } from './StatCard.tsx';
import { TaskTypeBadge } from './TaskTypeBadge.tsx';

type Period = 'DAY' | 'WEEK' | 'MONTH';

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
      recentTasks(first: 10) {
        id
        taskId
        description
        type
        status
        outcome
        confidence
        startedAt
        completedAt
        durationSeconds
      }
    }
  }
`;

/**
 * Format percentage
 */
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${seconds}s`;
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
    { fetchPolicy: 'store-and-network' }
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
  const recentTasks = metrics.recentTasks ?? [];

  return (
    <VStack gap="lg">
      {/* Stats Grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        <StatCard
          label="Total Tasks"
          value={metrics.totalTasks ?? 0}
          subvalue={`${metrics.completedTasks ?? 0} completed`}
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
              : '-'
          }
          subvalue="confidence vs outcome"
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(metrics.averageDuration)}
        />
        <StatCard
          label="Frustrations"
          value={metrics.significantFrustrations ?? 0}
          subvalue={`${formatPercent(metrics.significantFrustrationRate)} rate`}
        />
      </Box>

      {/* Breakdown Section */}
      <HStack gap="lg" wrap>
        <Card style={{ flex: 1, minWidth: '200px' }}>
          <VStack gap="md">
            <Heading size="sm" as="h3">
              By Type
            </Heading>
            <VStack gap="sm">
              {tasksByType.map((item) => (
                <HStack key={item.type} justify="space-between" align="center">
                  <TaskTypeBadge type={item.type ?? 'UNKNOWN'} />
                  <Text weight="medium">{item.count ?? 0}</Text>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </Card>

        <Card style={{ flex: 1, minWidth: '200px' }}>
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

      {/* Recent Tasks */}
      <VStack gap="md">
        <Heading size="sm" as="h3">
          Recent Tasks
        </Heading>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: theme.fontSize.sm,
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: theme.colors.bg.tertiary,
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: theme.spacing.md }}>Description</th>
                <th style={{ padding: theme.spacing.md }}>Type</th>
                <th style={{ padding: theme.spacing.md }}>Outcome</th>
                <th style={{ padding: theme.spacing.md }}>Confidence</th>
                <th style={{ padding: theme.spacing.md }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recentTasks.map((task) => (
                <tr
                  key={task.id}
                  style={{
                    borderTop: `1px solid ${theme.colors.border.default}`,
                  }}
                >
                  <td
                    style={{
                      padding: theme.spacing.md,
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.description}
                  </td>
                  <td style={{ padding: theme.spacing.md }}>
                    <TaskTypeBadge type={task.type ?? 'UNKNOWN'} />
                  </td>
                  <td style={{ padding: theme.spacing.md }}>
                    <OutcomeBadge outcome={task.outcome} />
                  </td>
                  <td style={{ padding: theme.spacing.md }}>
                    {task.confidence !== null
                      ? formatPercent(task.confidence)
                      : '-'}
                  </td>
                  <td style={{ padding: theme.spacing.md }}>
                    {formatDuration(task.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </VStack>
    </VStack>
  );
}
