/**
 * GraphQL Todo type
 *
 * Represents a todo item from Claude Code's TodoWrite tool.
 */

import {
  extractTodosFromMessages,
  getActiveTodos,
  getCurrentTodo,
  getTodoCounts,
  getTodosFromDb,
  type TodoItem,
} from '../../api/todos.ts';
import { builder } from '../builder.ts';
import { TodoStatusEnum } from './enums/todo-status.ts';

/**
 * Todo type ref
 */
const TodoRef = builder.objectRef<TodoItem>('Todo');

/**
 * Todo type implementation
 */
export const TodoType = TodoRef.implement({
  description: 'A todo item from a Claude Code session',
  fields: (t) => ({
    id: t.id({
      description: 'Todo ID (content hash)',
      resolve: (todo) => {
        // Generate a stable ID from content
        let hash = 0;
        for (let i = 0; i < todo.content.length; i++) {
          const char = todo.content.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return `todo-${Math.abs(hash).toString(36)}`;
      },
    }),
    content: t.exposeString('content', {
      description: 'The todo item content (imperative form)',
    }),
    status: t.field({
      type: TodoStatusEnum,
      description: 'Current status of the todo',
      resolve: (todo) => todo.status,
    }),
    activeForm: t.exposeString('activeForm', {
      description: 'Present continuous form shown during execution',
    }),
  }),
});

// Re-export utilities for use in session.ts
export {
  extractTodosFromMessages,
  getActiveTodos,
  getCurrentTodo,
  getTodoCounts,
  getTodosFromDb,
};
export type { TodoItem };
