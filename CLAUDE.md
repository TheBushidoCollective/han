# Han - Claude Code Plugin Marketplace

## Project Overview

Han is a curated marketplace of Claude Code plugins built on Bushido principles. The codebase consists of:

- **bushido/** - Core foundation plugin with quality principles
- **jutsu/** - Technique plugins (language/tool skills with validation hooks)
- **do/** - Discipline plugins (specialized agents)
- **hashi/** - Bridge plugins (MCP servers for external integrations)
- **packages/han/** - CLI tool for plugin installation and management

## Development Commands

```bash
# Build the CLI
cd packages/han && npm run build

# Run tests
cd packages/han && npm test

# Format code (from website directory)
cd website && npx biome format --write .

# Run Playwright tests
cd website && npx playwright test
```

## Plugin Structure

Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/
│   ├── plugin.json      # Plugin metadata
│   ├── hooks.json       # Claude Code hooks (optional)
│   └── marketplace.json # Only in root for marketplace listing
├── commands/            # Slash commands (*.md with frontmatter)
└── skills/              # Skills (*.md)
```

### Command Files

Commands require YAML frontmatter:

```markdown
---
description: Brief description of the command
---

Command content here...
```

### hooks.json Format

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "your-command-here" }
        ]
      }
    ]
  }
}
```

## CLI Architecture

The CLI (`packages/han/`) uses:

- **Commander.js** for CLI parsing
- **Ink** (React for CLI) for interactive UIs
- **Claude Agent SDK** for AI-powered plugin detection

Key files:

- `lib/main.ts` - CLI entry point and command definitions
- `lib/install.ts` - Plugin installation logic
- `lib/shared.ts` - Shared utilities and agent detection
- `lib/plugin-selector.tsx` - Interactive plugin selector UI

## Versioning

Version bumps happen automatically via GitHub Actions:

- `feat:` commits trigger MINOR bumps
- `fix:`, `refactor:`, etc. trigger PATCH bumps
- `!` or `BREAKING CHANGE:` triggers MAJOR bumps

## CI/CD

- **auto-tag-release.yml** - Bumps version and creates tags on changes to `packages/han/`
- **publish-npm.yml** - Publishes to npm using trusted publishers (OIDC, no token needed)
- **claudelint.yml** - Validates plugin structure with claudelint

## Conventions

- Use `npx biome format --write .` for formatting
- Plugin names follow patterns: `jutsu-*`, `do-*`, `hashi-*`
- Always include `bushido` as a dependency in recommendations
- MCP servers in hashi plugins should use HTTP transport with OAuth when available

## Plugin Installation

Plugins automatically install the han binary to `~/.claude/bin/han` on first session start (via the core plugin's SessionStart hook). This ensures hooks work immediately without any manual setup.

For users who want to use the CLI outside of Claude Code sessions:

```bash
# Recommended: Install via curl
curl -fsSL https://han.guru/install.sh | bash

# Or via Homebrew
brew install thebushidocollective/tap/han

# Then install plugins
han plugin install --auto
```

Within Claude Code, plugins can also be installed via:

```bash
/plugin install bushido@han
```

### Installation Scopes

By default, plugins install to user settings (`~/.claude/settings.json`) which applies across all projects:

```bash
# User scope (default) - shared across all projects
han plugin install hashi-playwright-mcp

# Project scope - only for current project (.claude/settings.json)
han plugin install jutsu-typescript --scope project

# Local scope - gitignored project settings (.claude/settings.local.json)
han plugin install --scope local
```

**Scope recommendations:**

- **user** (default): MCP servers, general-purpose plugins (hashi-*, do-*)
- **project**: Project-specific validation hooks (jutsu-* with hooks)
- **local**: Personal preferences not shared with team

Global installation via Homebrew or install.sh is optional but provides faster execution for frequent CLI usage.
