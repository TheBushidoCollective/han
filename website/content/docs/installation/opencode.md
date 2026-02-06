---
title: "Using Han with OpenCode"
description: "How to use Han's validation pipeline and plugin ecosystem with OpenCode using the bridge plugin."
---

Han works with [OpenCode](https://opencode.ai) through a bridge plugin that translates OpenCode's event system into Han hook executions. Your existing Han plugins - validation, context injection, everything - work in OpenCode without modification.

## How It Works

OpenCode uses a JS/TS plugin system. The Han bridge plugin runs inside OpenCode and connects two things:

1. **OpenCode events** (`tool.execute.after`, `session.idle`, `stop`)
2. **Han plugin hooks** (PostToolUse, Stop) defined in `han-plugin.yml`

When OpenCode's agent edits a file, the bridge discovers matching Han hooks, runs them as parallel promises, and feeds structured results back to the agent.

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

That's it. Your Han validation hooks now run in OpenCode.

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

### Stop Validation (Secondary)

When the agent finishes a turn, broader project-level hooks run:

- Full project linting
- Type checking across the codebase
- Test suite execution

If issues are found, the bridge re-prompts the agent to fix them.

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

## Event Mapping

| OpenCode Event | Han Hook Type | Behavior |
|---|---|---|
| `tool.execute.after` | PostToolUse | Per-file validation after edits |
| `session.idle` | Stop | Full project validation when agent finishes |
| `stop` | Stop | Force continuation if issues found |

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

## Known Limitations

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319))
- **Subagent hooks**: No OpenCode equivalent for SubagentStart/SubagentStop
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented in the bridge

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
  |-- tool.execute.after ────> PostToolUse hooks (per-file validation)
  |                              -> discovery → matcher → executor → formatter
  |                              -> mutate tool output + notify agent
  |
  |-- session.idle / stop ───> Stop hooks (full project validation)
  |                              -> client.session.prompt() if failures
  |
  |-- tool: han_skills ──────> Skill discovery (400+ coding skills)
  |                              -> list/search/load SKILL.md content
  |
  |-- tool: han_discipline ──> Agent disciplines (25 personas)
  |                              -> activate/deactivate/list
  |
  |-- system.transform ──────> Active discipline context injection
                                 -> Injected into every LLM call
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
