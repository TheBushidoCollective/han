---
name: hook-system
summary: Direct plugin hook execution via Claude Code with no centralized orchestration
---

# Hook System

Direct plugin hook execution via Claude Code with no centralized orchestration.

## Overview

The Han hook system integrates with Claude Code by having each plugin register its own hooks directly via `hooks/hooks.json`. There is **no centralized orchestration layer** - Claude Code executes plugin hooks directly when events occur.

## Architecture

### Direct Execution Model

```
Claude Code Event (e.g., Stop)
    ↓
Claude Code discovers all enabled plugins
    ↓
For each plugin with matching hooks/hooks.json:
    ↓
Claude Code executes the hook directly
    ↓
Hook output returned to Claude Code
```

**Key principle:** Each plugin is responsible for its own hooks. No centralized coordination.

### Why This Architecture?

1. **Simplicity** - No middleware layer to maintain
2. **Performance** - Direct execution, no IPC overhead
3. **Reliability** - Fewer moving parts, fewer failure modes
4. **Transparency** - Hook behavior is local to each plugin
5. **Claude Code native** - Uses built-in hook system as designed

## Hook Events

Claude Code provides these lifecycle events:

| Event | When Triggered | Common Use Cases |
|-------|----------------|------------------|
| `SessionStart` | When a Claude Code session begins | Setup, context injection, daemon startup |
| `SessionEnd` | When a session ends | Cleanup, reporting |
| `UserPromptSubmit` | When user submits a prompt | Current time, reminders, context updates |
| `Stop` | When Claude stops (before returning to user) | Validation, linting, testing |
| `PreToolUse` | Before a tool is executed | Permission checks, input modification, context injection |
| `PostToolUse` | After a tool is executed | Incremental validation, async tasks |
| `SubagentStart` | When a subagent (Task) starts | Subagent setup |
| `SubagentStop` | When a subagent completes | Subagent validation |
| `PreCompact` | Before context compaction | Save state before compaction |
| `Notification` | For notifications | User alerts |
| `Setup` | When plugin is first installed | Auto-install, configuration wizard |

## Hook Registration

### File Structure

Each plugin registers hooks via `hooks/hooks.json`:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json          # Hook registration for Claude Code
│   └── script.sh           # Hook implementation scripts
├── han-plugin.yml          # Plugin metadata (NOT for hook registration)
└── README.md
```

### Registration Format (hooks/hooks.json)

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
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "han hook run biome lint --async"
          }
        ],
        "async": true
      }
    ]
  }
}
```

### Hook Types

#### Command Hooks

Execute a shell command and return stdout:

```json
{
  "type": "command",
  "command": "bash script.sh",
  "timeout": 30000
}
```

**Environment variables available:**
- `CLAUDE_PLUGIN_ROOT` - Plugin directory path
- `CLAUDE_PROJECT_DIR` - Current project root
- `HAN_SESSION_ID` - Session identifier
- `CLAUDE_SESSION_ID` - Claude session ID (fallback)

#### Prompt Hooks

Return text directly to the agent (no command execution):

```json
{
  "type": "prompt",
  "prompt": "Remember to follow coding standards."
}
```

### Matchers (PreToolUse/PostToolUse)

Filter hooks by tool name using regex-style patterns:

```json
{
  "matcher": "Edit|Write|NotebookEdit",
  "hooks": [...]
}
```

Common patterns:
- `"Edit|Write"` - File editing operations
- `"Task|Skill"` - Subagent invocations
- `"Bash"` - Shell commands

### Async Flag (PostToolUse only)

Mark hooks as async to run in background (experimental):

```json
{
  "hooks": [...],
  "async": true
}
```

**Note:** Async hooks run after Claude Code continues, so they cannot block or modify behavior.

## Stdin Payload

Claude Code passes context to hook commands via stdin JSON:

```json
{
  "session_id": "abc123",
  "hook_event_name": "Stop",
  "cwd": "/project/path",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**Fields:**
- `session_id` - Current session identifier
- `hook_event_name` - Event type (Stop, PreToolUse, etc.)
- `cwd` - Working directory
- `tool_name` - Tool being used (for PreToolUse/PostToolUse)
- `tool_input` - Tool arguments (for PreToolUse/PostToolUse)
- `agent_id` - For SubagentStart/SubagentStop
- `agent_type` - Subagent type

## Hook Implementation Patterns

### Pattern 1: Direct Command Execution

Simple validation that runs directly:

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

### Pattern 2: Delegating to han hook run

For hooks that need caching, directory filtering, and smart execution:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook run biome lint --async"
          }
        ],
        "async": true
      }
    ]
  }
}
```

**Benefits of `han hook run`:**
- Caching based on `if_changed` patterns
- Directory filtering via `dirs_with` and `dir_test`
- HAN_FILES substitution for modified files
- Event logging to JSONL
- Checkpoint filtering (session-scoped)

### Pattern 3: Context Injection (SessionStart)

Provide context to the agent at session start:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook context",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Pattern 4: Tool Filtering (PreToolUse/PostToolUse)

Run only for specific tools:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task|Skill",
        "hooks": [
          {
            "type": "command",
            "command": "han hook inject-subagent-context",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "han hook run biome lint --async"
          }
        ],
        "async": true
      }
    ]
  }
}
```

## Han Hook Run (Smart Execution)

The `han hook run` command provides intelligent hook execution with caching, directory filtering, and event logging. It reads configuration from `han-plugin.yml`.

### Configuration (han-plugin.yml)

```yaml
hooks:
  lint:
    event: [Stop, PostToolUse:Edit|Write|NotebookEdit]
    command: "npx -y @biomejs/biome check --write --error-on-warnings ${HAN_FILES}"
    dir_test: '[ "$(cat biome.json | han parse json root)" != "false" ]'
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,jsx,ts,tsx,json,jsonc}"
    idle_timeout: 60000
    description: "Run Biome linter and formatter"
```

**Configuration Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `event` | string \| string[] | Event types (for documentation only) |
| `command` | string | Shell command to execute |
| `dirs_with` | string[] | Run only in dirs containing these files |
| `dir_test` | string | Shell command to filter dirs (exit 0 = include) |
| `if_changed` | string[] | Glob patterns for cache checking |
| `idle_timeout` | number | Max idle time before timeout (ms) |
| `description` | string | Human-readable description |

### HAN_FILES Substitution

The special `${HAN_FILES}` variable is replaced with modified files from the current session:

```yaml
command: "npx biome check --write ${HAN_FILES}"
```

**Expands to:**
```bash
npx biome check --write src/file1.ts src/file2.ts
```

**Benefits:**
- Faster validation (only changed files)
- Incremental feedback
- Works with PostToolUse for immediate validation

### Usage

```bash
# Run hook with defaults
han hook run biome lint

# Disable caching (force re-run)
han hook run biome lint --no-cache

# Run only in specific directory
han hook run biome lint --only packages/han

# Async execution (background)
han hook run biome lint --async
```

### Caching

Hooks with `if_changed` patterns are cached based on file hashes:

1. Before execution: Hash files matching `if_changed`
2. Check cache: Compare against last successful run
3. Skip if no changes detected
4. On success: Update cache with new hashes

**Cache location:** `~/.han/cache/<plugin>/<hook>/`

**Override:** `--no-cache` flag forces execution

### Event Logging

`han hook run` logs execution to the session's JSONL file:

```jsonl
{"type":"hook_run","plugin":"biome","hook":"lint","directory":".","cached":false,...}
{"type":"hook_result","plugin":"biome","hook":"lint","success":true,"duration":1234,...}
```

**Visible in:** Browse UI hook timeline

## Structured Responses (PreToolUse)

PreToolUse hooks can return structured JSON to control tool execution:

### Allow/Deny Tool Usage

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Operation blocked: sensitive file modification"
  }
}
```

### Modify Tool Input

**CRITICAL:** Do NOT set `permissionDecision` when using `updatedInput` (see `.claude/rules/hooks/pretooluse-updatedinput.md`):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "updatedInput": {
      "prompt": "Modified prompt with additional context"
    }
  }
}
```

## Core Plugin Hooks

The core plugin (`plugins/core/`) provides essential infrastructure hooks:

### SessionStart Hooks

1. **ensure-han.sh** - Verify han binary is installed
2. **han coordinator ensure** - Start coordinator daemon
3. **han plugin migrate** - Migrate old plugin names
4. **register-config-dir.sh** - Register project with coordinator
5. **han hook context** - Output session context
6. **session-references.sh** - Reference critical rules

### UserPromptSubmit Hooks

1. **current-datetime.sh** - Output current date/time
2. **han hook reference** - Reference important rules

### PreToolUse Hooks

1. **han hook inject-subagent-context** - Inject context into Task/Skill tools

## Validation Plugin Hooks

Validation plugins (biome, eslint, prettier, etc.) register Stop hooks to run after Claude completes:

**Example:** `plugins/validation/biome/hooks/hooks.json`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook run biome lint --async"
          }
        ],
        "async": true
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "han hook run biome lint --async"
          }
        ],
        "async": true
      }
    ]
  }
}
```

**Corresponding han-plugin.yml:**

```yaml
hooks:
  lint:
    event: [Stop, PostToolUse:Edit|Write|NotebookEdit]
    command: "npx -y @biomejs/biome check --write --error-on-warnings ${HAN_FILES}"
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,jsx,ts,tsx,json,jsonc}"
```

## User Overrides (han.yml)

Users can override plugin hook behavior in `han.yml` files:

```yaml
# Disable all hooks
hooks:
  enabled: false

# Disable specific plugin
plugins:
  biome:
    enabled: false

# Override hook configuration
plugins:
  biome:
    hooks:
      lint:
        enabled: true
        command: "npx biome check --write ."
        if_changed:
          - "**/*.{js,ts,tsx}"
        idle_timeout: 30000
```

### Configuration Precedence

Multiple `han.yml` files merge with increasing priority:

```
~/.claude/han.yml          # Global user defaults (lowest)
.claude/han.yml            # Project team settings
.claude/han.local.yml      # Personal project overrides (gitignored)
./han.yml                  # Project root
<dir>/han.yml              # Directory-specific (highest)
```

## Exit Codes

Hooks should follow standard Unix exit codes:

- `0` - Success (validation passed, no changes needed)
- `1` - Failure (validation failed, errors found)
- `2` - Critical error (tool not found, invalid config)
- `127` - Command not found

**Claude Code behavior:**
- Exit 0: Hook passes, continue
- Non-zero: Hook fails, show error to agent

## Removed Features

The following features were removed when migrating from centralized orchestration:

### ❌ Removed: Centralized Orchestration

- **Old:** `han hook orchestrate Stop` discovered and coordinated all plugins
- **New:** Each plugin's hooks.json is executed directly by Claude Code

### ❌ Removed: Dependency Resolution

- **Old:** Hooks could declare `depends_on` for cross-plugin dependencies
- **New:** Dependencies must be handled within individual hook scripts

### ❌ Removed: Checkpoint Filtering (at orchestration level)

- **Old:** Orchestrator filtered hooks based on session checkpoints
- **New:** Individual hooks can still use checkpoint logic via `han hook run`

### ❌ Removed: Parallel Execution Control

- **Old:** Orchestrator used p-limit for controlled concurrency
- **New:** Claude Code handles hook execution scheduling

### ❌ Removed: before_all

- **Old:** Run command once before all directory iterations
- **New:** Hooks must handle setup within their own scripts

## Files

| File | Purpose |
|------|---------|
| `<plugin>/hooks/hooks.json` | Hook registration for Claude Code |
| `<plugin>/han-plugin.yml` | Plugin metadata and hook configuration |
| `packages/han/lib/commands/hook/run.ts` | Smart hook execution with caching |
| `packages/han/lib/hook-runner.ts` | Hook execution logic |
| `packages/han/lib/events/logger.ts` | Event logging to JSONL |

## Related Systems

- [Checkpoint System](./checkpoint-system.md) - Session/agent checkpoint management
- [Han Events Logging](./han-events-logging.md) - JSONL event logging
- [Settings Management](./settings-management.md) - Plugin configuration and overrides
- [Plugin Installation](./plugin-installation.md) - Setup hooks and auto-installation