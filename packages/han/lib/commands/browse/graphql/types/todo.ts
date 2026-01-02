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
	type TodoItem,
	type TodoStatus,
} from "../../api/todos.ts";
import { builder } from "../builder.ts";

/**
 * Todo status enum
 */
export const TodoStatusEnum = builder.enumType("TodoStatus", {
	description: "Status of a todo item",
	values: {
		PENDING: { value: "pending" as TodoStatus },
		IN_PROGRESS: { value: "in_progress" as TodoStatus },
		COMPLETED: { value: "completed" as TodoStatus },
	} as const,
});

/**
 * Todo type ref
 */
const TodoRef = builder.objectRef<TodoItem>("Todo");

/**
 * Todo type implementation
 */
export const TodoType = TodoRef.implement({
	description: "A todo item from a Claude Code session",
	fields: (t) => ({
		id: t.id({
			description: "Todo ID (content hash)",
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
		content: t.exposeString("content", {
			description: "The todo item content (imperative form)",
		}),
		status: t.field({
			type: TodoStatusEnum,
			description: "Current status of the todo",
			resolve: (todo) => todo.status,
		}),
		activeForm: t.exposeString("activeForm", {
			description: "Present continuous form shown during execution",
		}),
	}),
});

/**
 * Todo counts type for session summary
 */
interface TodoCountsData {
	total: number;
	pending: number;
	inProgress: number;
	completed: number;
}

const TodoCountsRef = builder.objectRef<TodoCountsData>("TodoCounts");

export const TodoCountsType = TodoCountsRef.implement({
	description: "Counts of todos by status",
	fields: (t) => ({
		total: t.exposeInt("total", { description: "Total number of todos" }),
		pending: t.exposeInt("pending", { description: "Number of pending todos" }),
		inProgress: t.exposeInt("inProgress", {
			description: "Number of in-progress todos",
		}),
		completed: t.exposeInt("completed", {
			description: "Number of completed todos",
		}),
	}),
});

// Re-export utilities for use in session.ts
export {
	extractTodosFromMessages,
	getActiveTodos,
	getCurrentTodo,
	getTodoCounts,
};
export type { TodoItem };
