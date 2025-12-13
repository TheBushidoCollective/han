---
title: "What is Han?"
description: "Han is a plugin system for Claude Code that adds automatic quality gates through validation hooks, metrics tracking, and MCP integrations."
---

Han brings automatic quality gates to Claude Code. Every conversation ends with validation—linting, formatting, type-checking, and tests run automatically, catching issues before they ship.

## How It Works

Han operates in four steps:

### 1. Install

One command installs the CLI and auto-detects plugins for your stack:

```bash
han plugin install --auto
```

The CLI automatically detects your project's technologies and recommends the right plugins. No manual configuration needed.

### 2. Code

Claude writes code as usual. No workflow changes needed.

You continue working with Claude Code exactly as before. Han operates transparently in the background.

### 3. Validate

Stop hooks run automatically when conversations end. Linters, formatters, type checkers, and tests are all verified.

If validation fails, Claude sees the errors and can fix them immediately—no manual intervention required.

### 4. Learn

Local metrics track success rates and calibrate confidence. Nothing leaves your machine.

Han learns from every task, building a private quality profile that helps Claude make better decisions over time.

## Key Features

### Automatic Validation

Quality checks run at key lifecycle points:

- **Stop hooks** - Run when conversations end
- **SessionStart hooks** - Run when Claude Code starts
- **Pre-commit hooks** - Run before git commits (optional)

You don't need to remember to run tests or check types. Han does it automatically.

### Smart Caching

Han only runs validation when relevant files change. Native Rust hashing makes this fast:

- File content hashing (not timestamps)
- Dependency-aware invalidation
- Per-hook cache isolation
- Checkpoint-based filtering per session

Validation that would take seconds runs in milliseconds when files haven't changed.

### 100% Local and Private

All data stays on your machine:

- Metrics stored locally in `~/.claude/metrics.db`
- No telemetry or phone-home
- No cloud dependencies
- Works completely offline

Your code, your data, your machine. Period.

### MCP Server Integration

Han includes MCP servers for natural language interaction:

- **Hooks MCP** - Execute validation hooks via natural language
- **Metrics MCP** - Query quality metrics and track progress
- **Checkpoints** - Session-scoped change tracking

These servers bridge Claude's AI capabilities with your development tools, creating a seamless workflow.

## What Han Is Not

Han is not:

- A code generator (Claude does that)
- A replacement for your tools (it runs them)
- A cloud service (everything is local)
- A workflow manager (it enhances your existing workflow)

Han is infrastructure. It makes Claude Code better at ensuring quality without changing how you work.

## Next Steps

- [Install Han](/docs/installation) and get started
- Learn about [plugin categories](/docs/plugin-categories)
- Explore the [CLI reference](/docs/cli)
- Read about the [metrics system](/docs/metrics)
