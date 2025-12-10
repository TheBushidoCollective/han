# Han CLI

Automatic quality gates for Claude Code. Linting, formatting, type-checking, and tests run automatically at the end of every conversation.

## Installation

```bash
# Quick install (recommended)
curl -fsSL https://han.guru/install.sh | bash

# Or via Homebrew
brew install thebushidocollective/tap/han
```

Then install plugins for your project:

```bash
han plugin install --auto
```

## Plugin Categories

| Category | Description |
|----------|-------------|
| **Core** | Essential infrastructure—always required |
| **Jutsu** (Tools) | Validation hooks: TypeScript, Biome, Pytest, RSpec, etc. |
| **Dō** (Agents) | Specialized agents: code review, debugging, architecture |
| **Hashi** (Integrations) | MCP servers: GitHub, Playwright, Blueprints |

## Commands

### plugin install

```bash
han plugin install              # Interactive mode
han plugin install --auto       # Auto-detect your stack
han plugin install <name>       # Install specific plugin
```

**Options:**

- `--auto` - AI analyzes your codebase and recommends plugins
- `--scope <project|local>` - Installation scope (default: `project`)

### plugin search / uninstall

```bash
han plugin search <query>
han plugin uninstall <name>
```

### hook run

Run validation hooks manually:

```bash
han hook run <plugin> <hook>              # Run a hook
han hook run <plugin> <hook> --cached     # Skip if no changes
han hook run <plugin> <hook> --verbose    # Show full output
```

**Examples:**

```bash
han hook run jutsu-typescript typecheck
han hook run jutsu-biome lint --cached
han hook run jutsu-elixir test --only=packages/core
```

### hook explain

Show configured hooks:

```bash
han hook explain                # Show all Han plugin hooks
han hook explain Stop           # Show only Stop hooks
han hook explain --all          # Include settings hooks
```

### mcp

Start the MCP server for natural language hook execution:

```bash
han mcp
```

Exposes tools based on installed plugins. Run hooks with natural language like "run the elixir tests".

### uninstall

Remove all Han plugins:

```bash
han uninstall
```

## Links

- [han.guru](https://han.guru) - Documentation and plugin browser
- [GitHub](https://github.com/thebushidocollective/han)

## License

MIT
