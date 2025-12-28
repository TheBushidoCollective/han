/**
 * Session Detail Page
 *
 * Displays full session details including messages.
 * Uses PageLoader for query preloading with @defer and pagination.
 */

import React, { Component } from 'react';
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

// Error boundary to catch and display errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box style={{ padding: '2rem', color: 'red' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message}
          </pre>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              marginTop: '1rem',
            }}
          >
            {this.state.error?.stack}
          </pre>
        </Box>
      );
    }
    return this.props.children;
  }
}

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
        ...SessionExpensiveFields_session @defer
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
