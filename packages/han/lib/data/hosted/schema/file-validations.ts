/**
 * Session File Validations Schema
 *
 * Tracks file validation status for hook caching.
 */

import {
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';
import { sessions } from './sessions.ts';

/**
 * Session File Validations table
 *
 * Records which files have been validated by which hooks.
 * Used for caching hook execution results.
 */
export const sessionFileValidations = pgTable(
  'session_file_validations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    filePath: text('file_path').notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    pluginName: varchar('plugin_name', { length: 255 }).notNull(),
    hookName: varchar('hook_name', { length: 255 }).notNull(),
    directory: text('directory').notNull(),
    commandHash: varchar('command_hash', { length: 64 }).notNull(),
    validatedAt: timestamp('validated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique().on(
      table.sessionId,
      table.filePath,
      table.pluginName,
      table.hookName,
      table.directory
    ),
  ]
);

/**
 * TypeScript type for a session file validation row
 */
export type SessionFileValidation = typeof sessionFileValidations.$inferSelect;
export type NewSessionFileValidation =
  typeof sessionFileValidations.$inferInsert;
