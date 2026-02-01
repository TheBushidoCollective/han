/**
 * CLI Authentication Handler
 *
 * Provides CLI-specific authentication flow:
 * 1. CLI starts localhost server on random port
 * 2. CLI opens browser to /auth/cli?port=NNNN
 * 3. Server redirects to GitHub OAuth
 * 4. After auth, server redirects back to localhost:port/callback
 * 5. CLI receives tokens
 */

import type { Context } from "hono";
import { isGitHubOAuthEnabled } from "../config/schema.ts";
import {
  generateState,
  storeState,
  buildAuthorizeUrl,
  generateCodeVerifier,
  generateCodeChallenge,
} from "./github-oauth.ts";

/**
 * Valid port range for CLI callback server
 * Ports must be in ephemeral range to avoid conflicts
 */
const MIN_PORT = 1024;
const MAX_PORT = 65535;

/**
 * Validate CLI callback port
 *
 * @param port - Port number string from query parameter
 * @returns Parsed port number or null if invalid
 */
export function validatePort(port: string | undefined): number | null {
  if (!port) {
    return null;
  }

  const portNum = Number.parseInt(port, 10);

  if (Number.isNaN(portNum)) {
    return null;
  }

  if (portNum < MIN_PORT || portNum > MAX_PORT) {
    return null;
  }

  return portNum;
}

/**
 * Handle GET /auth/cli
 *
 * Initiates CLI authentication flow with PKCE:
 * 1. Validates port parameter
 * 2. Generates PKCE code verifier and challenge
 * 3. Generates state with CLI port metadata and PKCE verifier
 * 4. Redirects to GitHub OAuth
 *
 * Query parameters:
 * - port: Required. The localhost port where CLI is listening
 *
 * After successful auth, redirects to:
 * http://localhost:{port}/callback?code=...
 *
 * The CLI then exchanges the code via POST /auth/cli/exchange for tokens.
 * This prevents token leakage via URL query parameters.
 */
export async function handleCliAuth(c: Context): Promise<Response> {
  if (!isGitHubOAuthEnabled()) {
    return c.json(
      {
        error: "oauth_not_configured",
        message: "GitHub OAuth is not configured on this server",
      },
      503
    );
  }

  const portStr = c.req.query("port");
  const port = validatePort(portStr);

  if (!port) {
    return c.json(
      {
        error: "invalid_port",
        message: "Valid port parameter required (1024-65535)",
      },
      400
    );
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Generate state with CLI metadata and PKCE verifier
  const state = generateState();
  await storeState(state, { cliPort: port, codeVerifier, codeChallenge });

  // Redirect to GitHub OAuth with PKCE
  const authorizeUrl = buildAuthorizeUrl(state, codeChallenge);
  return c.redirect(authorizeUrl);
}

/**
 * Response type for CLI token endpoint
 */
export interface CliTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

/**
 * Error response for CLI auth
 */
export interface CliAuthErrorResponse {
  error: string;
  message: string;
}
