/**
 * GraphQL TaskType enum
 *
 * Type of task.
 */

import { builder } from '../../builder.ts';

export const TaskTypeEnum = builder.enumType('TaskType', {
  values: ['IMPLEMENTATION', 'FIX', 'REFACTOR', 'RESEARCH'] as const,
  description: 'Type of task',
});
