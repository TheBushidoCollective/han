/**
 * Services Module
 *
 * Re-exports all service modules for easy importing.
 */

// Credential storage
export {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  isTokenExpired,
  getServerUrl,
  setServerUrl,
  getCredentialsDir,
  getCredentialsPath,
  DEFAULT_SERVER_URL,
  type StoredCredentials,
  type CredentialUser,
} from "./credentials.ts";

// Authentication service
export {
  login,
  logout,
  getAuthStatus,
  getValidAccessToken,
  refreshAccessToken,
  type LoginResult,
  type AuthStatus,
} from "./auth-service.ts";

// Sync service
export {
  syncSession,
  syncAllSessions,
  watchAndSync,
  getSyncableSessionCount,
  type SyncResult,
  type WatchResult,
} from "./sync-service.ts";
