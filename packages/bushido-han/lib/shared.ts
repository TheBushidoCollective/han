import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { detectPluginsPrompt } from './detect-plugins-prompt.js';

export const HAN_MARKETPLACE_REPO = 'thebushidocollective/han';

export type MarketplaceSource =
  | { source: 'directory'; path: string }
  | { source: 'git'; url: string }
  | { source: 'github'; repo: string };
export type Marketplace = { source: MarketplaceSource };
export type Marketplaces = Record<string, Marketplace>;
export type Plugins = Record<string, boolean>;

export interface ClaudeSettings {
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

export function getClaudeSettingsPath(scope: 'project' | 'local' = 'project'): string {
  const filename = scope === 'local' ? 'settings.local.json' : 'settings.json';
  return join(process.cwd(), '.claude', filename);
}

export function ensureClaudeDirectory(): void {
  const settingsPath = getClaudeSettingsPath();
  const claudeDir = join(settingsPath, '..');
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
}

export function readOrCreateSettings(scope: 'project' | 'local' = 'project'): ClaudeSettings {
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

export function writeSettings(settings: ClaudeSettings, scope: 'project' | 'local' = 'project'): void {
  const settingsPath = getClaudeSettingsPath(scope);
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Detect which scope(s) have Han marketplace configured
 * Returns array of scopes where Han is installed
 */
export function detectHanScopes(): Array<'project' | 'local'> {
  const scopes: Array<'project' | 'local'> = [];

  // Check project scope
  const projectSettings = readOrCreateSettings('project');
  if (projectSettings.extraKnownMarketplaces?.han) {
    scopes.push('project');
  }

  // Check local scope
  const localSettings = readOrCreateSettings('local');
  if (localSettings.extraKnownMarketplaces?.han) {
    scopes.push('local');
  }

  return scopes;
}

/**
 * Get currently installed Han plugins
 */
export function getInstalledPlugins(scope: 'project' | 'local' = 'project'): string[] {
  const settings = readOrCreateSettings(scope);
  const enabledPlugins = settings.enabledPlugins || {};

  return Object.keys(enabledPlugins)
    .filter((key) => key.endsWith('@han') && enabledPlugins[key])
    .map((key) => key.replace('@han', ''));
}

/**
 * Use Claude Agent SDK to intelligently analyze codebase and recommend plugins
 */
export async function detectPluginsWithAgent(
  callbacks: DetectPluginsCallbacks
): Promise<void> {
  // Define allowed tools - only read-only operations
  const allowedTools: string[] = ['web_fetch', 'read_file', 'glob', 'grep'];

  const agent = query({
    prompt: detectPluginsPrompt,
    options: {
      model: 'haiku',
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
export function parsePluginRecommendations(content: string): string[] {
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
