/**
 * Sessions Schema
 *
 * Sessions represent Claude Code sessions synced from local machines.
 * They belong to projects and contain messages.
 */

import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';
import { projects } from './projects.ts';

/**
 * Sessions table
 *
 * Stores Claude Code session metadata.
 * The session ID comes from the local JSONL filename UUID.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  // The original session UUID from Claude Code (for correlation)
  localSessionId: varchar('local_session_id', { length: 36 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'completed', 'archived'
  slug: varchar('slug', { length: 255 }), // Human-readable session name (e.g., "snug-dreaming-knuth")
  transcriptPath: text('transcript_path'), // Original local path (for reference)
  lastIndexedLine: integer('last_indexed_line'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for a session row
 */
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
