---
title: "Using Han with Codex CLI"
description: "How to use Han's validation pipeline, skills, and disciplines with OpenAI Codex CLI via lifecycle hooks."
---

Han works with [OpenAI Codex CLI](https://developers.openai.com/codex/) through its lifecycle hook system. Codex hooks are shell commands that receive JSON on stdin and return JSON decisions on stdout, the same shape as Claude Code hooks, so Han's validation pipeline runs natively.

## How It Works

The bridge is a CLI (`codex-plugin-han`) that Codex calls once per event:

1. **PreToolUse / PostToolUse / Stop** → **validation gates** (biome, eslint, tsc, etc.)
2. **SessionStart / UserPromptSubmit** → **context injection** (core guidelines, datetime)
3. **JSON decisions** → **`permissionDecision: "deny"` and `decision: "block"`** keep the agent in the loop until validation passes
4. **Event logging** → **Browse UI** (sessions visible alongside Claude Code sessions)

```text
Agent edits src/app.ts via apply_patch
  -> Codex calls: npx -y codex-plugin-han post-tool-use
  -> Bridge maps apply_patch -> Edit, matches PostToolUse hooks
  -> Runs hooks in parallel
  -> Any fail: { "decision": "block", "reason": ... }
     (reason replaces the tool result as agent feedback)
```

## Setup

### 1. Install Han and plugins

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### 2. Install the bridge

```bash
han plugin install codex@han
```

### 3. Enable Codex hooks

Hooks are gated behind a feature flag. Add to `~/.codex/config.toml`:

```toml
[features]
hooks = true
```

### 4. Wire the hook events

Add to `~/.codex/hooks.json` (global) or `<repo>/.codex/hooks.json` (per project). Timeouts are in **seconds**:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han session-start", "timeout": 30 }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han user-prompt-submit", "timeout": 10 }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash|apply_patch|Edit|Write|spawn_agent|Agent",
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han pre-tool-use", "timeout": 30 }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han permission-request", "timeout": 15 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "apply_patch|Edit|Write",
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han post-tool-use", "timeout": 120 }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han subagent-stop", "timeout": 180 }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han stop", "timeout": 180 }
        ]
      }
    ]
  }
}
```

The bridge also supports `PreCompact`, `PostCompact`, and `SubagentStart` if you want those events wired (they are no-ops today). See the [bridge README](https://github.com/thebushidocollective/han/tree/main/plugins/bridges/codex) for the full list.

### 5. Optional: Han MCP server

For Han's MCP tools (memory, codebase analysis), add to `~/.codex/config.toml`:

```toml
[mcp_servers.han]
command = "han"
args = ["mcp"]
```

## Coverage Matrix

| Claude Code Hook | Codex Hook | Status |
|---|---|---|
| SessionStart | `SessionStart` | Implemented |
| UserPromptSubmit | `UserPromptSubmit` | Implemented |
| PreToolUse | `PreToolUse` | Implemented |
| — | `PermissionRequest` | Implemented (runs PreToolUse hooks) |
| PostToolUse | `PostToolUse` | Implemented |
| Stop | `Stop` | Implemented |
| SubagentStop | `SubagentStop` | Implemented (runs Stop hooks) |
| SubagentStart | `SubagentStart` | Available (no-op) |
| PreCompact | `PreCompact` | Available (no-op) |
| PostCompact | `PostCompact` | Available (no-op) |

## Tool Name Mapping

| Codex Tool | Claude Code Equivalent |
|---|---|
| `Bash` | `Bash` |
| `apply_patch` | `Edit` |
| `Edit` / `Write` (apply_patch aliases) | passed through as-is |
| `spawn_agent` | `Agent` |
| `mcp__server__tool` | passed through as-is |

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/codex/projects/{slug}/{sessionId}-han.jsonl` with `provider: "codex"`, indexed by the Han coordinator and visible in the Browse UI alongside Claude Code, OpenCode, and other provider sessions.
