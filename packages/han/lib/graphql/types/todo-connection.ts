/**
 * GraphQL Todo Connection Types
 *
 * Relay-style connection types for paginated todo lists.
 */

import type { TodoItem } from "../../api/todos.ts";
import { builder } from "../builder.ts";
import { type Connection, type Edge, PageInfoType } from "./pagination.ts";
import { TodoType } from "./todo.ts";

/**
 * Todo connection data type
 */
export type TodoConnectionData = Connection<TodoItem>;

/**
 * Todo Edge type
 */
export const TodoEdgeType = builder
	.objectRef<Edge<TodoItem>>("TodoEdge")
	.implement({
		description: "An edge in a todo connection",
		fields: (t) => ({
			node: t.field({
				type: TodoType,
				description: "The todo item",
				resolve: (edge) => edge.node,
			}),
			cursor: t.exposeString("cursor", {
				description: "Cursor for pagination",
			}),
		}),
	});

/**
 * Todo Connection type
 */
export const TodoConnectionType = builder
	.objectRef<TodoConnectionData>("TodoConnection")
	.implement({
		description: "A paginated list of todo items",
		fields: (t) => ({
			edges: t.field({
				type: [TodoEdgeType],
				description: "List of todo edges",
				resolve: (conn) => conn.edges,
			}),
			pageInfo: t.field({
				type: PageInfoType,
				description: "Pagination information",
				resolve: (conn) => conn.pageInfo,
			}),
			totalCount: t.exposeInt("totalCount", {
				description: "Total number of todos",
			}),
		}),
	});
