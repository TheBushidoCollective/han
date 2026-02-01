/**
 * Session API Routes for Han Team Platform
 */

import type { Hono } from "hono";
import {
  requireAuth,
  requireDecryptionAccess,
  onErrorHandler,
  syncRateLimit,
  strictRateLimit,
  exportRateLimit,
  standardRateLimit,
} from "../middleware/index.ts";
import { handleSessionSync, getStoredSession, getStoredSessionsForUser } from "./sync.ts";
import { handleSessionRetrieve } from "./retrieve.ts";
import { handleSessionList } from "./list.ts";
import { handleSessionExport } from "./export.ts";

/**
 * Register session routes with the Hono app
 */
export function registerSessionRoutes(app: Hono): void {
  // Apply error handler globally
  app.onError(onErrorHandler);

  // Apply auth to all session routes
  app.use("/api/sessions/*", requireAuth);

  // POST /api/sessions/sync - Sync a session from CLI
  // Rate limited: 30 syncs per minute (encryption is CPU-intensive)
  app.post("/api/sessions/sync", syncRateLimit, handleSessionSync);

  // GET /api/sessions - List sessions (metadata only)
  // Rate limited: 100 requests per minute (standard)
  app.get("/api/sessions", standardRateLimit, handleSessionList);

  // POST /api/sessions/export - Export sessions as encrypted archive
  // Rate limited: 5 exports per 10 minutes (very CPU-intensive)
  app.post("/api/sessions/export", exportRateLimit, handleSessionExport);

  // GET /api/sessions/:id - Retrieve a specific session (decrypted)
  // Rate limited: 10 requests per minute (decryption is CPU-intensive)
  app.get(
    "/api/sessions/:id",
    strictRateLimit,
    requireDecryptionAccess("session"),
    handleSessionRetrieve
  );
}

// Re-export utilities for other modules
export { getStoredSession, getStoredSessionsForUser };
