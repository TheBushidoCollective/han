---
name: hook-system
summary: Complete hook lifecycle from definition to execution
---

# Hook System

Complete hook lifecycle from definition to execution.

## Overview

The Han hook system integrates with Claude Code to execute hooks at specific lifecycle events. It supports two parallel mechanisms:

1. **Plugin hooks.json** - Claude Code event-based hooks (Stop, UserPromptSubmit, etc.)
2. **Plugin han-config.json** - Directory-targeted validation hooks with caching

## Architecture

### Hook Types

**Claude Code Event Hooks:**

- `SessionStart` - When Claude Code session begins
- `SessionEnd` - When session ends
- `UserPromptSubmit` - When user submits a prompt
- `Stop` - When Claude completes a response
- `SubagentStop` - When a subagent completes
- `PreToolUse` / `PostToolUse` - Around tool execution
- `Notification` - For notifications
- `PreCompact` - Before context compaction

**Han Validation Hooks:**

- Defined in `han-config.json`
- Target specific directories based on marker files
- Support caching for performance

### Components

```
hooks.json                 Claude Code integration
    ↓
hook/dispatch.ts           Aggregates plugin hooks
    ↓
han-config.json            Plugin hook definitions
    ↓
hook/run.ts                Executes in directories
    ↓
validate.ts                Execution with caching
```

## API / Interface

### hooks.json Format

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook run plugin-name hook-name",
            "timeout": 120
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Remember to follow best practices..."
          }
        ]
      }
    ]
  }
}
```

**Hook Entry Properties:**

- `type` - `"command"` (execute) or `"prompt"` (output text)
- `command` - Shell command (supports `${CLAUDE_PLUGIN_ROOT}`)
- `prompt` - Static text for prompt hooks
- `timeout` - Execution timeout in seconds (default: 30000)

### han-config.json Format

```json
{
  "hooks": {
    "lint": {
      "command": "npx -y biome check --write",
      "dirsWith": ["biome.json"],
      "ifChanged": ["**/*.{js,ts}"],
      "idleTimeout": 5000
    }
  }
}
```

**Properties:**

- `command` (required) - Shell command to execute
- `dirsWith` (optional) - Marker files for target directories
- `dirTest` (optional) - Command to filter directories (exit 0 = include)
- `ifChanged` (optional) - Glob patterns for cache-based execution
- `idleTimeout` (optional) - Max idle time before timeout

### han-config.yml (User Overrides)

```yaml
plugin-name:
  hook-name:
    enabled: true
    command: "custom command"
    if_changed:
      - "custom/**/*.ts"
    idle_timeout: 60000
```

### CLI Commands

#### `han hook run <plugin> <hook> [options]`

Execute a plugin hook in matching directories.

**Options:**

- `--fail-fast` - Stop on first failure
- `--cached` - Only run if files changed
- `--only <dir>` - Limit to specific directory
- `--verbose` - Show detailed output

#### `han hook dispatch <hookType>`

Dispatch Claude Code hooks across all enabled plugins.

#### `han hook verify <hookType>`

Verify that all hooks of a specific type have been run and are cached.

**Behavior**:

- Exits 0 if all hooks with `ifChanged` patterns are cached
- Exits non-zero if any hooks are stale or need to be run
- Hooks without `ifChanged` patterns are always considered valid

**Example**:

```bash
han hook verify Stop
```

## Behavior

### Hook Dispatch Flow

```
1. Read stdin JSON payload (session_id)
2. Get merged plugins and marketplaces
3. For each enabled plugin:
   a. Load hooks.json
   b. Find matching hook type
   c. Execute command hooks (capture output)
   d. Collect prompt hooks
4. Output aggregated results to stdout
```

### Hook Execution Flow

```
1. Load plugin han-config.json
2. Discover target directories (dirsWith markers)
3. For each directory:
   a. Check cache (if --cached)
   b. Load user overrides (han-config.yml)
   c. Acquire execution slot
   d. Execute command with environment
   e. Monitor for idle timeout
   f. Update cache on success
4. Report results
```

### Caching

Cache location: `~/.claude/projects/{project-slug}/han/`

**Change Detection:**

1. Expand glob patterns against directory
2. Compute SHA256 hash for each file
3. Compare against cached manifest
4. Run hook only if changes detected

**Automatic Patterns:**

- Always includes `han-config.yml` and `han-config.json`
- Plugin files tracked separately

### Parallelism

- Slot-based concurrency (default: CPU count / 2)
- Lock files in `/tmp/han-hooks/{session}/`
- Cross-process failure signaling via sentinel files

### Environment Variables

**Provided to hooks:**

- `CLAUDE_PLUGIN_ROOT` - Plugin directory path
- `CLAUDE_PROJECT_DIR` - Current project root
- `HAN_SESSION_ID` - Session identifier

**Configuration:**

- `HAN_DISABLE_HOOKS` - When set to "true" or "1", all hook commands exit 0 silently without executing
- `HAN_HOOK_PARALLELISM` - Max concurrent hooks
- `HAN_HOOK_LOCK_TIMEOUT` - Stale lock timeout
- `HAN_DEBUG` - Enable debug output

## Files

- `lib/commands/hook/dispatch.ts` - Claude Code hook dispatch
- `lib/commands/hook/run.ts` - Hook execution command
- `lib/commands/hook/verify.ts` - Hook cache verification
- `lib/validate.ts` - Core execution logic
- `lib/hook-config.ts` - Configuration loading
- `lib/hook-cache.ts` - Cache management
- `lib/hook-lock.ts` - Parallelism control
- `bushido/hooks/pre-push-check.sh` - Pre-push verification script

## Pre-Push Verification

The bushido plugin includes a PreToolUse hook that automatically verifies Stop hooks before git push:

**Flow**:

1. User runs `git push`
2. PreToolUse hook detects the command
3. Runs `han hook verify Stop` to check if hooks are cached
4. If hooks are stale:
   - Automatically runs `han hook dispatch Stop`
   - Waits for hooks to complete
   - Proceeds with push if successful
   - Blocks push if hooks fail
5. If hooks are cached, proceeds immediately

**Script**: `bushido/hooks/pre-push-check.sh`

This ensures code quality checks (tests, linting, etc.) always run before pushing to remote.

## Related Systems

- [Settings Management](./settings-management.md) - Plugin discovery
- [MCP Server](./mcp-server.md) - Exposes hooks as MCP tools
