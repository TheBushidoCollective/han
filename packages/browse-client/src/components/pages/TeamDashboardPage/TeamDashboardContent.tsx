/**
 * Team Dashboard Content Component
 *
 * Main content for team dashboard using usePreloadedQuery.
 */

import type React from 'react';
import { useMemo } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { usePreloadedQuery } from 'react-relay';
import { useNavigate } from 'react-router-dom';
import { theme } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { SectionCard } from '@/components/organisms/SectionCard.tsx';
import { StatCard } from '@/components/organisms/StatCard.tsx';
import type { TeamDashboardPageQuery } from './__generated__/TeamDashboardPageQuery.graphql.ts';
import { ExportButton } from './ExportButton.tsx';
import { TeamDashboardPageQuery as TeamDashboardPageQueryDef } from './index.tsx';
import type { ProjectData } from './SessionsByProjectChart.tsx';
import { SessionsByProjectChart } from './SessionsByProjectChart.tsx';
import { TaskOutcomesChart } from './TaskOutcomesChart.tsx';
import type { PeriodData } from './TokenUsageTimelineChart.tsx';
import { TokenUsageTimelineChart } from './TokenUsageTimelineChart.tsx';

type Granularity = 'DAY' | 'WEEK' | 'MONTH';

interface TeamDashboardContentProps {
  queryRef: PreloadedQuery<TeamDashboardPageQuery>;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

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
 * Format USD amount
 */
function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Normalized contributor data with non-nullable fields
 */
interface NormalizedContributor {
  contributorId: string;
  displayName: string;
  sessionCount: number;
  taskCount: number;
  successRate: number;
}

export function TeamDashboardContent({
  queryRef,
  granularity,
  onGranularityChange,
}: TeamDashboardContentProps): React.ReactElement {
  const navigate = useNavigate();

  const data = usePreloadedQuery<TeamDashboardPageQuery>(
    TeamDashboardPageQueryDef,
    queryRef
  );

  const teamMetrics = data.teamMetrics;
  const projectCount = data.projects?.length ?? 0;

  // Prepare chart data - normalize nullable GraphQL types to non-nullable
  const sessionsByProject = useMemo<readonly ProjectData[]>(() => {
    const rawData = teamMetrics?.sessionsByProject ?? [];
    return rawData.slice(0, 10).map(
      (p): ProjectData => ({
        projectId: p.projectId ?? 'unknown',
        projectName: p.projectName ?? 'Unknown Project',
        sessionCount: p.sessionCount ?? 0,
        taskCount: p.taskCount ?? 0,
        successRate: p.successRate ?? 0,
      })
    );
  }, [teamMetrics?.sessionsByProject]);

  const sessionsByPeriod = useMemo<readonly PeriodData[]>(() => {
    const rawData = teamMetrics?.sessionsByPeriod ?? [];
    return rawData.map(
      (p): PeriodData => ({
        period: p.period ?? '',
        sessionCount: p.sessionCount ?? 0,
        taskCount: p.taskCount ?? 0,
        tokenUsage: p.tokenUsage ?? 0,
      })
    );
  }, [teamMetrics?.sessionsByPeriod]);

  const taskMetrics = {
    totalCreated: teamMetrics?.taskCompletionMetrics?.totalCreated ?? 0,
    totalCompleted: teamMetrics?.taskCompletionMetrics?.totalCompleted ?? 0,
    successRate: teamMetrics?.taskCompletionMetrics?.successRate ?? 0,
    averageConfidence:
      teamMetrics?.taskCompletionMetrics?.averageConfidence ?? 0,
    successCount: teamMetrics?.taskCompletionMetrics?.successCount ?? 0,
    partialCount: teamMetrics?.taskCompletionMetrics?.partialCount ?? 0,
    failureCount: teamMetrics?.taskCompletionMetrics?.failureCount ?? 0,
  };

  const tokenUsage = {
    totalInputTokens: teamMetrics?.tokenUsageAggregation?.totalInputTokens ?? 0,
    totalOutputTokens:
      teamMetrics?.tokenUsageAggregation?.totalOutputTokens ?? 0,
    totalCachedTokens:
      teamMetrics?.tokenUsageAggregation?.totalCachedTokens ?? 0,
    totalTokens: teamMetrics?.tokenUsageAggregation?.totalTokens ?? 0,
    estimatedCostUsd: teamMetrics?.tokenUsageAggregation?.estimatedCostUsd ?? 0,
  };

  const topContributors = useMemo<readonly NormalizedContributor[]>(() => {
    const rawData = teamMetrics?.topContributors ?? [];
    return rawData.map(
      (c): NormalizedContributor => ({
        contributorId: c.contributorId ?? 'unknown',
        displayName: c.displayName ?? 'Unknown',
        sessionCount: c.sessionCount ?? 0,
        taskCount: c.taskCount ?? 0,
        successRate: c.successRate ?? 0,
      })
    );
  }, [teamMetrics?.topContributors]);

  return (
    <VStack gap="xl" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          <Heading size="lg">Team Dashboard</Heading>
          <Text color="secondary">
            Aggregate metrics across {projectCount} projects
          </Text>
        </VStack>
        <HStack gap="md" align="center">
          {/* Granularity selector */}
          <HStack gap="xs">
            <Button
              size="sm"
              active={granularity === 'DAY'}
              onClick={() => onGranularityChange('DAY')}
            >
              Day
            </Button>
            <Button
              size="sm"
              active={granularity === 'WEEK'}
              onClick={() => onGranularityChange('WEEK')}
            >
              Week
            </Button>
            <Button
              size="sm"
              active={granularity === 'MONTH'}
              onClick={() => onGranularityChange('MONTH')}
            >
              Month
            </Button>
          </HStack>
          <ExportButton data={teamMetrics} />
        </HStack>
      </HStack>

      {/* Key metrics row */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: theme.spacing.lg,
        }}
      >
        <StatCard
          label="Total Sessions"
          value={teamMetrics?.totalSessions ?? 0}
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          label="Total Tasks"
          value={teamMetrics?.totalTasks ?? 0}
          subValue={`${taskMetrics.totalCompleted} completed`}
          onClick={() => navigate('/metrics')}
        />
        <StatCard
          label="Success Rate"
          value={`${Math.round(taskMetrics.successRate * 100)}%`}
          subValue={`${Math.round(taskMetrics.averageConfidence * 100)}% avg confidence`}
        />
        <StatCard
          label="Total Tokens"
          value={formatNumber(teamMetrics?.totalTokens ?? 0)}
          subValue={`${formatNumber(tokenUsage.totalInputTokens)} in / ${formatNumber(tokenUsage.totalOutputTokens)} out`}
        />
        <StatCard
          label="Estimated Cost"
          value={formatUsd(teamMetrics?.estimatedCostUsd ?? 0)}
          subValue="Last 30 days"
        />
      </Box>

      {/* Charts row */}
      <HStack gap="lg" style={{ alignItems: 'flex-start' }}>
        <Box style={{ flex: 2 }}>
          <SectionCard
            title="Sessions by Project"
            onViewAll={() => navigate('/projects')}
          >
            <SessionsByProjectChart data={sessionsByProject} />
          </SectionCard>
        </Box>
        <Box style={{ flex: 1 }}>
          <SectionCard title="Task Outcomes">
            <TaskOutcomesChart
              successCount={taskMetrics.successCount}
              partialCount={taskMetrics.partialCount}
              failureCount={taskMetrics.failureCount}
            />
          </SectionCard>
        </Box>
      </HStack>

      {/* Timeline chart */}
      <SectionCard title="Activity Over Time">
        <TokenUsageTimelineChart data={sessionsByPeriod} />
      </SectionCard>

      {/* Top contributors */}
      <SectionCard title="Top Projects">
        {topContributors.length > 0 ? (
          <VStack gap="sm">
            {topContributors.map((contributor, idx) => (
              <HStack
                key={contributor.contributorId}
                justify="space-between"
                align="center"
                style={{
                  padding: theme.spacing.sm,
                  backgroundColor:
                    idx === 0 ? theme.colors.bg.tertiary : undefined,
                  borderRadius: theme.radii.sm,
                }}
              >
                <HStack gap="md" align="center">
                  <Text color="muted" size="sm" style={{ width: 24 }}>
                    #{idx + 1}
                  </Text>
                  <Text weight="medium">{contributor.displayName}</Text>
                </HStack>
                <HStack gap="lg" align="center">
                  <VStack gap="xs" align="flex-end">
                    <Text size="sm">{contributor.sessionCount} sessions</Text>
                    <Text size="xs" color="muted">
                      {contributor.taskCount} tasks
                    </Text>
                  </VStack>
                  <Badge
                    variant={
                      contributor.successRate >= 0.8
                        ? 'success'
                        : contributor.successRate >= 0.5
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {Math.round(contributor.successRate * 100)}%
                  </Badge>
                </HStack>
              </HStack>
            ))}
          </VStack>
        ) : (
          <Text color="muted" size="sm">
            No project data available
          </Text>
        )}
      </SectionCard>
    </VStack>
  );
}
