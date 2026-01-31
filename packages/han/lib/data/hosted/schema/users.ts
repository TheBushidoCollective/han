/**
 * Users Schema
 *
 * Users are authenticated via OAuth providers (GitHub, GitLab, etc.).
 */

import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Users table
 *
 * Stores user account information synced from OAuth providers.
 */
export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: varchar("email", { length: 255 }).unique(),
		name: varchar("name", { length: 255 }),
		avatarUrl: varchar("avatar_url", { length: 512 }),
		provider: varchar("provider", { length: 50 }), // 'github', 'gitlab', 'email'
		providerId: varchar("provider_id", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [unique().on(table.provider, table.providerId)],
);

/**
 * TypeScript type for a user row
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
