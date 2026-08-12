/**
 * Session Detail Content Component
 *
 * Main content for session detail page using usePreloadedQuery.
 * Header banner + tabbed content (Overview, Messages, Tasks, Files).
 * Messages tab stays mounted (display toggled) to preserve VirtualList scroll.
 */

import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { graphql, usePreloadedQuery, useSubscription } from 'react-relay';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { GraphQLSubscriptionConfig } from 'relay-runtime';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { spacing } from '@/theme.ts';
import type { SessionDetailContentFilesSubscription } from './__generated__/SessionDetailContentFilesSubscription.graphql.ts';
import type { SessionDetailContentHooksSubscription } from './__generated__/SessionDetailContentHooksSubscription.graphql.ts';
import type { SessionDetailContentSubscription } from './__generated__/SessionDetailContentSubscription.graphql.ts';
import type { SessionDetailContentTodosSubscription } from './__generated__/SessionDetailContentTodosSubscription.graphql.ts';
import type { SessionDetailPageQuery } from './__generated__/SessionDetailPageQuery.graphql.ts';
import { FilesTab } from './FilesTab.tsx';
import { SessionDetailPageQuery as SessionDetailPageQueryDef } from './index.tsx';
import { OverviewTab } from './OverviewTab.tsx';
import { SessionDetailHeader } from './SessionDetailHeader.tsx';
import { SessionDetailTabs, type SessionTab } from './SessionDetailTabs.tsx';
import { SessionMessages } from './SessionMessages.tsx';
import { TasksTab } from './TasksTab.tsx';

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
  /** Parent session ID (for agent tasks) */
  parentSessionId?: string;
  /** Whether this is an agent task view */
  isAgentTask?: boolean;
}

export function SessionDetailContent({
  queryRef,
  sessionId,
  parentSessionId,
  isAgentTask = false,
}: SessionDetailContentProps): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, setRefreshKey] = useState(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read active tab from URL, default to "overview"
  const activeTab = (searchParams.get('tab') as SessionTab) || 'overview';
  const setActiveTab = useCallback(
    (tab: SessionTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

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

  // Subscription for todo changes
  const todosSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentTodosSubscription>
  >(
    () => ({
      subscription: SessionTodosSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionTodosChanged;
        if (event?.sessionId === sessionId) {
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

  // Subscription for file changes
  const filesSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentFilesSubscription>
  >(
    () => ({
      subscription: SessionFilesSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionFilesChanged;
        if (event?.sessionId === sessionId) {
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

  // Subscription for hook changes
  const hooksSubscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionDetailContentHooksSubscription>
  >(
    () => ({
      subscription: SessionHooksSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionHooksChanged;
        if (event?.sessionId === sessionId) {
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
    if (isAgentTask && parentSessionId) {
      navigate(`/sessions/${parentSessionId}`);
      return;
    }
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
            {isAgentTask ? 'Back to Parent Session' : 'Back to Sessions'}
          </Button>
        </HStack>
        <Center style={{ flex: 1 }}>
          <Text color="muted">Session not found.</Text>
        </Center>
      </Box>
    );
  }

  // Count tasks for tab badge (native tasks + todos)
  const nativeTaskCount = (session.nativeTasks ?? []).filter(
    (t) => t != null && !!t.id
  ).length;
  const todoCount = session.todoCounts?.total ?? 0;
  const taskCount = nativeTaskCount + todoCount;

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
      {/* Sticky header banner */}
      <SessionDetailHeader
        name={session.name}
        summary={session.summary}
        sessionId={sessionId}
        projectName={session.projectName}
        gitBranch={session.gitBranch}
        prNumber={session.prNumber}
        prUrl={session.prUrl}
        teamName={session.teamName}
        harness={session.harness}
        messageCount={session.messageCount ?? 0}
        turnCount={session.turnCount}
        duration={session.duration}
        estimatedCostUsd={session.estimatedCostUsd}
        compactionCount={session.compactionCount}
        status={session.status}
        isAgentTask={isAgentTask}
        onBack={handleBack}
      />

      {/* Tab bar */}
      <SessionDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        messageCount={session.messageCount ?? 0}
        taskCount={taskCount}
        fileCount={session.fileChangeCount ?? 0}
      />

      {/* Tab content */}
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Messages tab - ALWAYS MOUNTED, display toggled to preserve scroll */}
        <Box
          style={{
            display: activeTab === 'messages' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <SessionMessages fragmentRef={session} sessionId={sessionId} />
        </Box>

        {/* Other tabs render/unmount on switch */}
        {activeTab === 'overview' && (
          <OverviewTab fragmentRef={session} onSwitchTab={setActiveTab} />
        )}
        {activeTab === 'tasks' && <TasksTab fragmentRef={session} />}
        {activeTab === 'files' && <FilesTab fragmentRef={session} />}
      </Box>
    </Box>
  );
}
