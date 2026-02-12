/**
 * Services Module
 *
 * Re-exports all service modules for easy importing.
 */

// Authentication service
export {
  type AuthStatus,
  getAuthStatus,
  getValidAccessToken,
  type LoginResult,
  login,
  logout,
  refreshAccessToken,
} from './auth-service.ts';
// Credential storage
export {
  type CredentialUser,
  clearCredentials,
  DEFAULT_SERVER_URL,
  getCredentialsDir,
  getCredentialsPath,
  getServerUrl,
  isTokenExpired,
  loadCredentials,
  type StoredCredentials,
  saveCredentials,
  setServerUrl,
} from './credentials.ts';

// Sync service
export {
  getSyncableSessionCount,
  type SyncResult,
  syncAllSessions,
  syncSession,
  type WatchResult,
  watchAndSync,
} from './sync-service.ts';
