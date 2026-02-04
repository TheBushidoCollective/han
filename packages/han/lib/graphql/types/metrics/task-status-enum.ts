/**
 * GraphQL TaskStatus enum
 *
 * Status of a task.
 */

import { builder } from '../../builder.ts';

export const TaskStatusEnum = builder.enumType('TaskStatus', {
  values: ['ACTIVE', 'COMPLETED', 'FAILED'] as const,
  description: 'Status of a task',
});
