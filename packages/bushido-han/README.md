# Han CLI

**Sophisticated Claude Code Plugins with Superior Accuracy**

A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://han.guru/install.sh | sh
```

### Homebrew (macOS & Linux)

```bash
brew install thebushidocollective/tap/han
```

### npm

```bash
npm install -g @thebushidocollective/han
```

### Manual Download

Download the latest binary for your platform from [GitHub Releases](https://github.com/TheBushidoCollective/han/releases/latest):

| Platform | Download |
|----------|----------|
| macOS Apple Silicon | [han-darwin-arm64](https://github.com/TheBushidoCollective/han/releases/latest/download/han-darwin-arm64) |
| macOS Intel | [han-darwin-x64](https://github.com/TheBushidoCollective/han/releases/latest/download/han-darwin-x64) |
| Linux x64 | [han-linux-x64](https://github.com/TheBushidoCollective/han/releases/latest/download/han-linux-x64) |
| Linux ARM64 | [han-linux-arm64](https://github.com/TheBushidoCollective/han/releases/latest/download/han-linux-arm64) |
| Windows x64 | [han-windows-x64.exe](https://github.com/TheBushidoCollective/han/releases/latest/download/han-windows-x64.exe) |

## Plugin Categories

Han organizes plugins into four categories inspired by Japanese samurai traditions:

- **Bushido** (武士道) - Core principles, enforcement hooks, and foundational quality skills
- **Do** (道 - The Way) - Specialized agents for development disciplines and practices
- **Buki** (武器 - Weapons) - Language and tool skills with validation hooks for quality
- **Sensei** (先生 - Teachers) - MCP servers providing external knowledge and integrations

## Commands

### han plugin install

Install plugins interactively or automatically.

```bash
# Interactive mode - browse and select plugins
han plugin install

# Auto-detect mode - AI analyzes codebase and recommends plugins
han plugin install --auto

# Install specific plugin by name
han plugin install <plugin-name>
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

### han plugin uninstall

Remove a specific plugin.

```bash
han plugin uninstall <plugin-name> [--scope <project|local>]
```

### han plugin search

Search for plugins in the Han marketplace.

```bash
han plugin search [query]
```

### han hook run

Run a command in directories matching a pattern.

```bash
han hook run --dirs-with <pattern> -- <command>
```

**Examples:**

```bash
# Run npm test in all directories with package.json
han hook run --dirs-with package.json -- npm test

# Run mix compile in Elixir projects
han hook run --dirs-with mix.exs -- mix compile --warnings-as-errors

# Only run in directories passing a test command
han hook run --dirs-with mix.exs --test-dir "grep -qE ':credo' mix.exs" -- mix credo
```

### han hook test

Validate hook configurations for all installed plugins.

```bash
# Validate hook structure and syntax only
han hook test

# Validate AND execute hooks to verify they run successfully
han hook test --execute
```

### han uninstall

Remove all Han plugins and marketplace configuration.

```bash
han uninstall
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
