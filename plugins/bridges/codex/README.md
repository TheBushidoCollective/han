# Han Bridge for Codex CLI

Bridge plugin that brings Han's full plugin ecosystem to [OpenAI Codex CLI](https://developers.openai.com/codex/) — validation hooks, core guidelines, skills, and disciplines.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in Codex CLI:

1. **Hooks** — PreToolUse, PostToolUse, and Stop validation (biome, eslint, tsc, etc.) with parallel execution
2. **Guidelines** — Core principles (professional honesty, no excuses, skill selection) injected on session start
3. **Datetime** — Current time injected on every user prompt
4. **PreToolUse blocking** — JSON permission decisions deny tool execution per Codex convention
5. **Events** — Unified JSONL logging with `provider: "codex"` for Browse UI visibility

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

## Key Difference from OpenCode Bridge

The OpenCode bridge is an **in-process JS plugin** that hooks into OpenCode's runtime. The Codex bridge is a **CLI tool** that Codex hooks call as shell commands.

This is because Codex's hook system is shell-based (like Claude Code), not plugin-based (like OpenCode). Each Codex hook calls `npx -y codex-plugin-han <event>`, which:

1. Reads JSON from stdin (Codex's hook payload)
2. Maps Codex tool names to Claude Code tool names
3. Discovers and executes matching Han hooks
4. Outputs a JSON decision to stdout (all logging goes to stderr)

## Validation Flow

### PreToolUse (Pre-Execution Gate)

Runs before a tool executes via Codex's `PreToolUse` hook:

```
Agent about to run a tool
  -> Codex calls: npx -y codex-plugin-han pre-tool-use
  -> Bridge reads stdin JSON { tool_name: "apply_patch", ... }
  -> Maps apply_patch -> Edit (Claude Code name)
  -> Matches PreToolUse hooks by tool name
  -> Runs matching hooks in parallel
  -> All pass: {} (allow)
  -> Any fail: hookSpecificOutput.permissionDecision = "deny"
     (reason sent to the agent)
```

### PostToolUse (Primary Path - In-the-Loop)

The most important hook type. When the agent edits a file:

```
Agent edits src/app.ts via apply_patch
  -> Codex calls: npx -y codex-plugin-han post-tool-use
  -> Bridge extracts file paths (file_path fields + patch headers)
  -> Matches PostToolUse hooks (biome lint-async, eslint lint-async, etc.)
  -> Runs all matching hooks in parallel
  -> All pass: {}
  -> Any fail: { "decision": "block", "reason": ... }
     (reason replaces the tool result as agent feedback)
```

### Stop / SubagentStop (Full Project)

When the agent finishes a turn:

```
Agent signals completion
  -> Codex calls: npx -y codex-plugin-han stop
  -> Bridge runs Stop hooks (full project lint, typecheck, tests)
  -> All pass: {}
  -> Any fail: { "decision": "block", "reason": ... }
     (Codex turns the reason into a new user prompt;
      the agent keeps working until validation passes)
```

## Context Injection

### SessionStart

Core guidelines are injected via `hookSpecificOutput.additionalContext`:

- Professional honesty (verify before accepting claims)
- No time estimates (use phase numbers)
- No excuses policy (Boy Scout Rule)
- Date handling best practices
- Mandatory skill selection

If `HAN_DISCIPLINE` is set in the environment, that discipline's persona
context is injected alongside the guidelines.

### UserPromptSubmit

Current local datetime is injected on every user prompt via `additionalContext`, so the LLM always knows the current time.

## Setup

### Prerequisites

Han plugins must be installed:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### Install the Bridge

```bash
han plugin install codex@han
```

### Enable Codex Hooks

Hooks are gated behind a feature flag. Add to `~/.codex/config.toml`:

```toml
[features]
hooks = true
```

### Wire the Hook Events

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
    "PreCompact": [
      {
        "matcher": "manual|auto",
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han pre-compact", "timeout": 10 }
        ]
      }
    ],
    "PostCompact": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han post-compact", "timeout": 10 }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y codex-plugin-han subagent-start", "timeout": 10 }
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

### MCP Server (Complementary)

Hooks handle validation and context injection. For Han's MCP tools
(memory, codebase analysis, hook utilities), add the Han MCP server to
`~/.codex/config.toml`:

```toml
[mcp_servers.han]
command = "han"
args = ["mcp"]
```

### AGENTS.md Integration

For core guidelines without the full bridge, add to your project's `AGENTS.md`:

```markdown
## Han Guidelines

- Verify claims before accepting them (read code, search codebase, run tests)
- Never provide time estimates
- Own every issue you encounter (Boy Scout Rule)
- Use ISO 8601 for timestamps, store in UTC
```

## Architecture

```
Codex CLI Runtime
  |
  |-- SessionStart ────────────────────────────> additionalContext
  |     (startup/resume/clear/compact)            (core guidelines + discipline)
  |           |
  |           └─ han coordinator ensure ──────────┘
  |               (Browse UI visibility)
  |
  |-- UserPromptSubmit ────────────────────────> additionalContext
  |     (every user prompt)                       (current datetime)
  |
  |-- PreToolUse ──────────────────────────────> PreToolUse hooks
  |     (Bash, apply_patch, spawn_agent)          (validation gates)
  |           |
  |           └─ hookSpecificOutput ──────────────┘
  |               (permissionDecision: deny)
  |
  |-- PermissionRequest ───────────────────────> PreToolUse hooks
  |     (Codex about to prompt user)              |
  |           |
  |           └─ hookSpecificOutput ──────────────┘
  |               (decision.behavior: deny)
  |
  |-- PostToolUse ─────────────────────────────> PostToolUse hooks
  |     (apply_patch/Edit/Write)                  (biome, eslint, tsc)
  |           |
  |           └─ decision: "block" ───────────────┘
  |               (reason = tool result feedback)
  |
  |-- Stop / SubagentStop ─────────────────────> Stop hooks
  |     (agent finished turn)                     (full project lint)
  |           |
  |           └─ decision: "block" ───────────────┘
  |               (reason = new user prompt)
  |
  |-- JSONL logger ────────────────────────────> Event logging
        (hook_run, hook_result, hook_file_change)  (Browse UI visibility)

Bridge Internals:
  context.ts       Core guidelines + datetime injection
  discovery.ts     Read settings + marketplace + resolve plugin paths
  skills.ts        Discover SKILL.md files from installed plugins
  disciplines.ts   Discover discipline plugins, persona context builder
  matcher.ts       Filter by tool name, file globs, dirsWith
  executor.ts      Spawn hook commands as parallel promises
  formatter.ts     Structure results as Codex JSON decisions
  events.ts        JSONL event logger (provider="codex")
  cache.ts         Content-hash caching (SHA-256)
```

## Tool Name Mapping

Codex CLI uses different tool names than Claude Code. The bridge maps them before matching Han hooks:

| Codex Tool | Claude Code Equivalent |
|---|---|
| `Bash` | `Bash` |
| `apply_patch` | `Edit` |
| `Edit` / `Write` (apply_patch aliases) | passed through as-is |
| `spawn_agent` | `Agent` |
| `mcp__server__tool` | passed through as-is |

## Event Logging & Provider Architecture

The bridge writes Han-format JSONL events to `~/.han/codex/projects/{slug}/{sessionId}-han.jsonl`. Each event includes `provider: "codex"` so the coordinator can distinguish Codex sessions from Claude Code and OpenCode sessions.

Events logged:

- `hook_run` / `hook_result` — Hook execution lifecycle (start, success/failure, duration)
- `hook_file_change` — File edits detected via `PostToolUse`

The bridge sets `HAN_PROVIDER=codex` in the environment for child processes and starts the Han coordinator in the background on `SessionStart`. The coordinator indexes these JSONL files into SQLite and serves them through the Browse UI alongside other provider sessions.

## Remaining Gaps

- **SubagentStart context**: Codex supports `additionalContext` on SubagentStart, but the bridge has no per-session discipline state to inject (one process per event)
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented

## Development

```bash
# From the han repo root
cd plugins/bridges/codex

# The plugin uses TypeScript directly (Bun handles it)
# No build step required

# Smoke test: every event reads stdin until EOF and prints JSON
bun src/index.ts stop < /dev/null
echo '{"tool_name":"apply_patch","tool_input":{"patch":"*** Begin Patch\n*** Update File: src/x.ts\n*** End Patch"}}' | bun src/index.ts post-tool-use
```

## License

Apache-2.0
