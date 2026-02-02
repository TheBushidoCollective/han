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
han create plugin --category validation --name biome --description "Biome linting and formatting" --author "Your Name"
```

This scaffolds a complete plugin structure with all required files.

## Plugin Categories

Han plugins are organized into nine categories based on their technical layer:

| Category | Directory | Purpose | Examples |
|----------|-----------|---------|----------|
| **Core** | `core/` | Essential infrastructure | core, bushido |
| **Language** | `languages/` | Programming language support | typescript, python, rust |
| **Framework** | `frameworks/` | Framework integrations | react, nextjs, django |
| **Validation** | `validation/` | Linting, formatting | biome, eslint, prettier |
| **Tool** | `tools/` | Build tools, testing | playwright, jest, docker |
| **Integration** | `services/` | MCP servers for external services | github, gitlab, linear |
| **Discipline** | `disciplines/` | Specialized AI agents | frontend, backend, security |
| **Pattern** | `patterns/` | Methodologies, workflows | [ai-dlc](https://ai-dlc.dev), tdd, atomic-design |
| **Specialized** | `specialized/` | Niche tools | android, ios, tensorflow |

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
├── agents/              # Agents for discipline plugins (optional)
│   └── agent-name.md
├── .mcp.json            # MCP server config for integration plugins
├── README.md            # Documentation
└── CHANGELOG.md         # Version history
```

## Required Files

### plugin.json

Every plugin must have a `.claude-plugin/plugin.json` file:

```json
{
  "name": "biome",
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

- `name`: Unique plugin name (use category-appropriate naming)
- `version`: Semantic version (semver)
- `description`: Brief description shown in marketplace

**Optional fields:**

- `author`: Author information
- `homepage`: Plugin homepage URL
- `repository`: Source code repository
- `license`: License identifier (MIT, Apache-2.0, etc.)
- `keywords`: Search terms for marketplace discovery

## Next Steps

- [Plugin Types](/docs/plugin-development/types) - Detailed guide for each plugin category
- [Hook Configuration](/docs/plugin-development/hooks) - Writing validation hooks
- [Skills and Commands](/docs/plugin-development/skills) - Creating skills and commands
- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
- [Distribution](/docs/plugin-development/distribution) - Sharing your plugins
