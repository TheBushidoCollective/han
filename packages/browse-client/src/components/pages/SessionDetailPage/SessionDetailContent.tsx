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
import { colors, fonts, spacing } from '@/theme.ts';
import type { SessionDetailContentFilesSubscription } from './__generated__/SessionDetailContentFilesSubscription.graphql.ts';
import type { SessionDetailContentHooksSubscription } from './__generated__/SessionDetailContentHooksSubscription.graphql.ts';
import type { SessionDetailContentSubscription } from './__generated__/SessionDetailContentSubscription.graphql.ts';
import type { SessionDetailContentTodosSubscription } from './__generated__/SessionDetailContentTodosSubscription.graphql.ts';
import type { SessionDetailPageQuery } from './__generated__/SessionDetailPageQuery.graphql.ts';
import { formatDuration } from './components.ts';
import { SessionDetailPageQuery as SessionDetailPageQueryDef } from './index.tsx';
import { SessionMessages } from './SessionMessages.tsx';
import { SessionSidebar } from './SessionSidebar.tsx';

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

/**
 * Subscription for todo updates - watches for TodoWrite tool calls
 */
const SessionTodosSubscriptionDef = graphql`
  subscription SessionDetailContentTodosSubscription($sessionId: ID!) {
    sessionTodosChanged(sessionId: $sessionId) {
      sessionId
      todoCount
      inProgressCount
      completedCount
    }
  }
`;

/**
 * Subscription for file changes - watches for Edit, Write, NotebookEdit tool calls
 */
const SessionFilesSubscriptionDef = graphql`
  subscription SessionDetailContentFilesSubscription($sessionId: ID!) {
    sessionFilesChanged(sessionId: $sessionId) {
      sessionId
      fileCount
      toolName
    }
  }
`;

/**
 * Subscription for hook changes - watches for hook_run and hook_result events
 */
const SessionHooksSubscriptionDef = graphql`
  subscription SessionDetailContentHooksSubscription($sessionId: ID!) {
    sessionHooksChanged(sessionId: $sessionId) {
      sessionId
      pluginName
      hookName
      eventType
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

  // Subscription for todo changes - triggers a refresh when todos update
  const todosSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentTodosSubscription>
  >(
    () => ({
      subscription: SessionTodosSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionTodosChanged;
        if (event?.sessionId === sessionId) {
          // Trigger a refresh - the sidebar will re-render with updated todos
          setRefreshKey((k) => k + 1);
        }
      },
      onError: (err) => {
        console.warn('Todos subscription error:', err);
      },
    }),
    [sessionId]
  );

  useSubscription<SessionDetailContentTodosSubscription>(
    todosSubscriptionConfig
  );

  // Subscription for file changes - triggers a refresh when files are modified
  const filesSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentFilesSubscription>
  >(
    () => ({
      subscription: SessionFilesSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionFilesChanged;
        if (event?.sessionId === sessionId) {
          // Trigger a refresh - the sidebar will re-render with updated file changes
          setRefreshKey((k) => k + 1);
        }
      },
      onError: (err) => {
        console.warn('Files subscription error:', err);
      },
    }),
    [sessionId]
  );

  useSubscription<SessionDetailContentFilesSubscription>(
    filesSubscriptionConfig
  );

  // Subscription for hook changes - triggers a refresh when hooks run or complete
  const hooksSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentHooksSubscription>
  >(
    () => ({
      subscription: SessionHooksSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionHooksChanged;
        if (event?.sessionId === sessionId) {
          // Trigger a refresh - the sidebar will re-render with updated hooks
          setRefreshKey((k) => k + 1);
        }
      },
      onError: (err) => {
        console.warn('Hooks subscription error:', err);
      },
    }),
    [sessionId]
  );

  useSubscription<SessionDetailContentHooksSubscription>(
    hooksSubscriptionConfig
  );

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
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: spacing.lg,
        }}
      >
        <HStack style={{ marginBottom: spacing.md }}>
          <Button variant="secondary" onClick={handleBack}>
            Back to Sessions
          </Button>
        </HStack>
        <Center style={{ flex: 1 }}>
          <Text color="muted">Session not found.</Text>
        </Center>
      </Box>
    );
  }

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Fixed header - not in scroll area */}
      <Box
        style={{
          flexShrink: 0,
          backgroundColor: colors.bg.primary,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
          borderBottom: `1px solid ${colors.border.default}`,
        }}
      >
        <HStack
          justify="space-between"
          align="center"
          style={{ marginBottom: spacing.xs }}
        >
          <HStack gap="sm" align="center" style={{ flexWrap: 'wrap', flex: 1 }}>
            <Heading size="sm">{session.projectName}</Heading>
            <Text color="muted" size="sm">
              |
            </Text>
            <Text
              size="xs"
              color="muted"
              style={{ fontFamily: fonts.mono }}
              title={session.projectPath ?? ''}
            >
              {(session.projectPath?.length ?? 0) > 50
                ? `...${session.projectPath?.slice(-47)}`
                : session.projectPath}
            </Text>
            <Text color="muted" size="sm">
              |
            </Text>
            <Text size="xs" color="muted">
              {formatDuration(session.startedAt, session.updatedAt)}
            </Text>
            <Text color="muted" size="sm">
              |
            </Text>
            <Text size="xs" color="muted">
              {session.messageCount} msgs
            </Text>
          </HStack>
          <Button variant="secondary" size="sm" onClick={handleBack}>
            Back to Sessions
          </Button>
        </HStack>
      </Box>

      {/* Main content area with messages and sidebar */}
      <Box
        style={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Messages scroll area - takes most space */}
        <Box
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SessionMessages fragmentRef={session} sessionId={sessionId} />
        </Box>

        {/* Expensive fields sidebar - checkpoints, hooks, file changes */}
        <Box
          style={{
            width: 360,
            minWidth: 360,
            maxWidth: 360,
            flexBasis: 360,
            flexShrink: 0,
            flexGrow: 0,
            borderLeft: `1px solid ${colors.border.default}`,
            overflowY: 'auto',
            backgroundColor: colors.bg.secondary,
            padding: spacing.md,
          }}
        >
          <SessionSidebar fragmentRef={session} />
        </Box>
      </Box>
    </Box>
  );
}
