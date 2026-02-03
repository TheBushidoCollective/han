/**
 * GraphQL NativeTask type
 *
 * Represents a task from Claude Code's built-in TaskCreate/TaskUpdate tools.
 * This is distinct from Han's MCP metrics tasks.
 */

import { nativeTasks } from '../../db/index.ts';
import { builder } from '../builder.ts';

/**
 * NativeTask type from the database
 */
export interface NativeTaskData {
  id: string;
  sessionId: string;
  messageId: string;
  subject: string;
  description: string | null;
  status: string;
  activeForm: string | null;
  owner: string | null;
  blocks: string | null; // JSON array
  blockedBy: string | null; // JSON array
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lineNumber: number;
}

/**
 * NativeTask status enum
 */
export const NativeTaskStatusEnum = builder.enumType('NativeTaskStatus', {
  description: 'Status of a native Claude Code task',
  values: {
    pending: { value: 'pending', description: 'Task not yet started' },
    in_progress: {
      value: 'in_progress',
      description: 'Task currently being worked on',
    },
    completed: { value: 'completed', description: 'Task finished' },
  } as const,
});

/**
 * NativeTask type ref
 */
const NativeTaskRef = builder.objectRef<NativeTaskData>('NativeTask');

/**
 * NativeTask type implementation
 */
export const NativeTaskType = NativeTaskRef.implement({
  description: "A task from Claude Code's built-in task management system",
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'Task ID (sequential within session)',
    }),
    sessionId: t.exposeString('sessionId', {
      description: 'Session this task belongs to',
    }),
    messageId: t.exposeString('messageId', {
      description: 'Message ID that last updated this task',
    }),
    subject: t.exposeString('subject', {
      description: 'Brief task title',
    }),
    description: t.exposeString('description', {
      description: 'Detailed task description',
      nullable: true,
    }),
    status: t.field({
      type: NativeTaskStatusEnum,
      description: 'Current task status',
      resolve: (task) => task.status as 'pending' | 'in_progress' | 'completed',
    }),
    activeForm: t.exposeString('activeForm', {
      description: 'Present continuous form shown in spinner',
      nullable: true,
    }),
    owner: t.exposeString('owner', {
      description: 'Task owner (agent name)',
      nullable: true,
    }),
    blocks: t.stringList({
      description: 'Task IDs that this task blocks',
      resolve: (task) => {
        if (!task.blocks) return [];
        try {
          return JSON.parse(task.blocks) as string[];
        } catch {
          return [];
        }
      },
    }),
    blockedBy: t.stringList({
      description: 'Task IDs that block this task',
      resolve: (task) => {
        if (!task.blockedBy) return [];
        try {
          return JSON.parse(task.blockedBy) as string[];
        } catch {
          return [];
        }
      },
    }),
    createdAt: t.exposeString('createdAt', {
      description: 'When the task was created',
    }),
    updatedAt: t.exposeString('updatedAt', {
      description: 'When the task was last updated',
    }),
    completedAt: t.exposeString('completedAt', {
      description: 'When the task was completed',
      nullable: true,
    }),
  }),
});

/**
 * Get native tasks for a session
 */
export async function getNativeTasksForSession(
  sessionId: string
): Promise<NativeTaskData[]> {
  const tasks = await nativeTasks.getForSession(sessionId);
  return tasks.map((t) => ({
    id: t.id,
    sessionId: t.sessionId,
    messageId: t.messageId,
    subject: t.subject,
    description: t.description ?? null,
    status: t.status,
    activeForm: t.activeForm ?? null,
    owner: t.owner ?? null,
    blocks: t.blocks ?? null,
    blockedBy: t.blockedBy ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    completedAt: t.completedAt ?? null,
    lineNumber: t.lineNumber,
  }));
}
