import type { Command } from 'commander';

/**
 * Register the inject-subagent-context command
 *
 * Previously gathered context from SubagentPrompt hooks via orchestrate
 * and injected it into Task/Skill tool prompts. Now a no-op since
 * orchestrate has been removed.
 */
export function registerInjectSubagentContext(hookCommand: Command): void {
  hookCommand
    .command('inject-subagent-context')
    .description(
      'PreToolUse hook that injects context into Task and Skill tool prompts.\n\n' +
        'Currently a no-op. Context injection via orchestrate has been removed.'
    )
    .action(async () => {
      process.exit(0);
    });
}
