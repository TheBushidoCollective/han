# Hook Architecture: Direct Plugin Hooks

## Overview

Each Han plugin registers its own hooks directly with Claude Code via `hooks/hooks.json`. There is **no orchestration layer** - Claude Code executes plugin hooks directly.

## Architecture Summary

```
Claude Code Event (e.g., Stop)
    ↓
Claude Code finds matching hooks in enabled plugins
    ↓
Each plugin's hooks/hooks.json is executed directly
    ↓
Hook output returned to Claude Code
```

**Key principle:** Each plugin is responsible for its own hooks. No centralized orchestration.

## Plugin Hook Registration

Plugins register hooks in `hooks/hooks.json`:

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

## Hook Events

Claude Code provides these hook events (complete as of 2.1.63):

| Event | When Triggered | Matcher |
|-------|----------------|---------|
| `SessionStart` | When a Claude Code session begins | startup/resume/clear/compact |
| `UserPromptSubmit` | When user submits a prompt | No |
| `PreToolUse` | Before a tool is executed | tool name |
| `PermissionRequest` | When permission dialog appears | tool name |
| `PostToolUse` | After a tool is executed | tool name |
| `PostToolUseFailure` | When a tool execution fails | tool name |
| `Notification` | For notifications | notification type |
| `SubagentStart` | When a subagent (Agent) starts | agent type |
| `SubagentStop` | When a subagent completes | agent type |
| `Stop` | When Claude stops to allow validation | No |
| `TeammateIdle` | When a teammate goes idle | No |
| `TaskCompleted` | When a task is marked completed | No |
| `ConfigChange` | When configuration is modified | config source |
| `WorktreeCreate` | When a worktree is created | No |
| `WorktreeRemove` | When a worktree is removed | No |
| `PreCompact` | Before context compaction | manual/auto |
| `SessionEnd` | When a session ends | exit reason |

## Hook Types

### Command Hooks

Execute a shell command:

```json
{
  "type": "command",
  "command": "bash script.sh",
  "timeout": 30000
}
```

### Prompt Hooks

Return text directly to the agent:

```json
{
  "type": "prompt",
  "prompt": "Remember to follow coding standards."
}
```

### Agent Hooks

Spawn an agent to handle the event:

```json
{
  "type": "agent",
  "prompt": "Review the tool output for security issues. $ARGUMENTS"
}
```

### HTTP Hooks (2.1.63+)

POST JSON to a URL and receive JSON back:

```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks/stop",
  "timeout": 30,
  "headers": {
    "Authorization": "Bearer $MY_TOKEN"
  },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

HTTP hooks send the event's JSON input as the POST body. Response handling:
- 2xx with empty body: success (exit code 0 equivalent)
- 2xx with plain text: success, text added as context
- 2xx with JSON: parsed using same schema as command hooks
- Non-2xx / connection failure: non-blocking error

## Matchers

Filter hooks by tool name (for PreToolUse/PostToolUse):

```json
{
  "matcher": "Bash|Edit|Write",
  "hooks": [...]
}
```

## Core Plugin Hooks

The core plugin provides essential session hooks:

- **SessionStart**: Ensures coordinator is running, registers config, outputs context
- **UserPromptSubmit**: Outputs current datetime, references important rules
- **PreToolUse** (Agent|Task|Skill): Injects subagent context

## Validation Plugin Hooks

Validation plugins (biome, eslint, etc.) register Stop hooks:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @biomejs/biome check --write --error-on-warnings .",
            "timeout": 60000
          }
        ]
      }
    ]
  }
}
```

## Structured Responses

For PreToolUse hooks that need to allow/deny/modify tool calls:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Operation blocked: reason here"
  }
}
```

For input modification (DO NOT include permissionDecision):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "updatedInput": {
      "prompt": "Modified prompt here"
    }
  }
}
```

## File Locations

| File | Purpose |
|------|---------|
| `<plugin>/hooks/hooks.json` | Plugin hook definitions for Claude Code |
| `<plugin>/han-plugin.yml` | Plugin metadata (skills, MCP servers, etc.) - NOT for hooks |

## Stdin Payload

Claude Code passes context to hooks via stdin JSON:

```json
{
  "session_id": "abc123",
  "hook_event_name": "Stop",
  "cwd": "/project/path",
  "tool_name": "Bash",
  "tool_input": { ... }
}
```

## Common Patterns

### Validation on Stop

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npm run lint" }
        ]
      }
    ]
  }
}
```

### Context Injection on SessionStart

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "cat context.md" }
        ]
      }
    ]
  }
}
```

### Tool Filtering on PostToolUse

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npx biome check ${HAN_FILES}" }
        ]
      }
    ]
  }
}
```

## Deprecated

The following are **no longer used**:

- `han hook orchestrate` - Removed
- `han hook dispatch` - Removed
- `han-plugin.yml` hooks section - Not used for hooks
- Centralized hook orchestration - Each plugin handles its own
