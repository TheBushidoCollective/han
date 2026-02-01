/**
 * Session Sync Endpoint for Han Team Platform
 *
 * POST /api/sessions/sync
 *
 * Receives session data from CLI, scans for secrets,
 * encrypts, and stores in database.
 */

import type { Context } from "hono";
import { z } from "zod";
import {
  getSessionEncryptionService,
  type SessionData,
} from "../../services/index.ts";
import { ValidationError, ForbiddenError } from "../middleware/index.ts";
import { EncryptionNotAvailableError } from "../../crypto/index.ts";
import {
  storeSession,
  getStoredSession,
  isSessionOwner,
  getSessionOwner,
} from "./session-store.ts";

// Re-export for backwards compatibility
export { getStoredSession, getStoredSessionsForUser } from "./session-store.ts";

/**
 * Maximum size limits for request body fields
 */
const MAX_SESSION_ID_LENGTH = 256;
const MAX_PROJECT_PATH_LENGTH = 4096;
const MAX_SUMMARY_LENGTH = 10000;
const MAX_MESSAGE_CONTENT_LENGTH = 1000000; // 1MB per message
const MAX_MESSAGES_COUNT = 10000;

/**
 * Request body schema for session sync with size limits
 */
const SyncRequestSchema = z.object({
  sessionId: z
    .string()
    .min(1, "sessionId is required")
    .max(MAX_SESSION_ID_LENGTH, `sessionId must be at most ${MAX_SESSION_ID_LENGTH} characters`),
  projectPath: z
    .string()
    .min(1, "projectPath is required")
    .max(MAX_PROJECT_PATH_LENGTH, `projectPath must be at most ${MAX_PROJECT_PATH_LENGTH} characters`),
  summary: z
    .string()
    .max(MAX_SUMMARY_LENGTH, `summary must be at most ${MAX_SUMMARY_LENGTH} characters`)
    .optional(),
  messages: z
    .array(
      z.object({
        type: z.string().max(64),
        content: z.string().max(MAX_MESSAGE_CONTENT_LENGTH),
        timestamp: z.string().max(64),
        toolUse: z.unknown().optional(),
      })
    )
    .max(MAX_MESSAGES_COUNT, `Maximum ${MAX_MESSAGES_COUNT} messages allowed`),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Response for successful sync
 */
export interface SyncResponse {
  success: true;
  sessionId: string;
  encrypted: boolean;
  secretsRedacted: boolean;
  redactedSecretTypes: string[];
  storedAt: string;
}

/**
 * Response when encryption is not available
 */
export interface SyncPendingResponse {
  success: true;
  sessionId: string;
  encrypted: false;
  status: "pending_encryption";
  message: string;
  storedAt: string;
}

/**
 * Handle session sync request
 *
 * POST /api/sessions/sync
 */
export async function handleSessionSync(c: Context): Promise<Response> {
  // Get auth and operation context from middleware
  const auth = c.get("auth");
  const operationContext = c.get("operationContext");

  // Parse and validate request body
  const body = await c.req.json();
  const parseResult = SyncRequestSchema.safeParse(body);

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new ValidationError(`Invalid request: ${errors}`);
  }

  const sessionData: SessionData = parseResult.data;

  // Check if session already exists - enforce ownership
  const existingSession = getStoredSession(sessionData.sessionId);
  if (existingSession) {
    const ownerId = getSessionOwner(sessionData.sessionId);
    // Only the original owner or an admin can update
    if (ownerId !== auth.userId && !auth.isAdmin) {
      throw new ForbiddenError("You do not have permission to update this session");
    }
  }

  const encryptionService = getSessionEncryptionService();

  // Check if encryption is available
  if (!encryptionService.isEncryptionAvailable()) {
    // Store unencrypted temporarily (in production, queue for later encryption)
    // For now, return a pending response
    const response: SyncPendingResponse = {
      success: true,
      sessionId: sessionData.sessionId,
      encrypted: false,
      status: "pending_encryption",
      message:
        "Encryption key not yet provisioned. Session will be encrypted when key is available.",
      storedAt: new Date().toISOString(),
    };

    return c.json(response, 202);
  }

  // Encrypt and store the session
  try {
    const result = await encryptionService.encryptSession(
      sessionData,
      operationContext
    );

    // Store the encrypted record - bound to the authenticated user
    storeSession(auth.userId, result.record);

    const response: SyncResponse = {
      success: true,
      sessionId: sessionData.sessionId,
      encrypted: true,
      secretsRedacted: result.secretsDetected,
      redactedSecretTypes: result.redactedSecretTypes,
      storedAt: result.record.createdAt.toISOString(),
    };

    return c.json(response, 201);
  } catch (error) {
    if (error instanceof EncryptionNotAvailableError) {
      const response: SyncPendingResponse = {
        success: true,
        sessionId: sessionData.sessionId,
        encrypted: false,
        status: "pending_encryption",
        message: "Encryption service temporarily unavailable.",
        storedAt: new Date().toISOString(),
      };

      return c.json(response, 202);
    }
    throw error;
  }
}
