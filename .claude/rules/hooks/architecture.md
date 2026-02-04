# Hook Architecture: Claude Code + Han Integration

## Overview

Han's hook system is layered on top of Claude Code's native hooks. The **core plugin** acts as the bridge - it registers Claude Code hooks that call `han hook orchestrate`, which then runs hooks defined in `han-plugin.yml` across all enabled plugins.

## Architecture Summary

```
Claude Code Event (e.g., Stop)
    ↓
core/hooks/hooks.json
    ↓
"han hook orchestrate Stop"
    ↓
Reads han-plugin.yml from ALL enabled plugins
    ↓
Filters, resolves dependencies, caches
    ↓
Executes matching hooks
```

**Key principle:** Most plugins ONLY define hooks in `han-plugin.yml`. The orchestrator handles everything else.

## Claude Code Native Hooks

Claude Code's hook system uses `settings.json` or plugin `hooks/hooks.json`:

```json
{
  "hooks": {
    "EventType": [
      {
        "matcher": "optional-regex",
        "hooks": [
          {
            "type": "command",
            "command": "shell-command-here",
            "timeout": 30000
          }
        ]
      }
    ]
  }
}
```

**Native events:** SessionStart, SessionEnd, UserPromptSubmit, Stop, SubagentStart, SubagentStop, PreToolUse, PostToolUse, PreCompact, Notification, PermissionRequest

## Han Plugin Hooks (han-plugin.yml)

**This is where most plugin hooks are defined:**

```yaml
hooks:
  hook-name:
    event: Stop                    # Claude Code event(s) to trigger on
    command: bash hooks/script.sh  # Shell command to execute
    dirs_with: [package.json]      # Target directory markers
    if_changed: ["**/*.ts"]        # Cache patterns
    depends_on:                    # Hook dependencies
      - plugin: other-plugin
        hook: other-hook
```

The orchestrator reads these from ALL enabled plugins and handles:
- Event filtering
- Dependency resolution (topological sort)
- Caching (`if_changed` patterns)
- Checkpoint filtering (session/agent scope)
- Phase ordering (format → lint → typecheck → test)

## The Bridge: core/hooks/hooks.json

The **core plugin** is the ONLY plugin that needs `hooks/hooks.json` for standard orchestration:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "command": "han hook orchestrate SessionStart" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "command": "han hook orchestrate UserPromptSubmit" }] }],
    "Stop": [{ "hooks": [{ "command": "han hook orchestrate Stop --check --skip-if-questioning" }] }],
    "PreToolUse": [{ "hooks": [{ "command": "han hook orchestrate PreToolUse" }] }],
    "PostToolUse": [{ "hooks": [{ "command": "han hook orchestrate PostToolUse" }] }]
  }
}
```

## When Plugins Need hooks/hooks.json

**EXCEPTION:** Plugins use `hooks/hooks.json` directly (bypassing orchestrator) when they need to return **structured JSON** to Claude Code for:

1. **Permission decisions** (PreToolUse) - `permissionDecision: "allow" | "deny" | "ask"`
2. **Input modification** (PreToolUse) - `updatedInput: { ... }`
3. **Blocking decisions** (Stop/PostToolUse) - `decision: "block"`
4. **Context injection** - Direct control over output format

Example (from core's safe-operations.py):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Operation blocked: ..."
  }
}
```

The orchestrator aggregates text output but does NOT forward structured JSON responses. For structured responses, register directly in `hooks/hooks.json`.

## Bug Workaround: settings.json + dispatch (UserPromptSubmit/SessionStart ONLY)

Due to [Claude Code bug #12151](https://github.com/anthropics/claude-code/issues/12151), **only `UserPromptSubmit` and `SessionStart`** plugin hooks have their output silently discarded. The hooks execute, but stdout is not passed to the agent.

**Affected hooks:** `UserPromptSubmit`, `SessionStart`
**NOT affected:** `Stop`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, etc. (these work correctly from plugins)

**Workaround:** Define these specific hooks in `.claude/settings.json` that call `han hook dispatch`:

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "command": "han hook dispatch UserPromptSubmit" }] }],
    "SessionStart": [{ "hooks": [{ "command": "han hook dispatch SessionStart" }] }]
  }
}
```

This works because:
1. settings.json hooks DO pass output to the agent
2. `han hook dispatch` runs plugin hooks and outputs their content
3. That output flows through the working settings.json path

**CRITICAL:**
- `dispatch` exists ONLY for this workaround
- NEVER add other hooks (Stop, PreToolUse, PostToolUse, etc.) to settings.json
- All other hooks work correctly from plugin `hooks/hooks.json`

## Han Hook Commands

| Command | Purpose | Reads From |
|---------|---------|------------|
| `han hook orchestrate <event>` | **Primary** - Runs Han hooks with dependencies, caching, checkpoints | `han-plugin.yml` |
| `han hook dispatch <event>` | **Workaround for #12151** - runs plugin hooks via settings.json | `hooks/hooks.json` |
| `han hook run <plugin> <hook>` | Execute single Han hook directly | `han-plugin.yml` |
| `han hook context` | Output session context (ID, metrics, memory) | N/A |
| `han hook reference <file>` | Output markdown file content | File path |
| `han hook inject-subagent-context` | Aggregate SubagentPrompt hooks for Task/Skill tools | `han-plugin.yml` |

### orchestrate vs dispatch

| Feature | orchestrate | dispatch |
|---------|-------------|----------|
| **Hook type** | **Han hooks** | **Claude hooks** |
| **Reads from** | `han-plugin.yml` | `hooks/hooks.json` |
| Dependency resolution | Yes (topological sort) | No |
| Caching (`if_changed`) | Yes | No |
| Checkpoint filtering | Yes | No |
| Phase ordering | Yes | No |
| Event logging | Yes | No |
| **Use case** | Core plugin calls this | **Workaround for #12151 ONLY** |

**Key distinction:**
- **Han hooks** (`han-plugin.yml`) - Rich hook definitions with caching, dependencies, directory targeting
- **Claude hooks** (`hooks/hooks.json`) - Simple Claude Code format, executed directly by Claude Code or via dispatch

## File Locations

| File | Format | Purpose |
|------|--------|---------|
| `<plugin>/hooks/hooks.json` | Claude hooks | Claude Code plugin hooks (core's calls orchestrate) |
| `<plugin>/han-plugin.yml` | Han hooks | Rich hook definitions (read by orchestrate) |
| `.claude/settings.json` | Claude hooks | Workaround for #12151 (UserPromptSubmit/SessionStart only) |

## Stdin Payload

Claude Code passes context to hooks via stdin JSON:

```json
{
  "session_id": "abc123",
  "hook_event_name": "Stop",
  "cwd": "/project/path",
  "tool_name": "Bash",        // For PreToolUse/PostToolUse
  "tool_input": { ... },      // Tool arguments
  "agent_id": "xyz789",       // For Subagent events
  "agent_type": "Explore"     // Agent type
}
```

## Session ID Resolution Priority

When hooks need session ID:

1. **stdin payload** - Highest priority (from Claude Code)
2. `HAN_SESSION_ID` env var - Explicit override
3. `CLAUDE_SESSION_ID` env var - Fallback
4. Database active session lookup
5. Infer from most recent transcript file

## Common Issues

### "Hooks not firing"

1. Check `core@han` plugin is enabled in settings
2. Verify `core/hooks/hooks.json` exists and is valid
3. Run `han hook orchestrate <event> --verbose` manually to debug
4. Check for errors in stderr (toggle verbose mode with Ctrl+O in Claude Code)

### "dispatch finds no hooks"

`dispatch` runs Claude hooks from `hooks/hooks.json`. Most plugins only define Han hooks in `han-plugin.yml`. To run Han hooks, use `orchestrate` (which core's hooks.json already does).

### "Hook output not visible" (UserPromptSubmit/SessionStart only)

Claude Code bug #12151 affects **only `UserPromptSubmit` and `SessionStart`** plugin hooks - their output is silently discarded. All other hooks (Stop, PreToolUse, PostToolUse, etc.) work correctly from plugins.

**Workaround:** Add ONLY these two hooks to settings.json:
```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "command": "han hook dispatch UserPromptSubmit" }] }],
    "SessionStart": [{ "hooks": [{ "command": "han hook dispatch SessionStart" }] }]
  }
}
```

**NEVER add other hooks to settings.json** - they work correctly from plugins.

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────┐
│                      Claude Code                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  settings.json (ONLY for #12151 workaround)         │  │
│  │  → han hook dispatch UserPromptSubmit               │  │
│  │  → han hook dispatch SessionStart                   │  │
│  │  (NO other hooks belong here)                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  core/hooks/hooks.json (plugin hooks)               │  │
│  │  → han hook orchestrate <event>                     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────┐
│                    Han Orchestrator                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Reads han-plugin.yml from ALL enabled plugins       │  │
│  │ • Filters by event type                             │  │
│  │ • Resolves dependencies (topological sort)          │  │
│  │ • Applies caching (if_changed patterns)             │  │
│  │ • Executes in dependency order                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                              │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐     │
│  │ core/    │ │ biome/   │ │ typescript│ │ etc/     │     │
│  │han-plugin│ │han-plugin│ │han-plugin │ │han-plugin│     │
│  │  .yml    │ │  .yml    │ │  .yml     │ │  .yml    │     │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘     │
└───────────────────────────────────────────────────────────┘
```
