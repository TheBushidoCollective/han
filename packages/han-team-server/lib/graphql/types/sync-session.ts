/**
 * GraphQL Sync Session Types
 *
 * Input types and payload for the syncSession mutation.
 *
 * @description Defines the GraphQL types for session synchronization:
 * - SyncSessionInput: Input for the mutation
 * - MessageInput: Individual message structure
 * - SyncSessionPayload: Response with session and redaction count
 */

import { builder } from "../builder.ts";
import { SessionRef, type SessionData } from "./session.ts";

// =============================================================================
// Input Types
// =============================================================================

/**
 * Message input structure.
 *
 * @description Represents a single message in a session.
 */
export const MessageInput = builder.inputType("MessageInput", {
  description: "A message in a Claude Code session",
  fields: (t) => ({
    type: t.string({
      required: true,
      description: "Message type (e.g., 'user', 'assistant', 'tool_use')",
    }),
    content: t.string({
      required: true,
      description: "Message content (text or JSON-encoded tool output)",
    }),
    timestamp: t.string({
      required: true,
      description: "ISO 8601 timestamp of when the message was created",
    }),
    toolUse: t.field({
      type: "JSON",
      required: false,
      description: "Tool use metadata if this is a tool use message",
    }),
  }),
});

/**
 * Session sync input.
 *
 * @description Input for the syncSession mutation. Contains all data
 * needed to store and index a Claude Code session.
 */
export const SyncSessionInput = builder.inputType("SyncSessionInput", {
  description: "Input for synchronizing a Claude Code session to the server",
  fields: (t) => ({
    sessionId: t.string({
      required: true,
      description:
        "Claude Code session ID (UUID format from local session files)",
    }),
    projectPath: t.string({
      required: true,
      description: "Filesystem path to the project where the session was run",
    }),
    summary: t.string({
      required: false,
      description: "AI-generated or user-provided summary of the session",
    }),
    messages: t.field({
      type: [MessageInput],
      required: true,
      description: "Array of messages exchanged during the session",
    }),
    metadata: t.field({
      type: "JSON",
      required: false,
      description:
        "Additional metadata (git info, environment, token counts, etc.)",
    }),
  }),
});

// =============================================================================
// Payload Types
// =============================================================================

/**
 * Sync session payload data structure.
 *
 * @description Represents the response from a successful session sync.
 */
export interface SyncSessionPayloadData {
  /** The synced session */
  session: SessionData;
  /** Number of secrets that were redacted */
  secretsRedacted: number;
}

/**
 * Sync session payload object reference.
 */
export const SyncSessionPayloadRef =
  builder.objectRef<SyncSessionPayloadData>("SyncSessionPayload");

/**
 * Sync session payload type.
 *
 * @description Response from the syncSession mutation containing
 * the created/updated session and the count of redacted secrets.
 */
export const SyncSessionPayloadType = SyncSessionPayloadRef.implement({
  description: "Response from the syncSession mutation",
  fields: (t) => ({
    session: t.field({
      type: SessionRef,
      description: "The synchronized session",
      resolve: (payload) => payload.session,
    }),
    secretsRedacted: t.exposeInt("secretsRedacted", {
      description:
        "Number of secrets that were detected and redacted from the session content",
    }),
  }),
});

// =============================================================================
// Export Types for Schema Registration
// =============================================================================

export type { SyncSessionPayloadData };
