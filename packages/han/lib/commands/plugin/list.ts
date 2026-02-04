import type { Command } from 'commander';
import { listPlugins } from '../../plugin-list.ts';

export function registerPluginList(pluginCommand: Command): void {
  pluginCommand
    .command('list')
    .description('List installed plugins')
    .option(
      '--scope <scope>',
      'Scope to list: "user", "project", "local", or "all"',
      'all'
    )
    .action(async (options: { scope?: string }) => {
      try {
        await listPlugins(options.scope || 'all');
        process.exit(0);
      } catch (error: unknown) {
        console.error(
          'Error listing plugins:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });
}
