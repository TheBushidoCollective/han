/**
 * GraphQL TaskOutcomeCount type
 *
 * Task count by outcome.
 */

import { builder } from '../../builder.ts';
import { TaskOutcomeEnum } from './task-outcome-enum.ts';

/**
 * Task outcome count interface
 */
export interface TaskOutcomeCount {
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  count: number;
}

const TaskOutcomeCountRef =
  builder.objectRef<TaskOutcomeCount>('TaskOutcomeCount');

export const TaskOutcomeCountType = TaskOutcomeCountRef.implement({
  description: 'Task count by outcome',
  fields: (t) => ({
    outcome: t.field({
      type: TaskOutcomeEnum,
      resolve: (obj) => obj.outcome,
    }),
    count: t.exposeInt('count'),
  }),
});
