/**
 * Hook Executions Schema
 *
 * Tracks hook execution history for sessions.
 */

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';
import { sessions } from './sessions.ts';

/**
 * Hook Executions table
 *
 * Records each hook execution with its outcome.
 */
export const hookExecutions = pgTable('hook_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id, {
    onDelete: 'cascade',
  }),
  orchestrationId: uuid('orchestration_id'),
  taskId: varchar('task_id', { length: 255 }),
  hookType: varchar('hook_type', { length: 100 }).notNull(), // 'Stop', 'SessionStart', etc.
  hookName: varchar('hook_name', { length: 255 }).notNull(),
  hookSource: varchar('hook_source', { length: 255 }),
  directory: text('directory'),
  durationMs: integer('duration_ms').notNull().default(0),
  exitCode: integer('exit_code').notNull().default(0),
  passed: boolean('passed').notNull().default(false),
  output: text('output'),
  error: text('error'),
  ifChanged: text('if_changed'), // JSON array of glob patterns
  command: text('command'),
  status: varchar('status', { length: 50 }).default('completed'), // 'pending', 'running', 'completed', 'failed'
  consecutiveFailures: integer('consecutive_failures').default(0),
  maxAttempts: integer('max_attempts').default(3),
  pid: integer('pid'),
  pluginRoot: text('plugin_root'),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for a hook execution row
 */
export type HookExecution = typeof hookExecutions.$inferSelect;
export type NewHookExecution = typeof hookExecutions.$inferInsert;
