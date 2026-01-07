/**
 * GraphQL FileChangeAction enum
 *
 * The type of file change action.
 */

import { builder } from "../../builder.ts";

export const FileChangeActionEnum = builder.enumType("FileChangeAction", {
	description: "The type of file change action",
	values: {
		CREATED: { value: "created", description: "File was created" },
		MODIFIED: { value: "modified", description: "File was modified" },
		DELETED: { value: "deleted", description: "File was deleted" },
	},
});
