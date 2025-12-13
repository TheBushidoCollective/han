---
title: "Plugin Commands"
description: "Commands for managing Han plugins."
---

Commands for installing, listing, and managing Han plugins.

## `han plugin install`

Install one or more Han plugins.

### Usage

```bash
# Install a single plugin
han plugin install <plugin-name>

# Install multiple plugins
han plugin install <plugin1> <plugin2> <plugin3>

# Auto-install recommended plugins based on repository
han plugin install --auto

# Install to project scope instead of user scope
han plugin install <plugin-name> --scope project

# Install to local (gitignored) scope
han plugin install <plugin-name> --scope local
```

### Options

| Option | Description |
|--------|-------------|
| `--auto` | Automatically detect and install recommended plugins |
| `--scope <scope>` | Installation scope: `user` (default), `project`, or `local` |
| `--force` | Force reinstall if already installed |

### Installation Scopes

By default, plugins install to user settings (`~/.claude/settings.json`) which applies across all projects:

| Scope | Location | Use Case |
|-------|----------|----------|
| `user` | `~/.claude/settings.json` | MCP servers, general-purpose plugins (hashi-*, do-*) |
| `project` | `.claude/settings.json` | Project-specific validation hooks (jutsu-* with hooks) |
| `local` | `.claude/settings.local.json` | Personal preferences not shared with team |

### Examples

```bash
# Install GitHub integration globally
han plugin install hashi-github

# Install TypeScript validation for this project
han plugin install jutsu-typescript --scope project

# Auto-detect and install recommended plugins
han plugin install --auto

# Install multiple plugins at once
han plugin install jutsu-bun jutsu-biome hashi-playwright-mcp
```

### Auto-Detection

When using `--auto`, Han analyzes your repository and suggests relevant plugins:

- Detects package managers (npm, bun, pnpm)
- Identifies languages (TypeScript, Python, Go, etc.)
- Recognizes frameworks (Next.js, React, etc.)
- Suggests appropriate jutsu and hashi plugins

## `han plugin list`

List installed Han plugins.

### Usage

```bash
# List all installed plugins
han plugin list

# List plugins in a specific scope
han plugin list --scope user
han plugin list --scope project
han plugin list --scope local

# Show detailed information
han plugin list --verbose
```

### Options

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Filter by scope: `user`, `project`, or `local` |
| `--verbose` | Show detailed plugin information |
| `--json` | Output as JSON for scripting |

### Output

```
Installed Han Plugins (user scope):

  hashi-github (v1.2.3)
    GitHub integration for Claude Code
    MCP Server: github
    Commands: /create-pr, /review-pr
    Skills: github-workflow-patterns

  jutsu-bun (v1.0.0)
    Bun runtime and testing support
    Hooks: test, build
```

### Examples

```bash
# List all plugins
han plugin list

# List only project-specific plugins
han plugin list --scope project

# Get JSON output for scripting
han plugin list --json | jq '.[] | select(.name | startswith("jutsu-"))'
```

## `han plugin uninstall`

Remove one or more Han plugins.

### Usage

```bash
# Uninstall a single plugin
han plugin uninstall <plugin-name>

# Uninstall multiple plugins
han plugin uninstall <plugin1> <plugin2>

# Uninstall from specific scope
han plugin uninstall <plugin-name> --scope project
```

### Options

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Uninstall from specific scope: `user`, `project`, or `local` |
| `--all-scopes` | Uninstall from all scopes |

### Examples

```bash
# Uninstall GitHub integration
han plugin uninstall hashi-github

# Uninstall TypeScript plugin from project scope
han plugin uninstall jutsu-typescript --scope project

# Uninstall from all scopes
han plugin uninstall jutsu-bun --all-scopes
```

## `han plugin search`

Search for available plugins in the Han marketplace.

### Usage

```bash
# Search all plugins
han plugin search

# Search for specific term
han plugin search <query>

# Filter by category
han plugin search --category jutsu
han plugin search --category hashi
```

### Options

| Option | Description |
|--------|-------------|
| `--category <category>` | Filter by category: `jutsu`, `hashi`, `do`, `core` |
| `--json` | Output as JSON for scripting |

### Examples

```bash
# Search for TypeScript-related plugins
han plugin search typescript

# List all hashi (MCP bridge) plugins
han plugin search --category hashi

# Get JSON output
han plugin search --json | jq '.[] | select(.category == "jutsu")'
```

## `han plugin update-marketplace`

Update the local plugin marketplace cache.

### Usage

```bash
# Update marketplace cache
han plugin update-marketplace

# Force update even if recently updated
han plugin update-marketplace --force
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Force update even if cache is fresh |

The marketplace cache is stored in `~/.claude/han/marketplace-cache.json` and updates automatically every 24 hours.

## Learn More

- [Installation Guide](/docs/installation) - Getting started with Han
- [Plugin Marketplace](/plugins) - Browse available plugins
- [Hook Commands](/docs/cli/hooks) - Running plugin validation hooks
