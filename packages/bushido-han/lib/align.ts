import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { render } from 'ink';
import React from 'react';
import { detectPluginsPrompt } from './detect-plugins-prompt.js';

const HAN_MARKETPLACE_REPO = 'thebushidocollective/han';

type MarketplaceSource =
  | { source: 'directory'; path: string }
  | { source: 'git'; url: string }
  | { source: 'github'; repo: string };
type Marketplace = { source: MarketplaceSource };
type Marketplaces = Record<string, Marketplace>;
type Plugins = Record<string, boolean>;

interface ClaudeSettings {
  extraKnownMarketplaces?: Marketplaces;
  enabledPlugins?: Plugins;
  [key: string]: unknown;
}

export interface AgentUpdate {
  type: 'text' | 'tool';
  content: string;
  toolName?: string;
}

export interface AlignResult {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface DetectPluginsCallbacks {
  onUpdate: (update: AgentUpdate) => void;
  onComplete: (plugins: string[], fullText: string) => void;
  onError: (error: Error) => void;
}

function getClaudeSettingsPath(scope: 'project' | 'local' = 'project'): string {
  const filename = scope === 'local' ? 'settings.local.json' : 'settings.json';
  return join(process.cwd(), '.claude', filename);
}

function ensureClaudeDirectory(): void {
  const settingsPath = getClaudeSettingsPath();
  const claudeDir = join(settingsPath, '..');
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
}

function readOrCreateSettings(scope: 'project' | 'local' = 'project'): ClaudeSettings {
  const settingsPath = getClaudeSettingsPath(scope);

  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
    } catch (_error) {
      console.error(`Error reading ${scope === 'local' ? 'settings.local.json' : 'settings.json'}, creating new one`);
      return {};
    }
  }

  return {};
}

function writeSettings(settings: ClaudeSettings, scope: 'project' | 'local' = 'project'): void {
  const settingsPath = getClaudeSettingsPath(scope);
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Get currently installed Han plugins
 */
function getInstalledPlugins(scope: 'project' | 'local' = 'project'): string[] {
  const settings = readOrCreateSettings(scope);
  const enabledPlugins = settings.enabledPlugins || {};

  return Object.keys(enabledPlugins)
    .filter((key) => key.endsWith('@han') && enabledPlugins[key])
    .map((key) => key.replace('@han', ''));
}

/**
 * Use Claude Agent SDK to intelligently analyze codebase and recommend plugins
 */
async function detectPluginsWithAgent(
  callbacks: DetectPluginsCallbacks
): Promise<void> {
  // Define allowed tools - only read-only operations
  const allowedTools: string[] = ['web_fetch', 'read_file', 'glob', 'grep'];

  const agent = query({
    prompt: detectPluginsPrompt,
    options: {
      model: 'claude-haiku-4-20250514',
      includePartialMessages: true,
      allowedTools,
      permissionMode: 'bypassPermissions',
    },
  });

  let responseContent = '';

  try {
    // Collect all messages from the agent with live updates
    for await (const sdkMessage of agent) {
      if (sdkMessage.type === 'assistant' && sdkMessage.message.content) {
        for (const block of sdkMessage.message.content) {
          if (block.type === 'text') {
            // Send text updates
            callbacks.onUpdate({ type: 'text', content: block.text });
            responseContent += block.text;
          } else if (block.type === 'tool_use') {
            // Send tool usage updates
            callbacks.onUpdate({
              type: 'tool',
              content: `Using ${block.name}`,
              toolName: block.name,
            });
          }
        }
      }
    }

    // Extract plugin recommendations from agent response
    const plugins = parsePluginRecommendations(responseContent);
    const finalPlugins = plugins.length > 0 ? plugins : ['bushido'];

    callbacks.onComplete(finalPlugins, responseContent);
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

/**
 * Parse plugin recommendations from agent response
 */
function parsePluginRecommendations(content: string): string[] {
  try {
    // Try to find JSON array in the response
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const plugins = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(plugins)) {
        plugins.push('bushido');
        return plugins.filter((p): p is string => typeof p === 'string');
      }
    }

    // Fallback: look for plugin names mentioned
    const pluginPattern = /(buki-[\w-]+|do-[\w-]+|sensei-[\w-]+|bushido)/g;
    const matches = content.match(pluginPattern);
    if (matches) {
      return [...new Set(matches)];
    }

    return [];
  } catch (_error) {
    return [];
  }
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
