# Han Bridge for OpenCode

Bridge plugin that brings Han's full plugin ecosystem to [OpenCode](https://opencode.ai) — validation hooks, core guidelines, 400+ skills, and 25 agent disciplines.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in OpenCode:

1. **Hooks** — PreToolUse, PostToolUse, and Stop validation (biome, eslint, tsc, etc.) with parallel execution
2. **Guidelines** — Core principles (professional honesty, no excuses, skill selection) injected into every LLM call
3. **Datetime** — Current time injected on every user prompt
4. **Skills** — 400+ coding skills loadable on demand via `han_skills` tool
5. **Disciplines** — 25 agent personas (frontend, backend, SRE, security, etc.) with system prompt injection
6. **Events** — Unified JSONL logging with `provider: "opencode"` for Browse UI visibility

## Coverage Matrix

| Claude Code Hook | OpenCode Equivalent | Status |
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
  -> OpenCode fires tool.execute.before
  -> Bridge matches PreToolUse hooks by tool name
  -> Runs matching hooks in parallel
  -> Injects discipline context into subagent prompts
```

### PostToolUse (Primary Path - In-the-Loop)

The most important hook type. When the agent edits a file:

```
Agent edits src/app.ts via Edit tool
  -> OpenCode fires tool.execute.after
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
  -> OpenCode fires session.idle / stop
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

**Option A: npm package** (recommended)

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-han"]
}
```

**Option B: Local plugin**

Copy the `src/` directory to `.opencode/plugins/han-bridge/` in your project.

## Architecture

```
OpenCode Runtime
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
  |     (Edit, Write)                              (biome, eslint, tsc)
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
  events.ts        JSONL event logger (provider="opencode")
  cache.ts         Content-hash caching (SHA-256)
```

## Result Format

Hook results are delivered as structured XML that the agent can parse:

```xml
<han-post-tool-validation files="src/app.ts">
The following validation hooks reported issues after your last edit.
Please fix these issues before continuing:

<han-validation plugin="biome" hook="lint-async" status="failed">
src/app.ts:10:5 lint/correctness/noUnusedVariables ━━━━━━━━━━━━━━━━━
  This variable is unused.
</han-validation>
</han-post-tool-validation>
```

## Caching

The bridge implements content-hash caching identical to Han's approach. After a hook runs successfully on a file, the file's SHA-256 hash is recorded. On subsequent edits, if the file content hasn't changed (e.g. a no-op edit or reformat), the hook is skipped.

Cache invalidation happens automatically: when `tool.execute.after` fires, the edited file's cache entries are invalidated before hooks run, ensuring validation always runs on genuinely changed content.

## Skills

The bridge registers a `han_skills` tool with OpenCode that gives the LLM access to Han's full skill library (400+ skills across 95+ plugins). Skills are discovered at plugin init time by scanning each installed plugin's `skills/*/SKILL.md` files.

Two actions:
- **list** — Browse available skills with optional search filter
- **load** — Load the full SKILL.md content for a specific skill (supports partial name matching)

```
LLM: han_skills({ action: "list", filter: "typescript" })
→ Found 3 skills:
  ## typescript
  - typescript-type-system: Use when working with TypeScript's type system...
  - typescript-async-patterns: Use when working with async/await...
  - typescript-utility-types: Use when working with utility types...

LLM: han_skills({ action: "load", skill: "typescript-type-system" })
→ [Full SKILL.md content loaded into context]
```

## Disciplines

The bridge registers a `han_discipline` tool for activating specialized agent personas. When a discipline is active, its context is injected into every LLM call via `experimental.chat.system.transform`.

Available disciplines include: frontend, backend, api, architecture, mobile, database, security, infrastructure, sre, performance, accessibility, quality, documentation, and more (25 total).

```
LLM: han_discipline({ action: "activate", discipline: "frontend" })
→ Activated discipline: frontend
  3 specialized skills available. Use han_skills to load any of them.

# All subsequent LLM calls now receive frontend discipline context
# in the system prompt, steering the agent's expertise.
```

## Event Logging & Provider Architecture

The bridge writes Han-format JSONL events to `~/.han/opencode/projects/{slug}/{sessionId}-han.jsonl`. Each event includes `provider: "opencode"` so the coordinator can distinguish OpenCode sessions from Claude Code sessions.

Events logged:
- `hook_run` / `hook_result` — Hook execution lifecycle (start, success/failure, duration)
- `hook_file_change` — File edits detected via `tool.execute.after`

The bridge sets `HAN_PROVIDER=opencode` in the environment for child processes and starts the Han coordinator in the background via `han coordinator ensure --background --watch-path <dir>`. The coordinator indexes these JSONL files into SQLite and serves them through the Browse UI alongside Claude Code sessions.

## Remaining Gaps

These are genuine platform limitations in OpenCode that cannot be bridged:

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319))
- **Subagent hooks**: No OpenCode equivalent for SubagentStart/SubagentStop
- **Permission denial**: `tool.execute.before` cannot block tool execution (PreToolUse hooks can warn but not deny)
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented

## Development

```bash
# From the han repo root
cd plugins/bridges/opencode

# The plugin uses TypeScript directly (Bun handles it)
# No build step required for OpenCode
```

## License

Apache-2.0
