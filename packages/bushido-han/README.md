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

### han hook test

Validate and test hook configurations for all installed plugins.

```bash
# Validate hook structure and syntax only
han hook test

# Execute hooks with beautiful tree UI showing live progress
han hook test --execute

# Show detailed output for all hooks
han hook test --execute --verbose
```

**Options:**

- `--execute` - Execute hooks to verify they run successfully (in addition to validation)
- `--verbose` - Show detailed output for all hooks (only with --execute)

**Features:**

- Validates hook JSON structure and syntax
- Checks for valid hook event types (SessionStart, Stop, UserPromptSubmit, etc.)
- Ensures hook commands using `han hook run` have proper `--` separator
- With `--execute`: Beautiful tree UI with live progress tracking
- Failed hooks automatically show their output for debugging
- Supports hook timeout property
- Handles both `type: "command"` and `type: "prompt"` hooks

**Example output (validation only):**

```
🔍 Validating hooks for installed plugins...

Found hooks:
  SessionStart: 2 hook(s) from bushido
  Stop: 6 hook(s) from buki-act, buki-biome, buki-markdownlint, buki-typescript, do-claude-plugin-development
  SubagentStop: 6 hook(s) from buki-act, buki-biome, buki-markdownlint, buki-typescript, do-claude-plugin-development
  UserPromptSubmit: 2 hook(s) from bushido

✅ All hooks validated successfully

Tip: Run with --execute to test hook execution
```

**Example output (with --execute):**

```
🔍 Testing and executing hooks for installed plugins

├─ ✓ SessionStart (2/2)
│ └─ ✓ bushido (2/2)
│   ├─ ✓ cat "${CLAUDE_PLUGIN_ROOT}/hooks/agent-bushido.md"
│   └─ ✓ cat "${CLAUDE_PLUGIN_ROOT}/hooks/no-time-estimates.md"
├─ ✓ Stop (5/6)
│ ├─ ✓ buki-act (1/1)
│ │ └─ ✓ npx -y @thebushidocollective/han hook run --fail-fast --dirs-with .github/workflows -- "act --dryrun"
│ ├─ ✓ buki-biome (0/1)
│ │ └─ ✗ npx -y @thebushidocollective/han hook run --fail-fast --dirs-with biome.json -- npx -y @biomejs/biome check --write
│ └─ ✓ do-claude-plugin-development (2/2)
│   ├─ ✓ uvx claudelint ${CLAUDE_PROJECT_DIR} || (echo 'Please fix the claude lint errors...')
│   └─ ✓ npx -y markdownlint-cli --config ${CLAUDE_PLUGIN_ROOT}/hooks/.markdownlint.json ${CLAUDE_PROJECT_DIR}...
└─ ✓ UserPromptSubmit (2/2)
  └─ ✓ bushido (2/2)
    ├─ ✓ cat "${CLAUDE_PLUGIN_ROOT}/hooks/ensure-subagent.md"
    └─ ✓ cat "${CLAUDE_PLUGIN_ROOT}/hooks/ensure-skill-use.md"

============================================================

❌ Some hooks failed execution

Failed hooks in Stop:
  ✗ buki-biome: npx @biomejs/biome check --write
    [buki-biome/Stop] Error: File not found
    [buki-biome/Stop] Exit code: 1
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

- [Han Marketplace](https://han.thebushido.co)
- [GitHub](https://github.com/thebushidocollective/han)
- [The Bushido Collective](https://thebushido.co)

## License

MIT
