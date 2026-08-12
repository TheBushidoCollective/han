---
name: cross-harness-metrics
summary: Indexing and attributing sessions from every coding agent han bridges, not only Claude Code
---

# Cross-Harness Metrics

han indexes sessions from every coding agent it bridges and records which one produced each session. This blueprint covers the harness id set, the standalone ingestion path bridged harnesses use, how the indexer decides a han events file is a session in its own right, where the harness lives in the database, and the four breaks this work repaired.

## Overview

Before this, "a session" meant a Claude Code session. Bridges for OpenCode, Gemini CLI, Kiro, Codex, and Antigravity all wrote han-format JSONL, all started the coordinator, and all documented themselves as visible in the Browse UI. None of them were. Four independent defects sat between a bridge writing a file and that file reaching SQLite, and every one of them failed silently.

The fix has two halves. The ingestion half makes a bridge's JSONL a real session. The attribution half records which harness produced it, so a metric can be read per harness instead of averaged across all of them.

## Architecture

### Harness ids

Seven canonical ids. These exact strings are the vocabulary everywhere: the event envelope, the database column, the GraphQL field, and the directory name on disk.

`claude-code`, `omp`, `opencode`, `gemini-cli`, `kiro`, `codex`, `antigravity`

Where the ids live, and why it is not one place:

- `packages/han/lib/events/harness.ts` (`HARNESS_IDS`) is the source of truth for the han CLI and everything else in `packages/`. It is the only complete, machine-checked enumeration.
- The five environment-resolved bridges, `opencode`, `gemini-cli`, `kiro`, `codex`, and `antigravity`, each repeat the whole set verbatim in their own `plugins/bridges/<harness>/src/types.ts` as a `HanHarness` union with a matching `HAN_HARNESSES` array. They need the full set because each resolves its harness from the environment at runtime and validates what it finds. Bridges are separately built and do not import from `packages/han`, so they cannot share the constant. These lists must stay identical to `HARNESS_IDS`.
- The omp bridge does not carry the set at all. `plugins/bridges/omp/src/types.ts` declares a single `export const HAN_HARNESS = 'omp'`, because that bridge only ever runs inside omp and has nothing to resolve. Prefer this shape for a new bridge: a constant cannot drift from a list it does not have.

Rust never enumerates the set. It does not need to: the indexer reads whatever harness segment the path carries, and the column stores a string. Rust defines only the fallback, `DEFAULT_HARNESS`, once in `han_db::entities::sessions`. han-api imports it from han-db and han-indexer re-exports it with `pub use`. Do not add a second Rust definition; validating the set in Rust would also mean a code change is required before a new bridge's sessions can be indexed, which is exactly the coupling the string column avoids.

There is no enum. The ids are plain strings end to end, in kebab case, in GraphQL as well as in storage. An enum would force a schema change and a migration every time a bridge is added, which is exactly the kind of friction that keeps bridges unwritten.

### Two on-disk layouts

Claude Code writes a native transcript and han writes an events file beside it:

```text
~/.claude/projects/{slug}/
├── {sessionId}.jsonl        # Claude Code transcript
└── {sessionId}-han.jsonl    # han events
```

A bridged harness writes only the events file, under its own harness root:

```text
~/.han/{harness}/projects/{slug}/
└── {sessionId}-han.jsonl    # the entire session record
```

That difference is the whole problem. The indexer was built when only the first layout existed, and it treated a `*-han.jsonl` as a supplement to a transcript rather than as something that could stand alone.

### Ingestion path

```text
bridge writes ~/.han/<harness>/projects/<slug>/<sessionId>-han.jsonl
    |
    v
coordinator watcher (live) or full scan (startup)
    |
    +-- roots from bridge_harness_roots(): every child of ~/.han with a projects dir
    |
    v
native_sibling(path) -> None, so the events file is the session
    |
    v
index_session_file()
    |
    +-- harness_from_path() -> the segment before `projects`
    |
    v
crud::sessions::upsert(..., harness)
    |
    v
sessions.harness, then Session.harness in GraphQL
```

## Behavior

### Deciding a han events file is its own session

`native_sibling()` in `packages/han-rs/crates/han-indexer/src/processor.rs` is the single place that decides. It classifies the path, and for a `HanEvents` file joins the parent directory with `{sessionId}.jsonl`. If that file exists the events file belongs to a transcript. If it does not, the events file is the session's only record.

Say it that way when explaining it: a han events file beside a native transcript is read as part of that transcript; one standing alone becomes a session in its own right.

Two call sites consume the decision:

- `index_project_directory()` collects `ClassifiedFile::HanEvents` paths instead of discarding them, then indexes the ones with no sibling. Files with a sibling are skipped, because indexing the transcript already read them.
- `handle_file_event()` indexes the sibling transcript when there is one, and otherwise falls through to indexing the events file directly.

`ClassifiedFile::HanEvents` itself is unchanged. There is no new classification, and adding one would be the wrong fix: the file's kind did not change, only what the indexer is willing to do with it.

### Discovering harness roots

`bridge_harness_roots()` enumerates every child of `~/.han` that contains a `projects` directory and returns it as a root. Both the full scan and the live watcher consume it:

- `full_scan_and_index()` appends the roots to `dirs_to_scan` alongside `~/.claude` and any DB-registered config dirs.
- `add_extra_watch_paths()` in `han-coordinator/src/watcher_bridge.rs` chains the roots onto the registered config dirs and calls `add_watch_path(root, Some(&root.join("projects")))` for each.

Discovery is from disk, not from registration. A bridge does not announce itself, pass a flag, or write a row. It writes a file in the conventional place and is indexed. That is a deliberate choice: any registration step is a step a bridge can skip, and a bridge that skips it is silently invisible, which is the exact failure this work existed to repair.

Known limit, and it is real rather than theoretical: roots are enumerated once, when the watcher starts. A newly installed bridge creates `~/.han/<harness>/projects` for the first time after the coordinator is already running, and that new root is not watched until the coordinator restarts. The session is not lost, because the next full scan finds it, but it is not live either. The first session from a newly installed bridge appears at the next coordinator start; every session after that is live. Rescanning for new directories is a feature with its own failure modes and was left out on purpose.

### Where the harness comes from

`harness_from_path()` derives it. The function walks path components from the end looking for `projects`, and takes the preceding segment when the one before that is `.han`. Anything else, in practice `~/.claude/projects`, is `claude-code`.

It walks from the end specifically so a project directory literally named `han` cannot be mistaken for the `.han` root.

The path wins over the event envelope, and the asymmetry is intentional:

- Every bridge stamps `harness` into each event's envelope, and a reader inspecting one event sees it there.
- The session's harness comes from the path only. A session cannot legitimately change harness partway through, so a per-line value is the wrong shape for a per-session fact, and the path is something the indexer can trust without parsing content.

Anyone reading the code will notice the envelope field and assume it feeds the column. It does not. Leave the comment in place that says so.

### Storage

Column `harness`, TEXT, nullable, on `sessions`, with index `idx_sessions_harness`. Migration `packages/han-rs/crates/han-db/src/migration/m20260812_session_harness.rs`, registered in `migration.rs`. Entity field `pub harness: Option<String>` on `han_db::entities::sessions::Model`.

The migration backfills every pre-existing row to `claude-code`, since Claude Code was the only harness han could index before this. The column stays nullable so a writer may omit it, but no row is left NULL.

The backfill decision is worth preserving, because the first instinct is to skip it. Leaving legacy rows NULL keeps "measured Claude Code" distinguishable from "assumed Claude Code", which sounds valuable until you look for a consumer and cannot name one. The cost is concrete and permanent: the GraphQL resolver coalesces NULL to `claude-code`, but filters run against the raw column, so `harness: { _eq: "claude-code" }` would silently skip every session recorded before the column existed. A read and a filter that disagree is a query surface that lies. Do not reintroduce the NULL.

`crud::sessions::upsert` takes a trailing `harness: Option<String>` where `None` leaves any existing value alone rather than clearing it, so a re-index that cannot determine the harness never downgrades a row that already knows.

### Token and cost across harnesses

Claude Code records usage in its transcript and the indexer reads it with `extract_token_usage()`. No other harness writes a transcript han parses, so a bridge must report usage explicitly through a `token_usage` han event carrying `model`, optional `provider`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, and optional `cost_usd`.

`han_event_token_usage()` lifts those counts into the same `messages` token columns the Claude Code path fills, which is what the existing token and cost aggregates already read. Before this, those columns were always NULL on the han-event path, which is why cost metrics for anything but Claude Code were not merely missing but impossible.

Emission is per bridge and currently uneven. What each harness reports:

| Harness | Sessions | Tool calls | File changes | Tokens and cost |
|---|---|---|---|---|
| `claude-code` | Yes | Yes | Yes | Yes, read from its own transcript |
| `omp` | Yes | Yes | Yes | Yes, via `token_usage` |
| `opencode` | Yes | Yes | Yes | No |
| `gemini-cli` | Yes | Yes | Yes | No |
| `kiro` | Yes | Yes | Yes | No |
| `codex` | Yes | Yes | Yes | No |
| `antigravity` | Yes | Yes | Yes | No |

Closing the gap is a per-bridge change that needs nothing from the indexer: the ingestion path exists, the event type is harness-agnostic, and the columns the aggregates read are already populated by `han_event_token_usage()`. Do not read "han tracks cost across harnesses" into this. Five of seven report nothing, and a cost rollup that silently spans only two of them is the same class of claim this branch removed from the bridge install docs.

`cost_usd` is omitted rather than zeroed when a harness reports no cost, so a free turn stays distinguishable from an unmeasured one.

One trap specific to omp, recorded so nobody "simplifies" it: the omp bridge reads token and cost figures out of omp's session JSONL rather than off an event. That looks like an avoidable on-disk coupling until you check the alternative. `after_provider_response` fires before the response stream body is consumed, so final output token counts do not exist yet, and the only usage consumer on that path handles provider rate-limit headers rather than per-message accounting. Moving usage onto that event would produce numbers that are silently incomplete rather than an error.

## API / Interface

`Session.harness` is a non-null `String`. The resolver coalesces a NULL column to `DEFAULT_HARNESS` defensively; after the backfill no row should need it, but the column is still nullable and a future writer could omit it.

Filtering rides the macro-generated `SessionFilter`, so no new query argument exists. `harness` is a `StringFilter`, supporting `_eq`, `_ne`, `_contains`, `_startsWith`, `_endsWith`, `_in`, `_notIn`, and `_isNull`, composing with `_and`, `_or`, and `_not`, and sortable through `SessionOrderBy`.

```graphql
{
  sessions(first: 20, filter: { harness: { _eq: "omp" } }) {
    totalCount
    edges {
      node {
        sessionId
        harness
      }
    }
  }
}
```

## The Four Breaks This Repaired

Each of these shipped, each failed silently, and each is easy to reintroduce. This section exists so nobody does.

### 1. Bridges passed an option that did not exist

Every bridge spawned `han coordinator ensure --background --watch-path <dir>`. `--watch-path` was never registered on the `ensure` subcommand, so Commander exited 1 with `error: unknown option '--watch-path'` and the coordinator never started. The spawn was fire and forget, so nothing surfaced the failure.

Bridges now call `han coordinator ensure --background` and nothing else. Do not add a path flag back. The coordinator finds harness roots itself, and a flag would reintroduce the class of bug where the caller and the callee disagree about an interface with no test covering the pair.

### 2. The coordinator watched the wrong directories

The watcher covered `~/.claude/projects` plus DB-registered `config_dirs`. Bridge directories under `~/.han/<harness>/projects` were never in either set, so no file event was ever emitted for a bridge file. Fixed by `bridge_harness_roots()` feeding both the watcher and the full scan.

This one has a partial-fix trap. Adding the roots to `full_scan_and_index()` alone looks like it works, because sessions do appear after a coordinator restart. They just never appear live, and `handle_file_event()`'s standalone branch stays unreachable. Both call sites are required.

### 3. Registration was impossible anyway

`registerConfigDir` in `packages/han/lib/grpc/data-access.ts` throws `'registerConfigDir: coordinator-internal operation'`, so `han coordinator register` could not register a bridge directory even if a bridge had tried. It is still stubbed, deliberately. Disk discovery replaced the need for it rather than unblocking it.

### 4. The indexer dropped standalone han event files

`index_project_directory()` matched `ClassifiedFile::HanEvents` to `{}` with the comment "Processed with main file", and `handle_file_event()` returned `Ok(None)` when a `*-han.jsonl` had no sibling transcript. Both assumed a native sibling always exists. For a bridge, one never does, so no bridge events file was ever opened. The comment was accurate about intent and wrong about reach: the file was skipped on the assumption that a main file had already covered it, and for a bridge there was no main file to have covered anything.

The assumption is the thing to watch for. Any new code that pairs a han events file with a transcript must go through `native_sibling()` and handle `None` as a valid, common case rather than as an error or a skip.

## Files

- `packages/han/lib/events/harness.ts` - Canonical `HARNESS_IDS`, `HarnessId`, `DEFAULT_HARNESS`, and the `HARNESS` value for the running process
- `packages/han/lib/events/types.ts` - `BaseEvent.harness`, `TokenUsageEvent`
- `packages/han-rs/crates/han-indexer/src/processor.rs` - `harness_from_path()`, `native_sibling()`, `has_native_sibling()`, `bridge_harness_roots()`, `han_event_token_usage()`, `index_project_directory()`, `handle_file_event()`, `full_scan_and_index()`
- `packages/han-rs/crates/han-coordinator/src/watcher_bridge.rs` - Watching harness roots
- `packages/han-rs/crates/han-db/src/entities/sessions.rs` - `harness` column, `DEFAULT_HARNESS`
- `packages/han-rs/crates/han-db/src/migration/m20260812_session_harness.rs` - Column, index, backfill
- `packages/han-rs/crates/han-db/src/crud/sessions.rs` - `upsert` harness argument
- `packages/han-rs/crates/han-api/src/types/sessions/mod.rs` - `Session.harness`, `SessionFilterSource`
- `plugins/bridges/{opencode,gemini-cli,kiro,codex,antigravity}/src/types.ts` - `HanHarness` union, `HAN_HARNESSES`, and `getHarness()` resolving from `HAN_PROVIDER`
- `plugins/bridges/omp/src/index.ts` - The only bridge emitting `token_usage`; wires `session_start`, `session_switch`, `session_shutdown`, `session_compact`, `tool_execution_start`, `tool_execution_end`, `turn_end`
- `plugins/bridges/omp/src/types.ts` - Fixed `HAN_HARNESS = 'omp'`, `TOOL_NAME_MAP`, and the omp session-entry types; no union and no resolution
- `plugins/bridges/omp/src/session.ts` - Session id and slug derivation, and usage extraction from omp's session JSONL
- `plugins/bridges/*/src/events.ts` - Per-bridge event envelope; omp's is the only one emitting `token_usage`

## Related Systems

- [Han Events Logging](./han-events-logging.md) - The JSONL event format and logger
- [Coordinator Daemon](./coordinator-daemon.md) - Watcher and scan lifecycle
- [Coordinator Data Layer](./coordinator-data-layer.md) - Indexing into SQLite
- [Harness Feature Parity](./harness-feature-parity.md) - Which hook surface each bridge covers
- [Metrics System](./metrics-system.md) - Task tracking indexed from transcripts
