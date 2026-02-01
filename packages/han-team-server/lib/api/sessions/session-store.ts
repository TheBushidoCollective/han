/**
 * Centralized Session Store for Han Team Platform
 *
 * Single source of truth for in-memory session storage.
 * In production, this would be backed by a database.
 *
 * SECURITY: Session IDs and user IDs are validated before key construction
 * to prevent key injection attacks via colons in IDs.
 */

import type { EncryptedSessionRecord } from "../../services/index.ts";

/**
 * Valid ID pattern - alphanumeric, hyphens, and underscores only.
 * This prevents key injection attacks where IDs containing colons
 * could confuse the key parsing logic.
 *
 * @security Prevents: Session ID collision attacks (HIGH-4)
 */
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate an ID to prevent key injection attacks.
 *
 * @param id - The ID to validate
 * @param type - Type of ID for error messages
 * @throws Error if ID contains invalid characters
 */
function validateId(id: string, type: "userId" | "sessionId"): void {
  if (!id || id.length === 0) {
    throw new Error(`${type} cannot be empty`);
  }
  if (id.length > 256) {
    throw new Error(`${type} cannot exceed 256 characters`);
  }
  if (!VALID_ID_PATTERN.test(id)) {
    throw new Error(
      `${type} contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed.`
    );
  }
}

/**
 * Session storage key format: "userId:sessionId"
 * This ensures session ownership is enforced at the storage level.
 *
 * @security IDs are validated before key construction to prevent injection.
 */
function makeKey(userId: string, sessionId: string): string {
  // Validate IDs before constructing key to prevent colon injection
  validateId(userId, "userId");
  validateId(sessionId, "sessionId");
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
 *
 * @security Uses validated key parsing - since keys are constructed with
 * validated IDs, we know exactly one colon exists as the delimiter.
 */
export function getSessionOwner(sessionId: string): string | undefined {
  for (const [key, record] of sessionStore.entries()) {
    if (record.sessionId === sessionId) {
      // Key format is "userId:sessionId"
      // Since IDs are validated to not contain colons, first colon is the delimiter
      const colonIndex = key.indexOf(":");
      if (colonIndex === -1) {
        // Malformed key - should never happen with validated IDs
        console.error(`[SECURITY] Malformed session store key detected: ${key}`);
        continue;
      }
      return key.substring(0, colonIndex);
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
