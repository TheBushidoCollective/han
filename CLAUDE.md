# Han - Claude Code Plugin Marketplace

## Project Overview

Han is a curated marketplace of Claude Code plugins built on Bushido principles. The codebase consists of:

- **bushido/** - Core foundation plugin with quality principles
- **jutsu/** - Technique plugins (language/tool skills with validation hooks)
- **do/** - Discipline plugins (specialized agents)
- **hashi/** - Bridge plugins (MCP servers for external integrations)
- **packages/bushido-han/** - CLI tool for plugin installation and management

## Development Commands

```bash
# Build the CLI
cd packages/bushido-han && npm run build

# Run tests
cd packages/bushido-han && npm test

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

The CLI (`packages/bushido-han/`) uses:

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

- **auto-tag-release.yml** - Bumps version and creates tags on changes to `packages/bushido-han/`
- **publish-npm.yml** - Publishes to npm using trusted publishers (OIDC, no token needed)
- **claudelint.yml** - Validates plugin structure with claudelint

## Conventions

- Use `npx biome format --write .` for formatting
- Plugin names follow patterns: `jutsu-*`, `do-*`, `hashi-*`
- Always include `bushido` as a dependency in recommendations
- MCP servers in hashi plugins should use HTTP transport with OAuth when available

## Technical Specifications (specs/)

This project uses `specs/` directories for implementation documentation. When adding or modifying features:

1. **Check existing specs** - Read `specs/README.md` for documented systems
2. **Update alongside code** - Keep specs in sync with implementation changes
3. **Use `/specs` command** - Generate documentation for a specific system
4. **Use `/specs-all` command** - Audit and update all documentation

The `jutsu-specs` plugin enforces documentation through hooks:
- **UserPromptSubmit**: Reminds when to document
- **Stop**: Verifies documentation matches changes

See `jutsu/jutsu-specs/` for documentation guidelines and skills.

## Plugin Installation

Plugins can be installed directly through Claude Code - no global han installation required. Hooks use npx automatically.

```bash
# Install from within Claude Code
/plugin install bushido@han

# Or via Claude CLI
claude plugin install bushido@han

# Or use npx for CLI features (auto-detect recommended plugins)
npx @thebushidocollective/han plugin install --auto
```

### Installation Scopes

By default, plugins install to user settings (`~/.claude/settings.json`) which applies across all projects:

```bash
# User scope (default) - shared across all projects
npx @thebushidocollective/han plugin install hashi-playwright-mcp

# Project scope - only for current project (.claude/settings.json)
npx @thebushidocollective/han plugin install jutsu-typescript --scope project

# Local scope - gitignored project settings (.claude/settings.local.json)
npx @thebushidocollective/han plugin install --scope local
```

**Scope recommendations:**

- **user** (default): MCP servers, general-purpose plugins (hashi-*, do-*)
- **project**: Project-specific validation hooks (jutsu-* with hooks)
- **local**: Personal preferences not shared with team

Global installation via Homebrew or install.sh is optional but provides faster execution for frequent CLI usage.
