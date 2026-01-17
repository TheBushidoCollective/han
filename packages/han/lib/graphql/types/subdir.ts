/**
 * GraphQL Subdir type
 *
 * Represents a subdirectory within a worktree.
 */

import type { SubdirInfo } from "../../api/sessions.ts";
import { builder } from "../builder.ts";

/**
 * Subdir type ref
 */
const SubdirRef = builder.objectRef<SubdirInfo>("Subdir");

/**
 * Subdir type implementation
 */
export const SubdirType = SubdirRef.implement({
	description: "A subdirectory within a worktree",
	fields: (t) => ({
		relativePath: t.exposeString("relativePath", {
			description: "Relative path from worktree root",
		}),
		path: t.exposeString("path", { description: "Full path to subdirectory" }),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions in this subdirectory",
		}),
	}),
});
