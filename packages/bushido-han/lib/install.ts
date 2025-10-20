import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

const HAN_MARKETPLACE_REPO = 'thebushidocollective/han';
const HAN_MARKETPLACE_URL = `https://github.com/${HAN_MARKETPLACE_REPO}`;

type MarketplaceSource = { source: 'directory', path: string } | { source: 'git', url: string } | { source: 'github', repo: string }
type Marketplace = { source: MarketplaceSource }
type Marketplaces = Record<string, Marketplace>
type Plugins = Record<string, boolean>

interface ClaudeSettings {
  extraKnownMarketplaces?: Marketplaces;
  enabledPlugins?: Plugins;
  [key: string]: unknown;
}

function getClaudeSettingsPath(): string {
  const rootDir = process.cwd();
  return join(rootDir, '.claude', 'settings.json');
}

function ensureClaudeDirectory(): void {
  const rootDir = process.cwd();
  const claudeDir = join(rootDir, '.claude');
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
async function detectPluginsWithAgent(): Promise<string[] | null> {
  try {
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
4. Get the latest han plugins from the marketplace ${HAN_MARKETPLACE_URL}
5. Recommend Han plugins that match the detected technologies
6. Return your recommendations as a JSON array of plugin names

Focus on detecting:
- Programming languages (TypeScript, Python, Go, Rust, Ruby, etc.)
- Frontend frameworks (React, Vue, Angular, Next.js, etc.)
- Backend frameworks (NestJS, Django, FastAPI, Rails, etc.)
- Testing frameworks (Jest, Pytest, RSpec, etc.)
- GraphQL implementations
- Monorepo tools (Nx, Turborepo, Lerna)

ALWAYS add the bushido plugin!

Return ONLY a JSON array of recommended plugin names, like:
["bushido", "buki-typescript", "buki-react", "buki-jest"]

Analyze this codebase and recommend appropriate Han plugins.`;

    // Define allowed tools - only read-only operations
    const allowedTools: Tool[] = [
      'web_search',
      'read_file',
      'glob',
      'grep'
    ];

    console.log('🔍 Analyzing codebase...\n');

    const agent = query({
      prompt: agentPrompt,
      options: {
        model: 'claude-sonnet-4-5-20250929',
        maxTurns: 10,
        includePartialMessages: true,
        allowedTools
      },
    });

    let responseContent = '';
    const toolCounts = new Map<string, number>();

    // Collect all messages from the agent and show progress
    for await (const sdkMessage of agent) {
      if (sdkMessage.type === 'assistant' && sdkMessage.message.content) {
        for (const block of sdkMessage.message.content) {
          if (block.type === 'text') {
            responseContent += block.text;
            // Don't print agent's internal reasoning, just collect it
          } else if (block.type === 'tool_use') {
            // Track tool usage
            const count = (toolCounts.get(block.name) || 0) + 1;
            toolCounts.set(block.name, count);

            // Show tool usage on same line using carriage return
            const toolEmoji = block.name === 'web_search' ? '🌐' :
              block.name === 'read_file' ? '📄' :
                block.name === 'glob' ? '🔍' :
                  block.name === 'grep' ? '🔎' : '🔧';

            // Clear line and show current tool
            process.stdout.write(`\r${toolEmoji} ${block.name}... (${count}/${Array.from(toolCounts.values()).reduce((a, b) => a + b, 0)})    `);
          }
        }
      }
    }

    // Clear the progress line and show summary
    process.stdout.write('\r\x1b[K'); // Clear line
    console.log('📊 Analysis complete:');
    for (const [tool, count] of toolCounts.entries()) {
      console.log(`   ${tool}: ${count} call${count > 1 ? 's' : ''}`);
    }
    console.log();

    // Extract plugin recommendations from agent response
    const plugins = parsePluginRecommendations(responseContent);

    return plugins;
  } catch (error) {
    console.error('Error using Agent SDK:', (error as Error).message);
    console.log('Falling back to simple detection...\n');
    return null;
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
 * SDK-based install command
 */
export async function install(): Promise<void> {
  console.log('🤖 Han Plugin Installer\n');

  // Use SDK-based detection
  let plugins = await detectPluginsWithAgent();

  if (!plugins || plugins.length === 0) {
    console.log('⚠️  No specific plugins detected. Installing core bushido plugin.\n');
    plugins = ['bushido'];
  } else {
    console.log('✅ Recommended plugins:');
    for (const plugin of plugins.sort()) {
      console.log(`   • ${plugin}`);
    }
    console.log();
  }

  ensureClaudeDirectory();

  console.log('📝 Updating Claude Code settings...\n');

  const settings = readOrCreateSettings();

  // Add Han marketplace to extraMarketplaces
  if (!settings.extraMarketplaces) {
    settings.extraMarketplaces = [];
  }

  if (!settings?.extraKnownMarketplaces?.han) {
    settings.extraKnownMarketplaces = { ...settings.extraKnownMarketplaces, han: { source: { source: "github", repo: HAN_MARKETPLACE_REPO } } };
    console.log(`   ✓ Added Han marketplace: ${HAN_MARKETPLACE_REPO}`);
  } else {
    console.log(`   ✓ Han marketplace already configured`);
  }

  // Add detected plugins
  if (!settings.plugins) {
    settings.plugins = [];
  }

  let addedCount = 0;
  for (const plugin of plugins) {
    settings.enabledPlugins = {
      ...settings.enabledPlugins, [plugin]: true
    };
    addedCount++;
  }

  console.log(`   ✓ Added ${addedCount} new plugin(s)`);
  console.log(`   ✓ Total plugins configured: ${Object.keys(settings?.enabledPlugins ?? {}).length}`);

  writeSettings(settings);

  console.log('\n✅ Installation complete!\n');
  console.log('💡 Restart Claude Code to load the new plugins.');
}
