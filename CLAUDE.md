# Han - Claude Code Plugin Marketplace

## Project Overview

Han is a curated marketplace of Claude Code plugins built on Bushido principles. The codebase consists of:

- **bushido/** - Core foundation plugin with quality principles
- **buki/** - Weapon plugins (language/tool skills with validation hooks)
- **do/** - Discipline plugins (specialized agents)
- **sensei/** - Teacher plugins (MCP servers for external integrations)
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
- Plugin names follow patterns: `buki-*`, `do-*`, `sensei-*`
- Always include `bushido` as a dependency in recommendations
- MCP servers in sensei plugins should use HTTP transport with OAuth when available
