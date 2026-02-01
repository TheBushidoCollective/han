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
  - github (v1.2.3) - GitHub integration
  - bun (v1.0.0) - Bun runtime support

Installed Plugins (project):
  - typescript (v1.1.0) - TypeScript validation

Active Hooks:
  bun/test (Stop hook)
  typescript/typecheck (Stop hook)

MCP Servers:
  - han (built-in)
  - github (github plugin)

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
  1. bun/test (100% success)
  2. typescript/typecheck (96% success)
  3. biome/lint (92% success)

Recommendations:
- Consider adding playwright-mcp for browser testing
- Hook failure rate for biome/lint suggests review of lint rules
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
  - TypeScript (✓ typescript installed)
  - Bun (✓ bun installed)
  - React (missing plugin)
  - PostgreSQL (missing integration)

Recommended Plugins:

  react - React development patterns and hooks
    Why: 23 React components detected without validation

  postgresql - PostgreSQL database integration
    Why: Database queries found without schema validation

  code-reviewer - Multi-agent code review system
    Why: No automated code review process detected

Install with:
  han plugin install react postgresql code-reviewer
```

## `han checkpoint`

Manage session and agent checkpoints for validation filtering.

Checkpoints capture the state of files at specific points (session start, subagent start) to enable efficient validation filtering. Hooks can use the `if_changed` option to only run when relevant files have changed since the checkpoint.

### `han checkpoint capture`

Capture a checkpoint of current file state. Can read from stdin (hook payload) or use explicit options.

#### Usage

```bash
# From hook (reads stdin JSON with hook_event_name and session_id/agent_id)
echo '{"hook_event_name": "SessionStart", "session_id": "abc123"}' | han checkpoint capture

# With explicit options
han checkpoint capture --type session --id abc123
han checkpoint capture --type agent --id agent-xyz
```

#### Auto-detection

When reading from stdin, checkpoint type is automatically determined:

- `SessionStart` → captures session checkpoint using `session_id`
- `SubagentStart` → captures agent checkpoint using `agent_id`

#### Options

| Option | Description |
|--------|-------------|
| `--type <type>` | Checkpoint type: `session` or `agent` |
| `--id <id>` | Checkpoint ID (session_id or agent_id) |

#### Example

```bash
# Typically called from SessionStart hook
han checkpoint capture < /tmp/hook-payload.json

# Manual capture
han checkpoint capture --type session --id my-session-123

# Output
Checkpoint captured: session/my-session-123
```

### `han checkpoint list`

List active checkpoints for the current project.

#### Usage

```bash
han checkpoint list
```

#### Output

```bash
$ han checkpoint list

Active Checkpoints
==================

Session Checkpoints:
  - abc123 (captured 2 hours ago)
  - def456 (captured 1 day ago)

Agent Checkpoints:
  - agent-xyz (captured 5 minutes ago)
  - agent-abc (captured 3 hours ago)

Total: 4 checkpoints
```

### `han checkpoint clean`

Remove stale checkpoints older than specified age.

#### Usage

```bash
# Remove checkpoints older than 24 hours (default)
han checkpoint clean

# Custom age in hours
han checkpoint clean --max-age 48
```

#### Options

| Option | Description |
|--------|-------------|
| `--max-age <hours>` | Remove checkpoints older than N hours (default: 24) |

#### Example

```bash
$ han checkpoint clean --max-age 48

Cleaning checkpoints older than 48 hours...

Removed:
  - session/old-session-1 (72 hours old)
  - session/old-session-2 (96 hours old)
  - agent/old-agent-1 (120 hours old)

Cleaned 3 checkpoints
```

## Learn More

- [Installation Guide](/docs/installation) - Getting started with Han
- [Plugin Commands](/docs/cli/plugins) - Managing plugins
- [Hook Commands](/docs/cli/hooks) - Running hooks
