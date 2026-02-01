/**
 * Team Dashboard Page
 *
 * Displays aggregate team metrics including:
 * - Session counts by project/time period
 * - Task completion metrics
 * - Token usage aggregation
 * - Activity timeline
 * - Top contributors
 */

import type React from 'react';
import { useState } from 'react';
import { graphql } from 'react-relay';
import { PageLoader } from '@/components/helpers';
import type { TeamDashboardPageQuery as TeamDashboardPageQueryType } from './__generated__/TeamDashboardPageQuery.graphql.ts';
import { TeamDashboardContent } from './TeamDashboardContent.tsx';

export const TeamDashboardPageQuery = graphql`
  query TeamDashboardPageQuery(
    $startDate: String
    $endDate: String
    $granularity: Granularity
  ) {
    teamMetrics(
      startDate: $startDate
      endDate: $endDate
      granularity: $granularity
    ) {
      totalSessions
      totalTasks
      totalTokens
      estimatedCostUsd
      sessionsByProject {
        projectId
        projectName
        sessionCount
        taskCount
        successRate
      }
      sessionsByPeriod {
        period
        sessionCount
        taskCount
        tokenUsage
      }
      taskCompletionMetrics {
        totalCreated
        totalCompleted
        successRate
        averageConfidence
        successCount
        partialCount
        failureCount
      }
      tokenUsageAggregation {
        totalInputTokens
        totalOutputTokens
        totalCachedTokens
        totalTokens
        estimatedCostUsd
      }
      activityTimeline {
        period
        sessionCount
        messageCount
        taskCount
      }
      topContributors {
        contributorId
        displayName
        sessionCount
        taskCount
        successRate
      }
    }
    projects(first: 100) {
      id
    }
  }
`;

type Granularity = 'DAY' | 'WEEK' | 'MONTH';

/**
 * Get default date range (last 30 days)
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

export interface TeamDashboardPageProps {
  /**
   * Initial granularity for time aggregation
   */
  initialGranularity?: Granularity;
}

/**
 * Team Dashboard page with PageLoader for query preloading
 */
export default function TeamDashboardPage({
  initialGranularity = 'DAY',
}: TeamDashboardPageProps): React.ReactElement {
  const [granularity, setGranularity] =
    useState<Granularity>(initialGranularity);
  const { startDate, endDate } = getDefaultDateRange();

  return (
    <PageLoader<TeamDashboardPageQueryType>
      query={TeamDashboardPageQuery}
      variables={{
        startDate,
        endDate,
        granularity,
      }}
      loadingMessage="Loading team metrics..."
    >
      {(queryRef) => (
        <TeamDashboardContent
          queryRef={queryRef}
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
      )}
    </PageLoader>
  );
}
