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
han hook run <plugin-name> <hook-name> --cache --verbose

# Legacy format: Run custom command across directories
han hook run --dirs-with <file> -- <command>
```

### Options

| Option | Description |
|--------|-------------|
| `--cache` | Use cached results (skip if files unchanged since last run) |
| `--verbose` | Show full command output in real-time |
| `--directory <path>` | Limit execution to specific directory |
| `--fail-fast` | Stop on first failure |
| `--checkpoint-type <type>` | Filter against checkpoint type (`session` or `agent`) |
| `--checkpoint-id <id>` | Filter against specific checkpoint ID |

**Legacy options:**

| Option | Description |
|--------|-------------|
| `--dirs-with <file>` | Only run in directories containing the specified file |
| `--test-dir <command>` | Only include directories where this command exits 0 |

### Caching Behavior

When `--cache` is enabled (or via `--cached`):

1. Han creates a checkpoint with file modification times
2. On subsequent runs, compares current file times to checkpoint
3. Skips execution if no files have changed
4. Clears checkpoint on failure (ensures retry on next run)

Checkpoints are session-scoped by default, meaning they're cleared when the Claude Code session ends.

### Examples

```bash
# Run Bun tests with caching
han hook run jutsu-bun test --cache

# Run TypeScript type checking verbosely
han hook run jutsu-typescript typecheck --verbose

# Run Biome lint in specific directory
han hook run jutsu-biome lint --directory packages/core

# Legacy: Run npm test in directories with package.json
han hook run --dirs-with package.json -- npm test
```

### Plugin Hook Configuration

Hooks are defined in plugin `han-plugin.yml` files:

```yaml
hooks:
  test:
    command: bun test --only-failures
    dirsWith: [bun.lock, bun.lockb]
    description: Run Bun tests
    ifChanged: ["**/*.ts", "**/*.test.ts"]
```

When you run `han hook run jutsu-bun test`, Han:

1. Finds directories containing `bun.lock` or `bun.lockb`
2. Checks if files matching `**/*.ts` or `**/*.test.ts` have changed (if `--cache` enabled)
3. Runs `bun test --only-failures` in each directory
4. Records the result and updates checkpoints

## `han hook list`

List available hooks from installed plugins.

### Usage

```bash
# List all available hooks
han hook list

# Filter by plugin
han hook list --plugin jutsu-bun

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

  jutsu-bun:
    test - Run Bun tests
    build - Build the Bun project

  jutsu-typescript:
    typecheck - Type-check TypeScript code for type errors

  jutsu-biome:
    lint - Lint Biome code for issues and style violations
```

### Examples

```bash
# List all hooks
han hook list

# List only Bun hooks
han hook list --plugin jutsu-bun

# Get JSON output for scripting
han hook list --json | jq '.[] | select(.plugin == "jutsu-bun")'
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
han hook run jutsu-bun test
```

Output:

```
Hook: jutsu-bun/test

Description: Run Bun tests

Command: bun test --only-failures

Directories: Runs in directories containing:
  - bun.lock
  - bun.lockb

File Patterns: Triggers when these files change:
  - **/*.ts
  - **/*.test.ts

Cache: Enabled by default (use --cache to enable)

Usage:
  han hook run jutsu-bun test
  han hook run jutsu-bun test --cache
  han hook run jutsu-bun test --verbose --directory packages/core
```

## `han hook verify`

Verify hook configuration for all installed plugins.

### Usage

```bash
# Verify all plugin hooks
han hook verify

# Verify specific plugin
han hook verify --plugin jutsu-bun
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
han hook run jutsu-bun test  # Exits immediately without running

# Enable verbose output globally
export HAN_HOOK_RUN_VERBOSE=1
han hook run jutsu-bun test  # Always shows full output
```

## Integration with Claude Code

Hooks run automatically at session boundaries when configured in plugin `hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run jutsu-bun test --cache" }
        ]
      }
    ]
  }
}
```

This runs `han hook run jutsu-bun test --cache` when the Claude Code session ends, validating all changes before commit.

## Learn More

- [Plugin Commands](/docs/cli/plugins) - Managing plugin installation
- [Configuration](/docs/configuration) - Configuring hook behavior
- [MCP Integrations](/docs/integrations) - How hooks integrate with MCP
