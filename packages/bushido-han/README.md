# Han CLI

**Sophisticated Claude Code Plugins with Superior Accuracy**

A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.

## Installation

Use npx to run han (no installation required):

```bash
npx @thebushidocollective/han plugin install
```

This always uses the latest version automatically.

## Plugin Categories

Han organizes plugins into four categories inspired by Japanese samurai traditions:

- **Bushido** (武士道) - Core principles, enforcement hooks, and foundational quality skills
- **Do** (道 - The Way) - Specialized agents for development disciplines and practices
- **Jutsu** (術 - Techniques) - Language and tool skills with validation hooks for quality
- **Hashi** (橋 - Bridges) - MCP servers providing external knowledge and integrations

## Commands

### plugin install

Install plugins interactively or automatically.

```bash
# Interactive mode - browse and select plugins
npx @thebushidocollective/han plugin install

# Auto-detect mode - AI analyzes codebase and recommends plugins
npx @thebushidocollective/han plugin install --auto

# Install specific plugin by name
npx @thebushidocollective/han plugin install <plugin-name>
```

**Options:**

- `--auto` - Use AI to analyze your codebase and recommend plugins:
  - Shows installed and recommended plugins only
  - Recommended plugins marked with ⭐ and pre-selected
  - Installed but no longer recommended plugins marked as "(installed)" and deselected
  - Other plugins discoverable via "🔍 Search for more plugins"
  - Based on: Programming languages, frameworks, git platform, testing tools
- `--scope <project|local>` - Installation scope (default: `project`)
  - `project`: Install to `.claude/settings.json` (shared via git)
  - `local`: Install to `.claude/settings.local.json` (git-ignored)

### plugin uninstall

Remove a specific plugin.

```bash
npx @thebushidocollective/han plugin uninstall <plugin-name> [--scope <project|local>]
```

### plugin search

Search for plugins in the Han marketplace.

```bash
npx @thebushidocollective/han plugin search [query]
```

### plugin update-marketplace

Update the local marketplace cache from GitHub.

```bash
npx @thebushidocollective/han plugin update-marketplace
```

The marketplace cache is automatically refreshed every 24 hours when using `han plugin install` or `han plugin search`. Use this command to manually force a refresh if you want to see the latest plugins immediately.

**Features:**

- Caches marketplace data locally in `~/.claude/cache/han-marketplace.json`
- Automatically refreshes after 24 hours
- Falls back to stale cache if network is unavailable
- Shows cache age and available categories after update

### hook run

Run a hook command defined by a plugin.

```bash
# New format (recommended) - uses plugin's han-config.json
npx @thebushidocollective/han hook run <plugin-name> <hook-name> [options]

# Legacy format - run arbitrary commands in matching directories
npx @thebushidocollective/han hook run --dirs-with <pattern> -- <command>
```

**Options:**

- `--fail-fast` - Stop on first failure (default: true)
- `--cached` - Skip if no relevant files have changed since last successful run
- `--only=<dir>` - Only run in the specified directory
- `--verbose` - Show full command output

**Examples:**

```bash
# Run TypeScript type checking using plugin config
npx @thebushidocollective/han hook run jutsu-typescript typecheck

# Run with caching (skip if no changes)
npx @thebushidocollective/han hook run jutsu-elixir test --cached

# Run in a specific directory only
npx @thebushidocollective/han hook run jutsu-biome lint --only=packages/core

# Legacy: Run npm test in all directories with package.json
npx @thebushidocollective/han hook run --dirs-with package.json -- npm test
```

### hook explain

Show comprehensive information about configured hooks.

```bash
npx @thebushidocollective/han hook explain [hookType] [--all]
```

**Options:**

- `[hookType]` - Filter by hook type (e.g., `Stop`, `SessionStart`)
- `--all` - Include hooks from Claude Code settings (not just Han plugins)

**Examples:**

```bash
# Show all Han plugin hooks
npx @thebushidocollective/han hook explain

# Show only Stop hooks
npx @thebushidocollective/han hook explain Stop

# Show all hooks including settings
npx @thebushidocollective/han hook explain --all
```

### hook dispatch

Dispatch hooks of a specific type across all installed Han plugins.

```bash
npx @thebushidocollective/han hook dispatch <hookType> [--all]
```

This is useful for triggering hooks manually or for workarounds when plugin hook output needs to be passed to the agent.

**Examples:**

```bash
# Dispatch SessionStart hooks
npx @thebushidocollective/han hook dispatch SessionStart

# Dispatch Stop hooks including settings hooks
npx @thebushidocollective/han hook dispatch Stop --all
```

### hook test

Validate hook configurations for all installed plugins.

```bash
# Validate hook structure and syntax only
npx @thebushidocollective/han hook test

# Validate AND execute hooks to verify they run successfully
npx @thebushidocollective/han hook test --execute
```

### mcp

Start the Han MCP server for natural language hook execution.

```bash
npx @thebushidocollective/han mcp
```

The MCP server dynamically exposes tools based on your installed plugins. Once installed via `hashi-han`, you can run hooks using natural language like "run the elixir tests" instead of remembering exact commands.

**Generated tools include:**

- `jutsu_elixir_test` - Run tests for Elixir projects
- `jutsu_typescript_typecheck` - Run TypeScript type checking
- `jutsu_biome_lint` - Run Biome linting

See the [hashi-han plugin](/hashi/hashi-han) for installation and configuration.

### uninstall

Remove all Han plugins and marketplace configuration.

```bash
npx @thebushidocollective/han uninstall
```

## Philosophy

> "Beginning is easy - continuing is hard." - Japanese Proverb

Walk the way of Bushido. Practice with Discipline. Build with Honor.

## Links

- [Han Marketplace](https://han.guru)
- [GitHub](https://github.com/thebushidocollective/han)
- [The Bushido Collective](https://thebushido.co)

## License

MIT
