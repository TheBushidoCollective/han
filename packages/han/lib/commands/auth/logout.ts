/**
 * han auth logout
 *
 * Clears stored authentication credentials.
 */

import type { Command } from "commander";
import { logout, getAuthStatus } from "../../services/index.ts";

export function registerLogoutCommand(authCommand: Command): void {
  authCommand
    .command("logout")
    .description("Clear stored authentication credentials")
    .action(async () => {
      const status = getAuthStatus();

      if (!status.authenticated) {
        console.log("You are not currently logged in.");
        return;
      }

      const username = status.user?.github_username || status.user?.email || "unknown";
      const cleared = logout();

      if (cleared) {
        console.log(`\x1b[32mSuccessfully logged out.\x1b[0m`);
        console.log(`Cleared credentials for: ${username}`);
      } else {
        console.log("No credentials to clear.");
      }
    });
}
