/**
 * Session File Changes Schema
 *
 * Tracks file changes made during Claude Code sessions.
 */

import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';
import { sessions } from './sessions.ts';

/**
 * Session File Changes table
 *
 * Records files created, modified, or deleted during a session.
 */
export const sessionFileChanges = pgTable('session_file_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'created', 'modified', 'deleted'
  fileHashBefore: varchar('file_hash_before', { length: 64 }),
  fileHashAfter: varchar('file_hash_after', { length: 64 }),
  toolName: varchar('tool_name', { length: 255 }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for a session file change row
 */
export type SessionFileChange = typeof sessionFileChanges.$inferSelect;
export type NewSessionFileChange = typeof sessionFileChanges.$inferInsert;
