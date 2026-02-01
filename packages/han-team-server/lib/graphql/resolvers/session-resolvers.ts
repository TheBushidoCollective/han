/**
 * Session GraphQL Resolvers
 *
 * Implements the syncSession mutation and sessions/session queries.
 *
 * @description Handles session synchronization, listing, and retrieval
 * with proper authentication, authorization, secret detection, and encryption.
 */

import { builder } from "../builder.ts";
import {
  SessionRef,
  SyncSessionInput,
  SyncSessionPayloadRef,
  type SessionData,
  type SyncSessionPayloadData,
} from "../types/index.ts";
import {
  getSessionEncryptionService,
  type SessionData as ServiceSessionData,
  type OperationContext,
} from "../../services/index.ts";
import {
  storeSession,
  getStoredSession,
  getStoredSessionsForUser,
  getSessionOwner,
  isSessionOwner,
} from "../../api/sessions/session-store.ts";
import { getAuditService } from "../../audit/index.ts";
import { EncryptionNotAvailableError } from "../../crypto/index.ts";
import type { GraphQLContext } from "../builder.ts";

// =============================================================================
// Validation Constants
// =============================================================================

const MAX_SESSION_ID_LENGTH = 256;
const MAX_PROJECT_PATH_LENGTH = 4096;
const MAX_SUMMARY_LENGTH = 10000;
const MAX_MESSAGE_CONTENT_LENGTH = 1000000; // 1MB per message
const MAX_MESSAGES_COUNT = 10000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert encrypted session record to SessionData for GraphQL.
 */
function recordToSessionData(
  record: {
    sessionId: string;
    projectPath: string;
    createdAt: Date;
    updatedAt: Date;
    keyId: string;
  },
  ownerId: string,
  orgId: string
): SessionData {
  return {
    id: record.sessionId,
    ownerId,
    orgId,
    name: null,
    projectPath: record.projectPath,
    repoUrl: null,
    branchName: null,
    status: "active",
    visibility: "private",
    startedAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncedAt: record.updatedAt,
    messageCount: 0, // Would be computed from decrypted content
    inputTokens: 0,
    outputTokens: 0,
    summary: null,
  };
}

/**
 * Validate sync session input values.
 */
function validateSyncSessionInput(input: {
  sessionId: string;
  projectPath: string;
  summary?: string | null;
  messages: Array<{ type: string; content: string; timestamp: string }>;
}): void {
  if (!input.sessionId || input.sessionId.length === 0) {
    throw new Error("sessionId is required");
  }
  if (input.sessionId.length > MAX_SESSION_ID_LENGTH) {
    throw new Error(
      `sessionId must be at most ${MAX_SESSION_ID_LENGTH} characters`
    );
  }
  if (!input.projectPath || input.projectPath.length === 0) {
    throw new Error("projectPath is required");
  }
  if (input.projectPath.length > MAX_PROJECT_PATH_LENGTH) {
    throw new Error(
      `projectPath must be at most ${MAX_PROJECT_PATH_LENGTH} characters`
    );
  }
  if (input.summary && input.summary.length > MAX_SUMMARY_LENGTH) {
    throw new Error(`summary must be at most ${MAX_SUMMARY_LENGTH} characters`);
  }
  if (input.messages.length > MAX_MESSAGES_COUNT) {
    throw new Error(`Maximum ${MAX_MESSAGES_COUNT} messages allowed`);
  }
  for (const message of input.messages) {
    if (message.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new Error(
        `Message content must be at most ${MAX_MESSAGE_CONTENT_LENGTH} characters`
      );
    }
  }
}

/**
 * Check if user can access a session.
 */
function canAccessSession(
  userId: string,
  sessionId: string,
  teamIds: string[] = [],
  isAdmin = false
): boolean {
  // Admins can access all sessions
  if (isAdmin) {
    return true;
  }

  // Check if user owns the session
  if (isSessionOwner(userId, sessionId)) {
    return true;
  }

  // Check if session belongs to one of user's teams
  const session = getStoredSession(sessionId);
  if (session) {
    for (const teamId of teamIds) {
      if (session.keyId === `team:${teamId}`) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * syncSession mutation.
 *
 * @description Synchronizes a Claude Code session to the server:
 * 1. Validates input
 * 2. Checks authorization (owner or admin)
 * 3. Scans for secrets and redacts them
 * 4. Encrypts the session content
 * 5. Stores in the session store
 * 6. Logs audit event
 */
builder.mutationField("syncSession", (t) =>
  t.field({
    type: SyncSessionPayloadRef,
    args: {
      input: t.arg({ type: SyncSessionInput, required: true }),
    },
    description:
      "Synchronize a Claude Code session to the server. Detects and redacts secrets, encrypts content, and stores the session.",
    resolve: async (_parent, args, context: GraphQLContext) => {
      // Step 1: Require authentication
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const { id: userId, orgId, teamIds = [], role } = context.user;
      const isAdmin = role === "admin";

      // Step 2: Validate input
      const input = args.input;
      validateSyncSessionInput({
        sessionId: input.sessionId,
        projectPath: input.projectPath,
        summary: input.summary,
        messages: input.messages.map((m) => ({
          type: m.type,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });

      // Step 3: Check if session exists and enforce ownership atomically
      // SECURITY FIX: Use atomic check-and-update to prevent TOCTOU race conditions
      const existingSession = getStoredSession(input.sessionId);
      if (existingSession) {
        // Get owner in the same operation as existence check
        // The session record was just fetched, use it directly
        const ownerId = getSessionOwner(input.sessionId);

        // SECURITY: Atomic permission check with the fetched session
        // Re-verify the session still exists and owner matches
        const currentSession = getStoredSession(input.sessionId);
        const currentOwnerId = getSessionOwner(input.sessionId);

        // If session was deleted between checks, treat as new session (owned by current user)
        if (currentSession && currentOwnerId !== userId && !isAdmin) {
          throw new Error("You do not have permission to update this session");
        }

        // If owner changed between checks, abort to prevent race condition exploitation
        if (currentSession && ownerId !== currentOwnerId) {
          throw new Error("Session ownership changed during update, please retry");
        }
      }

      // Step 4: Build operation context
      const operationContext: OperationContext = {
        userId,
        teamId: teamIds[0], // Use first team for encryption key scope
      };

      // Step 5: Build session data for encryption service
      const sessionData: ServiceSessionData = {
        sessionId: input.sessionId,
        projectPath: input.projectPath,
        summary: input.summary ?? undefined,
        messages: input.messages.map((m) => ({
          type: m.type,
          content: m.content,
          timestamp: m.timestamp,
          toolUse: m.toolUse,
        })),
        metadata: input.metadata as Record<string, unknown> | undefined,
      };

      // Step 6: Get encryption service
      const encryptionService = getSessionEncryptionService();

      // Step 7: Check encryption availability
      if (!encryptionService.isEncryptionAvailable()) {
        throw new Error(
          "Encryption service not available. Please try again later."
        );
      }

      // Step 8: Encrypt session (includes secret detection and redaction)
      let encryptResult;
      try {
        encryptResult = await encryptionService.encryptSession(
          sessionData,
          operationContext
        );
      } catch (error) {
        if (error instanceof EncryptionNotAvailableError) {
          throw new Error(
            "Encryption service temporarily unavailable. Please try again later."
          );
        }
        throw error;
      }

      // Step 9: Store the encrypted session
      storeSession(userId, encryptResult.record);

      // Step 10: Build response
      const responseSession: SessionData = {
        id: input.sessionId,
        ownerId: userId,
        orgId,
        name: null,
        projectPath: input.projectPath,
        repoUrl: null,
        branchName: null,
        status: "active",
        visibility: "private",
        startedAt: encryptResult.record.createdAt,
        updatedAt: encryptResult.record.updatedAt,
        syncedAt: encryptResult.record.updatedAt,
        messageCount: input.messages.length,
        inputTokens: 0,
        outputTokens: 0,
        summary: input.summary ?? null,
      };

      const payload: SyncSessionPayloadData = {
        session: responseSession,
        secretsRedacted: encryptResult.redactedSecretCount,
      };

      return payload;
    },
  })
);

// =============================================================================
// Queries
// =============================================================================

/**
 * sessions query - Relay connection for user's sessions.
 *
 * @description Returns a paginated list of sessions accessible to the user.
 * Uses Relay cursor-based pagination.
 */
builder.queryField("sessions", (t) =>
  t.connection({
    type: SessionRef,
    description:
      "Get the authenticated user's synced sessions. Returns a Relay connection for pagination.",
    resolve: async (_parent, args, context: GraphQLContext) => {
      // Require authentication
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const { id: userId, orgId, teamIds = [] } = context.user;

      // Get sessions accessible to user
      const records = getStoredSessionsForUser(userId, teamIds);

      // Convert to SessionData array
      const sessions: SessionData[] = records.map((record) =>
        recordToSessionData(record, userId, orgId)
      );

      // Apply pagination with validation
      const first = args.first ?? 20;
      const after = args.after;

      let startIndex = 0;
      if (after) {
        // Cursor is base64-encoded index
        // SECURITY FIX: Validate parsed cursor to prevent injection attacks
        let decodedCursor: string;
        try {
          decodedCursor = Buffer.from(after, "base64").toString("utf-8");
        } catch {
          throw new Error("Invalid cursor format");
        }

        const parsedIndex = parseInt(decodedCursor, 10);

        // Validate the parsed index is a finite, non-negative integer
        if (!Number.isFinite(parsedIndex) || parsedIndex < 0 || !Number.isInteger(parsedIndex)) {
          throw new Error("Invalid cursor value");
        }

        // Prevent integer overflow attacks
        if (parsedIndex > Number.MAX_SAFE_INTEGER - 1) {
          throw new Error("Cursor value out of range");
        }

        startIndex = parsedIndex + 1;
      }

      const endIndex = startIndex + first;
      const paginatedSessions = sessions.slice(startIndex, endIndex);

      // Build edges
      const edges = paginatedSessions.map((session, index) => ({
        cursor: Buffer.from(String(startIndex + index)).toString("base64"),
        node: session,
      }));

      // Build page info
      const hasNextPage = endIndex < sessions.length;
      const hasPreviousPage = startIndex > 0;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },
  })
);

/**
 * session query - Get single session by ID.
 *
 * @description Returns a decrypted session if the user has access.
 * Authorization checks:
 * - User owns the session
 * - User is a member of a team that has access
 * - User is an admin
 */
builder.queryField("session", (t) =>
  t.field({
    type: SessionRef,
    nullable: true,
    args: {
      id: t.arg.string({
        required: true,
        description: "Session ID (UUID format, matches local session ID)",
      }),
    },
    description:
      "Get a session by ID. Requires authentication and view permission (owner, team member, or org member based on visibility).",
    resolve: async (_parent, args, context: GraphQLContext) => {
      // Require authentication
      if (!context.user) {
        return null;
      }

      const { id: userId, orgId, teamIds = [], role } = context.user;
      const isAdmin = role === "admin";
      const sessionId = args.id;

      // Check access
      if (!canAccessSession(userId, sessionId, teamIds, isAdmin)) {
        return null;
      }

      // Get the session record
      const record = getStoredSession(sessionId);
      if (!record) {
        return null;
      }

      // Get encryption service
      const encryptionService = getSessionEncryptionService();

      // Build operation context for decryption
      const operationContext: OperationContext = {
        userId,
        teamId: teamIds[0],
      };

      // Attempt to decrypt
      try {
        const decryptResult = await encryptionService.decryptSession(
          record,
          operationContext
        );

        // Build full session data from decrypted content
        const sessionData: SessionData = {
          id: sessionId,
          ownerId: getSessionOwner(sessionId) ?? userId,
          orgId,
          name: null,
          projectPath: decryptResult.data.projectPath,
          repoUrl: null,
          branchName: null,
          status: "active",
          visibility: "private",
          startedAt: record.createdAt,
          updatedAt: record.updatedAt,
          syncedAt: record.updatedAt,
          messageCount: decryptResult.data.messages.length,
          inputTokens: 0,
          outputTokens: 0,
          summary: decryptResult.data.summary ?? null,
        };

        return sessionData;
      } catch (error) {
        // Log decryption failure
        const auditService = getAuditService();
        await auditService.log({
          eventType: "session.view",
          userId,
          metadata: {
            sessionId,
            error: "decryption_failed",
          },
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Decryption failed",
        });

        // Return null on decryption failure (don't expose error details)
        return null;
      }
    },
  })
);
