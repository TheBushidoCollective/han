import { render } from 'ink';
import React from 'react';
import {
  HAN_MARKETPLACE_REPO,
  ensureClaudeDirectory,
  readOrCreateSettings,
  writeSettings,
  getInstalledPlugins,
  detectPluginsWithAgent,
  type ClaudeSettings,
} from './shared.js';

/**
 * Install plugins to Claude settings and return list of added plugins
 */
function installPluginsToSettings(plugins: string[], scope: 'project' | 'local' = 'project'): string[] {
  ensureClaudeDirectory();

  const settings = readOrCreateSettings(scope);
  const currentPlugins = getInstalledPlugins(scope);
  const added: string[] = [];

  // Add Han marketplace to extraMarketplaces
  if (!settings?.extraKnownMarketplaces?.han) {
    settings.extraKnownMarketplaces = {
      ...settings.extraKnownMarketplaces,
      han: { source: { source: 'github', repo: HAN_MARKETPLACE_REPO } },
    };
  }

  // Add plugins
  for (const plugin of plugins) {
    if (!currentPlugins.includes(plugin)) {
      added.push(plugin);
    }
    settings.enabledPlugins = {
      ...settings.enabledPlugins,
      [`${plugin}@han`]: true,
    };
  }

  writeSettings(settings, scope);

  return added;
}

/**
 * SDK-based install command with Ink UI
 */
export async function install(scope: 'project' | 'local' = 'project'): Promise<void> {
  // Import Ink UI component dynamically to avoid issues with React
  const { InstallProgress } = await import('./install-progress.js');

  let resolveCompletion: (() => void) | undefined;
  let rejectCompletion: ((error: Error) => void) | undefined;

  const completionPromise = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const filename = scope === 'local' ? 'settings.local.json' : 'settings.json';
  console.log(`Installing to ./.claude/${filename}...\n`);

  const { unmount } = render(
    React.createElement(InstallProgress, {
      detectPlugins: detectPluginsWithAgent,
      onInstallComplete: (plugins: string[]) => {
        const added = installPluginsToSettings(plugins, scope);
        if (added.length > 0) {
          console.log(
            `\n✓ Added ${added.length} plugin(s): ${added.join(', ')}`
          );
        } else {
          console.log('\n✓ All recommended plugins were already installed');
        }
        console.log('\n⚠️  Please restart Claude Code to load the new plugins');
        if (resolveCompletion) resolveCompletion();
      },
      onInstallError: (error: Error) => {
        if (rejectCompletion) rejectCompletion(error);
      },
    })
  );

  try {
    await completionPromise;
    // Wait a moment for the UI to show completion message
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } finally {
    unmount();
  }
}
