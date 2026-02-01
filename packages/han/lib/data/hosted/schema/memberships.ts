/**
 * Memberships Schema
 *
 * Memberships link users to organizations and optionally teams with a role.
 */

import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.ts";
import { teams } from "./teams.ts";
import { users } from "./users.ts";

/**
 * Memberships table
 *
 * Defines user access to organizations and teams.
 */
export const memberships = pgTable(
	"memberships",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
		role: varchar("role", { length: 50 }).notNull().default("member"), // 'owner', 'admin', 'member', 'viewer'
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [unique().on(table.userId, table.organizationId, table.teamId)],
);

/**
 * TypeScript type for a membership row
 */
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

/**
 * Role types for memberships
 */
export type MembershipRole = "owner" | "admin" | "member" | "viewer";
