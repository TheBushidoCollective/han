import type { Command } from 'commander';

/**
 * Register memory command
 *
 * Memory is now fully integrated with the indexer:
 * - File changes tracked from JSONL transcripts
 * - Summaries indexed from Claude's native summary events
 * - No LLM calls needed - pure indexing
 */
export function registerMemoryCommand(program: Command): void {
  program
    .command('memory')
    .description('Memory system operations')
    .action(() => {
      console.log(
        'Memory system is integrated with the indexer.\n' +
          '\n' +
          'All data is indexed automatically from Claude Code session transcripts:\n' +
          '  - File changes and tool usage\n' +
          "  - Session summaries (from Claude's native summary events)\n" +
          '  - Tasks and work items\n' +
          '\n' +
          'Use the Browse UI (han browse) to search session history.'
      );
    });
}
