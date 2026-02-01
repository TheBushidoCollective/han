/**
 * han auth status
 *
 * Shows current authentication state and user information.
 */

import type { Command } from "commander";
import { getAuthStatus, getValidAccessToken } from "../../services/index.ts";

export function registerStatusCommand(authCommand: Command): void {
  authCommand
    .command("status")
    .description("Show current authentication state")
    .option("-j, --json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const status = getAuthStatus();

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      console.log("\n=== Han Authentication Status ===\n");

      console.log(`Server: ${status.serverUrl}`);
      console.log(
        `Status: ${status.authenticated ? "\x1b[32mAuthenticated\x1b[0m" : "\x1b[33mNot authenticated\x1b[0m"}`
      );

      if (status.authenticated && status.user) {
        console.log("\nUser Information:");

        if (status.user.name) {
          console.log(`  Name:     ${status.user.name}`);
        }
        if (status.user.github_username) {
          console.log(`  GitHub:   @${status.user.github_username}`);
        }
        if (status.user.email) {
          console.log(`  Email:    ${status.user.email}`);
        }
        console.log(`  ID:       ${status.user.id}`);

        console.log("\nToken Status:");

        if (status.expiresAt) {
          const expiresAt = new Date(status.expiresAt);
          const now = new Date();
          const diffMs = expiresAt.getTime() - now.getTime();

          if (diffMs <= 0) {
            console.log("  Expires:  \x1b[31mExpired\x1b[0m");
          } else {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            if (diffHours > 24) {
              const diffDays = Math.floor(diffHours / 24);
              console.log(`  Expires:  in ${diffDays} day${diffDays > 1 ? "s" : ""}`);
            } else if (diffHours > 0) {
              console.log(`  Expires:  in ${diffHours}h ${diffMinutes}m`);
            } else {
              console.log(`  Expires:  in ${diffMinutes} minutes`);
            }
          }
        }

        if (status.tokenExpired) {
          console.log("\n\x1b[33mYour access token has expired.\x1b[0m");
          console.log("It will be refreshed automatically on the next API call.");

          // Try to refresh now
          const token = await getValidAccessToken();
          if (token) {
            console.log("\x1b[32mToken refreshed successfully.\x1b[0m");
          } else {
            console.log(
              "\x1b[31mCould not refresh token. Please run 'han auth login' to re-authenticate.\x1b[0m"
            );
          }
        }
      } else {
        console.log("\n\x1b[33mNot logged in.\x1b[0m");
        console.log("Run 'han auth login' to authenticate.");
      }

      console.log("");
    });
}
