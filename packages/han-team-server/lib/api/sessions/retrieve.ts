/**
 * Session Retrieval Endpoint for Han Team Platform
 *
 * GET /api/sessions/:id
 *
 * Retrieves and decrypts a session for an authorized user.
 */

import type { Context } from "hono";
import { getSessionEncryptionService } from "../../services/index.ts";
import { hasKeyAccess } from "../middleware/index.ts";
import { NotFoundError, ForbiddenError } from "../middleware/error-handler.ts";
import { getStoredSession } from "./sync.ts";

/**
 * Response for session retrieval
 */
export interface RetrieveResponse {
  sessionId: string;
  projectPath: string;
  summary?: string;
  messages: Array<{
    type: string;
    content: string;
    timestamp: string;
    toolUse?: unknown;
  }>;
  metadata?: Record<string, unknown>;
  retrievedAt: string;
  secretsWereRedacted: boolean;
}

/**
 * Handle session retrieval request
 *
 * GET /api/sessions/:id
 */
export async function handleSessionRetrieve(c: Context): Promise<Response> {
  const sessionId = c.req.param("id");
  const auth = c.get("auth");
  const operationContext = c.get("operationContext");

  if (!sessionId) {
    throw new NotFoundError("Session ID is required");
  }

  // Get the encrypted session record
  const record = getStoredSession(sessionId);

  if (!record) {
    throw new NotFoundError("Session not found");
  }

  // Verify the user has access to the encryption key
  const hasAccess = await hasKeyAccess(auth, record.keyId);

  if (!hasAccess) {
    throw new ForbiddenError("You do not have access to this session");
  }

  // Decrypt the session
  const encryptionService = getSessionEncryptionService();
  const result = await encryptionService.decryptSession(record, operationContext);

  const response: RetrieveResponse = {
    sessionId: result.data.sessionId,
    projectPath: result.data.projectPath,
    summary: result.data.summary,
    messages: result.data.messages,
    metadata: result.data.metadata,
    retrievedAt: result.decryptedAt.toISOString(),
    secretsWereRedacted: record.secretsRedacted,
  };

  return c.json(response, 200);
}
