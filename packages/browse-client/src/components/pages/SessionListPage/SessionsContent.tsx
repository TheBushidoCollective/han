/**
 * Sessions Content Component
 *
 * Displays sessions list with pagination using usePaginationFragment.
 * Uses usePreloadedQuery to read from the preloaded query reference.
 */

import type React from 'react';
import { useCallback, useMemo, useState, useTransition } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { graphql, usePaginationFragment, usePreloadedQuery } from 'react-relay';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { SessionListItem } from '@/components/organisms/SessionListItem.tsx';
import type { SessionListPageQuery } from './__generated__/SessionListPageQuery.graphql.ts';
import type { SessionsContent_query$key } from './__generated__/SessionsContent_query.graphql.ts';
import type { SessionsContentPaginationQuery } from './__generated__/SessionsContentPaginationQuery.graphql.ts';
import { SessionListPageQuery as SessionListPageQueryDef } from './index.tsx';

/**
 * Pagination fragment for sessions connection
 */
const SessionsConnectionFragment = graphql`
  fragment SessionsContent_query on Query
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
    projectId: { type: "String" }
    worktreeName: { type: "String" }
  )
  @refetchable(queryName: "SessionsContentPaginationQuery") {
    sessions(
      first: $first
      after: $after
      projectId: $projectId
      worktreeName: $worktreeName
    ) @connection(key: "SessionsContent_sessions") {
      __id
      edges {
        node {
          id
          sessionId
          projectName
          worktreeName
          summary
          updatedAt
          startedAt
          gitBranch
          ...SessionListItem_session
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

interface SessionsContentProps {
  queryRef: PreloadedQuery<SessionListPageQuery>;
  projectId: string | null;
  worktreeName: string | null;
}

export function SessionsContent({
  queryRef,
  projectId,
  worktreeName,
}: SessionsContentProps): React.ReactElement {
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  // First, read the preloaded query data
  const preloadedData = usePreloadedQuery<SessionListPageQuery>(
    SessionListPageQueryDef,
    queryRef
  );

  // Then use pagination fragment to get paginated data
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SessionsContentPaginationQuery,
    SessionsContent_query$key
  >(SessionsConnectionFragment, preloadedData);

  // Extract session edges and sort by updatedAt (most recent first)
  type SessionEdge = NonNullable<
    NonNullable<typeof data.sessions>['edges']
  >[number];
  type ValidEdge = NonNullable<SessionEdge> & {
    node: NonNullable<NonNullable<SessionEdge>['node']> & { id: string };
  };

  const sortedEdges = useMemo(() => {
    const edges = data.sessions?.edges ?? [];
    const filtered = edges.filter(
      (edge): edge is ValidEdge =>
        !!edge?.node?.id &&
        // Exclude agent sessions - they are child sessions shown in session detail
        !edge.node.sessionId?.startsWith('agent-')
    );

    // Sort by updatedAt descending (most recent first), fall back to startedAt
    return filtered.sort((a, b) => {
      const aTime = a.node.updatedAt || a.node.startedAt || '';
      const bTime = b.node.updatedAt || b.node.startedAt || '';
      return bTime.localeCompare(aTime);
    });
  }, [data.sessions?.edges]);

  // Filter edges by search text
  const filteredEdges = useMemo(() => {
    if (!filter) return sortedEdges;

    const searchLower = filter.toLowerCase();
    return sortedEdges.filter(
      (edge) =>
        edge.node.projectName?.toLowerCase().includes(searchLower) ||
        edge.node.summary?.toLowerCase().includes(searchLower) ||
        edge.node.gitBranch?.toLowerCase().includes(searchLower)
    );
  }, [sortedEdges, filter]);

  // Build page title based on context
  let pageTitle = 'Sessions';
  let pageSubtitle = '';

  if (projectId && worktreeName) {
    pageTitle = `Sessions - ${worktreeName}`;
    pageSubtitle = `Worktree sessions for ${projectId}`;
  } else if (projectId) {
    pageTitle = 'Project Sessions';
    pageSubtitle = `Sessions for ${projectId}`;
  }

  // Automatic pagination when reaching end of list
  const handleEndReached = useCallback(() => {
    if (hasNext && !isLoadingNext && !isPending) {
      startTransition(() => {
        loadNext(50);
      });
    }
  }, [hasNext, isLoadingNext, isPending, loadNext]);

  return (
    <VStack style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header with title and filter */}
      <HStack
        justify="space-between"
        align="center"
        style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border.subtle}`,
          flexShrink: 0,
        }}
      >
        <HStack gap="md" align="center">
          <Heading size="md">{pageTitle}</Heading>
          {pageSubtitle && (
            <>
              <Text color="muted">|</Text>
              <Text color="secondary" size="sm">
                {pageSubtitle}
              </Text>
            </>
          )}
          {data.sessions?.totalCount !== undefined && (
            <>
              <Text color="muted">|</Text>
              <Text color="muted" size="sm">
                {data.sessions.totalCount} total
              </Text>
            </>
          )}
        </HStack>
        <Input
          placeholder="Filter sessions..."
          value={filter}
          onChange={setFilter}
          style={{ width: '250px' }}
        />
      </HStack>

      {/* Scrollable list */}
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
        onScroll={(e) => {
          const target = e.currentTarget;
          const nearBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 400;
          if (nearBottom) {
            handleEndReached();
          }
        }}
      >
        {filteredEdges.length === 0 ? (
          <VStack
            align="center"
            justify="center"
            style={{ height: '200px', padding: theme.spacing.xl }}
          >
            <Text color="secondary">
              {filter
                ? 'No sessions match your filter.'
                : 'No sessions found. Start using Claude Code!'}
            </Text>
          </VStack>
        ) : (
          <>
            {filteredEdges.map((edge) => (
              <SessionListItem
                key={edge.node.id}
                session={edge.node}
                connectionId={data.sessions?.__id}
              />
            ))}
            {(isLoadingNext || isPending) && (
              <HStack justify="center" style={{ padding: theme.spacing.lg }}>
                <Spinner />
              </HStack>
            )}
          </>
        )}
      </Box>
    </VStack>
  );
}
