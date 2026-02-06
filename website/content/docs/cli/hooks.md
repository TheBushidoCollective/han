---
title: "Hook Commands"
description: "Commands for running and managing hooks."
---

Commands for running validation hooks and managing hook execution.

## `han hook run`

Run a validation hook from an installed plugin.

### Usage

```bash
# New format: Run a plugin's hook
han hook run <plugin-name> <hook-name>

# With options
han hook run <plugin-name> <hook-name> --verbose

# Disable caching
han hook run <plugin-name> <hook-name> --no-cache

# Legacy format: Run custom command across directories
han hook run --dirs-with <file> -- <command>
```

### Options

| Option | Description |
|--------|-------------|
| `--no-cache` | Disable caching (caching is ON by default in v2.0.0+) |
| `--no-checkpoints` | Disable checkpoint filtering (checkpoints are ON by default) |
| `--verbose` | Show full command output in real-time |
| `--directory <path>` | Limit execution to specific directory |
| `--checkpoint-type <type>` | Filter against checkpoint type (`session` or `agent`) |
| `--checkpoint-id <id>` | Filter against specific checkpoint ID |

**Legacy options:**

| Option | Description |
|--------|-------------|
| `--dirs-with <file>` | Only run in directories containing the specified file |
| `--test-dir <command>` | Only include directories where this command exits 0 |

**Breaking Change (v2.0.0):** Caching is enabled by default. Use `--no-cache` to disable it.

### Caching Behavior

Caching is enabled by default (since v2.0.0):

1. Han creates a checkpoint with file modification times
2. On subsequent runs, compares current file times to checkpoint
3. Skips execution if no files have changed
4. Clears checkpoint on failure (ensures retry on next run)

Checkpoints are session-scoped by default, meaning they're cleared when the Claude Code session ends. Use `--no-checkpoints` to disable checkpoint filtering entirely.

### Examples

```bash
# Run Bun tests (caching enabled by default)
han hook run bun test

# Run without caching
han hook run bun test --no-cache

# Run TypeScript type checking verbosely
han hook run typescript typecheck --verbose

# Run Biome lint in specific directory
han hook run biome lint --directory packages/core

# Legacy: Run npm test in directories with package.json
han hook run --dirs-with package.json -- npm test
```

### Plugin Hook Configuration

Hooks are defined in plugin `han-plugin.yml` files:

```yaml
hooks:
  test:
    command: bun test --only-failures
    dirs_with: [bun.lock, bun.lockb]
    description: Run Bun tests
    if_changed: ["**/*.ts", "**/*.test.ts"]
```

When you run `han hook run bun test`, Han:

1. Finds directories containing `bun.lock` or `bun.lockb`
2. Checks if files matching `**/*.ts` or `**/*.test.ts` have changed (caching is enabled by default)
3. Runs `bun test --only-failures` in each directory
4. Records the result and updates checkpoints

## `han hook list`

List available hooks from installed plugins.

### Usage

```bash
# List all available hooks
han hook list

# Filter by plugin
han hook list --plugin bun

# Show detailed information
han hook list --verbose
```

### Options

| Option | Description |
|--------|-------------|
| `--plugin <name>` | Filter hooks by plugin name |
| `--verbose` | Show detailed hook configuration |
| `--json` | Output as JSON for scripting |

### Output

```
Available Hooks:

  bun:
    test - Run Bun tests
    build - Build the Bun project

  typescript:
    typecheck - Type-check TypeScript code for type errors

  biome:
    lint - Lint Biome code for issues and style violations
```

### Examples

```bash
# List all hooks
han hook list

# List only Bun hooks
han hook list --plugin bun

# Get JSON output for scripting
han hook list --json | jq '.[] | select(.plugin == "bun")'
```

## `han hook explain`

Show detailed explanation of a hook's configuration and behavior.

### Usage

```bash
# Explain a specific hook
han hook explain <plugin-name> <hook-name>
```

### Example

```bash
han hook explain bun test
```

Output:

```
Hook: bun/test

Description: Run Bun tests

Command: bun test --only-failures

Directories: Runs in directories containing:
  - bun.lock
  - bun.lockb

File Patterns: Triggers when these files change:
  - **/*.ts
  - **/*.test.ts

Cache: Enabled by default (use --no-cache to disable)

Usage:
  han hook run bun test
  han hook run bun test --no-cache
  han hook run bun test --verbose --directory packages/core
```

## `han hook verify`

Verify hook configuration for all installed plugins.

### Usage

```bash
# Verify all plugin hooks
han hook verify

# Verify specific plugin
han hook verify --plugin bun
```

### Options

| Option | Description |
|--------|-------------|
| `--plugin <name>` | Verify hooks for specific plugin only |
| `--fix` | Attempt to fix common issues |

Checks for:

- Valid hook configuration syntax
- Command executability
- File pattern validity
- Directory detection logic

## `han hook test`

Test a hook configuration without actually running it.

### Usage

```bash
# Test which directories a hook would run in
han hook test <plugin-name> <hook-name>

# Test with specific directory
han hook test <plugin-name> <hook-name> --directory packages/core
```

Shows:

- Detected directories
- Files that would trigger execution (if `ifChanged` is set)
- Checkpoint status (if `--cache` would skip)

## Environment Variables

Hook execution respects these environment variables:

| Variable | Description |
|----------|-------------|
| `HAN_DISABLE_HOOKS` | Set to `1` or `true` to disable all hooks |
| `HAN_HOOK_RUN_VERBOSE` | Set to `1` or `true` to enable verbose output globally |
| `HAN_MCP_TIMEOUT` | Hook timeout in milliseconds (default: 600000 = 10 minutes) |

### Example

```bash
# Disable all hooks temporarily
export HAN_DISABLE_HOOKS=1
han hook run bun test  # Exits immediately without running

# Enable verbose output globally
export HAN_HOOK_RUN_VERBOSE=1
han hook run bun test  # Always shows full output
```

## Integration with Claude Code

Hooks run automatically at lifecycle events when configured in plugin `hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run bun test" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run typescript typecheck" }
        ]
      }
    ]
  }
}
```

### Hook Lifecycle

Han supports these Claude Code hook points:

| Hook | When It Fires | Checkpoint Type | Purpose |
|------|---------------|-----------------|---------|
| `SessionStart` | Claude Code session begins | Creates session checkpoint | Initialize session state |
| `SubagentStart` | Subagent is spawned | Creates agent checkpoint | Capture pre-subagent state |
| `UserPromptSubmit` | User submits a prompt | N/A | Pre-process user input |
| `PreToolUse` | Before each tool call | N/A | Validate tool usage |
| `PostToolUse` | After each tool call | N/A | Post-process tool results |
| `Stop` | Agent about to respond | Validates using session checkpoint | Validate all session changes |
| `SubagentStop` | Subagent completes | Validates using agent checkpoint | Validate subagent changes |
| `SessionEnd` | Session ends | N/A | Cleanup session state |

### Checkpoint Filtering

Hooks automatically filter what files they check based on when they run:

- **Stop hooks** validate against the session checkpoint (created at `SessionStart`)
  - Only checks files modified during the entire session
  - Use for session-wide validations (tests, builds, linting)

- **SubagentStop hooks** validate against the agent checkpoint (created at `SubagentStart`)
  - Only checks files modified by that specific subagent
  - Use for focused validations (type checking, unit tests)

This ensures hooks only validate relevant changes and skip unchanged files automatically.

## Learn More

- [Plugin Commands](/docs/cli/plugins) - Managing plugin installation
- [Configuration](/docs/configuration) - Configuring hook behavior
- [MCP Integrations](/docs/integrations) - How hooks integrate with MCP
