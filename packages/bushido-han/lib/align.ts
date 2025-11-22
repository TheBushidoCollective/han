import { render } from 'ink';
import React from 'react';
import {
  HAN_MARKETPLACE_REPO,
  ensureClaudeDirectory,
  readOrCreateSettings,
  writeSettings,
  getInstalledPlugins,
  detectPluginsWithAgent,
} from './shared.js';

export interface AlignResult {
  added: string[];
  removed: string[];
  unchanged: string[];
}

/**
 * Compare current plugins with recommended plugins and update settings
 */
function alignPluginsInSettings(recommendedPlugins: string[], scope: 'project' | 'local' = 'project'): AlignResult {
  ensureClaudeDirectory();

  const settings = readOrCreateSettings(scope);
  const currentPlugins = getInstalledPlugins(scope);

  // Calculate differences
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  // Add Han marketplace if not present
  if (!settings?.extraKnownMarketplaces?.han) {
    settings.extraKnownMarketplaces = {
      ...settings.extraKnownMarketplaces,
      han: { source: { source: 'github', repo: HAN_MARKETPLACE_REPO } },
    };
  }

  // Initialize enabledPlugins if needed
  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }

  // Find plugins to add (in recommended but not in current)
  for (const plugin of recommendedPlugins) {
    if (!currentPlugins.includes(plugin)) {
      added.push(plugin);
      settings.enabledPlugins[`${plugin}@han`] = true;
    } else {
      unchanged.push(plugin);
    }
  }

  // Find plugins to remove (in current but not in recommended)
  for (const plugin of currentPlugins) {
    if (!recommendedPlugins.includes(plugin)) {
      removed.push(plugin);
      delete settings.enabledPlugins[`${plugin}@han`];
    }
  }

  writeSettings(settings, scope);

  return { added, removed, unchanged };
}

/**
 * SDK-based align command with Ink UI
 */
export async function align(scope: 'project' | 'local' = 'project'): Promise<void> {
  // Import Ink UI component dynamically
  const { AlignProgress } = await import('./align-progress.js');

  let resolveCompletion: (() => void) | undefined;
  let rejectCompletion: ((error: Error) => void) | undefined;

  const completionPromise = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const filename = scope === 'local' ? 'settings.local.json' : 'settings.json';
  console.log(`Aligning plugins in ./.claude/${filename}...\n`);

  const { unmount } = render(
    React.createElement(AlignProgress, {
      detectPlugins: detectPluginsWithAgent,
      onAlignComplete: (plugins: string[]) => {
        const result = alignPluginsInSettings(plugins, scope);

        // Report changes
        if (result.added.length > 0) {
          console.log(
            `\n✓ Added ${result.added.length} plugin(s): ${result.added.join(', ')}`
          );
        }
        if (result.removed.length > 0) {
          console.log(
            `\n✓ Removed ${result.removed.length} plugin(s): ${result.removed.join(', ')}`
          );
        }
        if (result.added.length === 0 && result.removed.length === 0) {
          console.log('\n✓ No changes needed - plugins are already aligned');
        } else {
          console.log('\n⚠️  Please restart Claude Code to load the plugin changes');
        }

        if (resolveCompletion) resolveCompletion();
      },
      onAlignError: (error: Error) => {
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
