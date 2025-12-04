import type { Command } from "commander";
import { startMcpServer } from "./server.js";

export function registerMcpCommands(program: Command): void {
	program
		.command("mcp")
		.description(
			"Start the Han MCP server.\n" +
				"Exposes tools for running hook commands from installed plugins.\n\n" +
				"This command is typically invoked by Claude Code when the hashi-han plugin is installed.\n" +
				"It uses stdio for JSON-RPC communication.",
		)
		.action(async () => {
			await startMcpServer();
		});
}
