# Han Bridge for Codex CLI

Bridge plugin that brings Han's full plugin ecosystem to [OpenAI Codex CLI](https://developers.openai.com/codex/) — validation hooks, core guidelines, 400+ skills, and 25 agent disciplines.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in Codex CLI:

1. **Hooks** — PreToolUse, PostToolUse, and Stop validation (biome, eslint, tsc, etc.) with parallel execution
2. **Guidelines** — Core principles (professional honesty, no excuses, skill selection) injected into every LLM call
3. **Datetime** — Current time injected on every user prompt
4. **Skills** — 400+ coding skills loadable on demand via `han_skills` tool
5. **Disciplines** — 25 agent personas (frontend, backend, SRE, security, etc.) with system prompt injection
6. **Events** — Unified JSONL logging with `provider: "codex"` for Browse UI visibility

## Coverage Matrix

| Claude Code Hook | Codex Equivalent | Status |
|---|---|---|
| PostToolUse | `tool.execute.after` | Implemented |
| PreToolUse | `tool.execute.before` | Implemented |
| Stop | `stop` + `session.idle` | Implemented |
| SessionStart | `experimental.chat.system.transform` | Implemented |
| UserPromptSubmit | `chat.message` | Implemented |
| SubagentPrompt | `tool.execute.before` (Task/agent) | Implemented |
| SubagentStart/Stop | — | Not available |
| MCP tool events | — | Not available |
| Permission denial | — | Not available |

## Validation Flow

### PreToolUse (Pre-Execution)

Runs before a tool executes via `tool.execute.before`:

```
Agent about to run a tool
  -> Codex fires tool.execute.before
  -> Bridge matches PreToolUse hooks by tool name
  -> Runs matching hooks in parallel
  -> Injects discipline context into subagent prompts
```

### PostToolUse (Primary Path - In-the-Loop)

The most important hook type. When the agent edits a file:

```
Agent edits src/app.ts via edit tool
  -> Codex fires tool.execute.after
  -> Bridge matches PostToolUse hooks (biome lint-async, eslint lint-async, etc.)
  -> Runs all matching hooks in parallel as promises
  -> Collects structured results (exit code, stdout, stderr)
  -> Delivers feedback:
     1. Inline: appends errors to tool output (agent sees immediately)
     2. Async: client.session.prompt() notification (agent acts on next turn)
```

### Stop (Secondary - Full Project)

When the agent finishes a turn:

```
Agent signals completion
  -> Codex fires session.idle / stop
  -> Bridge runs Stop hooks (full project lint, typecheck, tests)
  -> If failures: re-prompts agent via client.session.prompt()
  -> Agent gets a new turn to fix project-wide issues
```

## Context Injection

### SessionStart Equivalent

Core guidelines are injected into every LLM call via `experimental.chat.system.transform`:

- Professional honesty (verify before accepting claims)
- No time estimates (use phase numbers)
- No excuses policy (Boy Scout Rule)
- Date handling best practices
- Mandatory skill selection

### UserPromptSubmit Equivalent

Current local datetime is injected on every user message via `chat.message`, so the LLM always knows the current time.

### SubagentPrompt Equivalent

When a discipline is active and the LLM spawns a task/agent tool, the bridge injects discipline context into the subagent's prompt via `tool.execute.before`.

## Hook Discovery

The bridge reads installed plugins directly from the filesystem:

1. **Settings files**: `~/.claude/settings.json`, `.claude/settings.json` for enabled plugins
2. **Marketplace**: `.claude-plugin/marketplace.json` for plugin path resolution
3. **Plugin configs**: Each plugin's `han-plugin.yml` for hook definitions

No dependency on `han hook dispatch` (which is fire-and-forget). The bridge manages hook lifecycle directly.

## Setup

### Prerequisites

Han plugins must be installed:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### Install the Bridge

**Option A: MCP Server** (recommended for immediate use)

Add to your `~/.codex/config.toml`:

```toml
[mcp_servers.han]
command = "npx"
args = ["-y", "codex-plugin-han"]
```

**Option B: Local plugin**

Copy the `src/` directory to your project and reference it in your Codex configuration.

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
  |-- experimental.chat.system.transform ──────> SessionStart context
  |     (every LLM call)                          (core guidelines + discipline)
  |
  |-- chat.message ────────────────────────────> UserPromptSubmit context
  |     (every user prompt)                        (current datetime)
  |
  |-- tool.execute.before ─────────────────────> PreToolUse hooks
  |     (before tool runs)                         (validation gates)
  |                                                     |
  |     └─ discipline context ──────────────────────────┘
  |         (injected into task/agent prompts)
  |
  |-- tool.execute.after ──────────────────────> PostToolUse hooks
  |     (edit, write, shell)                       (biome, eslint, tsc)
  |                                                     |
  |     ┌─ inline: mutate tool output ──────────────────┤
  |     └─ async: client.session.prompt(noReply) ───────┘
  |
  |-- session.idle ────────────────────────────> Stop hooks
  |     (agent finished turn)                      (full project lint)
  |                                                     |
  |     └─ client.session.prompt() ─────────────────────┘
  |         (re-prompts agent to fix issues)
  |
  |-- stop ────────────────────────────────────> Stop hooks (backup)
  |     (agent signals completion)                  |
  |                                                 └─ { continue: true }
  |                                                     (force continuation)
  |
  |-- tool: han_skills ────────────────────────> Skill discovery
  |     (LLM-callable)                             (list/search/load 400+ skills)
  |
  |-- tool: han_discipline ────────────────────> Agent disciplines
  |     (LLM-callable)                             (activate/deactivate/list)
  |
  |-- JSONL logger ────────────────────────────> Event logging
        (hook_run, hook_result, hook_file_change)  (Browse UI visibility)

Bridge Internals:
  context.ts       Core guidelines + datetime injection
  discovery.ts     Read settings + marketplace + resolve plugin paths
  skills.ts        Discover SKILL.md files from installed plugins
  disciplines.ts   Discover discipline plugins, system prompt builder
  matcher.ts       Filter by tool name, file globs, dirsWith
  executor.ts      Spawn hook commands as parallel promises
  formatter.ts     Structure results as XML-tagged agent messages
  events.ts        JSONL event logger (provider="codex")
  cache.ts         Content-hash caching (SHA-256)
```

## Tool Name Mapping

Codex CLI uses different tool names than Claude Code:

| Codex Tool | Claude Code Equivalent |
|---|---|
| `shell` | `Bash` |
| `edit` | `Edit` |
| `write` | `Write` |
| `read` | `Read` |
| `list` | `Glob` |

## Skills

The bridge registers a `han_skills` tool that gives the LLM access to Han's full skill library (400+ skills across 95+ plugins). Skills are discovered at plugin init time by scanning each installed plugin's `skills/*/SKILL.md` files.

Two actions:

- **list** — Browse available skills with optional search filter
- **load** — Load the full SKILL.md content for a specific skill (supports partial name matching)

## Disciplines

The bridge registers a `han_discipline` tool for activating specialized agent personas. When a discipline is active, its context is injected into every LLM call.

Available disciplines include: frontend, backend, api, architecture, mobile, database, security, infrastructure, sre, performance, accessibility, quality, documentation, and more (25 total).

## Event Logging & Provider Architecture

The bridge writes Han-format JSONL events to `~/.han/codex/projects/{slug}/{sessionId}-han.jsonl`. Each event includes `provider: "codex"` so the coordinator can distinguish Codex sessions from Claude Code and OpenCode sessions.

Events logged:

- `hook_run` / `hook_result` — Hook execution lifecycle (start, success/failure, duration)
- `hook_file_change` — File edits detected via `tool.execute.after`

The bridge sets `HAN_PROVIDER=codex` in the environment for child processes and starts the Han coordinator in the background. The coordinator indexes these JSONL files into SQLite and serves them through the Browse UI alongside other provider sessions.

## Remaining Gaps

These are platform limitations that cannot be bridged until Codex adds support:

- **MCP tool events**: Codex may not fire `tool.execute.after` for MCP tool calls
- **Subagent hooks**: No Codex equivalent for SubagentStart/SubagentStop
- **Permission denial**: `tool.execute.before` cannot block tool execution (PreToolUse hooks can warn but not deny)
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented

## Development

```bash
# From the han repo root
cd plugins/bridges/codex

# The plugin uses TypeScript directly (Bun handles it)
# No build step required
```

## License

Apache-2.0
