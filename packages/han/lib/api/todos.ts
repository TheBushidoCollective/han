/**
 * Todos API - Extract todo state from Claude Code sessions
 *
 * Parses session messages to find the most recent TodoWrite tool call
 * and extract the current todo list state.
 */

import type { SessionMessage } from "./sessions.ts";

/**
 * Todo item status
 */
export type TodoStatus = "pending" | "in_progress" | "completed";

/**
 * A todo item as stored by Claude Code
 */
export interface TodoItem {
	content: string;
	status: TodoStatus;
	activeForm: string;
}

/**
 * Content block type from Claude messages
 */
interface ContentBlock {
	type: string;
	text?: string;
	name?: string;
	input?: Record<string, unknown>;
}

/**
 * Extract the current todo list from session messages
 *
 * Searches through messages in reverse order to find the most recent
 * TodoWrite tool call and returns its todo list.
 */
export function extractTodosFromMessages(
	messages: SessionMessage[],
): TodoItem[] {
	// Search messages in reverse to find most recent TodoWrite
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.type !== "assistant") continue;

		const content = msg.content;
		if (!content || typeof content === "string") continue;

		// Look for TodoWrite tool use in content blocks
		const contentBlocks = content as ContentBlock[];
		for (const block of contentBlocks) {
			if (block.type === "tool_use" && block.name === "TodoWrite") {
				const input = block.input as { todos?: TodoItem[] } | undefined;
				if (input?.todos && Array.isArray(input.todos)) {
					return input.todos;
				}
			}
		}
	}

	return [];
}

/**
 * Get active (non-completed) todos from a todo list
 */
export function getActiveTodos(todos: TodoItem[]): TodoItem[] {
	return todos.filter((todo) => todo.status !== "completed");
}

/**
 * Get the current in-progress todo
 */
export function getCurrentTodo(todos: TodoItem[]): TodoItem | null {
	return todos.find((todo) => todo.status === "in_progress") ?? null;
}

/**
 * Get todo counts for a todo list
 */
export function getTodoCounts(todos: TodoItem[]): {
	total: number;
	pending: number;
	inProgress: number;
	completed: number;
} {
	return {
		total: todos.length,
		pending: todos.filter((t) => t.status === "pending").length,
		inProgress: todos.filter((t) => t.status === "in_progress").length,
		completed: todos.filter((t) => t.status === "completed").length,
	};
}
