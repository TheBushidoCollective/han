import type { Command } from 'commander';
import { registerPluginCreate } from './plugin.ts';

/**
 * Register all create commands under `han create`
 */
export function registerCreateCommands(program: Command): void {
  const createCommand = program
    .command('create')
    .description('Scaffold new Han resources');

  registerPluginCreate(createCommand);
}
