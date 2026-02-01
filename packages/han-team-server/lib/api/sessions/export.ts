/**
 * Session Export Endpoint for Han Team Platform
 *
 * POST /api/sessions/export
 *
 * Exports all user's sessions as an encrypted archive.
 */

import type { Context } from "hono";
import { z } from "zod";
import {
  getSessionEncryptionService,
  type EncryptedSessionRecord,
} from "../../services/index.ts";
import { hasKeyAccess } from "../middleware/index.ts";
import { ValidationError, ForbiddenError } from "../middleware/error-handler.ts";
import { getStoredSessionsForUser } from "./session-store.ts";

/**
 * Maximum sessions per export to prevent memory exhaustion
 *
 * NOTE: This is a v1 limitation. Future versions should implement
 * streaming export to handle unlimited sessions.
 */
const MAX_SESSIONS_PER_EXPORT = 1000;

/**
 * Minimum passphrase length
 */
const MIN_PASSPHRASE_LENGTH = 16;

/**
 * Maximum passphrase length
 */
const MAX_PASSPHRASE_LENGTH = 128;

/**
 * Passphrase complexity requirements
 */
function isPassphraseComplex(passphrase: string): boolean {
  // Require at least 3 of the following 4 categories:
  // - Lowercase letters
  // - Uppercase letters
  // - Digits
  // - Special characters
  let categories = 0;

  if (/[a-z]/.test(passphrase)) categories++;
  if (/[A-Z]/.test(passphrase)) categories++;
  if (/[0-9]/.test(passphrase)) categories++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) categories++;

  return categories >= 3;
}

/**
 * Request body schema for export with enhanced passphrase validation
 */
const ExportRequestSchema = z.object({
  passphrase: z
    .string()
    .min(
      MIN_PASSPHRASE_LENGTH,
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`
    )
    .max(
      MAX_PASSPHRASE_LENGTH,
      `Passphrase must be at most ${MAX_PASSPHRASE_LENGTH} characters`
    )
    .refine(isPassphraseComplex, {
      message:
        "Passphrase must contain at least 3 of: lowercase, uppercase, digits, special characters",
    }),
  includeMetadata: z.boolean().default(true),
  sessionIds: z
    .array(z.string().max(256))
    .max(MAX_SESSIONS_PER_EXPORT)
    .optional(), // If not provided, export all
});

/**
 * Response for export
 */
export interface ExportResponse {
  success: true;
  encryptedArchive: string;
  nonce: string;
  authTag: string;
  salt: string;
  exportedAt: string;
  sessionCount: number;
  instructions: string;
}

/**
 * Handle session export request
 *
 * POST /api/sessions/export
 *
 * NOTE: Current implementation loads all sessions into memory before
 * re-encryption. This is acceptable for the v1 limit of 1000 sessions.
 * Future versions should implement streaming for unlimited exports.
 */
export async function handleSessionExport(c: Context): Promise<Response> {
  const auth = c.get("auth");
  const operationContext = c.get("operationContext");

  // Parse and validate request body
  const body = await c.req.json();
  const parseResult = ExportRequestSchema.safeParse(body);

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new ValidationError(`Invalid request: ${errors}`);
  }

  const { passphrase, includeMetadata, sessionIds } = parseResult.data;

  // Get user's sessions
  let sessions: EncryptedSessionRecord[];

  if (sessionIds && sessionIds.length > 0) {
    // Get specific sessions
    const allUserSessions = getStoredSessionsForUser(auth.userId, auth.teamIds);
    sessions = allUserSessions.filter((s) => sessionIds.includes(s.sessionId));

    // Verify access to all requested sessions
    for (const session of sessions) {
      const hasAccess = await hasKeyAccess(auth, session.keyId);
      if (!hasAccess) {
        throw new ForbiddenError(
          `You do not have access to session ${session.sessionId}`
        );
      }
    }
  } else {
    // Get all user's sessions they have access to
    const allSessions = getStoredSessionsForUser(auth.userId, auth.teamIds);
    sessions = [];

    for (const session of allSessions) {
      const hasAccess = await hasKeyAccess(auth, session.keyId);
      if (hasAccess) {
        sessions.push(session);
      }
    }
  }

  if (sessions.length === 0) {
    throw new ValidationError("No sessions available for export");
  }

  // Enforce maximum sessions limit
  if (sessions.length > MAX_SESSIONS_PER_EXPORT) {
    throw new ValidationError(
      `Export limited to ${MAX_SESSIONS_PER_EXPORT} sessions. ` +
        `Please specify session IDs to export fewer sessions, or contact support for bulk export.`
    );
  }

  // Export the sessions
  const encryptionService = getSessionEncryptionService();
  const exportResult = await encryptionService.exportSessions(
    sessions,
    { passphrase, includeMetadata },
    operationContext
  );

  const response: ExportResponse = {
    success: true,
    encryptedArchive: exportResult.encryptedArchive,
    nonce: exportResult.nonce,
    authTag: exportResult.authTag,
    salt: exportResult.salt,
    exportedAt: exportResult.exportedAt.toISOString(),
    sessionCount: exportResult.sessionCount,
    instructions:
      "To decrypt this archive, use the same passphrase with the provided salt, nonce, and authTag. " +
      "Use PBKDF2 with SHA-256, 100000 iterations to derive the key from the passphrase and salt. " +
      "Then decrypt using AES-256-GCM with the nonce and authTag.",
  };

  return c.json(response, 200);
}
