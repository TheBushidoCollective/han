---
title: "Plugin Development Guide"
description: "Complete guide for building third-party Han plugins, covering plugin structure, configuration, skills, commands, hooks, and distribution."
---

This guide walks you through creating Han plugins from scratch. Whether you're building validation hooks, specialized agents, or MCP integrations, you'll find everything you need here.

## Quick Start

The fastest way to create a new plugin is with the `han create plugin` command:

```bash
# Interactive mode - prompts for all options
han create plugin

# Non-interactive mode
han create plugin --type jutsu --name my-linter --description "My custom linter" --author "Your Name"
```

This scaffolds a complete plugin structure with all required files.

## Plugin Types

Han supports three plugin types, each serving a different purpose:

| Type | Prefix | Purpose | Examples |
|------|--------|---------|----------|
| **Jutsu** | `jutsu-` | Language/tool skills with validation hooks | jutsu-biome, jutsu-typescript |
| **Do** | `do-` | Specialized agents for complex workflows | do-architecture, do-security-engineering |
| **Hashi** | `hashi-` | MCP servers bridging external services | hashi-github, hashi-reddit |

## Plugin Structure

All plugins share a common base structure:

```
your-plugin/
├── .claude-plugin/
│   └── plugin.json      # Required: Plugin metadata
├── han-plugin.yml       # Hook configuration (optional)
├── skills/              # Skills (optional)
│   └── skill-name/
│       └── SKILL.md
├── commands/            # Slash commands (optional)
│   └── command-name.md
├── agents/              # Agents for do-* plugins (optional)
│   └── agent-name.md
├── .mcp.json            # MCP server config for hashi-* plugins
├── README.md            # Documentation
└── CHANGELOG.md         # Version history
```

## Required Files

### plugin.json

Every plugin must have a `.claude-plugin/plugin.json` file:

```json
{
  "name": "jutsu-my-tool",
  "version": "1.0.0",
  "description": "Brief description of what your plugin does",
  "author": {
    "name": "Your Name",
    "url": "https://your-website.com"
  },
  "homepage": "https://github.com/you/your-plugin",
  "repository": "https://github.com/you/your-plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"]
}
```

**Required fields:**

- `name`: Unique plugin name with appropriate prefix (jutsu-, do-, or hashi-)
- `version`: Semantic version (semver)
- `description`: Brief description shown in marketplace

**Optional fields:**

- `author`: Author information
- `homepage`: Plugin homepage URL
- `repository`: Source code repository
- `license`: License identifier (MIT, Apache-2.0, etc.)
- `keywords`: Search terms for marketplace discovery

## Next Steps

- [Plugin Types](/docs/plugin-development/types) - Detailed guide for each plugin type
- [Hook Configuration](/docs/plugin-development/hooks) - Writing validation hooks
- [Skills and Commands](/docs/plugin-development/skills) - Creating skills and commands
- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
- [Distribution](/docs/plugin-development/distribution) - Sharing your plugins
