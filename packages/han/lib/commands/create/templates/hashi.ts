/**
 * Hashi plugin template.
 *
 * Hashi plugins bridge external services via MCP servers.
 * They include MCP server configuration and optional memory providers.
 */

import { type PluginConfig, processTemplate, toTitleCase } from './index.ts';

export interface HashiTemplateFiles {
  [key: string]: string;
  '.claude-plugin/plugin.json': string;
  '.mcp.json': string;
  'han-plugin.yml': string;
  'README.md': string;
  'CHANGELOG.md': string;
}

const PLUGIN_JSON_TEMPLATE = `{
  "name": "{{NAME}}",
  "version": "0.1.0",
  "description": "{{DESCRIPTION}}",
  "author": {
    "name": "{{AUTHOR_NAME}}",
    "url": "{{AUTHOR_URL}}"
  },
  "license": "MIT",
  "keywords": ["mcp", "{{KEYWORD}}", "server"]
}
`;

const MCP_JSON_TEMPLATE = `{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "command": "npx",
      "args": ["-y", "@your-org/mcp-server-{{KEYWORD}}"]
    }
  }
}
`;

const HAN_PLUGIN_YML_TEMPLATE = `# {{TITLE}} Plugin Configuration
# This plugin provides {{TITLE}} integration via MCP server
# MCP server is defined in .mcp.json for direct exposure to Claude Code

# No hooks - MCP server plugins don't have validation hooks
hooks: {}

# Memory provider for team memory extraction (optional)
# Uncomment and configure if your MCP server provides searchable data
# memory:
#   allowed_tools:
#     - mcp__{{SERVER_NAME}}__tool_name
#   system_prompt: |
#     Search {{TITLE}} for relevant information.
#     Return relevant findings with context.
`;

const README_TEMPLATE = `# {{TITLE}}

{{DESCRIPTION}}

## Installation

\`\`\`bash
han plugin install {{NAME}}
\`\`\`

## MCP Server

This plugin configures an MCP server for {{TITLE}} integration.

### Prerequisites

<!-- List any prerequisites like API keys, accounts, etc. -->

### Configuration

The MCP server is configured in \`.mcp.json\`. You may need to:

1. Set up authentication (API keys, OAuth, etc.)
2. Configure environment variables
3. Adjust server settings as needed

### Available Tools

<!-- Document the tools provided by your MCP server -->

- **tool_name** - Description of what this tool does

## Usage

Once installed, the MCP server tools are available to Claude Code automatically.

Example usage:

\`\`\`
Ask Claude: "Use {{KEYWORD}} to..."
\`\`\`

## Environment Variables

<!-- Document required environment variables -->

| Variable | Description | Required |
|----------|-------------|----------|
| \`API_KEY\` | Your API key | Yes |

## License

MIT
`;

const CHANGELOG_TEMPLATE = `# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - {{DATE}}

### Added

- Initial release
- MCP server configuration
`;

/**
 * Generate all files for a hashi plugin.
 */
export function getHashiTemplate(config: PluginConfig): HashiTemplateFiles {
  const keyword = config.name.replace(/^hashi-/, '');
  const serverName = keyword;

  const variables = {
    NAME: config.name,
    TITLE: toTitleCase(config.name.replace(/^hashi-/, '')),
    DESCRIPTION: config.description,
    AUTHOR_NAME: config.authorName,
    AUTHOR_URL: config.authorUrl,
    KEYWORD: keyword,
    SERVER_NAME: serverName,
    DATE: new Date().toISOString().split('T')[0],
  };

  return {
    '.claude-plugin/plugin.json': processTemplate(
      PLUGIN_JSON_TEMPLATE,
      variables
    ),
    '.mcp.json': processTemplate(MCP_JSON_TEMPLATE, variables),
    'han-plugin.yml': processTemplate(HAN_PLUGIN_YML_TEMPLATE, variables),
    'README.md': processTemplate(README_TEMPLATE, variables),
    'CHANGELOG.md': processTemplate(CHANGELOG_TEMPLATE, variables),
  };
}
