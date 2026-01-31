/**
 * Organization Schema
 *
 * Organizations are the top-level tenant entity. All data is scoped to an organization.
 */

import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Organizations table
 *
 * Represents a tenant (company/team) in the hosted platform.
 */
export const organizations = pgTable("organizations", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 255 }).notNull(),
	slug: varchar("slug", { length: 255 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for an organization row
 */
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
