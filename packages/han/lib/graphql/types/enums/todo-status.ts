/**
 * GraphQL TodoStatus enum
 *
 * Status of a todo item.
 */

import type { TodoStatus } from '../../../api/todos.ts';
import { builder } from '../../builder.ts';

/**
 * Todo status enum
 */
export const TodoStatusEnum = builder.enumType('TodoStatus', {
  description: 'Status of a todo item',
  values: {
    PENDING: { value: 'pending' as TodoStatus },
    IN_PROGRESS: { value: 'in_progress' as TodoStatus },
    COMPLETED: { value: 'completed' as TodoStatus },
  } as const,
});
