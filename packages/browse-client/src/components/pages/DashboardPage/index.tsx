/**
 * Dashboard Page
 *
 * Overview of Han's key metrics and status.
 * Uses PageLoader for query preloading.
 */

import type React from 'react';
import { graphql } from 'react-relay';
import { PageLoader } from '@/components/helpers';
import type { DashboardPageQuery as DashboardPageQueryType } from './__generated__/DashboardPageQuery.graphql.ts';
import { DashboardContent } from './DashboardContent.tsx';

/**
 * Main dashboard query
 */
export const DashboardPageQuery = graphql`
  query DashboardPageQuery {
    projects(first: 100) {
      id
    }
    sessions(first: 5) @connection(key: "DashboardPage_sessions") {
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
    checkpointStats {
      totalCheckpoints
      sessionCheckpoints
      agentCheckpoints
    }
    pluginStats {
      totalPlugins
      userPlugins
      projectPlugins
      enabledPlugins
    }
    pluginCategories {
      category
      count
    }
  }
`;

/**
 * Dashboard page with PageLoader for query preloading
 */
export default function DashboardPage(): React.ReactElement {
  return (
    <PageLoader<DashboardPageQueryType>
      query={DashboardPageQuery}
      loadingMessage="Loading dashboard..."
    >
      {(queryRef) => <DashboardContent queryRef={queryRef} />}
    </PageLoader>
  );
}
