/**
 * Session Sidebar Component
 *
 * Displays hooks, tasks, todos, and file changes for a session.
 */

import type { CSSProperties } from 'react';
import React, { type ReactElement, Suspense, useState } from 'react';
import type { ViewStyle } from 'react-native-web';
import { graphql, useFragment, usePaginationFragment } from 'react-relay';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Pressable } from '@/components/atoms/Pressable.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { StatCard } from '@/components/organisms/StatCard.tsx';
import { colors, fontSizes, radii, spacing } from '@/theme.ts';
import type { SessionSidebar_fileChanges$key } from './__generated__/SessionSidebar_fileChanges.graphql.ts';
import type { SessionSidebar_hookExecutions$key } from './__generated__/SessionSidebar_hookExecutions.graphql.ts';
import type { SessionSidebar_session$key } from './__generated__/SessionSidebar_session.graphql.ts';
import type { SessionSidebarFilesRefetchQuery } from './__generated__/SessionSidebarFilesRefetchQuery.graphql.ts';
import type { SessionSidebarHooksRefetchQuery } from './__generated__/SessionSidebarHooksRefetchQuery.graphql.ts';
import {
  FileChangeCard,
  HookExecutionCard,
  NativeTaskCard,
  TaskCard,
} from './components.ts';
import type { NativeTask } from './types.ts';
import { formatMs } from './utils.ts';

type SidebarTab = 'todos' | 'nativeTasks' | 'tasks' | 'hooks' | 'files';

/**
 * Fragment for hook executions with pagination
 */
const SidebarHooksPaginationFragment = graphql`
  fragment SessionSidebar_hookExecutions on Session
  @refetchable(queryName: "SessionSidebarHooksRefetchQuery")
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    hookExecutions(first: $first, after: $after)
      @connection(key: "SessionSidebar_hookExecutions") {
      totalCount
      edges {
        node {
          id
          hookType
          hookName
          hookSource
          directory
          durationMs
          passed
          output
          error
          timestamp
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Fragment for file changes with pagination
 */
const SidebarFilesPaginationFragment = graphql`
  fragment SessionSidebar_fileChanges on Session
  @refetchable(queryName: "SessionSidebarFilesRefetchQuery")
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    fileChanges(first: $first, after: $after)
      @connection(key: "SessionSidebar_fileChanges") {
      totalCount
      edges {
        node {
          id
          filePath
          action
          toolName
          recordedAt
          isValidated
          validations {
            pluginName
            hookName
            validatedAt
          }
          missingValidations {
            pluginName
            hookName
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    fileChangeCount
  }
`;

/**
 * Fragment for sidebar fields loaded via @defer
 */
const SessionSidebarFragment = graphql`
  fragment SessionSidebar_session on Session {
    ...SessionSidebar_hookExecutions
    ...SessionSidebar_fileChanges
    hookStats {
      totalHooks
      passedHooks
      failedHooks
      totalDurationMs
      passRate
      byHookType {
        hookType
        total
        passed
      }
    }
    frustrationSummary {
      totalAnalyzed
      moderateCount
      highCount
      overallLevel
      averageScore
      peakScore
      topSignals
    }
    todos {
      totalCount
      edges {
        node {
          id
          content
          status
          activeForm
        }
      }
    }
    currentTodo {
      content
      activeForm
      status
    }
    todoCounts {
      total
      pending
      inProgress
      completed
    }
    tasks {
      totalCount
      edges {
        node {
          id
          taskId
          description
          type
          status
          outcome
          confidence
          startedAt
          completedAt
          durationSeconds
        }
      }
    }
    activeTasks {
      totalCount
      edges {
        node {
          id
          taskId
          description
          type
          status
          startedAt
        }
      }
    }
    currentTask {
      id
      taskId
      description
      type
      status
      startedAt
    }
    nativeTasks {
      id
      sessionId
      messageId
      subject
      description
      status
      activeForm
      owner
      blocks
      blockedBy
      createdAt
      updatedAt
      completedAt
    }
  }
`;

interface SessionSidebarProps {
  fragmentRef: SessionSidebar_session$key;
}

/**
 * Hook Type Chip - Shows hook type with pass/total count
 */
interface HookTypeChipProps {
  hookType: string;
  passed: number;
  total: number;
}

const hookTypeChipStyle: ViewStyle = {
  backgroundColor: colors.bg.tertiary,
  borderRadius: radii.lg,
  padding: `${spacing.xs}px ${spacing.sm}px`,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
};

function HookTypeChip({
  hookType,
  passed,
  total,
}: HookTypeChipProps): ReactElement {
  const allPassed = passed === total;
  const countColor = allPassed ? colors.success : colors.warning;

  return (
    <Box style={hookTypeChipStyle}>
      <Text size="sm" weight="medium">
        {hookType}
      </Text>
      <Text size="sm" style={{ color: countColor }}>
        {passed}/{total}
      </Text>
    </Box>
  );
}

const tabBarStyle: ViewStyle = {
  display: 'flex',
  borderBottom: `1px solid ${colors.border.default}`,
  marginBottom: spacing.md,
};

const tabStyle = (active: boolean): CSSProperties => ({
  padding: `${spacing.sm}px ${spacing.md}px`,
  cursor: 'pointer',
  fontSize: fontSizes.sm,
  fontWeight: active ? 500 : 400,
  color: active ? colors.text.primary : colors.text.muted,
  borderBottom: active
    ? `2px solid ${colors.primary}`
    : '2px solid transparent',
  marginBottom: -1,
  transition: 'color 0.15s, border-color 0.15s',
  background: 'none',
  border: 'none',
});

/**
 * Status color helper for todos
 */
function getTodoStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return colors.success;
    case 'IN_PROGRESS':
      return colors.primary;
    default:
      return colors.text.muted;
  }
}

/**
 * Status label helper for todos
 */
function getTodoStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return '✓';
    case 'IN_PROGRESS':
      return '●';
    default:
      return '○';
  }
}

/**
 * Frustration level colors
 */
function getFrustrationColor(level: string): string {
  switch (level) {
    case 'high':
      return colors.danger;
    case 'moderate':
      return colors.warning;
    case 'low':
      return colors.text.muted;
    default:
      return colors.success;
  }
}

/**
 * Frustration level emoji
 */
function getFrustrationEmoji(level: string): string {
  switch (level) {
    case 'high':
      return '\u{1F621}'; // angry face
    case 'moderate':
      return '\u{1F615}'; // confused face
    case 'low':
      return '\u{1F610}'; // neutral face
    default:
      return '\u{1F60A}'; // happy face
  }
}

/**
 * Frustration level label
 */
function getFrustrationLabel(level: string): string {
  switch (level) {
    case 'high':
      return 'High Frustration';
    case 'moderate':
      return 'Moderate Frustration';
    case 'low':
      return 'Low Frustration';
    default:
      return 'No Frustration';
  }
}

function SessionSidebarContent({
  fragmentRef,
}: SessionSidebarProps): ReactElement {
  // Main fragment for non-paginated data
  const data = useFragment(SessionSidebarFragment, fragmentRef);

  // Pagination fragments for hooks and files
  const {
    data: hooksData,
    loadNext: loadNextHooks,
    hasNext: hasMoreHooks,
    isLoadingNext: isLoadingMoreHooks,
  } = usePaginationFragment<
    SessionSidebarHooksRefetchQuery,
    SessionSidebar_hookExecutions$key
  >(SidebarHooksPaginationFragment, data);

  const {
    data: filesData,
    loadNext: loadNextFiles,
    hasNext: hasMoreFiles,
    isLoadingNext: isLoadingMoreFiles,
  } = usePaginationFragment<
    SessionSidebarFilesRefetchQuery,
    SessionSidebar_fileChanges$key
  >(SidebarFilesPaginationFragment, data);

  // Extract data from fragments
  const hookExecutionsConnection = hooksData.hookExecutions;
  const hookExecutions =
    hookExecutionsConnection?.edges
      ?.map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => node != null) ?? [];

  const fileChangesConnection = filesData.fileChanges;
  const fileChanges =
    fileChangesConnection?.edges
      ?.map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => node != null) ?? [];
  const fileChangeCount = filesData.fileChangeCount ?? 0;

  // Non-paginated data
  const hookStats = data.hookStats;
  const frustrationSummary = data.frustrationSummary;
  const tasksConnection = data.tasks;
  const tasks =
    tasksConnection?.edges
      ?.map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => node != null) ?? [];
  const todosConnection = data.todos;
  const todos =
    todosConnection?.edges
      ?.map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => node != null) ?? [];
  const todoCounts = data.todoCounts;

  // Native tasks from Claude's built-in task system
  const nativeTasks: NativeTask[] = (data.nativeTasks ?? [])
    .filter(
      (t): t is NonNullable<typeof t> & { id: string; status: string } =>
        t != null && !!t.id && !!t.status
    )
    .map((t) => ({
      id: t.id,
      sessionId: t.sessionId ?? '',
      messageId: t.messageId ?? '',
      subject: t.subject ?? '',
      description: t.description ?? null,
      status: (['pending', 'in_progress', 'completed'].includes(t.status)
        ? t.status
        : 'pending') as 'pending' | 'in_progress' | 'completed',
      activeForm: t.activeForm ?? null,
      owner: t.owner ?? null,
      blocks: t.blocks ?? [],
      blockedBy: t.blockedBy ?? [],
      createdAt: t.createdAt ?? '',
      updatedAt: t.updatedAt ?? '',
      completedAt: t.completedAt ?? null,
    }));

  // Load more handlers
  const loadMoreHooks = () => {
    if (hasMoreHooks && !isLoadingMoreHooks) {
      loadNextHooks(50);
    }
  };

  const loadMoreFiles = () => {
    if (hasMoreFiles && !isLoadingMoreFiles) {
      loadNextFiles(50);
    }
  };

  // Determine counts for tabs
  const todosCount = todoCounts?.total ?? todos.length;
  const nativeTasksCount = nativeTasks.length;
  const tasksCount = tasksConnection?.totalCount ?? tasks.length;
  const hooksCount =
    hookStats?.totalHooks ??
    hookExecutionsConnection?.totalCount ??
    hookExecutions.length;
  const filesCount =
    fileChangeCount || fileChangesConnection?.totalCount || fileChanges.length;

  // Set initial tab based on which has data (prefer native tasks, then todos)
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    nativeTasksCount > 0
      ? 'nativeTasks'
      : todosCount > 0
        ? 'todos'
        : tasksCount > 0
          ? 'tasks'
          : hooksCount > 0
            ? 'hooks'
            : 'files'
  );

  // Check if we have any data to display
  const hasAnyData =
    todos.length > 0 ||
    nativeTasks.length > 0 ||
    tasks.length > 0 ||
    hookExecutions.length > 0 ||
    fileChanges.length > 0;

  return (
    <>
      {/* Show message if no data */}
      {!hasAnyData && (
        <VStack align="center" gap="sm" style={{ padding: spacing.md }}>
          <Text color="muted" size="sm">
            No sidebar data for this session
          </Text>
        </VStack>
      )}

      {/* Frustration Summary Card - always show if there's analyzed data */}
      {frustrationSummary && (frustrationSummary.totalAnalyzed ?? 0) > 0 && (
        <Box
          style={{
            padding: spacing.md,
            backgroundColor: colors.bg.tertiary,
            borderRadius: radii.md,
            borderLeft: `4px solid ${getFrustrationColor(frustrationSummary.overallLevel ?? 'none')}`,
            marginBottom: spacing.md,
          }}
        >
          <HStack justify="space-between" align="center">
            <HStack gap="sm" align="center">
              <span
                style={{ fontSize: fontSizes.xl }}
                role="img"
                aria-label={getFrustrationLabel(
                  frustrationSummary.overallLevel ?? 'none'
                )}
              >
                {getFrustrationEmoji(frustrationSummary.overallLevel ?? 'none')}
              </span>
              <VStack gap="xs" align="start">
                <Text
                  weight="medium"
                  style={{
                    color: getFrustrationColor(
                      frustrationSummary.overallLevel ?? 'none'
                    ),
                  }}
                >
                  {getFrustrationLabel(
                    frustrationSummary.overallLevel ?? 'none'
                  )}
                </Text>
                <Text size="xs" color="muted">
                  {frustrationSummary.totalAnalyzed ?? 0} messages analyzed
                </Text>
              </VStack>
            </HStack>
            {((frustrationSummary.moderateCount ?? 0) > 0 ||
              (frustrationSummary.highCount ?? 0) > 0) && (
              <VStack gap="xs" align="end">
                {(frustrationSummary.highCount ?? 0) > 0 && (
                  <Text size="xs" style={{ color: colors.danger }}>
                    {frustrationSummary.highCount} high
                  </Text>
                )}
                {(frustrationSummary.moderateCount ?? 0) > 0 && (
                  <Text size="xs" style={{ color: colors.warning }}>
                    {frustrationSummary.moderateCount} moderate
                  </Text>
                )}
              </VStack>
            )}
          </HStack>
          {(frustrationSummary.topSignals?.length ?? 0) > 0 && (
            <HStack
              gap="xs"
              style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}
            >
              {(frustrationSummary.topSignals ?? [])
                .slice(0, 3)
                .map((signal) => (
                  <span
                    key={signal}
                    style={{
                      fontSize: fontSizes.xs,
                      color: colors.text.muted,
                      backgroundColor: colors.bg.secondary,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      borderRadius: radii.sm,
                    }}
                  >
                    {signal}
                  </span>
                ))}
            </HStack>
          )}
        </Box>
      )}

      {/* Tab Bar for switching between native tasks, todos, tasks, hooks, and file changes */}
      {(nativeTasks.length > 0 ||
        todos.length > 0 ||
        tasks.length > 0 ||
        hookExecutions.length > 0 ||
        fileChanges.length > 0) && (
        <Box style={tabBarStyle}>
          {nativeTasks.length > 0 && (
            <Pressable
              style={tabStyle(activeTab === 'nativeTasks')}
              onPress={() => setActiveTab('nativeTasks')}
            >
              <Text>Tasks ({nativeTasksCount})</Text>
            </Pressable>
          )}
          {todos.length > 0 && (
            <Pressable
              style={tabStyle(activeTab === 'todos')}
              onPress={() => setActiveTab('todos')}
            >
              <Text>Todos ({todosCount})</Text>
            </Pressable>
          )}
          {tasks.length > 0 && (
            <Pressable
              style={tabStyle(activeTab === 'tasks')}
              onPress={() => setActiveTab('tasks')}
            >
              <Text>Metrics ({tasksCount})</Text>
            </Pressable>
          )}
          <Pressable
            style={tabStyle(activeTab === 'hooks')}
            onPress={() => setActiveTab('hooks')}
          >
            <Text>Hooks ({hooksCount})</Text>
          </Pressable>
          <Pressable
            style={tabStyle(activeTab === 'files')}
            onPress={() => setActiveTab('files')}
          >
            <Text>Files ({filesCount})</Text>
          </Pressable>
        </Box>
      )}

      {activeTab === 'nativeTasks' && nativeTasks.length > 0 && (
        <VStack className="native-tasks-section" gap="md" align="stretch">
          {/* Native Task Summary Cards */}
          <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
            <StatCard
              value={nativeTasks.filter((t) => t.status === 'completed').length}
              label="Done"
              valueColor={colors.success}
              compact
            />
            <StatCard
              value={
                nativeTasks.filter((t) => t.status === 'in_progress').length
              }
              label="Active"
              valueColor={colors.primary}
              compact
            />
            <StatCard
              value={nativeTasks.filter((t) => t.status === 'pending').length}
              label="Pending"
              valueColor={colors.text.muted}
              compact
            />
          </HStack>

          {/* Native Task List */}
          <VStack className="native-tasks-grid" gap="sm">
            {nativeTasks.map((task) => (
              <NativeTaskCard key={task.id} task={task} />
            ))}
          </VStack>
        </VStack>
      )}

      {activeTab === 'todos' && todos.length > 0 && (
        <VStack className="todos-section" gap="md" align="stretch">
          {/* Todo Summary Cards */}
          <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
            <StatCard
              value={todoCounts?.completed ?? 0}
              label="Done"
              valueColor={colors.success}
              compact
            />
            <StatCard
              value={todoCounts?.inProgress ?? 0}
              label="Active"
              valueColor={colors.primary}
              compact
            />
            <StatCard
              value={todoCounts?.pending ?? 0}
              label="Pending"
              valueColor={colors.text.muted}
              compact
            />
          </HStack>

          {/* Todo List */}
          <VStack className="todos-grid" gap="xs">
            {todos
              .filter((t): t is typeof t & { id: string } => !!t.id)
              .map((todo) => (
                <Box
                  key={todo.id}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    backgroundColor: colors.bg.tertiary,
                    borderRadius: radii.sm,
                    opacity: todo.status === 'COMPLETED' ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: spacing.sm,
                    }}
                  >
                    <span
                      style={{
                        color: getTodoStatusColor(todo.status ?? 'PENDING'),
                        fontSize: fontSizes.sm,
                        flexShrink: 0,
                      }}
                    >
                      {getTodoStatusLabel(todo.status ?? 'PENDING')}
                    </span>
                    <span
                      style={{
                        fontSize: fontSizes.sm,
                        color:
                          todo.status === 'COMPLETED'
                            ? colors.text.muted
                            : colors.text.primary,
                        textDecoration:
                          todo.status === 'COMPLETED' ? 'line-through' : 'none',
                        flex: 1,
                      }}
                    >
                      {todo.content}
                    </span>
                  </div>
                  {todo.status === 'IN_PROGRESS' && todo.activeForm && (
                    <Text
                      size="xs"
                      color="muted"
                      style={{
                        marginLeft: spacing.md + spacing.sm,
                        marginTop: spacing.xs,
                      }}
                    >
                      {todo.activeForm}...
                    </Text>
                  )}
                </Box>
              ))}
          </VStack>
        </VStack>
      )}

      {activeTab === 'hooks' && hookExecutions.length > 0 && hookStats && (
        <VStack className="hooks-section" gap="md" align="stretch">
          {/* Summary Cards */}
          <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
            <StatCard
              value={hookStats.passedHooks ?? 0}
              label="Passed"
              valueColor={colors.success}
              compact
            />
            <StatCard
              value={hookStats.failedHooks ?? 0}
              label="Failed"
              valueColor={colors.danger}
              compact
            />
            <StatCard
              value={`${(hookStats.passRate ?? 0).toFixed(1)}%`}
              label="Pass Rate"
              valueColor={
                (hookStats.passRate ?? 0) >= 90
                  ? colors.success
                  : (hookStats.passRate ?? 0) >= 70
                    ? colors.warning
                    : colors.danger
              }
              compact
            />
            <StatCard
              value={formatMs(hookStats.totalDurationMs ?? 0)}
              label="Total Time"
              valueColor={colors.text.muted}
              compact
            />
          </HStack>

          {/* Hook Type Breakdown */}
          {(hookStats.byHookType?.length ?? 0) > 0 && (
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              {(hookStats.byHookType ?? []).map((stat) => (
                <HookTypeChip
                  key={stat.hookType ?? 'unknown'}
                  hookType={stat.hookType ?? 'unknown'}
                  passed={stat.passed ?? 0}
                  total={stat.total ?? 0}
                />
              ))}
            </HStack>
          )}

          {/* Hook Execution Cards - sorted newest first */}
          <VStack className="hooks-grid" gap="sm">
            {hookExecutions
              .filter(
                (h): h is NonNullable<typeof h> & { id: string } =>
                  h != null && !!h.id
              )
              .slice()
              .sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeB - timeA;
              })
              .map((hook) => (
                <HookExecutionCard
                  key={hook.id}
                  hook={{
                    id: hook.id,
                    hookType: hook.hookType ?? '',
                    hookName: hook.hookName ?? '',
                    hookSource: hook.hookSource ?? null,
                    directory: hook.directory ?? null,
                    durationMs: hook.durationMs ?? 0,
                    passed: hook.passed ?? false,
                    output: hook.output ?? null,
                    error: hook.error ?? null,
                    timestamp: hook.timestamp ?? '',
                  }}
                />
              ))}
          </VStack>
          {hasMoreHooks && (
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMoreHooks}
              disabled={isLoadingMoreHooks}
              style={{ alignSelf: 'center', marginTop: spacing.sm }}
            >
              {isLoadingMoreHooks ? 'Loading...' : 'Load More Hooks'}
            </Button>
          )}
        </VStack>
      )}

      {activeTab === 'tasks' && tasks.length > 0 && (
        <VStack className="tasks-section" gap="md" align="stretch">
          {/* Task Summary Stats */}
          <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
            <StatCard
              value={tasks.filter((t) => t.status === 'COMPLETED').length}
              label="Completed"
              valueColor={colors.success}
              compact
            />
            <StatCard
              value={tasks.filter((t) => t.status === 'ACTIVE').length}
              label="Active"
              valueColor={colors.primary}
              compact
            />
            <StatCard
              value={tasks.filter((t) => t.status === 'FAILED').length}
              label="Failed"
              valueColor={colors.danger}
              compact
            />
          </HStack>
          <VStack className="tasks-grid" gap="sm">
            {tasks
              .filter((t): t is typeof t & { id: string } => !!t.id)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={{
                    id: task.id,
                    taskId: task.taskId ?? '',
                    description: task.description ?? '',
                    type: ([
                      'IMPLEMENTATION',
                      'FIX',
                      'REFACTOR',
                      'RESEARCH',
                    ].includes(task.type ?? '')
                      ? task.type
                      : 'IMPLEMENTATION') as
                      | 'IMPLEMENTATION'
                      | 'FIX'
                      | 'REFACTOR'
                      | 'RESEARCH',
                    status: (['ACTIVE', 'COMPLETED', 'FAILED'].includes(
                      task.status ?? ''
                    )
                      ? task.status
                      : 'ACTIVE') as 'ACTIVE' | 'COMPLETED' | 'FAILED',
                    outcome: (['SUCCESS', 'PARTIAL', 'FAILURE'].includes(
                      task.outcome ?? ''
                    )
                      ? task.outcome
                      : null) as 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null,
                    confidence: task.confidence ?? null,
                    startedAt: task.startedAt ?? '',
                    completedAt: task.completedAt ?? null,
                    durationSeconds: task.durationSeconds ?? null,
                  }}
                />
              ))}
          </VStack>
        </VStack>
      )}

      {activeTab === 'files' && fileChanges.length > 0 && (
        <VStack className="file-changes-section" gap="md" align="stretch">
          <HStack
            className="file-changes-stats"
            gap="lg"
            style={{ flexWrap: 'wrap' }}
          >
            <Text className="file-changes-stat file-changes-created">
              {fileChanges.filter((f) => f.action === 'CREATED').length} created
            </Text>
            <Text className="file-changes-stat file-changes-modified">
              {fileChanges.filter((f) => f.action === 'MODIFIED').length}{' '}
              modified
            </Text>
            <Text className="file-changes-stat file-changes-deleted">
              {fileChanges.filter((f) => f.action === 'DELETED').length} deleted
            </Text>
          </HStack>
          <VStack className="file-changes-grid" gap="xs">
            {fileChanges
              .filter((f): f is typeof f & { id: string } => !!f.id)
              .map((fileChange) => (
                <FileChangeCard
                  key={fileChange.id}
                  fileChange={{
                    id: fileChange.id,
                    filePath: fileChange.filePath ?? '',
                    action: (['CREATED', 'MODIFIED', 'DELETED'].includes(
                      fileChange.action ?? ''
                    )
                      ? fileChange.action
                      : 'MODIFIED') as 'CREATED' | 'MODIFIED' | 'DELETED',
                    toolName: fileChange.toolName ?? null,
                    recordedAt: fileChange.recordedAt ?? null,
                    isValidated: fileChange.isValidated ?? false,
                    validations: fileChange.validations ?? [],
                    missingValidations: fileChange.missingValidations ?? [],
                  }}
                />
              ))}
          </VStack>
          {hasMoreFiles && (
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMoreFiles}
              disabled={isLoadingMoreFiles}
              style={{ alignSelf: 'center', marginTop: spacing.sm }}
            >
              {isLoadingMoreFiles ? 'Loading...' : 'Load More Files'}
            </Button>
          )}
        </VStack>
      )}
    </>
  );
}

/**
 * Error boundary for sidebar content
 */
class SidebarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <VStack align="center" gap="sm" style={{ padding: '1rem' }}>
          <Text color="muted" size="sm">
            Error loading sidebar:
          </Text>
          <Text size="xs" style={{ color: colors.danger }}>
            {this.state.error?.message}
          </Text>
        </VStack>
      );
    }
    return this.props.children;
  }
}

/**
 * Wrapper with Suspense for deferred loading
 */
export function SessionSidebar({
  fragmentRef,
}: SessionSidebarProps): ReactElement {
  return (
    <SidebarErrorBoundary>
      <Suspense
        fallback={
          <VStack align="center" gap="sm" style={{ padding: '1rem' }}>
            <Spinner size="sm" />
            <Text color="muted" size="sm">
              Loading details...
            </Text>
          </VStack>
        }
      >
        <SessionSidebarContent fragmentRef={fragmentRef} />
      </Suspense>
    </SidebarErrorBoundary>
  );
}
