/**
 * Session Expensive Fields Component
 *
 * Displays checkpoints, hooks, tasks, and todos.
 * Loaded via @defer for better initial page load performance.
 */

import type React from 'react';
import { Suspense } from 'react';
import { graphql, useFragment } from 'react-relay';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { SessionExpensiveFields_session$key } from './__generated__/SessionExpensiveFields_session.graphql.ts';
import { CheckpointCard, HookExecutionCard, TaskCard } from './components.ts';

/**
 * Fragment for expensive fields loaded via @defer
 */
const SessionExpensiveFieldsFragment = graphql`
  fragment SessionExpensiveFields_session on Session {
    checkpoints {
      id
      checkpointId
      type
      createdAt
      fileCount
      patternCount
      patterns
    }
    hookExecutions {
      id
      hookType
      hookName
      hookSource
      durationMs
      passed
      output
      error
      timestamp
    }
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
    todos {
      id
      content
      status
      activeForm
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
    activeTasks {
      id
      taskId
      description
      type
      status
      startedAt
    }
    currentTask {
      id
      taskId
      description
      type
      status
      startedAt
    }
  }
`;

interface SessionExpensiveFieldsProps {
  fragmentRef: SessionExpensiveFields_session$key;
}

function SessionExpensiveFieldsContent({
  fragmentRef,
}: SessionExpensiveFieldsProps): React.ReactElement {
  const data = useFragment(SessionExpensiveFieldsFragment, fragmentRef);

  const checkpoints = data.checkpoints ?? [];
  const hookExecutions = data.hookExecutions ?? [];
  const hookStats = data.hookStats;
  const tasks = data.tasks ?? [];

  return (
    <>
      {checkpoints.length > 0 && (
        <VStack className="checkpoints-section" gap="md" align="stretch">
          <Heading size="sm" as="h3">
            Checkpoints ({checkpoints.length})
          </Heading>
          <Box className="checkpoints-grid">
            {checkpoints
              .filter((c): c is typeof c & { id: string } => !!c.id)
              .map((checkpoint) => (
                <CheckpointCard
                  key={checkpoint.id}
                  checkpoint={{
                    id: checkpoint.id,
                    checkpointId: checkpoint.checkpointId ?? '',
                    type: (checkpoint.type === 'SESSION' ||
                    checkpoint.type === 'AGENT'
                      ? checkpoint.type
                      : 'SESSION') as 'SESSION' | 'AGENT',
                    createdAt: checkpoint.createdAt ?? '',
                    fileCount: checkpoint.fileCount ?? 0,
                    patternCount: checkpoint.patternCount ?? 0,
                    patterns: (checkpoint.patterns ?? []) as string[],
                  }}
                />
              ))}
          </Box>
        </VStack>
      )}

      {hookExecutions.length > 0 && hookStats && (
        <VStack className="hooks-section" gap="md" align="stretch">
          <Heading size="sm" as="h3">
            Hook Executions ({hookStats.totalHooks})
          </Heading>
          <HStack className="hooks-stats" gap="lg" style={{ flexWrap: 'wrap' }}>
            <Text className="hooks-stat hooks-passed">
              {hookStats.passedHooks} passed
            </Text>
            <Text className="hooks-stat hooks-failed">
              {hookStats.failedHooks} failed
            </Text>
            <Text className="hooks-stat" color="muted">
              {(hookStats.passRate ?? 0).toFixed(1)}% pass rate
            </Text>
            <Text className="hooks-stat" color="muted">
              {hookStats.totalDurationMs}ms total
            </Text>
          </HStack>
          {(hookStats.byHookType?.length ?? 0) > 0 && (
            <HStack
              className="hooks-by-type"
              gap="md"
              style={{ flexWrap: 'wrap' }}
            >
              {(hookStats.byHookType ?? []).map((stat) => (
                <Text key={stat.hookType} className="hook-type-stat">
                  <strong>{stat.hookType}</strong>: {stat.passed}/{stat.total}
                </Text>
              ))}
            </HStack>
          )}
          <VStack className="hooks-grid" gap="md">
            {hookExecutions
              .filter((h): h is typeof h & { id: string } => !!h.id)
              .map((hook) => (
                <HookExecutionCard
                  key={hook.id}
                  hook={{
                    id: hook.id,
                    hookType: hook.hookType ?? '',
                    hookName: hook.hookName ?? '',
                    hookSource: hook.hookSource ?? null,
                    durationMs: hook.durationMs ?? 0,
                    passed: hook.passed ?? false,
                    output: hook.output ?? null,
                    error: hook.error ?? null,
                    timestamp: hook.timestamp ?? '',
                  }}
                />
              ))}
          </VStack>
        </VStack>
      )}

      {tasks.length > 0 && (
        <VStack className="tasks-section" gap="md" align="stretch">
          <Heading size="sm" as="h3">
            Tasks ({tasks.length})
          </Heading>
          <HStack className="tasks-stats" gap="lg" style={{ flexWrap: 'wrap' }}>
            <Text className="tasks-stat" color="muted">
              {tasks.filter((t) => t.status === 'ACTIVE').length} active
            </Text>
            <Text className="tasks-stat tasks-completed">
              {tasks.filter((t) => t.status === 'COMPLETED').length} completed
            </Text>
            <Text className="tasks-stat tasks-failed">
              {tasks.filter((t) => t.status === 'FAILED').length} failed
            </Text>
          </HStack>
          <VStack className="tasks-grid" gap="md">
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
    </>
  );
}

/**
 * Wrapper with Suspense for deferred loading
 */
export function SessionExpensiveFields({
  fragmentRef,
}: SessionExpensiveFieldsProps): React.ReactElement {
  return (
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
      <SessionExpensiveFieldsContent fragmentRef={fragmentRef} />
    </Suspense>
  );
}
