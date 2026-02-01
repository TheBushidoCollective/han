/**
 * Native Tasks Schema
 *
 * Tracks Claude Code's built-in task system (TaskCreate/TaskUpdate).
 */

import {
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.ts";
import { sessions } from "./sessions.ts";

/**
 * Native Tasks table
 *
 * Stores tasks created via Claude Code's TaskCreate/TaskUpdate tools.
 */
export const nativeTasks = pgTable(
	"native_tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		// The task ID from Claude (e.g., "1", "2") - scoped to session
		localTaskId: varchar("local_task_id", { length: 50 }).notNull(),
		messageId: uuid("message_id"), // References the message that created/updated this task
		subject: text("subject").notNull(),
		description: text("description"),
		status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'in_progress', 'completed'
		activeForm: text("active_form"), // Present continuous form
		owner: varchar("owner", { length: 255 }),
		blocks: text("blocks"), // JSON array of task IDs
		blockedBy: text("blocked_by"), // JSON array of task IDs
		lineNumber: integer("line_number").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [unique().on(table.sessionId, table.localTaskId)],
);

/**
 * TypeScript type for a native task row
 */
export type NativeTask = typeof nativeTasks.$inferSelect;
export type NewNativeTask = typeof nativeTasks.$inferInsert;
