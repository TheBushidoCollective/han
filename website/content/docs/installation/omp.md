---
title: "Using Han with Oh My Pi"
description: "How to record Oh My Pi (omp) sessions in Han's metrics, using the omp telemetry bridge extension."
---

Han records [Oh My Pi](https://github.com/badlogic/oh-my-pi) (`omp`) sessions through a bridge extension, so omp work is counted, costed, and comparable alongside your Claude Code sessions.

Read the next paragraph before the rest of this page, because this bridge is not shaped like the others.

## What This Bridge Does and Does Not Do

The omp bridge is **telemetry only**. It observes omp and reports what happened to Han:

- Session lifecycle: when an omp session starts, compacts, and ends
- Per-tool-call records, with omp's tool names mapped onto Claude Code's
- File-change records for edits and writes
- Token counts and dollar cost, per assistant message

It does **not** run Han plugin hooks. There is no validation, no linting on save, no context injection, no skills or disciplines, and no permission gating in omp. The OpenCode, Gemini CLI, Kiro, and Codex bridges execute Han's hook pipeline; this one does not. If you came here expecting `biome` to run when the agent writes a file, that is not what this integrates.

The reason is deliberate. omp fails closed on its `tool_call` and `tool_result` events: a handler that throws blocks the tool from running. Hanging validation off those events means a bug in Han can stop a user's tool call. The bridge instead uses `tool_execution_start` and `tool_execution_end`, which omp documents as observability and which cannot block anything. omp's `{ block: true, reason }` capability is real and genuinely useful, but this bridge does not use it.

## Setup

### 1. Install Han

```bash
curl -fsSL https://han.guru/install.sh | bash
```

### 2. Add the Han marketplace to omp

omp reads Claude Code marketplace catalogs. It prefers `.omp-plugin/marketplace.json` and falls back to `.claude-plugin/marketplace.json`, which is the one Han publishes:

```bash
omp plugin marketplace add thebushidocollective/han
```

### 3. Install the bridge

```bash
omp plugin install omp@han
```

Add `--scope project` to install it for the current project only. The default scope is `user`, which applies to every project. An enabled project-scoped install shadows an enabled user-scoped one.

### 4. Restart omp

This step is not optional. Marketplace installs update disk state but do not rebuild a running session, and `/reload-plugins` refreshes skills, slash commands, and MCP servers but **not** extension modules. A newly installed bridge does nothing until omp restarts.

Confirm the install:

```bash
omp plugin list
```

### Alternative: load the extension directly

Working from a checkout instead of the marketplace? Point omp at the bridge directory with an `extensions:` entry in `~/.omp/agent/config.yml`:

```yaml
extensions:
  - ~/dev/src/github.com/thebushidocollective/han/plugins/bridges/omp
```

Point it at the plugin **directory**, not a file. omp resolves a directory through its `package.json` `omp.extensions` entry, which in this package is `["./src/index.ts"]`, before falling back to `index.ts` or a one-level scan. The project-scoped equivalents are `<cwd>/.omp/extensions/` and the `extensions:` key in `<cwd>/.omp/config.yml`. Under `omp --profile <name>` the user directory becomes `~/.omp/profiles/<name>/agent/`.

## What Gets Recorded

| omp Event | Han Event | Hook Type |
|---|---|---|
| `session_start` | `hook_run` + `hook_result` | `SessionStart` |
| `session_switch` | closes the outgoing session, opens the incoming one | `Stop`, then `SessionStart` |
| `session_compact` | `hook_run` + `hook_result` | `PreCompact` |
| `session_shutdown` | `hook_run` + `hook_result` | `Stop` |
| `tool_execution_start` | `hook_run` | `PostToolUse` |
| `tool_execution_end` | `hook_result`, plus `hook_file_change` for writes and edits | `PostToolUse` |
| `turn_end` | one `token_usage` per new assistant message | none |

The `plugin` field on those hook events is the literal `omp-bridge`. The `hook` field is the tool name for tool events, `session` for session start and end, and `compact` for compaction. Nothing is aggregated: one `token_usage` event per assistant message.

A tool still running when the session dies leaves a `hook_run` with no matching `hook_result`, which is how Han represents abandoned work rather than a defect in the bridge.

`session_switch` is wired because omp retargets the session file mid-process. Without it, every tool call and every token after a switch would be billed to the session you just left.

## Tool Name Mapping

Han keys tool metrics by name, so an omp `read` and a Claude Code `Read` have to arrive as the same tool or no cross-harness comparison lines up:

| omp Tool | Claude Code Equivalent |
|---|---|
| `read` | `Read` |
| `write` | `Write` |
| `edit` | `Edit` |
| `bash` | `Bash` |
| `glob` | `Glob` |
| `grep` | `Grep` |
| `task` | `Task` |
| `eval` | `Eval` |
| `browser` | `Browser` |
| `computer` | `Computer` |
| `debug` | `Debug` |
| `hub` | `Hub` |
| `yield` | `Yield` |

Unrecognized names, including MCP server tools and other extensions' tools, pass through unchanged.

## Token and Cost Accounting

omp's extension event bus carries no completed token counts and no dollar cost, so the bridge reads them out of omp's own session JSONL on `turn_end` and emits one `token_usage` event per new assistant message.

This is not a workaround for an event that would have been easier. The nearest candidate, `after_provider_response`, fires *before the response stream body is consumed*, so final output token counts cannot exist yet; the only usage consumer on that path records provider rate-limit and quota headers, not per-message accounting. The session file is where the completed numbers live, and it is the only place they live.

Each persisted assistant message carries `model`, `provider`, and a `usage` object with `input`, `output`, `cacheRead`, `cacheWrite`, and a `cost` breakdown including `cost.total`.

Both the load path and the event surface were observed rather than inferred. Running the extension under real omp 17.2.15 with `omp -p --tools=bash --extension <plugin>/src/index.ts "run echo hello-han"` produced eight events in `~/.han/omp/projects/<slug>/<sessionId>-han.jsonl`, each tagged `harness=omp`: a `SessionStart` pair, a `PostToolUse` pair for `Bash`, two `token_usage` events carrying model and dollar cost, and a `Stop` pair.

**This is a genuine dependency on omp's on-disk format, and you should know about it.** If omp changes the shape of its session entries, cost tracking for omp goes quiet. It degrades to producing no usage events rather than to producing wrong numbers, which is the right direction to fail, but a silent stop is still a stop. A provider omp cannot price, such as a local model, reports no cost rather than a zero, so a genuinely free turn stays distinguishable from an unpriced one.

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/omp/projects/{slug}/{sessionId}-han.jsonl`. Every event carries `harness: "omp"`, the canonical id Han uses for Oh My Pi wherever it reports on a session. The project slug is derived exactly as the OpenCode bridge derives it, so one project worked on from two harnesses lands under one slug.

omp writes no native transcript into that directory, so the events file is the session's entire record. Han indexes a `*-han.jsonl` file that has no sibling `{sessionId}.jsonl` as a session in its own right rather than as a supplement to a Claude Code transcript, and stamps the harness onto the session row. omp sessions show up in the Browse UI and in metrics queries beside Claude Code sessions, attributed to `omp` rather than folded into it.

The coordinator finds the directory without being told about it. Every child of `~/.han` holding a `projects` directory is a harness root, so the bridge needs no registration step and no watch flag. On `session_start` the bridge runs `han coordinator ensure --background` to make sure the coordinator is up.

The first omp session you record is the exception to live indexing. It creates `~/.han/omp/projects` for the first time, and the coordinator enumerates harness roots when it starts, so that session is indexed at the next coordinator start rather than as it is written. Every session after it is live.

For what the harness dimension buys you once the data is indexed, see [Local Metrics](/docs/metrics#the-harness-dimension).

## Remaining Gaps

- **No hook execution**: Han's validation pipeline, context injection, skills, and disciplines do not run in omp. This bridge reports on omp; it does not extend it.
- **No permission gating**: the bridge deliberately avoids omp's blocking events, so it cannot deny a tool call.
- **A session with no model reply has no usage**: omp writes nothing to disk until a session's first assistant message, so a session that ends before the model replies produces lifecycle events and no token or cost data. That is correct behaviour, not a gap in coverage.
- **Session format coupling**: token and cost data depend on omp's persisted session entry shape, as described above.
- **Restart required**: extension modules load only at startup, so installing or upgrading the bridge needs an omp restart rather than `/reload-plugins`.

## Next Steps

- Read about [Local Metrics](/docs/metrics) to see how omp sessions are measured and filtered
- For a harness where Han's full hook pipeline does run, see [OpenCode](/docs/installation/opencode) or [Codex CLI](/docs/installation/codex)
