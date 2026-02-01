/**
 * Projects Schema
 *
 * Projects belong to organizations and optionally teams and repositories.
 * They represent directories where Claude Code sessions are run.
 */

import {
	boolean,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.ts";
import { repositories } from "./repositories.ts";
import { teams } from "./teams.ts";

/**
 * Projects table
 *
 * Represents a project directory synced from local Claude Code.
 */
export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		repositoryId: uuid("repository_id").references(() => repositories.id, {
			onDelete: "set null",
		}),
		teamId: uuid("team_id").references(() => teams.id, {
			onDelete: "set null",
		}),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull(),
		path: text("path"), // Local filesystem path (if synced)
		relativePath: text("relative_path"), // Path relative to repo root
		isWorktree: boolean("is_worktree").default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [unique().on(table.organizationId, table.slug)],
);

/**
 * TypeScript type for a project row
 */
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
