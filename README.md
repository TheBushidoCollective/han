# Han

[![GitHub Release](https://img.shields.io/github/v/release/thebushidocollective/han)](https://github.com/thebushidocollective/han/releases)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/jwaldrip/cd6f81e193544d779245496680af7ba0/raw/han-coverage.json)](https://github.com/thebushidocollective/han/actions/workflows/validate-han.yml)

Automatic quality gates for Claude Code. Every conversation ends with validation—linting, formatting, type-checking, and tests run automatically, catching issues before they ship.

## Getting Started

Two commands. That's it.

```bash
# 1. Install the CLI
curl -fsSL https://han.guru/install.sh | bash

# 2. Auto-detect and install plugins for your project
han plugin install --auto
```

Next time you use Claude Code, validation hooks run automatically when you finish a conversation.

### Alternative Installation

```bash
# Homebrew (macOS/Linux)
brew install thebushidocollective/tap/han
```

## How It Works

1. **Install** - One command installs the CLI and auto-detects plugins for your stack
2. **Code** - Claude writes code as usual. No workflow changes needed
3. **Validate** - Stop hooks run automatically. Linters, formatters, type checkers, and tests are all verified
4. **Learn** - Local metrics track success rates and calibrate confidence. Nothing leaves your machine

## Plugin Categories

139 plugins across four categories:

| Category | Description | Examples |
|----------|-------------|----------|
| **Core** | Essential infrastructure. Auto-installs han binary, provides metrics and MCP servers | Always required |
| **Jutsu** (Tools) | Validation plugins for your stack | TypeScript, Biome, Pytest, RSpec, ShellCheck |
| **Dō** (Agents) | Specialized AI agents | Code review, debugging, architecture, security |
| **Hashi** (Integrations) | MCP servers for external tools | GitHub, Playwright, Blueprints |

Browse all plugins at [han.guru/plugins](https://han.guru/plugins/)

## Why It Works

- **Smart Caching** - Only runs validation when relevant files change. Native Rust hashing keeps it fast
- **Local Metrics** - Tracks task success and confidence calibration. All data stays on your machine
- **Zero Config** - Binary auto-installs on first session. `--auto` flag detects your stack automatically
- **Any Stack** - TypeScript, Python, Rust, Go, Ruby, Elixir. If there's a linter, there's a plugin

## CLI Commands

```bash
# Install plugins
han plugin install              # Interactive mode
han plugin install --auto       # Auto-detect your stack
han plugin install <name>       # Install specific plugin

# Manage plugins
han plugin search <query>       # Search marketplace
han plugin uninstall <name>     # Remove plugin

# Run hooks manually
han hook run <plugin> <hook>    # Run a specific hook
han hook explain                # Show configured hooks

# MCP server
han mcp                         # Start MCP server for natural language hook execution
```

## Documentation

Full documentation at [han.guru/docs](https://han.guru/docs/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to create new plugins.

## License

MIT License - see [LICENSE](LICENSE)

---

Built by [The Bushido Collective](https://thebushido.co)
