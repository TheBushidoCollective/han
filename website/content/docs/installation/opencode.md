---
title: "Using Han with OpenCode"
description: "How to use Han's validation pipeline and plugin ecosystem with OpenCode using the bridge plugin."
---

Han works with [OpenCode](https://opencode.ai) through a bridge plugin that translates OpenCode's event system into Han hook executions. Your existing Han plugins - validation, context injection, skills, disciplines - work in OpenCode without modification.

## How It Works

OpenCode uses a JS/TS plugin system. The Han bridge plugin runs inside OpenCode and connects:

1. **OpenCode events** → **Han hooks** (PreToolUse, PostToolUse, Stop)
2. **System prompt injection** → **Core guidelines** (professional honesty, no excuses, skill selection)
3. **Chat message hooks** → **Datetime injection** (current time on every prompt)
4. **Custom tools** → **Skills & disciplines** (400+ skills, 25 agent personas)

```text
Agent edits src/app.ts
  -> OpenCode fires tool.execute.after
  -> Bridge matches PostToolUse hooks (biome, eslint, tsc)
  -> Runs hooks in parallel, collects results
  -> Agent sees validation errors and fixes them
```

## Setup

### 1. Install Han and plugins

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### 2. Add the bridge to OpenCode

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-han"]
}
```

That's it. Your Han plugins now work in OpenCode.

## Coverage Matrix

The bridge maps Claude Code's hook events to OpenCode's plugin API:

| Claude Code Hook | OpenCode Equivalent | Status | Notes |
|---|---|---|---|
| **PostToolUse** | `tool.execute.after` | Implemented | Primary validation path - per-file linting/formatting |
| **PreToolUse** | `tool.execute.before` | Implemented | Pre-execution gates, subagent context injection |
| **Stop** | `stop` + `session.idle` | Implemented | Full project validation when agent finishes |
| **SessionStart** | `experimental.chat.system.transform` | Implemented | Core guidelines injected into system prompt |
| **UserPromptSubmit** | `chat.message` | Implemented | Current datetime injected on every prompt |
| **SubagentPrompt** | `tool.execute.before` (Task/agent) | Implemented | Discipline context injected into subagent prompts |
| **Skills** | `tool` registration | Implemented | 400+ skills via `han_skills` tool |
| **Disciplines** | `tool` + `system.transform` | Implemented | 25 agent personas via `han_discipline` tool |
| **Event Logging** | JSONL + coordinator | Implemented | Browse UI visibility for OpenCode sessions |
| SubagentStart/Stop | — | Not available | No OpenCode equivalent |
| MCP tool events | — | Not available | OpenCode doesn't fire events for MCP calls ([#2319](https://github.com/sst/opencode/issues/2319)) |
| Permission denial | — | Not available | `tool.execute.before` can't block tool execution |
| PreCompact | — | Not available | No OpenCode equivalent |
| Session slug | — | Not available | OpenCode uses its own session naming |

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

Results are delivered two ways:

1. **Inline**: Appended directly to the tool output (agent sees immediately)
2. **Notification**: Sent via `client.session.prompt()` (agent acts on next turn)

### PreToolUse Hooks

Run before a tool executes via `tool.execute.before`. Enables:

- Pre-commit/pre-push validation gates (intercept git commands)
- Subagent context injection (discipline context added to task tool prompts)
- Input modification for tool calls

### Stop Validation (Secondary)

When the agent finishes a turn, broader project-level hooks run:

- Full project linting
- Type checking across the codebase
- Test suite execution

If issues are found, the bridge re-prompts the agent to fix them.

### SessionStart Context (Guidelines)

Core guidelines are injected into every LLM call via `experimental.chat.system.transform`:

- **Professional honesty** — Verify claims before accepting them
- **No time estimates** — Use phase numbers and priority order instead
- **No excuses** — Own every issue (Boy Scout Rule)
- **Date handling** — Use injected datetime, never hardcode
- **Skill selection** — Review available skills before starting work

These are the same guidelines that Claude Code sessions receive via the core plugin's SessionStart hook.

### UserPromptSubmit Context (Datetime)

Current local datetime is injected on every user message via `chat.message`, mirroring Claude Code's UserPromptSubmit hook. This ensures the LLM always knows the current time for temporal assertions.

### Result Format

Hook results are structured so the agent can parse and act on them:

```xml
<han-post-tool-validation files="src/app.ts">
The following validation hooks reported issues after your last edit.
Please fix these issues before continuing:

<han-validation plugin="biome" hook="lint-async" status="failed">
src/app.ts:10:5 lint/correctness/noUnusedVariables
  This variable is unused.
</han-validation>
</han-post-tool-validation>
```

## Skills (400+)

The bridge registers a `han_skills` tool with OpenCode, giving the LLM on-demand access to Han's full skill library. Skills are discovered at startup from installed plugins' `skills/*/SKILL.md` files.

The LLM can search for skills and load their full content:

```text
han_skills({ action: "list", filter: "react" })
→ Lists all React-related skills across plugins

han_skills({ action: "load", skill: "react-hooks-patterns" })
→ Loads full skill content into context
```

## Disciplines (25 Agent Personas)

The bridge registers a `han_discipline` tool for activating specialized agent personas. When activated, the discipline's expertise is injected into every LLM call via system prompt.

```text
han_discipline({ action: "list" })
→ Available: frontend, backend, sre, security, mobile, database...

han_discipline({ action: "activate", discipline: "frontend" })
→ System prompt now includes frontend expertise context
```

Available disciplines: frontend, backend, api, architecture, mobile, database, security, infrastructure, sre, performance, accessibility, quality, documentation, project-management, product, data-engineering, machine-learning, and more.

## Remaining Gaps

These are genuine platform limitations that cannot be bridged:

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319)). Validation only runs for built-in tools (edit, write, bash).
- **Subagent hooks**: No OpenCode equivalent for SubagentStart/SubagentStop. Discipline context is injected via `tool.execute.before` as a workaround.
- **Permission denial**: OpenCode's `tool.execute.before` cannot block tool execution (no `permissionDecision` equivalent). PreToolUse hooks can warn but not deny.
- **PreCompact**: No hook before context compaction.
- **Checkpoint filtering**: Session-scoped checkpoint filtering (only validate files changed since last checkpoint) is not yet implemented in the bridge.

## How Plugins Stay Compatible

Han plugins don't need modification to work with OpenCode. The bridge reads the same `han-plugin.yml` files that Claude Code uses:

```yaml
# This config works in both Claude Code and OpenCode
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
- **OpenCode**: Bridge reads `han-plugin.yml`, runs the command directly as a promise

Same hook definition. Same validation. Different runtime.

## Architecture

```text
OpenCode Plugin Runtime
  |
  |-- experimental.chat.system.transform
  |     -> Core guidelines (professional honesty, no excuses, etc.)
  |     -> Active discipline context injection
  |     -> Skill/discipline capability summary
  |
  |-- chat.message ────────────> Datetime injection (every prompt)
  |
  |-- tool.execute.before ─────> PreToolUse hooks
  |                                -> Pre-execution validation gates
  |                                -> Discipline context for subagents
  |
  |-- tool.execute.after ──────> PostToolUse hooks (per-file validation)
  |                                -> discovery → matcher → executor → formatter
  |                                -> mutate tool output + notify agent
  |
  |-- session.idle / stop ─────> Stop hooks (full project validation)
  |                                -> client.session.prompt() if failures
  |
  |-- tool: han_skills ────────> Skill discovery (400+ coding skills)
  |                                -> list/search/load SKILL.md content
  |
  |-- tool: han_discipline ────> Agent disciplines (25 personas)
  |                                -> activate/deactivate/list
  |
  |-- JSONL event logger ──────> Browse UI visibility
                                   -> ~/.han/opencode/projects/{slug}/
```

The bridge discovers hooks at startup by reading:

1. `~/.claude/settings.json` and `.claude/settings.json` for enabled plugins
2. `.claude-plugin/marketplace.json` for plugin path resolution
3. Each plugin's `han-plugin.yml` for hook definitions

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/opencode/projects/`. Each event includes `provider: "opencode"` to distinguish OpenCode sessions from Claude Code sessions.

On startup, the bridge launches the Han coordinator in the background. The coordinator watches the OpenCode events directory and indexes events into SQLite, making them visible in the Browse UI alongside Claude Code sessions.

Events logged:
- **hook_run / hook_result** - Hook execution lifecycle
- **hook_file_change** - File edits detected via tool events

Environment variables set by the bridge:
- `HAN_PROVIDER=opencode` - Identifies the provider for child processes
- `HAN_SESSION_ID=<uuid>` - Session ID for event correlation

## Next Steps

- [Install Han plugins](/docs/installation/plugins) for your project's languages and tools
- Read about [hook configuration](/docs/plugin-development/hooks) to understand what hooks do
- Check the [bridge source code](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/opencode) for implementation details
