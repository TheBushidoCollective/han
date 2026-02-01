/**
 * han auth login
 *
 * Opens browser for GitHub OAuth authentication with PKCE security.
 * Flow:
 * 1. Generate PKCE code verifier/challenge and state token
 * 2. Start local HTTP server on random port
 * 3. Open browser to server's CLI auth endpoint with PKCE challenge
 * 4. Receive callback with auth code, verify state
 * 5. Exchange code for tokens with code_verifier
 * 6. Store credentials securely
 */

import type { Command } from "commander";
import { login, getAuthStatus } from "../../services/index.ts";
import { getServerUrl, validateServerUrlScheme } from "../../services/credentials.ts";

export function registerLoginCommand(authCommand: Command): void {
  authCommand
    .command("login")
    .description("Authenticate with the Han team server using GitHub")
    .option(
      "-s, --server <url>",
      "Server URL (default: configured or https://api.han.guru)"
    )
    .option(
      "-t, --timeout <seconds>",
      "Timeout for authentication in seconds",
      "300"
    )
    .option(
      "--insecure",
      "Allow insecure HTTP connections (WARNING: credentials transmitted in plain text)"
    )
    .action(async (options: { server?: string; timeout?: string; insecure?: boolean }) => {
      const serverUrl = options.server || getServerUrl();
      const timeout = parseInt(options.timeout || "300", 10) * 1000;

      // Validate HTTPS scheme (MEDIUM-3)
      try {
        validateServerUrlScheme(serverUrl, options.insecure);
      } catch (error) {
        console.error(`\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`);
        process.exit(1);
      }

      if (options.insecure) {
        console.log(`\x1b[33mWARNING: Using insecure HTTP connection. Credentials may be transmitted in plain text.\x1b[0m\n`);
      }

      // Check if already logged in
      const status = getAuthStatus();
      if (status.authenticated && !status.tokenExpired) {
        console.log(
          `\x1b[33mYou are already logged in as ${status.user?.github_username || status.user?.email || "unknown"}.\x1b[0m`
        );
        console.log("Run 'han auth logout' first if you want to switch accounts.");
        return;
      }

      console.log(`\nAuthenticating with ${serverUrl}...\n`);

      const result = await login(serverUrl, timeout);

      if (result.success) {
        console.log(
          `\n\x1b[32mSuccessfully logged in!\x1b[0m`
        );
        console.log(`\nWelcome, ${result.user?.name || result.user?.github_username || result.user?.email || "user"}!`);

        if (result.user?.github_username) {
          console.log(`GitHub: @${result.user.github_username}`);
        }
        if (result.user?.email) {
          console.log(`Email: ${result.user.email}`);
        }

        console.log(`\nServer: ${serverUrl}`);
        console.log("\nYou can now sync your sessions with 'han sync'.");
      } else {
        console.error(`\n\x1b[31mLogin failed:\x1b[0m ${result.error}`);
        process.exit(1);
      }
    });
}
