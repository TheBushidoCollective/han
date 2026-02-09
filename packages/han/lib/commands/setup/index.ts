import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';

type AgentName = 'codex' | 'kiro' | 'gemini' | 'opencode' | 'agents-md';

interface AgentConfig {
  name: AgentName;
  label: string;
  files: Array<{ path: string; content: string }>;
}

const HAN_NPX = 'npx -y @thebushidocollective/han';

function agentsMarkdownContent(): string {
  return `# Han - AI Code Quality Marketplace

Han is a curated marketplace of plugins for AI coding agents. It provides
quality gates, validation hooks, MCP server integrations, and specialized
disciplines that work across multiple AI coding tools.

## Context Injection

Run this command at the start of each session to load Han plugin context
(installed plugin rules, project conventions, and quality guidelines):

\`\`\`bash
${HAN_NPX} hook dispatch SessionStart
\`\`\`

The output should be treated as system-level instructions for the session.

## Validation

After making code changes, run validation hooks to check your work:

\`\`\`bash
${HAN_NPX} hook dispatch Stop
\`\`\`

## Learn More

- Website: https://han.guru
- GitHub: https://github.com/thebushidocollective/han
- Install: \`${HAN_NPX} plugin install --auto\`
`;
}

function getAgentConfigs(): AgentConfig[] {
  return [
    {
      name: 'agents-md',
      label: 'AGENTS.md + GEMINI.md',
      files: [
        { path: 'AGENTS.md', content: agentsMarkdownContent() },
        { path: 'GEMINI.md', content: agentsMarkdownContent() },
      ],
    },
    {
      name: 'codex',
      label: 'Codex CLI',
      files: [
        {
          path: '.codex/config.toml',
          content: `[mcp_servers.han]
command = "npx"
args = ["-y", "@thebushidocollective/han", "mcp"]
`,
        },
      ],
    },
    {
      name: 'kiro',
      label: 'Kiro CLI',
      files: [
        {
          path: '.kiro/agents/han.json',
          content: JSON.stringify(
            {
              name: 'han',
              description:
                'Han quality gates and plugin marketplace. Provides automated validation hooks, MCP server integrations, and quality guidelines.',
              mcpServers: {
                han: {
                  command: 'npx',
                  args: ['-y', '@thebushidocollective/han', 'mcp'],
                },
              },
              hooks: {
                agentSpawn: [
                  {
                    command: `${HAN_NPX} hook dispatch SessionStart`,
                    timeout_ms: 15000,
                  },
                ],
                stop: [
                  {
                    command: `${HAN_NPX} hook dispatch Stop`,
                    timeout_ms: 120000,
                  },
                ],
              },
            },
            null,
            2
          ),
        },
      ],
    },
    {
      name: 'gemini',
      label: 'Gemini CLI',
      files: [
        {
          path: '.gemini/settings.json',
          content: JSON.stringify(
            {
              mcpServers: {
                han: {
                  command: 'npx',
                  args: ['-y', '@thebushidocollective/han', 'mcp'],
                },
              },
            },
            null,
            2
          ),
        },
      ],
    },
    {
      name: 'opencode',
      label: 'OpenCode',
      files: [
        {
          path: 'opencode.json',
          content: JSON.stringify(
            {
              $schema: 'https://opencode.ai/config.json',
              plugin: ['opencode-plugin-han'],
            },
            null,
            2
          ),
        },
      ],
    },
  ];
}

function writeAgentFiles(
  cwd: string,
  config: AgentConfig,
  force: boolean
): { created: string[]; skipped: string[] } {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of config.files) {
    const fullPath = join(cwd, file.path);

    if (existsSync(fullPath) && !force) {
      skipped.push(file.path);
      continue;
    }

    // Ensure parent directory exists
    const dir = join(fullPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, file.content, 'utf-8');
    created.push(file.path);
  }

  return { created, skipped };
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description(
      'Generate config files for non-Claude-Code agents (Codex, Kiro, Gemini CLI, OpenCode)'
    )
    .option(
      '--agent <name>',
      'Generate config for a specific agent (codex, kiro, gemini, opencode, agents-md)'
    )
    .option('--all', 'Generate configs for all agents (default)')
    .option('--force', 'Overwrite existing config files')
    .action((options: { agent?: string; all?: boolean; force?: boolean }) => {
      const cwd = process.cwd();
      const force = options.force === true;
      const configs = getAgentConfigs();

      let targets: AgentConfig[];

      if (options.agent) {
        const target = configs.find((c) => c.name === options.agent);
        if (!target) {
          const valid = configs.map((c) => c.name).join(', ');
          console.error(
            `Unknown agent: ${options.agent}\nValid agents: ${valid}`
          );
          process.exit(1);
        }
        targets = [target];
      } else {
        // Default: generate all
        targets = configs;
      }

      let totalCreated = 0;
      let totalSkipped = 0;

      for (const config of targets) {
        const { created, skipped } = writeAgentFiles(cwd, config, force);

        if (created.length > 0) {
          for (const file of created) {
            console.log(`  \x1b[32m+\x1b[0m ${file}`);
          }
          totalCreated += created.length;
        }

        if (skipped.length > 0) {
          for (const file of skipped) {
            console.log(
              `  \x1b[33m~\x1b[0m ${file} (exists, use --force to overwrite)`
            );
          }
          totalSkipped += skipped.length;
        }
      }

      console.log('');

      if (totalCreated > 0) {
        console.log(
          `Created ${totalCreated} file(s)${totalSkipped > 0 ? `, skipped ${totalSkipped}` : ''}`
        );
      } else if (totalSkipped > 0) {
        console.log(`All files already exist. Use --force to overwrite.`);
      } else {
        console.log('No files to create.');
      }
    });
}
