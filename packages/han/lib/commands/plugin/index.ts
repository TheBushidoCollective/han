import type { Command } from 'commander';
import { registerPluginGenerateHooks } from './generate-hooks.ts';
import { registerPluginInstall } from './install.ts';
import { registerPluginList } from './list.ts';
import { registerPluginMigrate } from './migrate.ts';
import { registerPluginSearch } from './search.ts';
import { registerPluginUninstall } from './uninstall.ts';
import { registerPluginUpdateMarketplace } from './update.ts';
import { registerPluginValidate } from './validate.ts';

/**
 * Register all plugin management commands under `han plugin`
 */
export function registerPluginCommands(program: Command): void {
  const pluginCommand = program
    .command('plugin')
    .description('Manage Han plugins');

  registerPluginGenerateHooks(pluginCommand);
  registerPluginInstall(pluginCommand);
  registerPluginList(pluginCommand);
  registerPluginMigrate(pluginCommand);
  registerPluginUninstall(pluginCommand);
  registerPluginSearch(pluginCommand);
  registerPluginUpdateMarketplace(pluginCommand);
  registerPluginValidate(pluginCommand);
}
