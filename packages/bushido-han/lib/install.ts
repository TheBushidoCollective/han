import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
