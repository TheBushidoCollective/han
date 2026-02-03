/**
 * GraphQL Task type
 *
 * A tracked task.
 */

import type { Task as DbTask } from '../../../db/index.ts';
import { builder } from '../../builder.ts';
import { TaskOutcomeEnum } from './task-outcome-enum.ts';
import { TaskStatusEnum } from './task-status-enum.ts';
import { TaskTypeEnum } from './task-type-enum.ts';

const TaskRef = builder.objectRef<DbTask>('Task');

/**
 * Determine task status from outcome
 */
function getTaskStatus(task: DbTask): 'ACTIVE' | 'COMPLETED' | 'FAILED' {
  if (!task.outcome) return 'ACTIVE';
  if (task.outcome === 'failure') return 'FAILED';
  return 'COMPLETED';
}

export const TaskType = TaskRef.implement({
  description: 'A tracked task',
  fields: (t) => ({
    id: t.id({
      description: 'Task ID',
      resolve: (task) => task.taskId,
    }),
    taskId: t.exposeString('taskId', { description: 'Task ID' }),
    description: t.exposeString('description', {
      description: 'Task description',
    }),
    type: t.field({
      type: TaskTypeEnum,
      description: 'Type of task',
      resolve: (task) =>
        task.taskType.toUpperCase() as
          | 'IMPLEMENTATION'
          | 'FIX'
          | 'REFACTOR'
          | 'RESEARCH',
    }),
    status: t.field({
      type: TaskStatusEnum,
      description: 'Current status',
      resolve: (task) => getTaskStatus(task),
    }),
    outcome: t.field({
      type: TaskOutcomeEnum,
      nullable: true,
      description: 'Outcome if completed',
      resolve: (task) => {
        if (!task.outcome) return null;
        return task.outcome.toUpperCase() as 'SUCCESS' | 'PARTIAL' | 'FAILURE';
      },
    }),
    confidence: t.float({
      nullable: true,
      description: 'Confidence score (0-1)',
      resolve: (task) => task.confidence ?? null,
    }),
    startedAt: t.field({
      type: 'DateTime',
      description: 'When the task started',
      resolve: (task) => task.startedAt ?? new Date().toISOString(),
    }),
    completedAt: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'When the task completed',
      resolve: (task) => task.completedAt ?? null,
    }),
    durationSeconds: t.int({
      nullable: true,
      description: 'Duration in seconds',
      resolve: (task) => {
        if (!task.startedAt || !task.completedAt) return null;
        const start = new Date(task.startedAt).getTime();
        const end = new Date(task.completedAt).getTime();
        return Math.floor((end - start) / 1000);
      },
    }),
    filesModified: t.stringList({
      nullable: true,
      description: 'List of modified files',
      resolve: (task) => task.filesModified ?? null,
    }),
    testsAdded: t.int({
      nullable: true,
      description: 'Number of tests added',
      resolve: (task) => task.testsAdded ?? null,
    }),
    notes: t.string({
      nullable: true,
      description: 'Additional notes',
      resolve: (task) => task.notes ?? null,
    }),
  }),
});

/**
 * Get tasks for a session - stub for now (native list function needed)
 * TODO: Add listTasksForSession to han-native
 */
export function getTasksForSession(_sessionId: string): DbTask[] {
  // No native function to list tasks yet
  return [];
}

/**
 * Get active tasks for a session - stub for now
 * TODO: Add listActiveTasksForSession to han-native
 */
export function getActiveTasksForSession(_sessionId: string): DbTask[] {
  // No native function to list tasks yet
  return [];
}
