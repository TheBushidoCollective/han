# Han Bridge for OpenCode

Bridge plugin that enables Han's validation pipeline to work with [OpenCode](https://opencode.ai) by translating OpenCode events into direct hook execution with promise-based result collection.

## What This Does

Han plugins define validation hooks (biome, eslint, tsc, etc.) that run during Claude Code sessions. This bridge makes those same hooks work in OpenCode by:

1. **Discovering** installed Han plugins and their hook definitions from `han-plugin.yml`
2. **Matching** hooks against tool events (tool name + file glob patterns)
3. **Executing** hook commands as parallel promises (not fire-and-forget)
4. **Delivering** structured results the agent can act on

## Validation Flow

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

This enables single-file, on-the-loop validation identical to Claude Code's async PostToolUse hooks.

### Stop (Secondary - Full Project)

When the agent finishes a turn:

```
Agent signals completion
  -> OpenCode fires session.idle / stop
  -> Bridge runs Stop hooks (full project lint, typecheck, tests)
  -> If failures: re-prompts agent via client.session.prompt()
  -> Agent gets a new turn to fix project-wide issues
```

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
  |-- tool.execute.after ─────────────────────────> PostToolUse hooks
  |     (Edit, Write)                                (biome, eslint, tsc)
  |                                                       |
  |     ┌─ inline: mutate tool output ────────────────────┤
  |     └─ async: client.session.prompt(noReply) ─────────┘
  |
  |-- session.idle ───────────────────────────────> Stop hooks
  |     (agent finished turn)                        (full project lint)
  |                                                       |
  |     └─ client.session.prompt() ───────────────────────┘
  |         (re-prompts agent to fix issues)
  |
  |-- stop ───────────────────────────────────────> Stop hooks (backup)
        (agent signals completion)                    |
                                                     └─ { continue: true }
                                                         (force continuation)

Bridge Internals:
  discovery.ts   Read settings + marketplace + han-plugin.yml
  matcher.ts     Filter by tool name, file globs, dirsWith
  executor.ts    Spawn hook commands as parallel promises
  formatter.ts   Structure results as XML-tagged agent messages
  events.ts      JSONL event logger (provider="opencode")
  cache.ts       Content-hash caching (SHA-256)
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

## Event Logging & Provider Architecture

The bridge writes Han-format JSONL events to `~/.han/opencode/projects/{slug}/{sessionId}-han.jsonl`. Each event includes `provider: "opencode"` so the coordinator can distinguish OpenCode sessions from Claude Code sessions.

Events logged:
- `hook_run` / `hook_result` — Hook execution lifecycle (start, success/failure, duration)
- `hook_file_change` — File edits detected via `tool.execute.after`

The bridge sets `HAN_PROVIDER=opencode` in the environment for child processes and starts the Han coordinator in the background via `han coordinator ensure --background --watch-path <dir>`. The coordinator indexes these JSONL files into SQLite and serves them through the Browse UI alongside Claude Code sessions.

## Known Limitations

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319))
- **Subagent hooks**: No OpenCode equivalent for SubagentStart/SubagentStop
- **Checkpoints**: Session-scoped checkpoint filtering (only validate files changed since last checkpoint) is not yet implemented

## Development

```bash
# From the han repo root
cd plugins/bridges/opencode

# The plugin uses TypeScript directly (Bun handles it)
# No build step required for OpenCode
```

## License

Apache-2.0
