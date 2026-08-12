---
title: "Plugin Commands"
description: "Commands for managing Han plugins."
---

Commands for installing, listing, and managing Han plugins.

## `han plugin install`

Install one or more Han plugins.

### Usage

```bash
# Interactive picker
han plugin install

# Install a single plugin
han plugin install <plugin-name>

# Install multiple plugins
han plugin install <plugin1> <plugin2> <plugin3>

# Auto-detect plugins for this repository
han plugin install --auto

# Install to local (gitignored) scope
han plugin install <plugin-name> --scope local

# Install from an external marketplace repo
han plugin install <plugin-name> --from thebushidocollective/ai-dlc
```

### Options

| Option | Description |
|--------|-------------|
| `--auto` | Auto-detect plugins using file markers and AI analysis |
| `--no-analyze` | With `--auto`, skip AI analysis and use file-marker detection only |
| `--scope <scope>` | Installation scope: `project` (default) or `local` |
| `--from <repo>` | Install from an external GitHub marketplace repo |

### Installation Scopes

Han plugins always install at project or local scope, never user scope. This keeps plugins tracked per project instead of polluting global settings.

| Scope | Location | Use Case |
|-------|----------|----------|
| `project` | `.claude/settings.json` | Shared with the team, committed to the repo |
| `local` | `.claude/settings.local.json` | Personal preferences, gitignored |

`han plugin install --scope user` is rejected with an error. If you omit `--scope`, Han reuses whichever project-level scope already has Han configured, and otherwise defaults to `project`.

Note the asymmetry: `han plugin list` and `han plugin uninstall` do still accept `user`, because Han must be able to see and clean up plugins written to `~/.claude/settings.json` by older versions or by hand.

### Examples

```bash
# Install GitHub integration for this project
han plugin install github

# Install TypeScript validation without sharing it with the team
han plugin install typescript --scope local

# Auto-detect and install for your stack
han plugin install --auto

# Auto-detect using file markers only, no AI analysis
han plugin install --auto --no-analyze

# Install several at once
han plugin install bun biome playwright-mcp
```

### Auto-Detection

With `--auto`, Han analyzes your repository and installs relevant plugins:

- Detects package managers (npm, bun, pnpm)
- Identifies languages (TypeScript, Python, Go, and so on)
- Recognizes frameworks (Next.js, React, and so on)
- Suggests appropriate plugins for your stack

## `han plugin list`

List installed Han plugins.

### Usage

```bash
# Every scope (default)
han plugin list

# One scope
han plugin list --scope user
han plugin list --scope project
han plugin list --scope local
```

### Options

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Scope to list: `user`, `project`, `local`, or `all` (default: `all`) |

## `han plugin uninstall`

Remove one or more Han plugins.

### Usage

```bash
# Uninstall a single plugin
han plugin uninstall <plugin-name>

# Uninstall multiple plugins
han plugin uninstall <plugin1> <plugin2>

# Uninstall from a specific scope
han plugin uninstall <plugin-name> --scope project
```

### Options

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Scope to uninstall from: `user` (default), `project`, or `local` |

The default here is `user`, which does not match `install`'s default of `project`. Pass `--scope` explicitly when uninstalling a plugin you installed at project scope.

There is no `han plugin remove`; the command is `uninstall`.

## `han plugin search`

Search for available plugins in the Han marketplace.

### Usage

```bash
# List everything
han plugin search

# Search for a term
han plugin search typescript
```

The search matches plugin names, descriptions, and keywords. There are no filter flags; pipe the output through `grep` to narrow further.

## `han plugin validate`

Validate the plugin in the current directory: manifest structure, `han-plugin.yml` schema, and the Claude Code plugin manifest fields. Exits silently when the directory is not a plugin, so it is safe to wire into a hook.

### Usage

```bash
han plugin validate

# Errors only, suppress warnings
han plugin validate --quiet
```

### Options

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Only show errors, not warnings |

Han knows the 26 top-level fields of the Claude Code plugin manifest, including `settings` and `dependencies`. Claude Code itself ignores fields it does not recognize, so Han matches that: an unrecognized key is reported as a warning, not an error, and the manifest still validates. The two experimental component keys, `themes` and `monitors`, are accepted at the top level and belong under `experimental` going forward.

## `han plugin generate-hooks`

Generate `hooks/hooks.json` from a plugin's `han-plugin.yml`.

### Usage

```bash
# Current directory
han plugin generate-hooks

# A specific plugin directory
han plugin generate-hooks plugins/tools/biome

# Every plugin in the marketplace
han plugin generate-hooks --all
```

## `han plugin migrate`

Rewrite old prefixed plugin names to their short names in your settings files. The legacy `jutsu-`, `do-`, and `hashi-` prefixes remain valid marketplace aliases, so migrating is a tidiness step rather than a fix for a broken install.

```bash
han plugin migrate
```

## `han plugin update-marketplace`

Update the local plugin marketplace cache from GitHub.

### Usage

```bash
han plugin update-marketplace
```

The cache lives at `~/.claude/cache/han-marketplace.json` (or `$CLAUDE_CONFIG_DIR/cache/han-marketplace.json`) and is refreshed automatically once it is more than 24 hours old. This command forces a refresh now; it takes no options.

## Learn More

- [Installation Guide](/docs/installation) - Getting started with Han
- [Plugin Marketplace](/plugins) - Browse available plugins
- [Hook Commands](/docs/cli/hooks) - Running plugin validation hooks
