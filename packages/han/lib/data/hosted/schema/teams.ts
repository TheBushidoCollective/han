/**
 * Teams Schema
 *
 * Teams belong to organizations and can contain multiple projects and members.
 */

import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';

/**
 * Teams table
 *
 * Teams are subdivisions within an organization.
 */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.organizationId, table.slug)]
);

/**
 * TypeScript type for a team row
 */
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
