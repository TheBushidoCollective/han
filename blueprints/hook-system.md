---
name: hook-system
summary: Complete hook lifecycle from definition to execution with centralized orchestration and cross-plugin dependencies
---

# Hook System

Complete hook lifecycle from definition to execution.

## Overview

The Han hook system integrates with Claude Code to execute hooks at specific lifecycle events. The system uses a **centralized orchestration** architecture where the core plugin handles all hook coordination.

## Architecture

### Orchestration Model

```
Claude Code fires Stop event
    ↓
core/hooks.json registers "han hook orchestrate Stop"
    ↓
orchestrate.ts discovers all installed plugins
    ↓
Loads han-plugin.yml from each plugin
    ↓
Filters hooks by event field
    ↓
Resolves dependencies (topological sort)
    ↓
Executes hooks with p-limit concurrency control
    ↓
Returns aggregated output
```

**Key Benefits:**

- Single coordination point (no distributed locking)
- Intelligent scheduling with dependency resolution
- Controlled parallelism via p-limit (CPU count / 2)
- Consistent behavior across all event types

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
core/hooks.json            Registers orchestrate for each event
    ↓
hook/orchestrate.ts        Central orchestration engine
    ↓
han-plugin.yml             Plugin hook definitions with event binding
    ↓
validate.ts                Execution with caching + checkpoint filtering
    ↓
checkpoint.ts              Session/agent checkpoint management
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

### Plugin Hook Definition (han-plugin.yml)

Hooks are defined in each plugin's `han-plugin.yml` with an `event` field specifying which Claude Code events trigger the hook:

```yaml
hooks:
  lint:
    event: [Stop, SubagentStop]  # Runs on both main session and subagent stops
    command: "npx -y biome check --write"
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,ts}"
    tip: "Use the `jutsu_biome_lint` MCP tool before marking complete."

  pre-edit-check:
    event: PreToolUse
    tool_filter: [Edit, Write]  # Only for Edit and Write tools
    command: "han hook run core validate-edit"
```

**Event Field:**

- Single event: `event: Stop`
- Multiple events: `event: [Stop, SubagentStop]`
- Default (if omitted): `[Stop, SubagentStop]` for backwards compatibility

**Hook Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event` | string \| string[] | No | Claude Code event(s). Default: `[Stop, SubagentStop]` |
| `command` | string | Yes | Shell command to execute |
| `tool_filter` | string[] | No | For PreToolUse/PostToolUse, filter by tool names |
| `dirs_with` | string[] | No | Marker files for target directories |
| `dir_test` | string | No | Command to filter directories (exit 0 = include) |
| `if_changed` | string[] | No | Glob patterns for cache-based execution |
| `idle_timeout` | number | No | Max idle time before timeout (ms) |
| `description` | string | No | Human-readable description |
| `tip` | string | No | Guidance when hook fails repeatedly |
| `depends_on` | HookDependency[] | No | Array of hook dependencies |

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

## Hook Dependencies

Hooks can declare dependencies on other plugin hooks:

```yaml
hooks:
  test:
    event: [Stop, SubagentStop]
    command: "npx playwright test"
    dirs_with: ["playwright.config.ts"]
    depends_on:
      - plugin: jutsu-playwright-bdd
        hook: generate
        optional: true  # Don't fail if plugin not installed
```

**Resolution:**

- Dependencies are resolved via topological sort (Kahn's algorithm)
- Hooks are grouped into batches that can run in parallel
- Each batch waits for the previous batch to complete
- Circular dependencies are detected and reported as errors

## Execution Model

### Concurrency

The orchestrator uses `p-limit` for controlled parallelism:

```typescript
const concurrency = Math.max(1, Math.floor(cpus().length / 2));
const limit = pLimit(concurrency);
```

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

Stop/SubagentStop (via orchestrate):
  1. Load session/agent checkpoint
  2. For each directory:
     - Check cache: changed since last hook run?
     - Check checkpoint: changed since session/agent start?
     - Run only if BOTH conditions are true
```

## CLI Commands

### `han hook orchestrate <eventType>`

Central orchestration command called by Claude Code via core's hooks.json:

```bash
han hook orchestrate Stop
han hook orchestrate SubagentStop
han hook orchestrate PreToolUse
```

**Options:**

- `--no-cache` - Disable caching, force all hooks to run
- `--no-checkpoints` - Disable checkpoint filtering
- `-v, --verbose` - Show detailed execution output

### `han hook run <plugin> <hook> [options]`

Execute a single plugin hook (for manual/debugging use):

**Options:**

- `--fail-fast` - Stop on first failure
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

- `lib/commands/hook/orchestrate.ts` - **Central orchestration engine**
- `lib/commands/hook/dispatch.ts` - Legacy hook dispatch
- `lib/commands/hook/run.ts` - Single hook execution command
- `lib/hook-config.ts` - Configuration with event field support
- `lib/validate.ts` - Core execution logic with checkpoint filtering
- `lib/checkpoint.ts` - Checkpoint capture and comparison
- `core/hooks/hooks.json` - Registers orchestrate for all event types

## Migration from Distributed Hooks

Previously, each plugin had a `hooks/hooks.json` that registered directly with Claude Code. The new architecture:

1. **Core registers all event types** via its hooks.json
2. **Plugins define hooks in han-plugin.yml** with an `event` field
3. **Orchestrator discovers and coordinates** all plugins

Benefits:

- No distributed locking needed
- Dependencies resolved upfront via topological sort
- Single place for parallelism control (p-limit)
- Consistent behavior across all event types

### Migration Steps for Plugins

To migrate a plugin from `hooks/hooks.json` to `han-plugin.yml`:

1. **Create han-plugin.yml** at plugin root
2. **Convert each hook**:

   ```yaml
   # Old: hooks/hooks.json
   { "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "..." }] }] } }
   
   # New: han-plugin.yml
   hooks:
     hook-name:
       event: Stop
       command: "..."
   ```

3. **Add metadata**: `description`, `tip`, `if_changed`
4. **Set event field** explicitly for non-Stop hooks
5. **Remove hooks/hooks.json** (no longer needed)

## Related Systems

- [Settings Management](./settings-management.md) - Plugin discovery
- [MCP Server](./mcp-server.md) - Exposes hooks as MCP tools
