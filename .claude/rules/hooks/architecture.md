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

Claude Code provides these hook events:

| Event | When Triggered |
|-------|----------------|
| `SessionStart` | When a Claude Code session begins |
| `SessionEnd` | When a session ends |
| `UserPromptSubmit` | When user submits a prompt |
| `Stop` | When Claude stops to allow validation |
| `PreToolUse` | Before a tool is executed |
| `PostToolUse` | After a tool is executed |
| `SubagentStart` | When a subagent (Task) starts |
| `SubagentStop` | When a subagent completes |
| `PreCompact` | Before context compaction |
| `Notification` | For notifications |

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
- **PreToolUse** (Task|Skill): Injects subagent context

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
