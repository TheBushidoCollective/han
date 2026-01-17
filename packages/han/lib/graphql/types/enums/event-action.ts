/**
 * GraphQL EventAction enum
 *
 * Type of action that occurred in an event.
 */

import { builder } from "../../builder.ts";

/**
 * Event action enum
 */
export const EventActionEnum = builder.enumType("EventAction", {
	description: "Type of action that occurred",
	values: {
		CREATED: { value: "created" },
		UPDATED: { value: "updated" },
		DELETED: { value: "deleted" },
	} as const,
});
