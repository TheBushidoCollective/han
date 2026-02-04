import type { Command } from 'commander';
import { getMergedPluginsAndMarketplaces } from '../../config/claude-settings.ts';
import {
  getHookEvents,
  type HookEventType,
  loadPluginConfig,
  type PluginHookDefinition,
} from '../../hooks/hook-config.ts';
import {
  getPluginDirWithSource,
  type PluginSource,
} from '../../hooks/plugin-discovery.ts';

/**
 * ANSI color codes for CLI output
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

/**
 * Discovered hook information with source details
 */
interface DiscoveredHook {
  plugin: string;
  hookName: string;
  hookDef: PluginHookDefinition;
  pluginRoot: string;
  marketplace: string;
  source: PluginSource;
}

/**
 * Discover all hooks from all installed plugins
 */
function discoverAllHooks(): DiscoveredHook[] {
  const hooks: DiscoveredHook[] = [];
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  for (const [pluginName, marketplace] of plugins.entries()) {
    const marketplaceConfig = marketplaces.get(marketplace);
    const { path: pluginRoot, source } = getPluginDirWithSource(
      pluginName,
      marketplace,
      marketplaceConfig
    );

    if (!pluginRoot) continue;

    const config = loadPluginConfig(pluginRoot, false);
    if (!config?.hooks) continue;

    for (const [hookName, hookDef] of Object.entries(config.hooks)) {
      hooks.push({
        plugin: pluginName,
        hookName,
        hookDef,
        pluginRoot,
        marketplace,
        source,
      });
    }
  }

  return hooks;
}

/**
 * Format source information for display
 */
function formatSource(source: DiscoveredHook['source']): string {
  switch (source.type) {
    case 'directory':
      return `${colors.yellow}directory${colors.reset}: ${colors.dim}${source.path}${colors.reset}`;
    case 'git':
      return `${colors.magenta}git${colors.reset}: ${colors.dim}${source.path}${colors.reset}`;
    case 'github':
      return `${colors.blue}github${colors.reset}: ${colors.dim}${source.repo || 'han'}${colors.reset}`;
    case 'development':
      return `${colors.green}development${colors.reset}: ${colors.dim}${source.path}${colors.reset}`;
  }
}

/**
 * Register the hook list command
 */
export function registerHookList(hookCommand: Command): void {
  hookCommand
    .command('list')
    .description(
      'List all discovered hooks from installed plugins.\n\n' +
        'Shows hooks from all plugins installed via:\n' +
        '  - Local directory paths (source: directory)\n' +
        '  - Git URLs (source: git)\n' +
        '  - GitHub repositories (source: github)\n' +
        '  - Development mode (running in marketplace repo)'
    )
    .option(
      '-e, --event <event>',
      'Filter by event type (e.g., Stop, PreToolUse)'
    )
    .option('-p, --plugin <plugin>', 'Filter by plugin name')
    .option('--json', 'Output as JSON for programmatic use')
    .option('-v, --verbose', 'Show additional details including source paths')
    .action(
      (opts: {
        event?: string;
        plugin?: string;
        json?: boolean;
        verbose?: boolean;
      }) => {
        const allHooks = discoverAllHooks();

        // Apply filters
        let filteredHooks = allHooks;

        if (opts.event) {
          filteredHooks = filteredHooks.filter((h) => {
            const events = getHookEvents(h.hookDef);
            return events.includes(opts.event as HookEventType);
          });
        }

        if (opts.plugin) {
          const pluginFilter = opts.plugin.toLowerCase();
          filteredHooks = filteredHooks.filter((h) =>
            h.plugin.toLowerCase().includes(pluginFilter)
          );
        }

        // Output
        if (opts.json) {
          const output = filteredHooks.map((h) => ({
            plugin: h.plugin,
            hook: h.hookName,
            events: getHookEvents(h.hookDef),
            pluginRoot: h.pluginRoot,
            marketplace: h.marketplace,
            source: h.source,
            description: h.hookDef.description,
            command: h.hookDef.command,
            ifChanged: h.hookDef.ifChanged,
            dependsOn: h.hookDef.dependsOn,
          }));
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        if (filteredHooks.length === 0) {
          console.log(`${colors.yellow}No hooks found.${colors.reset}`);
          if (opts.event || opts.plugin) {
            console.log(
              `${colors.dim}Try removing filters to see all hooks.${colors.reset}`
            );
          }
          return;
        }

        // Group by plugin
        const byPlugin = new Map<string, DiscoveredHook[]>();
        for (const hook of filteredHooks) {
          const existing = byPlugin.get(hook.plugin) || [];
          existing.push(hook);
          byPlugin.set(hook.plugin, existing);
        }

        console.log(
          `\n${colors.bold}Discovered ${filteredHooks.length} hook(s) from ${byPlugin.size} plugin(s)${colors.reset}\n`
        );

        // Sort plugins for consistent output
        const sortedPlugins = Array.from(byPlugin.keys()).sort();

        for (const pluginName of sortedPlugins) {
          const pluginHooks = byPlugin.get(pluginName);
          if (!pluginHooks) continue;
          const firstHook = pluginHooks[0];

          console.log(
            `${colors.cyan}${colors.bold}${pluginName}${colors.reset} ${colors.dim}(${firstHook.marketplace})${colors.reset}`
          );

          if (opts.verbose) {
            console.log(`  ${formatSource(firstHook.source)}`);
            console.log(
              `  ${colors.dim}path: ${firstHook.pluginRoot}${colors.reset}`
            );
          }

          for (const hook of pluginHooks) {
            const events = getHookEvents(hook.hookDef);
            const eventStr = events.join(', ');

            console.log(
              `  ${colors.green}${hook.hookName}${colors.reset} ${colors.dim}[${eventStr}]${colors.reset}`
            );

            if (opts.verbose && hook.hookDef.description) {
              console.log(
                `    ${colors.dim}${hook.hookDef.description}${colors.reset}`
              );
            }

            if (opts.verbose && hook.hookDef.dependsOn?.length) {
              const deps = hook.hookDef.dependsOn
                .map((d) => `${d.plugin}/${d.hook}${d.optional ? '?' : ''}`)
                .join(', ');
              console.log(
                `    ${colors.dim}depends on: ${deps}${colors.reset}`
              );
            }
          }

          console.log(''); // Blank line between plugins
        }

        // Summary of source types
        const sourceTypes = new Map<string, number>();
        for (const hook of filteredHooks) {
          const type = hook.source.type;
          sourceTypes.set(type, (sourceTypes.get(type) || 0) + 1);
        }

        if (opts.verbose) {
          console.log(`${colors.bold}Source breakdown:${colors.reset}`);
          for (const [type, count] of sourceTypes.entries()) {
            console.log(`  ${type}: ${count} hook(s)`);
          }
        }
      }
    );
}
