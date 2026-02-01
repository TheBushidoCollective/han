/**
 * Relay-style Pagination Utilities
 *
 * Generic types and helpers for cursor-based pagination following the
 * Relay Connection specification.
 */

import { builder } from "../builder.ts";

/**
 * Encode a cursor from type, id, and optional timestamp
 * Format: base64("type:id:timestamp") or base64("type:id")
 */
export function encodeCursor(
	type: string,
	id: string,
	timestamp?: number,
): string {
	const data = timestamp ? `${type}:${id}:${timestamp}` : `${type}:${id}`;
	return Buffer.from(data).toString("base64");
}

/**
 * Decode a cursor back to its components
 */
export function decodeCursor(cursor: string): {
	type: string;
	id: string;
	timestamp?: number;
} {
	try {
		const decoded = Buffer.from(cursor, "base64").toString("utf-8");
		const [type, id, timestamp] = decoded.split(":");
		return {
			type: type || "unknown",
			id: id || "",
			timestamp: timestamp ? Number.parseInt(timestamp, 10) : undefined,
		};
	} catch {
		// If decoding fails, return a default
		return { type: "unknown", id: cursor };
	}
}

/**
 * Maximum page size to prevent memory exhaustion attacks.
 * Clients requesting more than this will be capped to this limit.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Default page size when not specified
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Connection arguments for pagination
 */
export interface ConnectionArgs {
	first?: number | null;
	after?: string | null;
	last?: number | null;
	before?: string | null;
}

/**
 * PageInfo type for Relay connections
 */
export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string | null;
	endCursor: string | null;
}

/**
 * Edge type for a connection
 */
export interface Edge<T> {
	node: T;
	cursor: string;
}

/**
 * Connection result type
 */
export interface Connection<T> {
	edges: Edge<T>[];
	pageInfo: PageInfo;
	totalCount: number;
}

/**
 * Apply connection arguments to a list of items
 * Implements Relay cursor-based pagination
 *
 * @param items - Array of items to paginate
 * @param args - Connection arguments (first, after, last, before)
 * @param getCursor - Function to generate cursor string from an item
 * @returns Connection with edges, pageInfo, and totalCount
 */
export function applyConnectionArgs<T>(
	items: T[],
	args: ConnectionArgs,
	getCursor: (item: T) => string,
): Connection<T> {
	const totalCount = items.length;
	let slicedItems = [...items];

	// Enforce MAX_PAGE_SIZE to prevent memory exhaustion attacks
	const normalizedArgs = {
		...args,
		first:
			args.first !== undefined && args.first !== null
				? Math.min(args.first, MAX_PAGE_SIZE)
				: args.first,
		last:
			args.last !== undefined && args.last !== null
				? Math.min(args.last, MAX_PAGE_SIZE)
				: args.last,
	};

	// Track cursor positions for hasMore calculations
	let afterIndex = -1;
	let beforeIndex = slicedItems.length;

	// Apply cursor-based slicing (after cursor)
	if (normalizedArgs.after) {
		afterIndex = slicedItems.findIndex(
			(item) => getCursor(item) === normalizedArgs.after,
		);
		if (afterIndex !== -1) {
			slicedItems = slicedItems.slice(afterIndex + 1);
		}
	}

	// Apply cursor-based slicing (before cursor)
	if (normalizedArgs.before) {
		const idx = slicedItems.findIndex(
			(item) => getCursor(item) === normalizedArgs.before,
		);
		if (idx !== -1) {
			beforeIndex = idx;
			slicedItems = slicedItems.slice(0, idx);
		}
	}

	// Track if we're trimming results
	let trimmedFromStart = false;
	let trimmedFromEnd = false;

	// Apply first limit (forward pagination) - capped at MAX_PAGE_SIZE
	if (
		normalizedArgs.first !== undefined &&
		normalizedArgs.first !== null &&
		normalizedArgs.first >= 0
	) {
		if (slicedItems.length > normalizedArgs.first) {
			trimmedFromEnd = true;
			slicedItems = slicedItems.slice(0, normalizedArgs.first);
		}
	}

	// Apply last limit (backward pagination) - capped at MAX_PAGE_SIZE
	if (
		normalizedArgs.last !== undefined &&
		normalizedArgs.last !== null &&
		normalizedArgs.last >= 0
	) {
		if (slicedItems.length > normalizedArgs.last) {
			trimmedFromStart = true;
			slicedItems = slicedItems.slice(-normalizedArgs.last);
		}
	}

	// Build edges with cursors
	const edges: Edge<T>[] = slicedItems.map((item) => ({
		node: item,
		cursor: getCursor(item),
	}));

	// Calculate hasPreviousPage and hasNextPage
	// hasPreviousPage: true if there are items before the current slice
	// hasNextPage: true if there are items after the current slice
	const hasPreviousPage =
		(normalizedArgs.after !== null &&
			normalizedArgs.after !== undefined &&
			afterIndex >= 0) ||
		trimmedFromStart;
	const hasNextPage =
		(normalizedArgs.before !== null &&
			normalizedArgs.before !== undefined &&
			beforeIndex < items.length) ||
		trimmedFromEnd;

	return {
		edges,
		pageInfo: {
			hasNextPage,
			hasPreviousPage,
			startCursor: edges.length > 0 ? edges[0].cursor : null,
			endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
		},
		totalCount,
	};
}

/**
 * PageInfo GraphQL type
 */
export const PageInfoType = builder.objectRef<PageInfo>("PageInfo").implement({
	description: "Pagination information for a connection",
	fields: (t) => ({
		hasNextPage: t.exposeBoolean("hasNextPage", {
			description: "Whether there are more items after the current page",
		}),
		hasPreviousPage: t.exposeBoolean("hasPreviousPage", {
			description: "Whether there are more items before the current page",
		}),
		startCursor: t.exposeString("startCursor", {
			description: "Cursor of the first item in the current page",
			nullable: true,
		}),
		endCursor: t.exposeString("endCursor", {
			description: "Cursor of the last item in the current page",
			nullable: true,
		}),
	}),
});
