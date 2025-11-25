# @thebushidocollective/han

**Sophisticated Claude Code Plugins with Superior Accuracy**

A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.

## Installation

```bash
npm install -g @thebushidocollective/han
```

Or use with npx (no installation required):

```bash
npx @thebushidocollective/han <command>
```

## Plugin Categories

Han organizes plugins into four categories inspired by Japanese samurai traditions:

- **Bushido** (武士道) - Core principles, enforcement hooks, and foundational quality skills
- **Do** (道 - The Way) - Specialized agents for development disciplines and practices
- **Buki** (武器 - Weapons) - Language and tool skills with validation hooks for quality
- **Sensei** (先生 - Teachers) - MCP servers providing external knowledge and integrations

## Commands

### han install

Auto-detect and install recommended plugins using AI analysis.

```bash
han install [--scope <project|local>]
```

This command uses the Claude Agent SDK to analyze your codebase and recommend appropriate plugins based on:
- Programming languages detected
- Frameworks and libraries in use
- Testing tools configured
- Project structure

### han plugin install

Interactive plugin management.

```bash
# Interactive mode - browse and select plugins
han plugin install

# Auto-detect mode - AI analyzes codebase
han plugin install --auto

# Install specific plugin
han plugin install <plugin-name>
```

**Options:**
- `--auto` - Use AI to auto-detect and recommend plugins
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

### han align

Re-analyze your codebase and sync plugins with current state. Adds new plugins for detected technologies and removes plugins for technologies no longer in use.

```bash
han align [--scope <project|local>]
```

**When to use:**
- After adding new dependencies or frameworks
- After removing technologies from your project
- Periodically to keep plugins in sync

### han uninstall

Remove all Han plugins and marketplace configuration.

```bash
han uninstall
```

## Philosophy

> "Beginning is easy - continuing is hard." - Japanese Proverb

Walk the way of Bushido. Practice with Discipline. Build with Honor.

## Links

- [Han Marketplace](https://han.thebushido.co)
- [GitHub](https://github.com/thebushidocollective/han)
- [The Bushido Collective](https://thebushido.co)

## License

MIT
