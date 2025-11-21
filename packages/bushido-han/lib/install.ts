import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { render } from 'ink';
import React from 'react';

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

function getClaudeSettingsPath(): string {
  // Always use project-level settings in current working directory
  return join(process.cwd(), '.claude', 'settings.json');
}

function ensureClaudeDirectory(): void {
  const settingsPath = getClaudeSettingsPath();
  const claudeDir = join(settingsPath, '..');
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
}

function readOrCreateSettings(): ClaudeSettings {
  const settingsPath = getClaudeSettingsPath();

  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
    } catch (_error) {
      console.error('Error reading settings.json, creating new one');
      return {};
    }
  }

  return {};
}

function writeSettings(settings: ClaudeSettings): void {
  const settingsPath = getClaudeSettingsPath();
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Use Claude Agent SDK to intelligently analyze codebase and recommend plugins
 */
async function detectPluginsWithAgent(
  callbacks: DetectPluginsCallbacks
): Promise<void> {
  const agentPrompt = `You are a Han plugin installer assistant. Your goal is to analyze the current codebase and recommend appropriate Claude Code plugins from the Han marketplace.

Available Plugin Categories:
- buki-* (武器 weapons): Skills for specific technologies (e.g., buki-typescript, buki-react, buki-go)
- do-* (道 disciplines): Specialized agents for development practices
- sensei-* (先生 teachers): MCP servers for external integrations
- bushido: Core quality and testing principles

Your Task:
1. Use Glob to discover what files exist in the repository
2. Use Grep to search for framework/library usage patterns
3. Read key configuration files (package.json, Cargo.toml, go.mod, etc.)
4. Get the latest han plugins from the marketplace https://raw.githubusercontent.com/TheBushidoCollective/han/refs/heads/main/.claude-plugin/marketplace.json
5. Recommend Han plugins that match the detected technologies
6. Return your recommendations as a JSON array of plugin names

Focus on detecting:
- Programming languages (TypeScript, Python, Go, Rust, Ruby, etc.)
- Frontend frameworks (React, Vue, Angular, Next.js, etc.)
- Backend frameworks (NestJS, Django, FastAPI, Rails, etc.)
- Testing frameworks (Jest, Pytest, RSpec, etc.)
- GraphQL implementations
- Monorepo tools (Nx, Turborepo, Lerna)

Return ONLY a JSON array of recommended plugin names, like:
["bushido", "buki-typescript", "buki-react", "buki-jest"]

ULTRATHINK and Analyze this codebase and recommend appropriate Han plugins.`;

  // Define allowed tools - only read-only operations
  const allowedTools: string[] = ['web_fetch', 'read_file', 'glob', 'grep'];

  const agent = query({
    prompt: agentPrompt,
    options: {
      model: 'claude-sonnet-4-5-20250929',
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
function getInstalledPlugins(): string[] {
  const settings = readOrCreateSettings();
  const enabledPlugins = settings.enabledPlugins || {};

  return Object.keys(enabledPlugins)
    .filter((key) => key.endsWith('@han') && enabledPlugins[key])
    .map((key) => key.replace('@han', ''));
}

/**
 * Install plugins to Claude settings and return list of added plugins
 */
function installPluginsToSettings(plugins: string[]): string[] {
  ensureClaudeDirectory();

  const settings = readOrCreateSettings();
  const currentPlugins = getInstalledPlugins();
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

  writeSettings(settings);

  return added;
}

/**
 * SDK-based install command with Ink UI
 */
export async function install(): Promise<void> {
  // Import Ink UI component dynamically to avoid issues with React
  const { InstallProgress } = await import('./install-progress.js');

  let resolveCompletion: (() => void) | undefined;
  let rejectCompletion: ((error: Error) => void) | undefined;

  const completionPromise = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  console.log('Installing to ./.claude/settings.json...\n');

  const { unmount } = render(
    React.createElement(InstallProgress, {
      detectPlugins: detectPluginsWithAgent,
      onInstallComplete: (plugins: string[]) => {
        const added = installPluginsToSettings(plugins);
        if (added.length > 0) {
          console.log(
            `\n✓ Added ${added.length} plugin(s): ${added.join(', ')}`
          );
        } else {
          console.log('\n✓ All recommended plugins were already installed');
        }
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
