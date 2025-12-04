#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { HAN_VERSION } from "./build-info.generated.js";
import { registerAliasCommands } from "./commands/aliases.js";
import { registerHookCommands } from "./commands/hook/index.js";
import { registerMcpCommands } from "./commands/mcp/index.js";
import { registerPluginCommands } from "./commands/plugin/index.js";

// Version is injected at build time for binary builds, otherwise read from package.json
const version = (() => {
	if (HAN_VERSION) {
		return HAN_VERSION;
	}
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packageJson = JSON.parse(
			readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
		);
		return packageJson.version;
	} catch {
		return "0.0.0-unknown";
	}
})();

const program = new Command();

program
	.name("han")
	.description("Utilities for The Bushido Collective's Han Code Marketplace")
	.version(version);

// Register command groups
registerPluginCommands(program);
registerHookCommands(program);
registerMcpCommands(program);
registerAliasCommands(program);

program.parse();
