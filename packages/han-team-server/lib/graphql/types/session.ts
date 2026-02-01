/**
 * GraphQL Session Type
 *
 * Represents a Claude Code session that has been synced to the team server.
 * Sessions contain messages, tool uses, and analytics data.
 *
 * @description Sessions are the core data unit in Han. Each session represents
 * one Claude Code conversation that a user has chosen to share with their team.
 *
 * Sessions are encrypted at rest and decrypted only for authorized viewers.
 * The encrypted data includes messages and tool outputs.
 */

import { builder } from "../builder.ts";
import { UserRef, type UserData } from "./user.ts";

/**
 * Session status indicating its current state.
 *
 * @description Sessions move through these states:
 * - `active`: Currently in progress
 * - `completed`: User ended the session
 * - `abandoned`: Session timed out without completion
 */
export const SessionStatusEnum = builder.enumType("SessionStatus", {
  description: "Current state of a session",
  values: {
    ACTIVE: {
      value: "active",
      description:
        "Session is currently in progress (user may still be working)",
    },
    COMPLETED: {
      value: "completed",
      description: "Session was explicitly ended by the user",
    },
    ABANDONED: {
      value: "abandoned",
      description:
        "Session timed out without explicit completion (no activity for extended period)",
    },
  },
});

/**
 * Session visibility setting.
 *
 * @description Controls who can view the session:
 * - `private`: Only the owner can view
 * - `team`: Visible to selected teams
 * - `org`: Visible to entire organization
 */
export const SessionVisibilityEnum = builder.enumType("SessionVisibility", {
  description: "Who can view this session",
  values: {
    PRIVATE: {
      value: "private",
      description: "Only the session owner can view",
    },
    TEAM: {
      value: "team",
      description: "Visible to selected teams (see sharedWithTeams)",
    },
    ORG: {
      value: "org",
      description: "Visible to all members of the organization",
    },
  },
});

/**
 * Session data shape from the database.
 *
 * @description Maps to the `sessions` table in PostgreSQL.
 * Message content is stored encrypted and decrypted on-demand.
 */
export interface SessionData {
  /** Unique session identifier (matches local session ID) */
  id: string;
  /** User who owns this session */
  ownerId: string;
  /** Organization the session belongs to */
  orgId: string;
  /** Human-readable session name (slug) */
  name: string | null;
  /** Project path on the user's machine */
  projectPath: string | null;
  /** Git repository URL if applicable */
  repoUrl: string | null;
  /** Git branch name if applicable */
  branchName: string | null;
  /** Current session status */
  status: "active" | "completed" | "abandoned";
  /** Session visibility setting */
  visibility: "private" | "team" | "org";
  /** When the session was started locally */
  startedAt: Date;
  /** When the session was last updated */
  updatedAt: Date;
  /** When the session was synced to the server */
  syncedAt: Date;
  /** Total messages in the session */
  messageCount: number;
  /** Total input tokens used */
  inputTokens: number;
  /** Total output tokens generated */
  outputTokens: number;
  /** Session summary (if generated) */
  summary: string | null;
  /** Owner user data (populated via join) */
  owner?: UserData;
}

/**
 * Session object reference for lazy type resolution.
 */
export const SessionRef = builder.objectRef<SessionData>("Session");

/**
 * Session GraphQL type implementation.
 *
 * @description Implements the session entity with full analytics data.
 * Message content is available through a separate messages connection
 * that handles decryption and pagination.
 */
export const SessionType = SessionRef.implement({
  description:
    "A Claude Code session synced to the team server for sharing and analytics",
  fields: (t) => ({
    id: t.exposeID("id", {
      description:
        "Unique session identifier (UUID format, matches local session ID)",
    }),
    ownerId: t.exposeString("ownerId", {
      description: "ID of the user who owns this session",
    }),
    orgId: t.exposeString("orgId", {
      description: "ID of the organization this session belongs to",
    }),
    name: t.string({
      nullable: true,
      description:
        "Human-readable session name (slug format like 'snug-dreaming-knuth')",
      resolve: (session) => session.name,
    }),
    projectPath: t.string({
      nullable: true,
      description:
        "Filesystem path to the project on the user's machine (for context)",
      resolve: (session) => session.projectPath,
    }),
    repoUrl: t.string({
      nullable: true,
      description: "Git remote URL if the session was in a git repository",
      resolve: (session) => session.repoUrl,
    }),
    branchName: t.string({
      nullable: true,
      description: "Git branch name at the time of the session",
      resolve: (session) => session.branchName,
    }),
    status: t.field({
      type: SessionStatusEnum,
      description: "Current state of the session (active, completed, abandoned)",
      resolve: (session) => session.status,
    }),
    visibility: t.field({
      type: SessionVisibilityEnum,
      description: "Who can view this session",
      resolve: (session) => session.visibility,
    }),
    startedAt: t.field({
      type: "DateTime",
      description: "Timestamp when the session was started locally",
      resolve: (session) => session.startedAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      description:
        "Timestamp when the session was last updated (locally or on server)",
      resolve: (session) => session.updatedAt,
    }),
    syncedAt: t.field({
      type: "DateTime",
      description: "Timestamp when the session was last synced to the server",
      resolve: (session) => session.syncedAt,
    }),
    messageCount: t.exposeInt("messageCount", {
      description: "Total number of messages in the session",
    }),
    inputTokens: t.exposeInt("inputTokens", {
      description: "Total input tokens consumed (for cost tracking)",
    }),
    outputTokens: t.exposeInt("outputTokens", {
      description: "Total output tokens generated (for cost tracking)",
    }),
    summary: t.string({
      nullable: true,
      description:
        "AI-generated summary of the session (created on completion)",
      resolve: (session) => session.summary,
    }),
    owner: t.field({
      type: UserRef,
      nullable: true,
      description: "The user who owns this session",
      resolve: (session) => session.owner ?? null,
    }),
    // Note: messages connection, sharedWithTeams, etc. would be added
    // with actual resolvers that handle decryption and pagination
  }),
});
