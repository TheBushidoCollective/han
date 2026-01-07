/**
 * GraphQL TaskTypeCount type
 *
 * Task count by type.
 */

import { builder } from "../../builder.ts";
import { TaskTypeEnum } from "./task-type-enum.ts";

/**
 * Task type count interface
 */
export interface TaskTypeCount {
	type: "IMPLEMENTATION" | "FIX" | "REFACTOR" | "RESEARCH";
	count: number;
}

const TaskTypeCountRef = builder.objectRef<TaskTypeCount>("TaskTypeCount");

export const TaskTypeCountType = TaskTypeCountRef.implement({
	description: "Task count by type",
	fields: (t) => ({
		type: t.field({
			type: TaskTypeEnum,
			resolve: (obj) => obj.type,
		}),
		count: t.exposeInt("count"),
	}),
});
