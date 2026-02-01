/**
 * Messages Schema
 *
 * Messages represent individual JSONL entries from Claude Code sessions.
 * They are synced from local machines and belong to sessions.
 */

import {
	doublePrecision,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.ts";
import { sessions } from "./sessions.ts";

/**
 * Messages table
 *
 * Stores individual messages from Claude Code sessions.
 * Each message represents a JSONL line from the transcript.
 */
export const messages = pgTable("messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	sessionId: uuid("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	// The original message UUID from Claude Code (for correlation)
	localMessageId: varchar("local_message_id", { length: 36 }).notNull(),
	agentId: varchar("agent_id", { length: 36 }), // NULL for main conversation
	parentId: uuid("parent_id"), // References another message (for results)
	messageType: varchar("message_type", { length: 100 }).notNull(),
	role: varchar("role", { length: 50 }), // 'user', 'assistant', 'system'
	content: text("content"),
	toolName: varchar("tool_name", { length: 255 }),
	toolInput: text("tool_input"), // JSON string
	toolResult: text("tool_result"),
	rawJson: text("raw_json"), // Original JSONL line
	timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
	lineNumber: integer("line_number").notNull(),
	sourceFileName: varchar("source_file_name", { length: 255 }),
	sourceFileType: varchar("source_file_type", { length: 50 }), // 'main', 'agent', 'han_events'
	// Sentiment analysis
	sentimentScore: doublePrecision("sentiment_score"),
	sentimentLevel: varchar("sentiment_level", { length: 50 }), // 'positive', 'neutral', 'negative'
	frustrationScore: doublePrecision("frustration_score"),
	frustrationLevel: varchar("frustration_level", { length: 50 }), // 'low', 'moderate', 'high'
	indexedAt: timestamp("indexed_at", { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for a message row
 */
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
