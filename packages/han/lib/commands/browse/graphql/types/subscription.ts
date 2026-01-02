/**
 * GraphQL Subscription Types
 *
 * Defines subscription types for real-time updates via WebSocket.
 */

import { builder } from "../builder.ts";

/**
 * Memory event action enum
 */
export const EventActionEnum = builder.enumType("EventAction", {
	description: "Type of action that occurred",
	values: {
		CREATED: { value: "created" },
		UPDATED: { value: "updated" },
		DELETED: { value: "deleted" },
	} as const,
});

/**
 * Memory event type enum
 */
export const MemoryEventTypeEnum = builder.enumType("MemoryEventType", {
	description: "Type of memory that changed",
	values: {
		SESSION: { value: "session" },
		SUMMARY: { value: "summary" },
		RULE: { value: "rule" },
		OBSERVATION: { value: "observation" },
		RELOAD: { value: "reload" },
	} as const,
});

/**
 * Memory event payload interface
 */
export interface MemoryEventPayload {
	type: "session" | "summary" | "rule" | "observation" | "reload";
	action: "created" | "updated" | "deleted";
	path: string;
	timestamp: number;
}

/**
 * Memory event type for subscriptions
 */
const MemoryEventRef = builder.objectRef<MemoryEventPayload>("MemoryEvent");

export const MemoryEventType = MemoryEventRef.implement({
	description: "Event emitted when memory changes",
	fields: (t) => ({
		type: t.field({
			type: MemoryEventTypeEnum,
			description: "Type of memory that changed",
			resolve: (e) => e.type,
		}),
		action: t.field({
			type: EventActionEnum,
			description: "What action occurred",
			resolve: (e) => e.action,
		}),
		path: t.string({
			description: "Path to the affected file",
			resolve: (e) => e.path,
		}),
		timestamp: t.string({
			description: "ISO timestamp when the event occurred",
			resolve: (e) => new Date(e.timestamp).toISOString(),
		}),
	}),
});
