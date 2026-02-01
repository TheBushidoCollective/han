/**
 * Config Commands
 *
 * CLI commands for configuration:
 * - han config set <key> <value>  - Set a configuration value
 * - han config get <key>          - Get a configuration value
 * - han config list               - List all configuration
 */

import type { Command } from "commander";
import {
  getServerUrl,
  setServerUrl,
  DEFAULT_SERVER_URL,
  loadCredentials,
  getCredentialsPath,
} from "../../services/credentials.ts";
import { existsSync } from "node:fs";

/**
 * Supported configuration keys
 */
const CONFIG_KEYS = {
  "server-url": {
    description: "Team server URL for sync and auth (HTTPS required unless --insecure)",
    get: () => getServerUrl(),
    set: (value: string, allowInsecure = false) => {
      // Validate URL format
      try {
        new URL(value);
      } catch {
        throw new Error(`Invalid URL: ${value}`);
      }
      // setServerUrl validates HTTPS scheme (MEDIUM-3)
      setServerUrl(value, allowInsecure);
      return true;
    },
  },
} as const;

export function registerConfigCommands(program: Command): void {
  const configCommand = program
    .command("config")
    .description("Manage Han CLI configuration");

  // han config set <key> <value>
  configCommand
    .command("set <key> <value>")
    .description("Set a configuration value")
    .option(
      "--insecure",
      "Allow insecure HTTP connections (WARNING: credentials transmitted in plain text)"
    )
    .action((key: string, value: string, options: { insecure?: boolean }) => {
      const configDef = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];

      if (!configDef) {
        console.error(`\x1b[31mUnknown configuration key: ${key}\x1b[0m`);
        console.log("\nAvailable keys:");
        for (const [k, v] of Object.entries(CONFIG_KEYS)) {
          console.log(`  ${k} - ${v.description}`);
        }
        process.exit(1);
      }

      try {
        // Pass insecure flag for server-url validation (MEDIUM-3)
        configDef.set(value, options.insecure);
        console.log(`\x1b[32mSet ${key} = ${value}\x1b[0m`);
        if (options.insecure) {
          console.log(`\x1b[33mWARNING: Using insecure HTTP connection. Credentials may be transmitted in plain text.\x1b[0m`);
        }
      } catch (error) {
        console.error(
          `\x1b[31mFailed to set ${key}:\x1b[0m`,
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // han config get <key>
  configCommand
    .command("get <key>")
    .description("Get a configuration value")
    .action((key: string) => {
      const configDef = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];

      if (!configDef) {
        console.error(`\x1b[31mUnknown configuration key: ${key}\x1b[0m`);
        console.log("\nAvailable keys:");
        for (const [k, v] of Object.entries(CONFIG_KEYS)) {
          console.log(`  ${k} - ${v.description}`);
        }
        process.exit(1);
      }

      const value = configDef.get();
      console.log(value);
    });

  // han config list
  configCommand
    .command("list")
    .description("List all configuration values")
    .option("-j, --json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const config: Record<string, string | null> = {};

      for (const [key, def] of Object.entries(CONFIG_KEYS)) {
        config[key] = def.get();
      }

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log("\n=== Han Configuration ===\n");

      for (const [key, value] of Object.entries(config)) {
        const def = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];
        const isDefault = key === "server-url" && value === DEFAULT_SERVER_URL;

        console.log(`${key}:`);
        console.log(`  Value: ${value}${isDefault ? " (default)" : ""}`);
        console.log(`  Description: ${def.description}`);
        console.log("");
      }

      // Show credentials path
      const credPath = getCredentialsPath();
      console.log("Credentials:");
      console.log(`  Path: ${credPath}`);
      console.log(`  Exists: ${existsSync(credPath) ? "yes" : "no"}`);

      const creds = loadCredentials();
      if (creds?.user) {
        console.log(`  User: ${creds.user.github_username || creds.user.email || creds.user.id}`);
      }

      console.log("");
    });
}
