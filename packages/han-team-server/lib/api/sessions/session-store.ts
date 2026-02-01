/**
 * Centralized Session Store for Han Team Platform
 *
 * Single source of truth for in-memory session storage.
 * In production, this would be backed by a database.
 */

import type { EncryptedSessionRecord } from "../../services/index.ts";

/**
 * Session storage key format: "userId:sessionId"
 * This ensures session ownership is enforced at the storage level.
 */
function makeKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

/**
 * In-memory session storage
 *
 * Key format: "userId:sessionId" - binds sessions to their owner
 */
const sessionStore = new Map<string, EncryptedSessionRecord>();

/**
 * Store a session (creates or updates)
 *
 * @param userId - Owner user ID (required for ownership binding)
 * @param record - Encrypted session record
 */
export function storeSession(userId: string, record: EncryptedSessionRecord): void {
  const key = makeKey(userId, record.sessionId);
  sessionStore.set(key, record);
}

/**
 * Get a stored session by ID
 *
 * @param sessionId - Session ID to look up
 * @returns The session record if found, undefined otherwise
 */
export function getStoredSession(sessionId: string): EncryptedSessionRecord | undefined {
  // Search through all entries since we don't know the owner
  for (const [key, record] of sessionStore.entries()) {
    if (record.sessionId === sessionId) {
      return record;
    }
  }
  return undefined;
}

/**
 * Get a stored session with ownership check
 *
 * @param userId - User ID to check ownership
 * @param sessionId - Session ID to look up
 * @returns The session record if found and owned by user, undefined otherwise
 */
export function getStoredSessionForUser(
  userId: string,
  sessionId: string
): EncryptedSessionRecord | undefined {
  const key = makeKey(userId, sessionId);
  return sessionStore.get(key);
}

/**
 * Check if user owns a session
 *
 * @param userId - User ID to check
 * @param sessionId - Session ID to check ownership of
 * @returns true if user owns the session
 */
export function isSessionOwner(userId: string, sessionId: string): boolean {
  const key = makeKey(userId, sessionId);
  return sessionStore.has(key);
}

/**
 * Get session owner ID
 *
 * @param sessionId - Session ID to look up
 * @returns Owner user ID if found, undefined otherwise
 */
export function getSessionOwner(sessionId: string): string | undefined {
  for (const [key, record] of sessionStore.entries()) {
    if (record.sessionId === sessionId) {
      // Key format is "userId:sessionId"
      return key.split(":")[0];
    }
  }
  return undefined;
}

/**
 * Get all sessions accessible to a user
 *
 * In production, this would query the database.
 * For demo, return sessions the user can access based on key scope.
 *
 * @param userId - User ID
 * @param teamIds - User's team IDs
 * @returns Array of accessible session records
 */
export function getStoredSessionsForUser(
  userId: string,
  teamIds: string[] = []
): EncryptedSessionRecord[] {
  return Array.from(sessionStore.values()).filter((session) => {
    // Check if user owns the key (user scope)
    if (session.keyId === `user:${userId}`) {
      return true;
    }
    // Check if user is member of a team that owns the key
    for (const teamId of teamIds) {
      if (session.keyId === `team:${teamId}`) {
        return true;
      }
    }
    // Note: Global keys are NOT automatically accessible
    // Admin check should be done separately by the caller
    return false;
  });
}

/**
 * Get all sessions (admin only - for list endpoint)
 *
 * @returns Array of all session records
 */
export function getAllSessions(): EncryptedSessionRecord[] {
  return Array.from(sessionStore.values());
}

/**
 * Clear all sessions (for testing)
 */
export function clearSessionStore(): void {
  sessionStore.clear();
}
