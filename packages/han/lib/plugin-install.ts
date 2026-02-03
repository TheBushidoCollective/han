import { execSync } from 'node:child_process';
import { resolvePluginNames } from './plugin-aliases.ts';
import { showPluginSelector } from './plugin-selector-wrapper.tsx';
import {
  ensureClaudeDirectory,
  ensureDispatchHooks,
  fetchMarketplace,
  findClaudeExecutable,
  getInstalledPlugins,
  getSettingsFilename,
  HAN_MARKETPLACE_REPO,
  type InstallScope,
  type MarketplacePlugin,
  readOrCreateSettings,
  removeInvalidPlugins,
  writeSettings,
} from './shared.ts';
import { recordPluginInstall } from './telemetry/index.ts';

/**
 * Check if Claude CLI is available
 * Set HAN_SKIP_CLAUDE_CLI=1 to force using direct settings modification (useful for tests)
 */
function isClaudeAvailable(): boolean {
  // Allow tests to skip Claude CLI
  if (process.env.HAN_SKIP_CLAUDE_CLI === '1') {
    return false;
  }
  try {
    findClaudeExecutable();
    return true;
  } catch {
    return false;
  }
}

/**
 * Show available plugins grouped by category
 */
function showAvailablePlugins(marketplacePlugins: MarketplacePlugin[]): void {
  console.error('Available plugins:');

  const jutsus = marketplacePlugins
    .filter((p) => p.name.startsWith('jutsu-'))
    .map((p) => p.name);
  const dos = marketplacePlugins
    .filter((p) => p.name.startsWith('do-'))
    .map((p) => p.name);
  const hashis = marketplacePlugins
    .filter((p) => p.name.startsWith('hashi-'))
    .map((p) => p.name);
  const others = marketplacePlugins
    .filter(
      (p) =>
        !p.name.startsWith('jutsu-') &&
        !p.name.startsWith('do-') &&
        !p.name.startsWith('hashi-')
    )
    .map((p) => p.name);

  if (others.length > 0) {
    console.error(`  Core: ${others.join(', ')}`);
  }
  if (jutsus.length > 0) {
    console.error(`  Jutsus: ${jutsus.join(', ')}`);
  }
  if (dos.length > 0) {
    console.error(`  Dōs: ${dos.join(', ')}`);
  }
  if (hashis.length > 0) {
    console.error(`  Hashis: ${hashis.join(', ')}`);
  }

  console.error("\nTip: Use 'han plugin search <query>' to find plugins.");
}

/**
 * Install plugins using Claude CLI
 * Uses `claude plugin install <plugin>@han` for proper Claude Code integration
 */
function installPluginViaClaude(
  pluginName: string,
  scope: InstallScope
): boolean {
  try {
    const claudePath = findClaudeExecutable();
    const scopeArg = scope === 'local' ? '--scope local' : '--scope project';

    // First ensure the Han marketplace is added
    try {
      execSync(
        `${claudePath} marketplace add han --source github --repo ${HAN_MARKETPLACE_REPO} ${scopeArg}`,
        { stdio: 'pipe', encoding: 'utf-8' }
      );
    } catch {
      // Marketplace might already exist, ignore error
    }

    // Install the plugin
    execSync(`${claudePath} plugin install ${pluginName}@han ${scopeArg}`, {
      stdio: 'inherit',
    });
    return true;
  } catch (error) {
    console.error(`Failed to install ${pluginName}:`, error);
    return false;
  }
}

/**
 * Install plugin directly to settings file (fallback when claude CLI unavailable)
 */
function installPluginDirect(pluginName: string, scope: InstallScope): boolean {
  try {
    const settings = readOrCreateSettings(scope);

    // Add Han marketplace if not already added
    if (!settings?.extraKnownMarketplaces?.han) {
      settings.extraKnownMarketplaces = {
        ...settings.extraKnownMarketplaces,
        han: { source: { source: 'github', repo: HAN_MARKETPLACE_REPO } },
      };
    }

    // Add the plugin
    settings.enabledPlugins = {
      ...settings.enabledPlugins,
      [`${pluginName}@han`]: true,
    };

    writeSettings(settings, scope);
    return true;
  } catch (error) {
    console.error(`Failed to install ${pluginName}:`, error);
    return false;
  }
}

/**
 * Install a plugin, preferring Claude CLI but falling back to direct settings modification
 */
function doInstallPlugin(
  pluginName: string,
  scope: InstallScope,
  useClaudeCli: boolean
): boolean {
  if (useClaudeCli) {
    return installPluginViaClaude(pluginName, scope);
  }
  return installPluginDirect(pluginName, scope);
}

/**
 * Install one or more plugins to Claude settings
 */
export async function installPlugins(
  pluginNames: string[],
  scope: InstallScope = 'project'
): Promise<void> {
  // Reject user scope - Han plugins must be installed at project or local scope
  if (scope === 'user') {
    console.error(
      'Error: --scope "user" is not supported. Han plugins must be installed at project or local scope.'
    );
    process.exit(1);
  }

  if (pluginNames.length === 0) {
    console.error('Error: No plugin names provided.');
    process.exit(1);
  }

  // Resolve aliases (short names, new paths, old names all resolve to canonical names)
  const resolvedNames = resolvePluginNames(pluginNames);

  // Always include bushido and core plugins as dependencies
  const pluginsToInstall = new Set(['core', 'bushido', ...resolvedNames]);

  ensureClaudeDirectory(scope);

  // Validate plugins exist in marketplace
  console.log('Validating plugins against marketplace...\n');
  const marketplacePlugins = await fetchMarketplace();

  if (marketplacePlugins.length === 0) {
    console.error(
      'Error: Could not fetch marketplace. Please check your internet connection.'
    );
    process.exit(1);
  }

  const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

  // Check all plugins are valid, or search for similar ones
  const invalidPlugins = Array.from(pluginsToInstall).filter(
    (p) => !validPluginNames.has(p)
  );

  if (invalidPlugins.length > 0) {
    // If there's only one invalid plugin, try to search for it
    if (invalidPlugins.length === 1 && pluginNames.length === 1) {
      const query = invalidPlugins[0];
      const searchResults = await searchForPlugin(query, marketplacePlugins);

      if (searchResults.length === 0) {
        console.error(`Error: No plugins found matching "${query}"\n`);
        showAvailablePlugins(marketplacePlugins);
        process.exit(1);
      }

      // If exact match found after normalization, use it
      const exactMatch = searchResults.find(
        (p) => p.name.toLowerCase() === query.toLowerCase()
      );
      if (exactMatch && searchResults.length === 1) {
        console.log(`✓ Found exact match: ${exactMatch.name}\n`);
        pluginsToInstall.delete(query);
        pluginsToInstall.add(exactMatch.name);
      } else {
        // Show interactive selector
        console.log(
          `Plugin "${query}" not found. Searching for similar plugins...\n`
        );
        const selectedPlugins = await showPluginSelector(
          searchResults,
          [],
          marketplacePlugins
        );

        if (selectedPlugins.length === 0) {
          console.log('Installation cancelled.');
          process.exit(0);
        }

        // Replace the invalid plugin with selected ones
        pluginsToInstall.delete(query);
        for (const plugin of selectedPlugins) {
          pluginsToInstall.add(plugin);
        }
      }
    } else {
      console.error(
        `Error: Plugin(s) not found in Han marketplace: ${invalidPlugins.join(', ')}\n`
      );
      showAvailablePlugins(marketplacePlugins);
      process.exit(1);
    }
  }

  // Remove any invalid plugins that are no longer in the marketplace
  const removedPlugins = removeInvalidPlugins(validPluginNames, scope);
  if (removedPlugins.length > 0) {
    console.log(
      `✓ Removed ${removedPlugins.length} invalid plugin(s): ${removedPlugins.join(', ')}\n`
    );
  }

  const currentPlugins = getInstalledPlugins(scope);
  const filename = getSettingsFilename(scope);
  console.log(`Installing to ${filename}...\n`);

  // Check if Claude CLI is available - use it for better integration, fall back to direct
  const useClaudeCli = isClaudeAvailable();
  if (!useClaudeCli) {
    console.log(
      'Note: Claude CLI not found, using direct settings modification\n'
    );
  }

  const installed: string[] = [];
  const alreadyInstalled: string[] = [];
  const failed: string[] = [];

  // Install each plugin
  for (const pluginName of pluginsToInstall) {
    if (currentPlugins.includes(pluginName)) {
      alreadyInstalled.push(pluginName);
    } else {
      console.log(`Installing ${pluginName}@han...`);
      if (doInstallPlugin(pluginName, scope, useClaudeCli)) {
        installed.push(pluginName);
        // Record telemetry
        recordPluginInstall(pluginName, scope, true);
      } else {
        failed.push(pluginName);
      }
    }
  }

  if (installed.length > 0) {
    console.log(
      `\n✓ Installed ${installed.length} plugin(s): ${installed.join(', ')}`
    );
  }
  if (alreadyInstalled.length > 0) {
    console.log(`⚠️  Already installed: ${alreadyInstalled.join(', ')}`);
  }
  if (failed.length > 0) {
    console.log(`✗ Failed to install: ${failed.join(', ')}`);
  }

  // Ensure dispatch hooks are configured in project settings
  // This is a workaround for Claude Code bug #12151
  ensureDispatchHooks(scope);

  if (installed.length > 0) {
    console.log('\n⚠️  Please restart Claude Code to load the new plugin(s)');
  }
}

/**
 * Install a specific plugin to Claude settings (convenience wrapper)
 */
export async function installPlugin(
  pluginName: string,
  scope: InstallScope = 'user'
): Promise<void> {
  return installPlugins([pluginName], scope);
}

/**
 * Search for plugins matching a query
 */
function searchForPlugin(
  query: string,
  allPlugins: MarketplacePlugin[]
): MarketplacePlugin[] {
  const lowerQuery = query.toLowerCase();
  return allPlugins.filter((plugin) => {
    const nameMatch = plugin.name.toLowerCase().includes(lowerQuery);
    const descMatch = plugin.description?.toLowerCase().includes(lowerQuery);
    const keywordMatch = plugin.keywords?.some((k) =>
      k.toLowerCase().includes(lowerQuery)
    );
    const categoryMatch = plugin.category?.toLowerCase().includes(lowerQuery);
    return nameMatch || descMatch || keywordMatch || categoryMatch;
  });
}
