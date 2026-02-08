---
title: "Using Han with Kiro CLI"
description: "How to use Han's validation pipeline and plugin ecosystem with Kiro CLI using the bridge plugin."
---

Han works with [Kiro CLI](https://kiro.dev/cli/) through a bridge plugin that translates Kiro's hook events into Han hook executions. Your existing Han plugins - validation, context injection, skills, disciplines - work in Kiro without modification.

## How It Works

Kiro CLI uses a shell-based hook system where hooks are defined in agent JSON configs. The Han bridge is a CLI tool that Kiro hooks call:

1. **Kiro hooks** → **Han hooks** (PreToolUse, PostToolUse, Stop)
2. **agentSpawn** → **Core guidelines** (professional honesty, no excuses, skill selection)
3. **userPromptSubmit** → **Datetime injection** (current time on every prompt)
4. **preToolUse** → **Validation gates** (exit code 2 blocks tool execution)

```text
Agent edits src/app.ts via fs_write
  -> Kiro fires postToolUse hook
  -> Bridge maps fs_write -> Write, finds matching Han hooks
  -> Runs biome, eslint, tsc in parallel
  -> Agent sees validation errors and fixes them
```

## Setup

### 1. Install Han and plugins

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### 2. Add the Kiro agent config

Copy the Han agent config to your Kiro settings:

```bash
# Global (all projects)
mkdir -p ~/.kiro/agents
curl -fsSL https://raw.githubusercontent.com/TheBushidoCollective/han/main/plugins/bridges/kiro/kiro-agent.json \
  -o ~/.kiro/agents/han.json

# Or project-specific
mkdir -p .kiro/agents
curl -fsSL https://raw.githubusercontent.com/TheBushidoCollective/han/main/plugins/bridges/kiro/kiro-agent.json \
  -o .kiro/agents/han.json
```

### 3. Start Kiro with Han

```bash
kiro-cli chat --agent han
```

That's it. Your Han plugins now work in Kiro.

## Coverage Matrix

The bridge maps Claude Code's hook events to Kiro's hook system:

| Claude Code Hook | Kiro Equivalent | Status | Notes |
|---|---|---|---|
| **PostToolUse** | `postToolUse` | Implemented | Primary validation path - per-file linting/formatting |
| **PreToolUse** | `preToolUse` | Implemented | Pre-execution gates with exit code 2 blocking |
| **Stop** | `stop` | Implemented | Full project validation when agent finishes |
| **SessionStart** | `agentSpawn` | Implemented | Core guidelines injected on agent start |
| **UserPromptSubmit** | `userPromptSubmit` | Implemented | Current datetime injected on every prompt |
| **Event Logging** | JSONL + coordinator | Implemented | Browse UI visibility for Kiro sessions |
| **Permission denial** | Exit code 2 | Implemented | Kiro's native blocking mechanism |
| SubagentStart/Stop | — | Not available | No Kiro equivalent |
| MCP tool events | `@mcp/tool` matchers | Partial | Kiro supports MCP tool matchers in hooks |
| PreCompact | — | Not available | No Kiro equivalent |

## What Works

### PostToolUse Validation (Primary)

The most important feature. When the agent edits a file, Han's per-file validation hooks fire:

| Plugin | What It Does |
|--------|-------------|
| `biome` | Lint and format JavaScript/TypeScript |
| `eslint` | JavaScript/TypeScript linting |
| `prettier` | Code formatting |
| `typescript` | Type checking |
| `clippy` | Rust linting |
| `pylint` | Python linting |

Results are delivered to stdout and the agent sees them immediately after the edit.

### PreToolUse Hooks (with Blocking)

Run before a tool executes via Kiro's `preToolUse` hook. Kiro supports **exit code 2** for blocking tool execution - when a PreToolUse hook returns exit code 2, Kiro blocks the tool call and sends stderr to the LLM as the reason.

This is a capability OpenCode lacks. Han's PreToolUse hooks can enforce validation gates in Kiro.

### Stop Validation (Secondary)

When the agent finishes a turn, broader project-level hooks run:

- Full project linting
- Type checking across the codebase
- Test suite execution

If issues are found, the bridge exits with code 1, signaling the agent should continue.

### SessionStart Context (Guidelines)

Core guidelines are injected when the agent starts via `agentSpawn`:

- **Professional honesty** — Verify claims before accepting them
- **No time estimates** — Use phase numbers and priority order instead
- **No excuses** — Own every issue (Boy Scout Rule)
- **Date handling** — Use injected datetime, never hardcode
- **Skill selection** — Review available skills before starting work

### UserPromptSubmit Context (Datetime)

Current local datetime is injected on every user prompt via `userPromptSubmit`, mirroring Claude Code's UserPromptSubmit hook.

### Result Format

Hook results are structured so the agent can parse and act on them:

```xml
<han-post-tool-validation>
The following validation hooks reported issues after your last edit.
Please fix these issues before continuing:

<han-validation plugin="biome" hook="lint-async" status="failed">
src/app.ts:10:5 lint/correctness/noUnusedVariables
  This variable is unused.
</han-validation>
</han-post-tool-validation>
```

## Tool Name Mapping

Kiro uses internal tool names that differ from Claude Code. The bridge maps them automatically:

| Kiro Tool | Claude Code Tool |
|-----------|-----------------|
| `fs_read` | `Read` |
| `fs_write` | `Write` |
| `execute_bash` | `Bash` |
| `glob` | `Glob` |
| `grep` | `Grep` |
| `notebook_edit` | `NotebookEdit` |

## How Plugins Stay Compatible

Han plugins don't need modification to work with Kiro. The bridge reads the same `han-plugin.yml` files that Claude Code uses:

```yaml
# This config works in Claude Code, OpenCode, and Kiro
hooks:
  lint-async:
    event: PostToolUse
    command: "npx -y @biomejs/biome check --write ${HAN_FILES}"
    tool_filter: [Edit, Write, NotebookEdit]
    file_filter: ["**/*.{js,jsx,ts,tsx}"]
    dirs_with: ["biome.json"]
```

The difference is in who executes the hook:

- **Claude Code**: Reads `hooks.json`, calls `han hook run` via shell
- **OpenCode**: Bridge reads `han-plugin.yml`, runs command as in-process promise
- **Kiro**: Bridge reads `han-plugin.yml`, runs command as child process

Same hook definition. Same validation. Different runtime.

## Kiro Agent Config

The bridge provides a Kiro agent configuration (`kiro-agent.json`) that defines all the necessary hooks:

```json
{
  "name": "han",
  "description": "Default coding agent with Han validation",
  "hooks": {
    "agentSpawn": [{ "command": "npx -y kiro-plugin-han agent-spawn" }],
    "userPromptSubmit": [{ "command": "npx -y kiro-plugin-han user-prompt-submit" }],
    "preToolUse": [{ "matcher": "*", "command": "npx -y kiro-plugin-han pre-tool-use" }],
    "postToolUse": [{ "matcher": "fs_write", "command": "npx -y kiro-plugin-han post-tool-use" }],
    "stop": [{ "command": "npx -y kiro-plugin-han stop", "timeout_ms": 120000 }]
  }
}
```

You can customize this by:
- Adding more matchers to `postToolUse` (e.g., `notebook_edit`)
- Adjusting timeouts
- Merging hooks into your own custom agent

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/kiro/projects/`. Each event includes `provider: "kiro"` to distinguish Kiro sessions from Claude Code and OpenCode sessions.

On agent start, the bridge launches the Han coordinator in the background, making events visible in the Browse UI.

## Remaining Gaps

- **Skills/Disciplines tools**: Currently injected as context only. Full tool registration would require a Kiro MCP server (planned).
- **Subagent hooks**: Kiro custom agents don't have SubagentStart/SubagentStop equivalents.
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented.

## Next Steps

- [Install Han plugins](/docs/installation/plugins) for your project's languages and tools
- Read about [hook configuration](/docs/plugin-development/hooks) to understand what hooks do
- Check the [bridge source code](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/kiro) for implementation details
