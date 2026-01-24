/**
 * GraphQL TaskOutcome enum
 *
 * Outcome of a completed task.
 */

import { builder } from "../../builder.ts";

export const TaskOutcomeEnum = builder.enumType("TaskOutcome", {
	values: ["SUCCESS", "PARTIAL", "FAILURE"] as const,
	description: "Outcome of a completed task",
});
