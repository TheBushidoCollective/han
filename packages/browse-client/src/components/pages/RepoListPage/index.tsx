/**
 * Repo List Page
 *
 * Displays all git repositories with their session counts.
 * Uses Relay for data fetching with PageLoader for query preloading.
 *
 * Note: Repos are identified by git remote-based IDs (e.g., github-com-org-repo)
 * unlike projects which use folder-based encoded paths.
 */

import type React from 'react';
import { graphql } from 'react-relay';
import { PageLoader } from '@/components/helpers';
import type { RepoListPageQuery as RepoListPageQueryType } from './__generated__/RepoListPageQuery.graphql.ts';
import { ReposContent } from './ReposContent.tsx';

/**
 * Top-level query for repos page
 */
export const RepoListPageQuery = graphql`
  query RepoListPageQuery {
    repos(first: 100) {
      id
      repoId
      name
      path
      totalSessions
      lastActivity
    }
  }
`;

/**
 * Repo list page with PageLoader for query preloading
 */
export default function RepoListPage(): React.ReactElement {
  return (
    <PageLoader<RepoListPageQueryType>
      query={RepoListPageQuery}
      loadingMessage="Loading repositories..."
    >
      {(queryRef) => <ReposContent queryRef={queryRef} />}
    </PageLoader>
  );
}
