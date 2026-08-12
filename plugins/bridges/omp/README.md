# Han Bridge for omp

Bridge plugin that makes [omp (Oh My Pi)](https://github.com/oh-my-pi) sessions countable in Han. It records session lifecycle, every tool call, files changed, and per-message token and dollar cost, so omp work shows up in Han's Browse UI and cost rollups alongside Claude Code.

## Install

```
omp plugin marketplace add thebushidocollective/han
omp plugin install omp@han
```

Then restart omp. Extension modules are only picked up when a session starts; `/reload-plugins` refreshes skills, commands, and MCP servers but not extensions.

To load it without the marketplace, point omp at the plugin directory:

```yaml
# ~/.omp/agent/config.yml
extensions:
  - ~/.claude/plugins/marketplaces/han/plugins/bridges/omp
```

Or for a single run:

```
omp --extension /path/to/plugins/bridges/omp/src/index.ts
```

omp resolves the directory through this package's `package.json` `omp.extensions` manifest.

## What This Does

This is a telemetry bridge, not a hook-execution bridge. It does not run Han plugin hooks, does not inject context, and does not gate tools. It answers one question Han could not previously answer for omp: what did this harness actually do, and what did it cost.

| Recorded | How |
|---|---|
| Session start and end | `session_start`, `session_shutdown` |
| Session switch | `session_switch` closes the old session and opens the new one |
| Context compaction | `session_compact` |
| Every tool call, with duration and success | `tool_execution_start` / `tool_execution_end` |
| Files written or edited | Arguments of a successful `Write` or `Edit` |
| Token counts and dollar cost | omp's session JSONL, drained on `turn_end` |

## Events

Events are written to:

```
~/.han/omp/projects/<project-slug>/<sessionId>-han.jsonl
```

Every event carries `harness: "omp"`. Han reads an absent `harness` as `claude-code`, so this is always written explicitly.

| Han event | When | Notes |
|---|---|---|
| `hook_run` | Session start, session end, compaction, tool start | `plugin` is `omp-bridge`; `hook` is the tool name or `session` |
| `hook_result` | The matching completion | Correlated by `hookRunId`; carries `duration_ms`, `exit_code`, `success` |
| `hook_file_change` | A successful `Write` or `Edit` | Carries the target path |
| `token_usage` | One per assistant message | `model`, `provider`, four token counts, and `cost_usd` |

Hook types reuse Claude Code's vocabulary (`SessionStart`, `Stop`, `PreCompact`, `PostToolUse`) so omp lands in the same buckets as every other harness rather than inventing an omp-only one.

Tool names are mapped from omp's lowercase built-ins to Claude Code's PascalCase (`read` becomes `Read`, `bash` becomes `Bash`), so an omp `read` and a Claude Code `Read` aggregate as one tool. Unrecognized names, including MCP and extension tools, pass through unchanged.

## Token and Cost Accounting

omp's extension event bus carries no token counts and no dollar cost. `after_provider_response` fires before the response stream body is consumed, so final output counts do not exist yet when it runs.

The numbers omp itself computed live on persisted assistant messages in the session JSONL, as `message.usage` with `input`, `output`, `cacheRead`, `cacheWrite`, and a `cost` breakdown. The bridge reads them from there, mapping:

| omp | Han |
|---|---|
| `usage.input` | `input_tokens` |
| `usage.output` | `output_tokens` |
| `usage.cacheRead` | `cache_read_tokens` |
| `usage.cacheWrite` | `cache_creation_tokens` |
| `usage.cost.total` | `cost_usd` |

No cost model is applied here and no number is estimated. A message with no computed cost is emitted without `cost_usd` rather than with a zero, because a missing cost and a free turn are different facts.

Reading is incremental by byte offset, so a long session is not re-parsed every turn. omp rewrites session files in full for migrations, title repair, fork, and move; a rewrite is detected by size and triggers a re-scan. Token usage events use a UUID derived from the omp session entry id, so a re-scan, or a session resumed in a new process, re-emits the same event rather than double counting.

## Session Identity

The session id is the one omp uses. It comes from the `{"type":"session","id":...}` header of the session file when that file exists, and otherwise from the filename, which omp formats as `<timestamp>_<sessionId>.jsonl`. It is resolved once per session so a session that starts in memory and later lands on disk cannot end up with two ids.

The project slug matches the other Han bridges byte for byte, so one project indexed from two harnesses lands under one slug.

## Limitations

- **Session files are a dependency.** Token and cost tracking reads omp's on-disk session format. If that format changes, cost tracking for omp goes quiet rather than reporting wrong numbers.
- **A session with no assistant message has no usage.** omp keeps a new session in memory until its first assistant message, so a session abandoned before the model replies produces lifecycle events and nothing else. That is correct, not a failure.
- **Tool output is not recorded.** An omp `read` result is an entire file. Only failures record their message, since that is the part worth investigating.
- **No hooks, no gating.** omp supports blocking a tool from a `tool_call` handler, but this bridge does not use it. A throw from a `tool_call` handler is fail-closed in omp and would block a user's tool, which is not an acceptable risk for telemetry.

## Development

```
bun install
bun run typecheck
bun test
```
