/**
 * Session Detail Content Component
 *
 * Main content for session detail page using usePreloadedQuery.
 * Displays session info, messages (paginated), and expensive fields (deferred).
 */

import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { graphql, usePreloadedQuery, useSubscription } from 'react-relay';
import { useNavigate } from 'react-router-dom';
import type { GraphQLSubscriptionConfig } from 'relay-runtime';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { SessionDetailContentSubscription } from './__generated__/SessionDetailContentSubscription.graphql.ts';
import type { SessionDetailPageQuery } from './__generated__/SessionDetailPageQuery.graphql.ts';
import { formatDuration } from './components.ts';
import { SessionDetailPageQuery as SessionDetailPageQueryDef } from './index.tsx';
import { SessionExpensiveFields } from './SessionExpensiveFields.tsx';
import { SessionMessages } from './SessionMessages.tsx';

/**
 * Subscription for live updates - watches for new messages in this session
 */
const SessionDetailContentSubscriptionDef = graphql`
  subscription SessionDetailContentSubscription($sessionId: ID!) {
    sessionMessageAdded(sessionId: $sessionId) {
      sessionId
      messageIndex
    }
  }
`;

interface SessionDetailContentProps {
  queryRef: PreloadedQuery<SessionDetailPageQuery>;
  sessionId: string;
}

export function SessionDetailContent({
  queryRef,
  sessionId,
}: SessionDetailContentProps): React.ReactElement {
  const navigate = useNavigate();
  const [isLive, setIsLive] = useState(false);
  const [, setRefreshKey] = useState(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const data = usePreloadedQuery<SessionDetailPageQuery>(
    SessionDetailPageQueryDef,
    queryRef
  );

  // Cast node to session type (node query returns union type)
  const session = data.node;

  // Subscription config for live updates - watches for new messages in this session
  const subscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentSubscription>
  >(
    () => ({
      subscription: SessionDetailContentSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionMessageAdded;
        if (event?.sessionId === sessionId) {
          setIsLive(true);
          // Debounce refresh
          if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
          }
          fetchTimeoutRef.current = setTimeout(() => {
            setRefreshKey((k) => k + 1);
          }, 500);
        }
      },
      onError: (err) => {
        console.warn('Subscription error:', err);
      },
    }),
    [sessionId]
  );

  useSubscription<SessionDetailContentSubscription>(subscriptionConfig);

  const handleBack = () => {
    // Navigate back to project sessions if projectId available, else global sessions
    if (session?.projectId) {
      navigate(`/projects/${session.projectId}/sessions`);
    } else {
      navigate('/sessions');
    }
  };

  if (!session) {
    return (
      <Box className="page session-detail-page">
        <header className="page-header">
          <HStack className="header-left">
            <Button
              variant="secondary"
              className="back-btn"
              onClick={handleBack}
            >
              Back to Sessions
            </Button>
          </HStack>
        </header>
        <Center className="empty-state">
          <Text color="muted">Session not found.</Text>
        </Center>
      </Box>
    );
  }

  return (
    <Box className="page session-detail-page">
      <Box className="sticky-header-section">
        <header className="page-header">
          <HStack
            className="header-left"
            gap="md"
            align="center"
            style={{ flexWrap: 'wrap' }}
          >
            <Heading size="md">{session.projectName}</Heading>
            <Text className="header-meta-sep" color="muted">
              |
            </Text>
            <Text
              className="session-meta-inline mono"
              size="sm"
              color="muted"
              title={session.projectPath ?? ''}
            >
              {(session.projectPath?.length ?? 0) > 40
                ? `...${session.projectPath?.slice(-37)}`
                : session.projectPath}
            </Text>
            <Text className="header-meta-sep" color="muted">
              |
            </Text>
            <Text className="session-meta-inline" size="sm" color="muted">
              {formatDuration(session.startedAt, session.updatedAt)}
            </Text>
            <Text className="header-meta-sep" color="muted">
              |
            </Text>
            <Text className="session-meta-inline" size="sm" color="muted">
              {session.messageCount} msgs
            </Text>
            {session.gitBranch && (
              <>
                <Text className="header-meta-sep" color="muted">
                  |
                </Text>
                <Text
                  className="session-meta-inline mono"
                  size="sm"
                  color="muted"
                >
                  {session.gitBranch}
                </Text>
              </>
            )}
            {session.version && (
              <>
                <Text className="header-meta-sep" color="muted">
                  |
                </Text>
                <Text className="session-meta-inline" size="sm" color="muted">
                  v{session.version}
                </Text>
              </>
            )}
          </HStack>
          <Button variant="secondary" className="back-btn" onClick={handleBack}>
            Back to Sessions
          </Button>
        </header>

        <HStack
          className="session-info-compact"
          gap="lg"
          style={{ flexWrap: 'wrap', padding: '0.5rem 0' }}
        >
          <Text
            className="session-id-compact mono"
            size="xs"
            color="muted"
            title={session.sessionId ?? ''}
          >
            ID: {session.sessionId}
          </Text>
          {session.worktreeName && (
            <Text className="worktree-compact" size="xs" color="muted">
              Worktree: {session.worktreeName}
            </Text>
          )}
          <Text className="date-compact" size="xs" color="muted">
            {session.date}
          </Text>
        </HStack>
      </Box>

      {session.summary && (
        <Box className="session-summary-card">
          <Heading size="sm" as="h3">
            Summary
          </Heading>
          <Text>{session.summary}</Text>
        </Box>
      )}

      {/* Expensive fields loaded via @defer */}
      <SessionExpensiveFields fragmentRef={session} />

      {/* Messages with pagination */}
      <VStack className="messages-section" gap="md" align="stretch">
        <SessionMessages
          fragmentRef={session}
          sessionId={sessionId}
          isLive={isLive}
        />
      </VStack>
    </Box>
  );
}
