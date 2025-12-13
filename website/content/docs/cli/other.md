---
title: "Other Commands"
description: "Additional CLI commands for version, help, and updates."
---

Additional Han CLI commands for version information, help, and updates.

## `han --version`

Show the current Han version.

### Usage

```bash
han --version
han -V
```

### Output

```
1.61.6
```

### Example

```bash
# Check version
$ han --version
1.61.6

# Use in scripts
if [ "$(han --version | cut -d. -f1)" -ge 2 ]; then
  echo "Han v2+ detected"
fi
```

## `han --help`

Show help information for Han commands.

### Usage

```bash
# Show main help
han --help
han -h

# Show help for specific command
han plugin --help
han hook run --help
```

### Output

```
Usage: han [options] [command]

Utilities for The Bushido Collective's Han Code Marketplace

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  plugin          Manage Han plugins
  hook            Hook utilities
  mcp             MCP server utilities
  memory          Memory management
  metrics         Metrics and analytics
  checkpoint      Checkpoint management
  explain         Show comprehensive overview of Han configuration
  summary         AI-powered summary of how Han is improving this repository
  gaps            AI-powered analysis of repository gaps and Han plugin recommendations
  help [command]  display help for command
```

### Examples

```bash
# General help
han --help

# Plugin command help
han plugin --help

# Hook run command help
han hook run --help
```

## `han update`

Update Han to the latest version.

### Usage

```bash
# Update to latest version
han update

# Update to specific version
han update --version 1.61.6

# Check for updates without installing
han update --check
```

### Options

| Option | Description |
|--------|-------------|
| `--version <version>` | Update to specific version |
| `--check` | Check for updates without installing |
| `--force` | Force reinstall even if up to date |

### Update Methods

The update behavior depends on how Han was installed:

**Homebrew installation:**

```bash
# Update via Homebrew
brew update
brew upgrade thebushidocollective/tap/han
```

**curl installation:**

```bash
# Update via installer script
curl -fsSL https://han.guru/install.sh | bash
```

**npm installation:**

```bash
# Update via npm
npm update -g @thebushidocollective/han
```

### Examples

```bash
# Update to latest
han update

# Check current version first
han --version
han update --check

# Update to specific version
han update --version 1.61.0
```

## `han explain`

Show comprehensive overview of Han configuration.

### Usage

```bash
han explain
```

### Output

Displays:

- Installed plugins by scope (user, project, local)
- Active hooks and their triggers
- MCP servers and their status
- Configuration file locations
- Checkpoint and metrics status

### Example

```bash
$ han explain

Han Configuration Overview
==========================

Installed Plugins (user):
  - hashi-github (v1.2.3) - GitHub integration
  - jutsu-bun (v1.0.0) - Bun runtime support

Installed Plugins (project):
  - jutsu-typescript (v1.1.0) - TypeScript validation

Active Hooks:
  jutsu-bun/test (Stop hook)
  jutsu-typescript/typecheck (Stop hook)

MCP Servers:
  - han (built-in)
  - github (hashi-github)

Configuration:
  User: ~/.claude/han.yml
  Project: .claude/han.yml
  Local: .claude/han.local.yml (not found)

Metrics: ~/.claude/han/metrics/
Checkpoints: ~/.claude/han/checkpoints/
```

## `han summary`

AI-powered summary of how Han is improving the repository.

### Usage

```bash
han summary
```

Analyzes:

- Hook execution history
- Task completion metrics
- Calibration trends
- Plugin usage patterns

Generates a natural language summary of Han's impact on your development workflow.

### Example

```bash
$ han summary

Analyzing Han's impact on your repository...

Over the past month, Han has:
- Run 147 validation hooks with 94% success rate
- Tracked 23 tasks with average confidence of 0.82
- Detected and prevented 8 potential issues before commit
- Improved calibration accuracy from 0.68 to 0.79

Top performing hooks:
  1. jutsu-bun/test (100% success)
  2. jutsu-typescript/typecheck (96% success)
  3. jutsu-biome/lint (92% success)

Recommendations:
- Consider adding jutsu-playwright for browser testing
- Hook failure rate for jutsu-biome/lint suggests review of lint rules
```

## `han gaps`

AI-powered analysis of repository gaps and plugin recommendations.

### Usage

```bash
han gaps
```

Analyzes your repository and suggests Han plugins that could add value based on:

- Detected technologies and frameworks
- Missing validation hooks
- Development patterns
- Team workflows

### Example

```bash
$ han gaps

Analyzing repository for improvement opportunities...

Detected Technologies:
  - TypeScript (✓ jutsu-typescript installed)
  - Bun (✓ jutsu-bun installed)
  - React (missing plugin)
  - PostgreSQL (missing integration)

Recommended Plugins:

  jutsu-react - React development patterns and hooks
    Why: 23 React components detected without validation

  hashi-postgresql - PostgreSQL database integration
    Why: Database queries found without schema validation

  do-code-reviewer - Multi-agent code review system
    Why: No automated code review process detected

Install with:
  han plugin install jutsu-react hashi-postgresql do-code-reviewer
```

## Learn More

- [Installation Guide](/docs/installation) - Getting started with Han
- [Plugin Commands](/docs/cli/plugins) - Managing plugins
- [Hook Commands](/docs/cli/hooks) - Running hooks
