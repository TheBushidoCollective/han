/**
 * CLI Authentication Service
 *
 * Handles browser-based OAuth authentication flow with PKCE:
 * 1. Generate state and PKCE code verifier/challenge
 * 2. Start local HTTP server on random port
 * 3. Open browser to server's CLI auth endpoint
 * 4. Receive callback with auth code, verify state
 * 5. Exchange code for tokens via POST with code_verifier
 * 6. Store credentials securely
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  isTokenExpired,
  getServerUrl,
  type StoredCredentials,
  type CredentialUser,
} from "./credentials.ts";

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Prevents authorization code interception attacks
 */
function generateCodeVerifier(): string {
  // Generate a random 32-byte value and encode as URL-safe base64
  return randomBytes(32)
    .toString("base64url")
    .replace(/=/g, "");
}

function generateCodeChallenge(verifier: string): string {
  // SHA-256 hash of the verifier, encoded as URL-safe base64
  return createHash("sha256")
    .update(verifier)
    .digest("base64url")
    .replace(/=/g, "");
}

/**
 * Generate a random state token for CSRF protection
 */
function generateState(): string {
  return randomBytes(32).toString("base64url").replace(/=/g, "");
}

/**
 * Mutex for token refresh to prevent race conditions
 */
let tokenRefreshPromise: Promise<TokenResponse> | null = null;

/**
 * Token response from server
 */
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

/**
 * User info response from /api/v1/user/me
 */
interface UserInfoResponse {
  id: string;
  email: string | null;
  name: string | null;
  github_username: string | null;
  avatar_url: string | null;
}

/**
 * Error response from server
 */
interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  user?: CredentialUser;
  error?: string;
}

/**
 * Auth status result
 */
export interface AuthStatus {
  authenticated: boolean;
  user?: CredentialUser;
  serverUrl: string;
  expiresAt?: string;
  tokenExpired?: boolean;
}

/**
 * Open URL in default browser
 * Uses execFile with array arguments to prevent command injection (MEDIUM-2)
 */
function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string;
    let args: string[];

    switch (process.platform) {
      case "darwin":
        command = "open";
        args = [url];
        break;
      case "win32":
        command = "cmd";
        args = ["/c", "start", "", url];
        break;
      default:
        // Linux and others
        command = "xdg-open";
        args = [url];
    }

    execFile(command, args, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Find an available port for the callback server
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not determine port")));
      }
    });
    server.on("error", reject);
  });
}

/**
 * Exchange auth code for tokens
 * Includes PKCE code_verifier for secure token exchange (HIGH-2)
 */
async function exchangeCodeForTokens(
  serverUrl: string,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(`${serverUrl}/auth/cli/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Fetch user info from server
 */
async function fetchUserInfo(
  serverUrl: string,
  accessToken: string
): Promise<UserInfoResponse> {
  const response = await fetch(`${serverUrl}/api/v1/user/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: HTTP ${response.status}`);
  }

  return response.json() as Promise<UserInfoResponse>;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  serverUrl: string,
  refreshToken: string
): Promise<TokenResponse> {
  const response = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Start browser-based login flow with PKCE and state parameter for security
 *
 * Security features:
 * - PKCE (Proof Key for Code Exchange) prevents authorization code interception (HIGH-2)
 * - State parameter prevents CSRF attacks (HIGH-1)
 *
 * @param serverUrl - Optional server URL (uses configured/default if not provided)
 * @param timeout - Timeout in milliseconds (default: 5 minutes)
 * @returns Login result with user info on success
 */
export async function login(
  serverUrl?: string,
  timeout = 5 * 60 * 1000
): Promise<LoginResult> {
  const server = serverUrl || getServerUrl();

  // Find available port
  let port: number;
  try {
    port = await findAvailablePort();
  } catch (error) {
    return {
      success: false,
      error: `Failed to find available port: ${error instanceof Error ? error.message : error}`,
    };
  }

  // Generate PKCE code verifier and challenge (HIGH-2)
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Generate state for CSRF protection (HIGH-1)
  const expectedState = generateState();

  // Create callback server
  return new Promise<LoginResult>((resolve) => {
    let resolved = false;
    let httpServer: ReturnType<typeof createServer> | null = null;

    const cleanup = () => {
      if (httpServer) {
        httpServer.close();
        httpServer = null;
      }
    };

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          error: "Login timed out. Please try again.",
        });
      }
    }, timeout);

    httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const returnedState = url.searchParams.get("state");

        // Verify state parameter to prevent CSRF (HIGH-1)
        if (returnedState !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Han CLI Login Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Security Error</h1>
                <p>Invalid state parameter. This may indicate a CSRF attack.</p>
                <p>Please try logging in again.</p>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve({
              success: false,
              error: "Invalid state parameter - possible CSRF attack",
            });
          }
          return;
        }

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Han CLI Login Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Login Failed</h1>
                <p>${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve({
              success: false,
              error: error,
            });
          }
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Han CLI Login Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Login Error</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve({
              success: false,
              error: "No authorization code received from server",
            });
          }
          return;
        }

        // Exchange code for tokens with PKCE code_verifier (HIGH-2)
        try {
          const tokens = await exchangeCodeForTokens(server, code, codeVerifier);

          // Fetch user info
          const userInfo = await fetchUserInfo(server, tokens.access_token);

          // Calculate expiration
          const expiresAt = new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString();

          // Store credentials
          const credentials: StoredCredentials = {
            server_url: server,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user: {
              id: userInfo.id,
              email: userInfo.email,
              github_username: userInfo.github_username,
              name: userInfo.name,
              avatar_url: userInfo.avatar_url,
            },
            expires_at: expiresAt,
          };

          saveCredentials(credentials);

          // Send success response
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Han CLI Login Success</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #16a34a;">Login Successful!</h1>
                <p>Welcome, ${userInfo.name || userInfo.github_username || userInfo.email || "user"}!</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve({
              success: true,
              user: credentials.user,
            });
          }
        } catch (exchangeError) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Han CLI Login Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Login Error</h1>
                <p>${exchangeError instanceof Error ? exchangeError.message : "Unknown error"}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve({
              success: false,
              error: exchangeError instanceof Error ? exchangeError.message : "Unknown error",
            });
          }
        }
      } else {
        // Unknown path
        res.writeHead(404);
        res.end("Not found");
      }
    });

    httpServer.listen(port, "127.0.0.1", async () => {
      console.log(`Opening browser for authentication...`);

      // Include PKCE code_challenge and state in auth URL (HIGH-1, HIGH-2)
      const authUrl = `${server}/auth/cli?port=${port}&state=${encodeURIComponent(expectedState)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

      try {
        await openBrowser(authUrl);
        console.log(`\nIf the browser doesn't open, visit:\n${authUrl}\n`);
        console.log("Waiting for authentication...");
      } catch {
        console.log(`\nPlease open this URL in your browser:\n${authUrl}\n`);
        console.log("Waiting for authentication...");
      }
    });

    httpServer.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve({
          success: false,
          error: `Server error: ${error.message}`,
        });
      }
    });
  });
}

/**
 * Logout and clear credentials
 *
 * @returns true if logged out, false if wasn't logged in
 */
export function logout(): boolean {
  return clearCredentials();
}

/**
 * Get current authentication status
 */
export function getAuthStatus(): AuthStatus {
  const serverUrl = getServerUrl();
  const credentials = loadCredentials();

  if (!credentials) {
    return {
      authenticated: false,
      serverUrl,
    };
  }

  const tokenExpired = isTokenExpired(credentials);

  return {
    authenticated: true,
    user: credentials.user,
    serverUrl: credentials.server_url,
    expiresAt: credentials.expires_at,
    tokenExpired,
  };
}

/**
 * Get valid access token, refreshing if necessary
 * Uses mutex to prevent concurrent refresh attempts (MEDIUM-1)
 *
 * @returns Access token or null if not authenticated
 */
export async function getValidAccessToken(): Promise<string | null> {
  const credentials = loadCredentials();

  if (!credentials) {
    return null;
  }

  // Check if token is expired or about to expire
  if (isTokenExpired(credentials)) {
    try {
      // Use mutex to prevent race condition with concurrent refresh attempts (MEDIUM-1)
      // If a refresh is already in progress, wait for it
      if (tokenRefreshPromise) {
        const tokens = await tokenRefreshPromise;
        return tokens.access_token;
      }

      // Start a new refresh and store the promise
      tokenRefreshPromise = refreshAccessToken(
        credentials.server_url,
        credentials.refresh_token
      );

      try {
        const tokens = await tokenRefreshPromise;

        // Update stored credentials
        const expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString();

        credentials.access_token = tokens.access_token;
        credentials.refresh_token = tokens.refresh_token;
        credentials.expires_at = expiresAt;

        saveCredentials(credentials);

        return tokens.access_token;
      } finally {
        // Clear the mutex after refresh completes (success or failure)
        tokenRefreshPromise = null;
      }
    } catch {
      // Refresh failed, clear mutex and user needs to re-login
      tokenRefreshPromise = null;
      return null;
    }
  }

  return credentials.access_token;
}
