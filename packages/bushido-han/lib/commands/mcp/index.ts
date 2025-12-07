import type { Command } from "commander";
import { startBlueprintsMcpServer } from "./blueprints.js";
import { startMcpServer } from "./server.js";

export function registerMcpCommands(program: Command): void {
	const mcpCommand = program
		.command("mcp")
		.description(
			"Start the Han MCP server.\n" +
				"Exposes tools for running hook commands from installed plugins and metrics tracking.\n\n" +
				"This command is typically invoked by Claude Code when the core plugin is installed.\n" +
				"It uses stdio for JSON-RPC communication.",
		)
		.action(async () => {
			await startMcpServer();
		});

	// Add blueprints subcommand
	mcpCommand
		.command("blueprints")
		.description(
			"Start the Han Blueprints MCP server.\n" +
				"Provides tools to search, read, and write technical blueprint documentation.\n\n" +
				"This command is typically invoked by Claude Code when the hashi-blueprints plugin is installed.\n" +
				"It uses stdio for JSON-RPC communication.",
		)
		.action(async () => {
			await startBlueprintsMcpServer();
		});
}
