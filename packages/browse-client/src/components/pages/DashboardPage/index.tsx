/**
 * Dashboard Page
 *
 * Overview of Han's key metrics and status.
 * Uses PageLoader for query preloading.
 *
 * Can be used for both global dashboard (/) and project-specific dashboard (/repos/:repoId).
 */

import type React from 'react';
import { graphql } from 'react-relay';
import { PageLoader } from '@/components/helpers';
import type { DashboardPageQuery as DashboardPageQueryType } from './__generated__/DashboardPageQuery.graphql.ts';
import { DashboardContent } from './DashboardContent.tsx';

/**
 * Fragment for deferred activity data
 * Relay requires @defer to be on fragment spreads, not inline fragments
 */
export const DashboardActivityFragment = graphql`
  fragment DashboardPageActivity_query on Query {
    activity(days: 730) {
      dailyActivity {
        date
        sessionCount
        messageCount
        inputTokens
        outputTokens
        cachedTokens
        linesAdded
        linesRemoved
        filesChanged
      }
      hourlyActivity {
        hour
        sessionCount
        messageCount
      }
      tokenUsage {
        totalInputTokens
        totalOutputTokens
        totalCachedTokens
        totalTokens
        estimatedCostUsd
        messageCount
        sessionCount
      }
      dailyModelTokens {
        date
        models {
          model
          displayName
          tokens
        }
        totalTokens
      }
      modelUsage {
        model
        displayName
        inputTokens
        outputTokens
        cacheReadTokens
        cacheCreationTokens
        totalTokens
      }
      totalSessions
      totalMessages
      firstSessionDate
      streakDays
      totalActiveDays
    }
  }
`;

/**
 * Main dashboard query
 * Note: projectId filter is used for repo-specific dashboards
 *
 * Activity data is deferred to allow stats/sessions to render immediately
 * while charts load progressively. GraphQL Yoga now supports @defer via useDeferStream plugin.
 */
export const DashboardPageQuery = graphql`
  query DashboardPageQuery($projectId: String) {
    projects(first: 100) {
      id
    }
    sessions(first: 5, projectId: $projectId)
      @connection(key: "DashboardPage_sessions") {
      __id
      edges {
        node {
          id
          ...SessionListItem_session
        }
      }
    }
    metrics(period: WEEK) {
      totalTasks
      completedTasks
      successRate
      averageConfidence
      calibrationScore
      significantFrustrations
      significantFrustrationRate
    }
    pluginStats {
      totalPlugins
      userPlugins
      projectPlugins
      localPlugins
      enabledPlugins
    }
    pluginCategories {
      category
      count
    }
    # Defer heavy activity data (730 days with nested arrays)
    # This allows the page to render stats/sessions immediately
    # while charts load progressively
    ...DashboardPageActivity_query @defer(label: "activityData")
  }
`;

export interface DashboardPageProps {
  /**
   * Optional repo ID to filter the dashboard to a specific repo.
   * When provided, shows repo-specific sessions and context.
   */
  repoId?: string;
}

/**
 * Dashboard page with PageLoader for query preloading
 */
export default function DashboardPage({
  repoId,
}: DashboardPageProps): React.ReactElement {
  return (
    <PageLoader<DashboardPageQueryType>
      query={DashboardPageQuery}
      variables={{
        projectId: repoId || null,
      }}
      loadingMessage="Loading dashboard..."
    >
      {(queryRef) => <DashboardContent queryRef={queryRef} repoId={repoId} />}
    </PageLoader>
  );
}
