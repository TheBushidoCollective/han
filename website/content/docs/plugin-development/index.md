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

What a Han plugin typically contains:

```
your-plugin/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest
├── han-plugin.yml       # Han hook configuration (optional)
├── hooks/
│   └── hooks.json       # Generated from han-plugin.yml
├── skills/              # Skills (optional)
│   └── skill-name/
│       └── SKILL.md
├── agents/              # Agents for discipline plugins (optional)
│   └── agent-name.md
├── .mcp.json            # MCP server config for integration plugins
├── README.md            # Documentation
└── CHANGELOG.md         # Version history
```

### The Full Claude Code Component Set

Han plugins use a subset of what Claude Code supports. The complete set of components a plugin can ship, and where each lives:

| Component | Location | Han's usage |
|-----------|----------|-------------|
| Manifest | `.claude-plugin/plugin.json` | Required by Han's marketplace |
| Skills | `skills/<name>/SKILL.md` | Han's convention for plugin knowledge |
| Commands | `commands/<name>.md` | Skills as flat markdown. Valid, but no Han plugin uses it |
| Agents | `agents/<name>.md` | Used by discipline plugins |
| Hooks | `hooks/hooks.json` | Generated from `han-plugin.yml` |
| MCP servers | `.mcp.json` | Used by integration plugins |
| LSP servers | `.lsp.json` | Not modeled by Han |
| Workflows | `workflows/` | Not modeled by Han |
| Output styles | `output-styles/` | Not modeled by Han |
| Themes | `themes/` | Experimental upstream. Not modeled by Han |
| Monitors | `monitors/monitors.json` | Experimental upstream. Not modeled by Han |
| Executables | `bin/` | Files here join the Bash tool's `PATH` and are invokable as bare commands while the plugin is enabled. Not modeled by Han |
| Settings | `settings.json` | Default configuration applied when the plugin is enabled. Only the `agent` and `subagentStatusLine` keys are supported. Not modeled by Han |

"Not modeled by Han" means Han's own tooling does not generate or validate the component; Claude Code still loads it normally if your plugin ships one.

Two notes on the ones that overlap with Han's conventions:

- `commands/` is accepted by Claude Code, so a plugin containing one is not invalid. It is not Han's convention: every plugin in the marketplace uses `skills/` with a `SKILL.md`, and none ships a `commands/` directory. Write a skill unless you specifically need explicit `/command` invocation.
- `hooks/hooks.json` should be generated with `han plugin generate-hooks` rather than hand-written, so `han-plugin.yml` stays the single source of truth.

Everything except `.claude-plugin/plugin.json` lives at the plugin root, not inside `.claude-plugin/`.

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
