import type { Command } from "commander";
import { startMetricsMcpServer } from "./metrics.js";
import { startMcpServer } from "./server.js";

export function registerMcpCommands(program: Command): void {
	const mcpCommand = program
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

	// Add metrics subcommand
	mcpCommand
		.command("metrics")
		.description(
			"Start the Han Metrics MCP server.\n" +
				"Enables agent task tracking with self-reporting and objective validation.\n\n" +
				"This command is typically invoked by Claude Code when the hashi-han-metrics plugin is installed.\n" +
				"It uses stdio for JSON-RPC communication.",
		)
		.action(async () => {
			await startMetricsMcpServer();
		});
}
