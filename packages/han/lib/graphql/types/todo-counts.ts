/**
 * GraphQL TodoCounts type
 *
 * Counts of todos by status.
 */

import { builder } from '../builder.ts';

/**
 * Todo counts data interface
 */
export interface TodoCountsData {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const TodoCountsRef = builder.objectRef<TodoCountsData>('TodoCounts');

export const TodoCountsType = TodoCountsRef.implement({
  description: 'Counts of todos by status',
  fields: (t) => ({
    total: t.exposeInt('total', { description: 'Total number of todos' }),
    pending: t.exposeInt('pending', { description: 'Number of pending todos' }),
    inProgress: t.exposeInt('inProgress', {
      description: 'Number of in-progress todos',
    }),
    completed: t.exposeInt('completed', {
      description: 'Number of completed todos',
    }),
  }),
});
