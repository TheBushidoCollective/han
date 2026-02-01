/**
 * Session List Endpoint for Han Team Platform
 *
 * GET /api/sessions
 *
 * Lists session metadata for the authenticated user.
 * No decryption needed - returns only metadata.
 */

import type { Context } from "hono";
import { z } from "zod";
import { hasKeyAccess } from "../middleware/index.ts";
import { getAllSessions, getStoredSessionsForUser } from "./session-store.ts";
import type { EncryptedSessionRecord } from "../../services/index.ts";

/**
 * Query parameters schema with size limits
 */
const ListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).max(100000).default(0),
  projectPath: z.string().max(4096).optional(),
});

/**
 * Session metadata (no encrypted content)
 */
export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  secretsRedacted: boolean;
  redactedSecretTypes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Response for session list
 */
export interface ListResponse {
  sessions: SessionMetadata[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Handle session list request
 *
 * GET /api/sessions
 */
export async function handleSessionList(c: Context): Promise<Response> {
  const auth = c.get("auth");

  // Parse query parameters
  const query = {
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    projectPath: c.req.query("projectPath"),
  };

  const parseResult = ListQuerySchema.safeParse(query);
  const { limit, offset, projectPath } = parseResult.success
    ? parseResult.data
    : { limit: 20, offset: 0, projectPath: undefined };

  // Get sessions based on user role
  let allSessions: EncryptedSessionRecord[];

  if (auth.isAdmin) {
    // Admins can see all sessions
    allSessions = getAllSessions();
  } else {
    // Regular users only see their own sessions + team sessions
    allSessions = getStoredSessionsForUser(auth.userId, auth.teamIds);
  }

  // Filter by access and optionally by project path
  const accessibleSessions: EncryptedSessionRecord[] = [];

  for (const session of allSessions) {
    // Check key access (for team/user scoped keys)
    const hasAccess = await hasKeyAccess(auth, session.keyId);
    if (!hasAccess) continue;

    // Filter by project path if specified
    if (projectPath && !session.projectPath.includes(projectPath)) {
      continue;
    }

    accessibleSessions.push(session);
  }

  // Sort by creation date (newest first)
  accessibleSessions.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Paginate
  const total = accessibleSessions.length;
  const paginatedSessions = accessibleSessions.slice(offset, offset + limit);

  // Map to metadata (no encrypted content)
  const sessionMetadata: SessionMetadata[] = paginatedSessions.map((s) => ({
    sessionId: s.sessionId,
    projectPath: s.projectPath,
    secretsRedacted: s.secretsRedacted,
    redactedSecretTypes: s.redactedSecretTypes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const response: ListResponse = {
    sessions: sessionMetadata,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  };

  return c.json(response, 200);
}
