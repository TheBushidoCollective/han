import { execSync } from 'node:child_process';
import {
  getShortPluginName,
  isDeprecatedPluginName,
  resolvePluginNamesStrict,
} from './plugin-aliases.ts';
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
 * Fetch marketplace.json from a GitHub repo
 */
async function fetchExternalMarketplace(
  repo: string
): Promise<MarketplacePlugin[]> {
  const url = `https://raw.githubusercontent.com/${repo}/main/.claude-plugin/marketplace.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch marketplace from ${repo}: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as { plugins: MarketplacePlugin[] };
  return data.plugins || [];
}

/**
 * Derive marketplace name from repo
 * Example: thebushidocollective/ai-dlc -> thebushidocollective-ai-dlc
 */
function deriveMarketplaceName(repo: string): string {
  return repo.replace('/', '-');
}

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
 * Uses `claude plugin install <plugin>@<marketplace>` for proper Claude Code integration
 */
function installPluginViaClaude(
  pluginName: string,
  scope: InstallScope,
  marketplaceName: string,
  marketplaceRepo: string
): boolean {
  try {
    const claudePath = findClaudeExecutable();
    const scopeArg = scope === 'local' ? '--scope local' : '--scope project';

    // Ensure the marketplace is added
    try {
      execSync(
        `${claudePath} marketplace add ${marketplaceName} --source github --repo ${marketplaceRepo} ${scopeArg}`,
        { stdio: 'pipe', encoding: 'utf-8' }
      );
    } catch {
      // Marketplace might already exist, ignore error
    }

    // Install the plugin
    execSync(
      `${claudePath} plugin install ${pluginName}@${marketplaceName} ${scopeArg}`,
      {
        stdio: 'inherit',
      }
    );
    return true;
  } catch (error) {
    console.error(`Failed to install ${pluginName}:`, error);
    return false;
  }
}

/**
 * Install plugin directly to settings file (fallback when claude CLI unavailable)
 */
function installPluginDirect(
  pluginName: string,
  scope: InstallScope,
  marketplaceName: string,
  marketplaceRepo: string
): boolean {
  try {
    const settings = readOrCreateSettings(scope);

    // Add marketplace if not already added
    if (!settings?.extraKnownMarketplaces?.[marketplaceName]) {
      settings.extraKnownMarketplaces = {
        ...settings.extraKnownMarketplaces,
        [marketplaceName]: { source: { source: 'github', repo: marketplaceRepo } },
      };
    }

    // Add the plugin
    settings.enabledPlugins = {
      ...settings.enabledPlugins,
      [`${pluginName}@${marketplaceName}`]: true,
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
  useClaudeCli: boolean,
  marketplaceName: string,
  marketplaceRepo: string
): boolean {
  if (useClaudeCli) {
    return installPluginViaClaude(pluginName, scope, marketplaceName, marketplaceRepo);
  }
  return installPluginDirect(pluginName, scope, marketplaceName, marketplaceRepo);
}

/**
 * Install one or more plugins to Claude settings
 */
export async function installPlugins(
  pluginNames: string[],
  scope: InstallScope = 'project',
  externalRepo?: string
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

  // Determine marketplace to use
  const marketplaceRepo = externalRepo || HAN_MARKETPLACE_REPO;
  const marketplaceName = externalRepo
    ? deriveMarketplaceName(externalRepo)
    : 'han';
  const isExternalMarketplace = !!externalRepo;

  // Check for deprecated naming (jutsu-*, hashi-*, do-*)
  const deprecatedInputs = pluginNames.filter(isDeprecatedPluginName);
  if (deprecatedInputs.length > 0) {
    console.error('Error: Deprecated plugin naming detected.\n');
    console.error(
      'The following plugin names use deprecated prefixes (jutsu-*, hashi-*, do-*):'
    );
    for (const name of deprecatedInputs) {
      const shortName = getShortPluginName(name);
      console.error(`  ${name} → use "${shortName}" instead`);
    }
    console.error('\nPlease use the short plugin names without prefixes.');
    process.exit(1);
  }

  // Resolve to short names (strict mode - no old naming)
  const { resolved } = resolvePluginNamesStrict(pluginNames);
  const resolvedNames = resolved.map((r) => r.name);

  // For Han marketplace: always include bushido and core as dependencies
  // For external marketplaces: install core + bushido from Han, then external plugins
  const pluginsToInstall = new Set(
    isExternalMarketplace ? resolvedNames : ['core', 'bushido', ...resolvedNames]
  );

  ensureClaudeDirectory(scope);

  // Validate plugins exist in marketplace
  console.log(
    `Validating plugins against ${isExternalMarketplace ? `${marketplaceRepo} marketplace` : 'Han marketplace'}...\n`
  );
  const marketplacePlugins = isExternalMarketplace
    ? await fetchExternalMarketplace(marketplaceRepo)
    : await fetchMarketplace();

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

  const settings = readOrCreateSettings(scope);
  const enabledPlugins = settings.enabledPlugins || {};

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

  // Install han core + bushido first if using external marketplace
  if (isExternalMarketplace) {
    console.log(
      '\nInstalling Han foundation (core + bushido) from Han marketplace...\n'
    );
    for (const foundationPlugin of ['core', 'bushido']) {
      const pluginKey = `${foundationPlugin}@han`;
      if (enabledPlugins[pluginKey]) {
        // Already installed
        continue;
      }
      console.log(`Installing ${pluginKey}...`);
      if (doInstallPlugin(foundationPlugin, scope, useClaudeCli, 'han', HAN_MARKETPLACE_REPO)) {
        installed.push(foundationPlugin);
        recordPluginInstall(foundationPlugin, scope, true);
      } else {
        failed.push(foundationPlugin);
      }
    }
    console.log(
      `\nInstalling plugins from ${marketplaceRepo} marketplace...\n`
    );
  }

  // Install each plugin
  for (const pluginName of pluginsToInstall) {
    const pluginKey = `${pluginName}@${marketplaceName}`;
    if (enabledPlugins[pluginKey]) {
      alreadyInstalled.push(pluginName);
    } else {
      console.log(`Installing ${pluginKey}...`);
      if (doInstallPlugin(pluginName, scope, useClaudeCli, marketplaceName, marketplaceRepo)) {
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
