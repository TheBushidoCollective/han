/**
 * GraphQL Task Connection Types
 *
 * Relay-style pagination for tasks.
 */

import type { Task as DbTask } from '../../../db/index.ts';
import { builder } from '../../builder.ts';
import { type Connection, type Edge, PageInfoType } from '../pagination.ts';
import { TaskType } from './task.ts';

/**
 * Type for task connection data
 */
export type TaskConnectionData = Connection<DbTask>;

export const TaskEdgeType = builder
  .objectRef<Edge<DbTask>>('TaskEdge')
  .implement({
    description: 'An edge in a task connection',
    fields: (t) => ({
      node: t.field({
        type: TaskType,
        description: 'The task at this edge',
        resolve: (edge) => edge.node,
      }),
      cursor: t.exposeString('cursor', {
        description: 'Cursor for this edge',
      }),
    }),
  });

export const TaskConnectionType = builder
  .objectRef<TaskConnectionData>('TaskConnection')
  .implement({
    description: 'A paginated list of tasks',
    fields: (t) => ({
      edges: t.field({
        type: [TaskEdgeType],
        description: 'List of task edges',
        resolve: (conn) => conn.edges,
      }),
      pageInfo: t.field({
        type: PageInfoType,
        description: 'Pagination information',
        resolve: (conn) => conn.pageInfo,
      }),
      totalCount: t.exposeInt('totalCount', {
        description: 'Total number of tasks',
      }),
    }),
  });
