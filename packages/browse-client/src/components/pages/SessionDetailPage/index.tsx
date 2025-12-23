/**
 * Session Detail Page
 *
 * Displays full session details including messages.
 * Uses PageLoader for query preloading with @defer and pagination.
 */

import type React from 'react';
import { graphql } from 'react-relay';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { PageLoader } from '@/components/helpers';
import type { SessionDetailPageQuery as SessionDetailPageQueryType } from './__generated__/SessionDetailPageQuery.graphql.ts';
import { SessionDetailContent } from './SessionDetailContent.tsx';

/**
 * Main query - loads core session info immediately
 * Expensive fields and messages are loaded via fragments
 */
export const SessionDetailPageQuery = graphql`
  query SessionDetailPageQuery($id: String!) {
    session(id: $id) {
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
      ...SessionMessages_session @arguments(last: 50)
      ...SessionExpensiveFields_session @defer
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

  if (!sessionId) {
    return (
      <Box className="page session-detail-page">
        <header className="page-header">
          <HStack className="header-left">
            <Button
              variant="secondary"
              className="back-btn"
              onClick={() => navigate('/sessions')}
            >
              Back to Sessions
            </Button>
          </HStack>
        </header>
        <Center className="empty-state">
          <Text color="muted">No session ID provided.</Text>
        </Center>
      </Box>
    );
  }

  return (
    <PageLoader<SessionDetailPageQueryType>
      query={SessionDetailPageQuery}
      variables={{ id: sessionId }}
      loadingMessage="Loading session..."
    >
      {(queryRef) => (
        <SessionDetailContent queryRef={queryRef} sessionId={sessionId} />
      )}
    </PageLoader>
  );
}
