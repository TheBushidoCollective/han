---
title: "CLI Reference"
description: "Complete reference for the han command-line tool."
---

The `han` command-line tool is the primary interface for managing plugins, running hooks, and interacting with Han's features outside of Claude Code sessions.

## Installation

Install the CLI via Homebrew or curl:

```bash
# Homebrew
brew install thebushidocollective/tap/han

# Or via curl
curl -fsSL https://han.guru/install.sh | bash
```

Alternatively, the CLI is automatically installed to `~/.claude/bin/han` when you start a Claude Code session with the core plugin.

## Command Categories

### [Plugin Commands](/docs/cli/plugins)

Manage Han plugins: install, list, uninstall, and search.

```bash
han plugin install <plugin-name>
han plugin list
han plugin uninstall <plugin-name>
```

### [Hook Commands](/docs/cli/hooks)

Run and manage validation hooks.

```bash
han hook run <plugin> <hook>
han hook list
```

### [Other Commands](/docs/cli/other)

Diagnostics, storage, parsing, worktrees, the coordinator daemon, and the browse dashboard.

```bash
han doctor
han browse
han keep list
```

## Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `--help` | Show help for the command |
| `-V, --version` | Show Han version |

## Environment Variables

Han respects these environment variables:

| Variable | Description |
|----------|-------------|
| `HAN_DISABLE_HOOKS` | Set to `1` or `true` to disable all hooks |
| `HAN_FORCE_HOOKS` | Set to `1` or `true` to run hooks even where they would otherwise be suppressed |
| `HAN_HOOK_RUN_VERBOSE` | Set to `1` or `true` to enable verbose hook output |
| `HAN_NO_CACHE` | Set to `1` to disable smart caching (force hooks to run) |
| `HAN_SESSION_ID` | Session ID used for event logging, cache tracking, and lock scoping |
| `HAN_DEBUG` | Set to `1` or `true` for debug diagnostics on stderr |
| `HAN_BINARY` | Override the han binary command or path |
| `HAN_DATA_DIR` | Override the Han data directory (default: `~/.han`) |
| `HAN_COORDINATOR_PORT` | Coordinator daemon port (default: 41957) |
| `HAN_BROWSE_PORT` | Browse UI port (default: 41956) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Set to `1` to enable OpenTelemetry export |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint |

`HAN_NO_CHECKPOINTS=1` turns off session-scoped `${HAN_FILES}` filtering. `HAN_CHECKPOINT_TYPE` and `HAN_CHECKPOINT_ID` are still set by `han hook dispatch` but are no longer read by anything. See [session-scoped validation](/docs/features/checkpoints).

**Note:** Environment variables override `han.yml` settings at runtime.

See [OpenTelemetry](/docs/metrics/opentelemetry) for more telemetry variables.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid command or arguments |

## Learn More

- [Plugin Commands](/docs/cli/plugins) - Detailed plugin management reference
- [Hook Commands](/docs/cli/hooks) - Detailed hook management reference
- [Other Commands](/docs/cli/other) - Everything else the CLI exposes
