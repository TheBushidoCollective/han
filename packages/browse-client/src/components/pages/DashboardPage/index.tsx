/**
 * Dashboard Page
 *
 * Overview of Han's key metrics and status.
 * Uses PageLoader for query preloading.
 *
 * Can be used for both global dashboard (/) and project-specific dashboard (/repos/:repoId).
 */

import type React from "react";
import { graphql } from "react-relay";
import { PageLoader } from "@/components/helpers";
import type { DashboardPageQuery as DashboardPageQueryType } from "./__generated__/DashboardPageQuery.graphql.ts";
import { DashboardContent } from "./DashboardContent.tsx";

/**
 * Fragment for deferred analytics data (heavy computation)
 * Relay requires @defer to be on fragment spreads, not inline fragments
 */
export const DashboardAnalyticsFragment = graphql`
  fragment DashboardPageAnalytics_query on Query {
    dashboardAnalytics(days: 30) {
      subagentUsage {
        subagentType
        count
      }
      compactionStats {
        totalCompactions
        sessionsWithCompactions
        sessionsWithoutCompactions
        avgCompactionsPerSession
        autoCompactCount
        manualCompactCount
        continuationCount
      }
      topSessions {
        sessionId
        slug
        summary
        score
        sentimentTrend
        avgSentimentScore
        turnCount
        taskCompletionRate
        compactionCount
        focusScore
        startedAt
      }
      bottomSessions {
        sessionId
        slug
        summary
        score
        sentimentTrend
        avgSentimentScore
        turnCount
        taskCompletionRate
        compactionCount
        focusScore
        startedAt
      }
      toolUsage {
        toolName
        count
      }
      hookHealth {
        hookName
        totalRuns
        passCount
        failCount
        passRate
        avgDurationMs
      }
      costAnalysis {
        estimatedCostUsd
        maxSubscriptionCostUsd
        costUtilizationPercent
        dailyCostTrend {
          date
          costUsd
          sessionCount
        }
        weeklyCostTrend {
          weekStart
          weekLabel
          costUsd
          sessionCount
          avgDailyCost
        }
        topSessionsByCost {
          sessionId
          slug
          costUsd
          inputTokens
          outputTokens
          cacheReadTokens
          messageCount
          startedAt
        }
        costPerSession
        costPerCompletedTask
        cacheHitRate
        potentialSavingsUsd
        subscriptionComparisons {
          tierName
          monthlyCostUsd
          apiCreditCostUsd
          savingsUsd
          savingsPercent
          recommendation
        }
        breakEvenDailySpend
      }
    }
  }
`;

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
    # Include activity and analytics data directly
    # Note: @defer is disabled due to a multipart streaming parser bug where the
    # initial response isn't yielded until the next chunk's delimiter arrives.
    # The 30s TTL cache on both queries makes subsequent loads instant.
    ...DashboardPageActivity_query
    ...DashboardPageAnalytics_query
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
