/**
 * Session Detail Page
 *
 * Displays full session details including messages.
 * Uses PageLoader for query preloading with pagination.
 */

import React, { Component } from 'react';
import { graphql } from 'react-relay';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { PageLoader } from '@/components/helpers';
import { colors, fonts, spacing } from '@/theme.ts';
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
        <Box style={{ padding: spacing.lg }}>
          <VStack gap="md" align="stretch">
            <Heading size="md" style={{ color: colors.danger }}>
              Something went wrong
            </Heading>
            <Box
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: colors.danger,
              }}
            >
              <Text>{this.state.error?.message}</Text>
            </Box>
            <Box
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: colors.text.muted,
              }}
            >
              <Text size="xs">{this.state.error?.stack}</Text>
            </Box>
          </VStack>
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
