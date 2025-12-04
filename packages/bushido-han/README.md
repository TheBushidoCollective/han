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

### hook run

Run a command in directories matching a pattern.

```bash
npx @thebushidocollective/han hook run --dirs-with <pattern> -- <command>
```

**Examples:**

```bash
# Run npm test in all directories with package.json
npx @thebushidocollective/han hook run --dirs-with package.json -- npm test

# Run mix compile in Elixir projects
npx @thebushidocollective/han hook run --dirs-with mix.exs -- mix compile --warnings-as-errors

# Only run in directories passing a test command
npx @thebushidocollective/han hook run --dirs-with mix.exs --test-dir "grep -qE ':credo' mix.exs" -- mix credo
```

### hook test

Validate hook configurations for all installed plugins.

```bash
# Validate hook structure and syntax only
npx @thebushidocollective/han hook test

# Validate AND execute hooks to verify they run successfully
npx @thebushidocollective/han hook test --execute
```

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
