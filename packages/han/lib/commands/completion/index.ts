/**
 * Shell completion command for han CLI.
 * Generates completion scripts for bash, zsh, and fish.
 */

import type { Command } from 'commander';
import { generateBashCompletion } from './bash.ts';
import { getCompletionsForContext } from './completions.ts';
import { generateFishCompletion } from './fish.ts';
import { generateZshCompletion } from './zsh.ts';

/**
 * Register the completion command
 */
export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script')
    .argument('<shell>', 'Shell type: bash, zsh, or fish')
    .action((shell: string) => {
      switch (shell.toLowerCase()) {
        case 'bash':
          console.log(generateBashCompletion());
          break;
        case 'zsh':
          console.log(generateZshCompletion());
          break;
        case 'fish':
          console.log(generateFishCompletion());
          break;
        default:
          console.error(`Unknown shell: ${shell}`);
          console.error('Supported shells: bash, zsh, fish');
          process.exit(1);
      }
    });
}

/**
 * Handle --get-completions for dynamic completion
 * Returns completion values, one per line
 */
export async function handleGetCompletions(words: string[]): Promise<void> {
  const completions = await getCompletionsForContext(words);

  for (const completion of completions) {
    if (completion.description) {
      console.log(`${completion.value}\t${completion.description}`);
    } else {
      console.log(completion.value);
    }
  }
}
