/**
 * Dashboard Page
 *
 * Overview of Han's key metrics and status.
 * Uses PageLoader for query preloading.
 *
 * Can be used for:
 * - Global dashboard (/)
 * - Repo-specific dashboard (/repos/:repoId)
 * - Project-specific dashboard (/projects/:projectId)
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
  fragment DashboardPageAnalytics_query on Query
    @argumentDefinitions(
      projectId: { type: "String" }
      repoId: { type: "String" }
    ) {
    dashboardAnalytics(days: 30, projectId: $projectId, repoId: $repoId) {
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
        isEstimated
        billingType
        cacheSavingsUsd
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
        configDirBreakdowns {
          configDirId
          configDirName
          estimatedCostUsd
          isEstimated
          cacheSavingsUsd
          totalSessions
          totalMessages
          modelCount
          costPerSession
          cacheHitRate
          potentialSavingsUsd
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
          subscriptionComparisons {
            tierName
            monthlyCostUsd
            apiCreditCostUsd
            savingsUsd
            savingsPercent
            recommendation
          }
          breakEvenDailySpend
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
        }
      }
    }
  }
`;

/**
 * Fragment for deferred activity data
 * Relay requires @defer to be on fragment spreads, not inline fragments
 */
export const DashboardActivityFragment = graphql`
  fragment DashboardPageActivity_query on Query
    @argumentDefinitions(
      projectId: { type: "String" }
      repoId: { type: "String" }
    ) {
    activity(days: 730, projectId: $projectId, repoId: $repoId) {
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
        costUsd
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
 * Note: projectId/repoId filters are used for scoped dashboards
 */
export const DashboardPageQuery = graphql`
  query DashboardPageQuery(
    $repoId: String!
    $hasRepoId: Boolean!
    $projectId: String!
    $hasProjectId: Boolean!
    $sessionFilter: SessionFilter
  ) {
    repo(id: $repoId) @include(if: $hasRepoId) {
      name
    }
    project(id: $projectId) @include(if: $hasProjectId) {
      id
      projectId
      name
      totalSessions
      lastActivity
      worktrees {
        name
        path
        sessionCount
        isWorktree
        subdirs {
          relativePath
          path
          sessionCount
        }
      }
      plugins {
        id
        name
        marketplace
        scope
        enabled
        category
      }
    }
    projects(first: 100) {
      id
    }
    sessions(first: 5, filter: $sessionFilter)
      @connection(key: "DashboardPage_sessions") {
      __id
      edges {
        node {
          id
          ...SessionListItem_session
        }
      }
    }
    metrics(period: WEEK, projectId: $projectId, repoId: $repoId) {
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
    ...DashboardPageActivity_query @arguments(projectId: $projectId, repoId: $repoId)
    ...DashboardPageAnalytics_query @arguments(projectId: $projectId, repoId: $repoId)
  }
`;

export interface DashboardPageProps {
	/**
	 * Optional repo ID to filter the dashboard to a specific repo.
	 * When provided, shows repo-specific sessions and context.
	 */
	repoId?: string;
	/**
	 * Optional project ID to filter the dashboard to a specific project.
	 * When provided, shows project-specific sessions and context.
	 */
	projectId?: string;
}

/**
 * Build the session filter based on the scoping props.
 * projectId takes precedence since it is more specific than repoId.
 */
function buildSessionFilter(
	projectId?: string,
	repoId?: string,
): { projectId: { _eq: string } } | { project: { repoId: { _eq: string } } } | null {
	if (projectId) {
		return { projectId: { _eq: projectId } };
	}
	if (repoId) {
		return { project: { repoId: { _eq: repoId } } };
	}
	return null;
}

/**
 * Dashboard page with PageLoader for query preloading
 */
export default function DashboardPage({
	repoId,
	projectId,
}: DashboardPageProps): React.ReactElement {
	return (
		<PageLoader<DashboardPageQueryType>
			query={DashboardPageQuery}
			variables={{
				repoId: repoId || "",
				hasRepoId: !!repoId,
				projectId: projectId || "",
				hasProjectId: !!projectId,
				sessionFilter: buildSessionFilter(projectId, repoId),
			}}
			loadingMessage="Loading dashboard..."
		>
			{(queryRef) => (
				<DashboardContent
					queryRef={queryRef}
					repoId={repoId}
					projectId={projectId}
				/>
			)}
		</PageLoader>
	);
}
