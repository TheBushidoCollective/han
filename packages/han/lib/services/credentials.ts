/**
 * Credential Storage Service
 *
 * Manages secure storage of authentication credentials in ~/.config/han/credentials.json.
 * Features:
 * - Secure file permissions (0600 - owner read/write only)
 * - Automatic token refresh
 * - Server URL configuration
 * - HTTPS enforcement for server URLs (MEDIUM-3)
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Whether to allow insecure HTTP connections (MEDIUM-3)
 * Can be enabled via HAN_INSECURE=1 environment variable
 */
export function isInsecureAllowed(): boolean {
  return (
    process.env.HAN_INSECURE === '1' || process.env.HAN_INSECURE === 'true'
  );
}

/**
 * Validate server URL scheme (MEDIUM-3)
 * Requires HTTPS unless insecure mode is explicitly enabled
 *
 * @param url - Server URL to validate
 * @param allowInsecure - Allow HTTP scheme (default: false)
 * @throws Error if URL uses HTTP and insecure not allowed
 */
export function validateServerUrlScheme(
  url: string,
  allowInsecure = false
): void {
  const parsed = new URL(url);

  // localhost is always allowed for development
  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  if (parsed.protocol === 'http:' && !isLocalhost) {
    if (!allowInsecure && !isInsecureAllowed()) {
      throw new Error(
        `Insecure HTTP connection not allowed for server URL: ${url}\n` +
          `Use HTTPS or set HAN_INSECURE=1 to allow insecure connections.\n` +
          `WARNING: HTTP connections transmit credentials in plain text.`
      );
    }
  }
}

/**
 * User information stored with credentials
 */
export interface CredentialUser {
  id: string;
  email: string | null;
  github_username: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

/**
 * Stored credentials structure
 */
export interface StoredCredentials {
  /** Server URL for API calls */
  server_url: string;
  /** JWT access token */
  access_token: string;
  /** JWT refresh token */
  refresh_token: string;
  /** User information */
  user: CredentialUser;
  /** Access token expiration time */
  expires_at: string;
  /** Refresh token expiration time (optional, for reference) */
  refresh_expires_at?: string;
}

/**
 * Default server URL
 */
export const DEFAULT_SERVER_URL = 'https://api.han.guru';

/**
 * Get the credentials directory path
 */
export function getCredentialsDir(): string {
  return join(homedir(), '.config', 'han');
}

/**
 * Get the credentials file path
 */
export function getCredentialsPath(): string {
  return join(getCredentialsDir(), 'credentials.json');
}

/**
 * Ensure credentials directory exists with proper permissions
 */
function ensureCredentialsDir(): void {
  const dir = getCredentialsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load stored credentials from disk
 *
 * @returns Stored credentials or null if not found/invalid
 */
export function loadCredentials(): StoredCredentials | null {
  const path = getCredentialsPath();

  if (!existsSync(path)) {
    return null;
  }

  try {
    // Check file permissions on Unix systems
    if (process.platform !== 'win32') {
      const stats = statSync(path);
      const mode = stats.mode & 0o777;
      // Warn if file permissions are too permissive
      if (mode !== 0o600) {
        console.error(
          `Warning: Credentials file has insecure permissions ${mode.toString(8)}. ` +
            `Run: chmod 600 ${path}`
        );
      }
    }

    const content = readFileSync(path, 'utf-8');
    const credentials = JSON.parse(content) as StoredCredentials;

    // Validate required fields
    if (
      !credentials.access_token ||
      !credentials.refresh_token ||
      !credentials.server_url ||
      !credentials.user
    ) {
      return null;
    }

    return credentials;
  } catch {
    return null;
  }
}

/**
 * Save credentials to disk with secure permissions
 *
 * @param credentials - Credentials to save
 */
export function saveCredentials(credentials: StoredCredentials): void {
  ensureCredentialsDir();
  const path = getCredentialsPath();

  const content = JSON.stringify(credentials, null, 2);
  writeFileSync(path, content, { mode: 0o600 });

  // Explicitly set permissions (in case umask interfered)
  if (process.platform !== 'win32') {
    chmodSync(path, 0o600);
  }
}

/**
 * Clear stored credentials
 *
 * @returns true if credentials were cleared, false if none existed
 */
export function clearCredentials(): boolean {
  const path = getCredentialsPath();

  if (!existsSync(path)) {
    return false;
  }

  try {
    // Overwrite with empty object before deleting (security best practice)
    writeFileSync(path, '{}', { mode: 0o600 });
    // Use unlink to delete
    const { unlinkSync } = require('node:fs');
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if access token is expired or about to expire
 *
 * @param credentials - Stored credentials
 * @param bufferSeconds - Buffer before expiration to consider expired (default: 60s)
 * @returns true if token is expired or will expire within buffer time
 */
export function isTokenExpired(
  credentials: StoredCredentials,
  bufferSeconds = 60
): boolean {
  if (!credentials.expires_at) {
    // No expiration info, assume expired
    return true;
  }

  const expiresAt = new Date(credentials.expires_at);
  const now = new Date();
  const bufferMs = bufferSeconds * 1000;

  return expiresAt.getTime() - now.getTime() <= bufferMs;
}

/**
 * Get configured server URL
 *
 * Priority:
 * 1. HAN_SERVER_URL environment variable
 * 2. Stored credentials server_url
 * 3. Default server URL
 */
export function getServerUrl(): string {
  // Environment variable takes priority
  if (process.env.HAN_SERVER_URL) {
    return process.env.HAN_SERVER_URL;
  }

  // Check stored credentials
  const credentials = loadCredentials();
  if (credentials?.server_url) {
    return credentials.server_url;
  }

  return DEFAULT_SERVER_URL;
}

/**
 * Update server URL in credentials (MEDIUM-3)
 * Validates HTTPS scheme unless insecure mode is enabled
 *
 * @param serverUrl - New server URL
 * @param allowInsecure - Allow HTTP scheme (default: false)
 * @returns true if updated, false if no credentials exist
 * @throws Error if URL uses HTTP and insecure not allowed
 */
export function setServerUrl(
  serverUrl: string,
  allowInsecure = false
): boolean {
  // Validate HTTPS scheme (MEDIUM-3)
  validateServerUrlScheme(serverUrl, allowInsecure);

  const credentials = loadCredentials();

  if (!credentials) {
    // No credentials, save just the server URL
    ensureCredentialsDir();
    const path = getCredentialsPath();
    const content = JSON.stringify({ server_url: serverUrl }, null, 2);
    writeFileSync(path, content, { mode: 0o600 });
    return true;
  }

  credentials.server_url = serverUrl;
  saveCredentials(credentials);
  return true;
}
