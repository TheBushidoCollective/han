/**
 * Session Detail Page
 *
 * Displays full session details including messages.
 * Uses PageLoader for query preloading with pagination.
 */

import React from 'react';
import { graphql } from 'react-relay';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { ErrorBoundary } from '@/components/molecules/ErrorBoundary.tsx';
import { PageLoader } from '@/components/helpers';
import { spacing } from '@/theme.ts';
import type { SessionDetailPageQuery as SessionDetailPageQueryType } from './__generated__/SessionDetailPageQuery.graphql.ts';
import { SessionDetailContent } from './SessionDetailContent.tsx';

/**
 * Main query - uses node(id:) pattern with global ID
 * Global ID format: Session:{sessionId}
 * Expensive fields and messages are loaded via fragments
 */
export const SessionDetailPageQuery = graphql`
  query SessionDetailPageQuery($id: ID!) {
    node(id: $id) {
      ... on Session {
        id
        sessionId
        date
        projectName
        projectPath
        projectId
        worktreeName
        summary
        messageCount
        startedAt
        updatedAt
        gitBranch
        version
        ...SessionMessages_session
        ...SessionSidebar_session
      }
    }
  }
`;

/**
 * Session detail page with PageLoader for query preloading
 */
export default function SessionDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string; id: string }>();
  const sessionId = params.id;

  // Build global ID for node query
  const globalId = sessionId ? `Session:${sessionId}` : null;

  if (!sessionId || !globalId) {
    return (
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: spacing.lg,
        }}
      >
        <HStack style={{ marginBottom: spacing.md }}>
          <Button variant="secondary" onClick={() => navigate('/sessions')}>
            Back to Sessions
          </Button>
        </HStack>
        <Center style={{ flex: 1 }}>
          <Text color="muted">No session ID provided.</Text>
        </Center>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <PageLoader<SessionDetailPageQueryType>
        query={SessionDetailPageQuery}
        variables={{ id: globalId }}
        loadingMessage="Loading session..."
      >
        {(queryRef) => (
          <SessionDetailContent queryRef={queryRef} sessionId={sessionId} />
        )}
      </PageLoader>
    </ErrorBoundary>
  );
}
