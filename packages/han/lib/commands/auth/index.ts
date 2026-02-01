/**
 * Auth Commands
 *
 * CLI commands for authentication:
 * - han auth login    - Authenticate with GitHub OAuth
 * - han auth logout   - Clear stored credentials
 * - han auth status   - Show current auth state
 */

import type { Command } from "commander";
import { registerLoginCommand } from "./login.ts";
import { registerLogoutCommand } from "./logout.ts";
import { registerStatusCommand } from "./status.ts";

export function registerAuthCommands(program: Command): void {
  const authCommand = program
    .command("auth")
    .description("Manage authentication with the Han team server");

  registerLoginCommand(authCommand);
  registerLogoutCommand(authCommand);
  registerStatusCommand(authCommand);
}
