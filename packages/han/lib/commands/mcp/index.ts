import type { Command } from 'commander';
import { startBlueprintsMcpServer } from './blueprints.ts';
import { startDalMcpServer } from './dal.ts';
import { startMcpServer } from './server.ts';

export function registerMcpCommands(program: Command): void {
  const mcpCommand = program
    .command('mcp')
    .description(
      'Start the Han MCP server.\n' +
        'Exposes tools for running hook commands from installed plugins and metrics tracking.\n\n' +
        'This command is typically invoked by Claude Code when the core plugin is installed.\n' +
        'It uses stdio for JSON-RPC communication.'
    )
    .action(async () => {
      await startMcpServer();
    });

  // Add blueprints subcommand
  mcpCommand
    .command('blueprints')
    .description(
      'Start the Han Blueprints MCP server.\n' +
        'Provides tools to search, read, and write technical blueprint documentation.\n\n' +
        'This command is typically invoked by Claude Code when the hashi-blueprints plugin is installed.\n' +
        'It uses stdio for JSON-RPC communication.'
    )
    .action(async () => {
      await startBlueprintsMcpServer();
    });

  // Add memory DAL subcommand (for Memory Agent)
  mcpCommand
    .command('memory')
    .description(
      'Start the Memory Data Access Layer MCP server.\n' +
        'Provides read-only search tools (FTS, Vector, Hybrid) for the Memory Agent.\n\n' +
        'This command is used by the Memory Agent via Agent SDK.\n' +
        'It uses stdio for JSON-RPC communication.'
    )
    .action(async () => {
      await startDalMcpServer();
    });
}
