/**
 * Repositories Schema
 *
 * Repositories represent git remotes synced from local Claude Code projects.
 * They belong to organizations and can have multiple projects.
 */

import { pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.ts";

/**
 * Repositories table
 *
 * Stores git repository metadata synced from local machines.
 */
export const repositories = pgTable(
	"repositories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		remote: text("remote").notNull(), // Git remote URL
		name: varchar("name", { length: 255 }).notNull(),
		defaultBranch: varchar("default_branch", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [unique().on(table.organizationId, table.remote)],
);

/**
 * TypeScript type for a repository row
 */
export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
