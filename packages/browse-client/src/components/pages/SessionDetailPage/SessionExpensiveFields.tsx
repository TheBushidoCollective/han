/**
 * Session Expensive Fields Component
 *
 * Displays checkpoints, hooks, tasks, and todos.
 * Loaded via @defer for better initial page load performance.
 */

import type { CSSProperties, ReactElement } from 'react';
import { Suspense, useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { TabButton } from '@/components/molecules/TabButton.tsx';
import { colors, radii, spacing } from '@/theme.ts';
import type { SessionExpensiveFields_session$key } from './__generated__/SessionExpensiveFields_session.graphql.ts';
import {
  CheckpointCard,
  FileChangeCard,
  HookExecutionCard,
  TaskCard,
} from './components.ts';
import { formatMs } from './utils.ts';

type SidebarTab = 'hooks' | 'files';

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
    fileChanges {
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
    }
    fileChangeCount
  }
`;

interface SessionExpensiveFieldsProps {
  fragmentRef: SessionExpensiveFields_session$key;
}

/**
 * Stat Card Component - Displays a single metric in a card format
 */
interface StatCardProps {
  value: number | string;
  label: string;
  color: string;
}

const statCardStyle: CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: radii.md,
  padding: `${spacing.sm}px ${spacing.md}px`,
  minWidth: 80,
  textAlign: 'center',
};

function StatCard({ value, label, color }: StatCardProps): ReactElement {
  return (
    <div style={statCardStyle}>
      <Text
        size="lg"
        weight="bold"
        style={{ color, display: 'block', marginBottom: 2 }}
      >
        {value}
      </Text>
      <Text size="xs" color="muted">
        {label}
      </Text>
    </div>
  );
}

/**
 * Hook Type Chip - Shows hook type with pass/total count
 */
interface HookTypeChipProps {
  hookType: string;
  passed: number;
  total: number;
}

const hookTypeChipStyle: CSSProperties = {
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
    <div style={hookTypeChipStyle}>
      <Text size="sm" weight="medium">
        {hookType}
      </Text>
      <Text size="sm" style={{ color: countColor }}>
        {passed}/{total}
      </Text>
    </div>
  );
}

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: spacing.xs,
  padding: spacing.xs,
  backgroundColor: colors.bg.tertiary,
  borderRadius: radii.md,
  marginBottom: spacing.md,
};

function SessionExpensiveFieldsContent({
  fragmentRef,
}: SessionExpensiveFieldsProps): ReactElement {
  const data = useFragment(SessionExpensiveFieldsFragment, fragmentRef);
  const [activeTab, setActiveTab] = useState<SidebarTab>('hooks');

  const checkpoints = data.checkpoints ?? [];
  const hookExecutions = data.hookExecutions ?? [];
  const hookStats = data.hookStats;
  const tasks = data.tasks ?? [];
  const fileChanges = data.fileChanges ?? [];
  const fileChangeCount = data.fileChangeCount ?? 0;

  // Determine counts for tabs
  const hooksCount = hookStats?.totalHooks ?? hookExecutions.length;
  const filesCount = fileChangeCount || fileChanges.length;

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

      {/* Tab Bar for switching between hooks and file changes */}
      {(hookExecutions.length > 0 || fileChanges.length > 0) && (
        <div style={tabBarStyle}>
          <TabButton
            active={activeTab === 'hooks'}
            onClick={() => setActiveTab('hooks')}
          >
            Hooks ({hooksCount})
          </TabButton>
          <TabButton
            active={activeTab === 'files'}
            onClick={() => setActiveTab('files')}
          >
            Files ({filesCount})
          </TabButton>
        </div>
      )}

      {activeTab === 'hooks' && hookExecutions.length > 0 && hookStats && (
        <VStack className="hooks-section" gap="md" align="stretch">
          <Heading size="sm" as="h3">
            Hook Executions ({hookStats.totalHooks})
          </Heading>

          {/* Summary Cards */}
          <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
            <StatCard
              value={hookStats.passedHooks ?? 0}
              label="Passed"
              color={colors.success}
            />
            <StatCard
              value={hookStats.failedHooks ?? 0}
              label="Failed"
              color={colors.danger}
            />
            <StatCard
              value={`${(hookStats.passRate ?? 0).toFixed(1)}%`}
              label="Pass Rate"
              color={
                (hookStats.passRate ?? 0) >= 90
                  ? colors.success
                  : (hookStats.passRate ?? 0) >= 70
                    ? colors.warning
                    : colors.danger
              }
            />
            <StatCard
              value={formatMs(hookStats.totalDurationMs ?? 0)}
              label="Total Time"
              color={colors.text.muted}
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
              .filter((h): h is typeof h & { id: string } => !!h.id)
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

      {activeTab === 'files' && fileChanges.length > 0 && (
        <VStack className="file-changes-section" gap="md" align="stretch">
          <Heading size="sm" as="h3">
            File Changes ({fileChangeCount})
          </Heading>
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
}: SessionExpensiveFieldsProps): ReactElement {
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
