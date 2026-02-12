---
name: hook-system
summary: Complete hook lifecycle from definition to execution with direct plugin registration and cross-plugin dependencies
---

# Hook System

Complete hook lifecycle from definition to execution.

## Overview

The Han hook system integrates with Claude Code to execute hooks at specific lifecycle events. Each plugin registers its own hooks directly with Claude Code via `hooks/hooks.json`. There is no centralized orchestration layer - Claude Code executes plugin hooks directly.

## Architecture

### Direct Plugin Registration Model

```
Plugin defines hooks in hooks/hooks.json
    ↓
Claude Code discovers hooks from enabled plugins
    ↓
Claude Code fires event (e.g., Stop)
    ↓
Claude Code executes matching hooks directly
    ↓
Hook output returned to Claude Code
```

**Key Principle:** Each plugin is responsible for its own hooks. No centralized orchestration.

### Hook Types (Claude Code Events)

- `SessionStart` - When Claude Code session begins
- `SessionEnd` - When session ends
- `UserPromptSubmit` - When user submits a prompt
- `Stop` - When Claude completes a response
- `SubagentStart` - When a subagent starts
- `SubagentStop` - When a subagent completes
- `PreToolUse` / `PostToolUse` - Around tool execution
- `Notification` - For notifications
- `PreCompact` - Before context compaction

### Components

```
<plugin>/hooks/hooks.json    Plugin hook definitions for Claude Code
    ↓
han-plugin.yml               Plugin metadata (skills, MCP servers, etc.)
    ↓
validate.ts                  Execution with caching + checkpoint filtering
    ↓
checkpoint.ts                Session/agent checkpoint management
```

## Stdin Payload

Claude Code provides a JSON payload on stdin with context about the current event:

```typescript
interface HookPayload {
  session_id?: string;      // Session identifier
  hook_event_name?: string; // Event type being fired
  agent_id?: string;        // For subagent events
  agent_type?: string;      // Type of agent
  tool_name?: string;       // For PreToolUse/PostToolUse
}
```

## Configuration

### Plugin Hook Definition (hooks/hooks.json)

Hooks are defined in each plugin's `hooks/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @biomejs/biome check --write .",
            "timeout": 60000
          }
        ]
      }
    ]
  }
}
```

### User Settings Precedence

Configuration is loaded from multiple files with increasing priority:

```
~/.claude/han.yml         # Global user defaults (lowest)
.claude/han.yml           # Project team settings
.claude/han.local.yml     # Personal project settings (gitignored)
./han.yml                 # Project root config
<dir>/han.yml             # Directory-specific (highest)
```

### User Override Format (han.yml)

Users can override plugin hook settings:

```yaml
hooks:
  enabled: true
  checkpoints: true

plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
        command: "npx biome check --write ."
        if_changed:
          - "**/*.{js,ts,tsx}"
        idle_timeout: 30000
        before_all: "npm run codegen"  # Runs once before all directories
```

## Execution Model

### Execution Flow per Hook

1. **Check user overrides** - Skip if `enabled: false`
2. **Check cache** - Skip if no files matching `if_changed` have changed
3. **Check checkpoint** - Skip if no changes since session/agent start
4. **Run before_all** - Execute once before all directory iterations (if configured)
5. **Execute command** - Run hook in each target directory
6. **Update cache** - Track files on success
7. **Log events** - Write hook_run and hook_result to event log

### Event Logging

Each hook execution logs events to the session's JSONL file:

- `hook_run` - When a hook starts executing
- `hook_result` - When a hook completes (success or failure)

```typescript
logger.logHookRun(plugin, hookName, directory, cached);
logger.logHookResult(plugin, hookName, directory, cached, duration, exitCode, success, output, error);
```

## Checkpoint System

Checkpoints capture file state at session/agent start to scope hook execution to only files changed during the current session.

### Checkpoint Flow

```
SessionStart:
  1. Collect all if_changed patterns from enabled plugins
  2. Hash all matching files
  3. Save checkpoint to checkpoints/session-{id}.json

Stop/SubagentStop:
  1. Load session/agent checkpoint
  2. For each directory:
     - Check cache: changed since last hook run?
     - Check checkpoint: changed since session/agent start?
     - Run only if BOTH conditions are true
```

## CLI Commands

### `han hook run <plugin> <hook> [options]`

Execute a single plugin hook (for manual/debugging use):

**Options:**

- `--cached` - Only run if files changed
- `--only <dir>` - Limit to specific directory
- `--verbose` - Show detailed output
- `--skip-deps` - Skip dependency resolution

### `han hook dispatch <hookType>`

Legacy dispatch command (still works for backwards compatibility).

## Environment Variables

**Provided to hooks:**

- `CLAUDE_PLUGIN_ROOT` - Plugin directory path
- `CLAUDE_PROJECT_DIR` - Current project root
- `HAN_SESSION_ID` - Session identifier

**Configuration:**

- `HAN_DISABLE_HOOKS` - When "true" or "1", all hooks exit silently
- `HAN_DEBUG` - Enable debug output

## Exit Codes

- `0` - All hooks passed (or skipped)
- `2` - One or more hooks failed

## Files

- `lib/commands/hook/dispatch.ts` - Legacy hook dispatch
- `lib/commands/hook/run.ts` - Single hook execution command
- `lib/hook-config.ts` - Configuration with event field support
- `lib/validate.ts` - Core execution logic with checkpoint filtering
- `lib/checkpoint.ts` - Checkpoint capture and comparison

## Related Systems

- [Checkpoint System](./checkpoint-system.md) - Session/agent checkpoint management
- [Settings Management](./settings-management.md) - Plugin discovery
- [MCP Server](./mcp-server.md) - Exposes hooks as MCP tools
