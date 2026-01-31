/**
 * Session List Page
 *
 * Displays Claude Code sessions with filtering and virtualized scrolling.
 * Uses Relay for data fetching with proper pagination via usePaginationFragment.
 */

import type React from 'react';
import { graphql } from 'react-relay';
import { useParams } from 'react-router-dom';
import { PageLoader } from '@/components/helpers';
import type { SessionListPageQuery as SessionListPageQueryType } from './__generated__/SessionListPageQuery.graphql.ts';
import { SessionsContent } from './SessionsContent.tsx';

/**
 * Top-level query that spreads the pagination fragment
 */
export const SessionListPageQuery = graphql`
  query SessionListPageQuery(
    $first: Int
    $projectId: String
    $worktreeName: String
    $userId: String
  ) {
    ...SessionsContent_query
      @arguments(
        first: $first
        projectId: $projectId
        worktreeName: $worktreeName
        userId: $userId
      )
  }
`;

/**
 * Session list page component with PageLoader for query preloading
 */
export default function SessionListPage(): React.ReactElement {
  const { projectId, worktreeName } = useParams<{
    projectId?: string;
    worktreeName?: string;
  }>();

  return (
    <PageLoader<SessionListPageQueryType>
      query={SessionListPageQuery}
      variables={{
        first: 50,
        projectId: projectId ?? null,
        worktreeName: worktreeName ?? null,
      }}
      loadingMessage="Loading sessions..."
    >
      {(queryRef) => (
        <SessionsContent
          queryRef={queryRef}
          projectId={projectId ?? null}
          worktreeName={worktreeName ?? null}
        />
      )}
    </PageLoader>
  );
}
