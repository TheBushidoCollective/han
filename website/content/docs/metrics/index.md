---
title: "Local Metrics"
description: "Track task completion and agent performance with local metrics."
---

Han's metrics system gives your coding agent self-awareness through measurement. By tracking tasks with confidence estimates and comparing them against actual outcomes, both you and the agent can see where confidence aligns with reality, and where it doesn't. It measures every harness Han bridges, not only Claude Code.

## The Problem: Uncalibrated Confidence

AI assistants often express confidence that doesn't match reality. "I've fixed the bug" when the tests still fail. "This should work" when it doesn't. Without feedback loops, there's no way to improve.

Han's metrics system creates that feedback loop.

## MCP Tools for Task Tracking

The core plugin exposes MCP tools for metrics tracking:

| Tool | Purpose |
|------|---------|
| `start_task` | Begin tracking a new task |
| `update_task` | Log progress notes |
| `complete_task` | Mark done with outcome and confidence |
| `fail_task` | Record failure with attempted solutions |
| `query_metrics` | Analyze task performance |

## How It Works

### Starting a Task

When Claude begins work on something substantive, it calls `start_task`:

```javascript
start_task({
  description: "Fix authentication timeout bug",
  type: "fix",  // implementation, fix, refactor, research
  estimated_complexity: "moderate"  // simple, moderate, complex
})
// Returns: { task_id: "task_abc123" }
```

### Tracking Progress

During work, Claude can log updates:

```javascript
update_task({
  task_id: "task_abc123",
  notes: "Found root cause - session expiry not refreshing"
})
```

### Recording Outcomes

When finished, Claude records the outcome with a confidence score:

```javascript
complete_task({
  task_id: "task_abc123",
  outcome: "success",  // success, partial, failure
  confidence: 0.85,  // 0.0 to 1.0
  files_modified: ["src/auth/session.ts"],
  tests_added: 2,
  notes: "Fixed refresh logic, added edge case tests"
})
```

The **confidence score** (0.0 to 1.0) is the key to calibration. Claude estimates how confident it is that the task actually succeeded. This gets validated against hook results and actual outcomes.

### Recording Failures

When a task can't be completed:

```javascript
fail_task({
  task_id: "task_abc123",
  reason: "Requires database migration that needs approval",
  confidence: 0.9,
  attempted_solutions: [
    "Tried updating schema in-place",
    "Attempted backwards-compatible approach"
  ]
})
```

Recording failures with attempted solutions helps identify patterns - certain types of tasks that consistently hit the same blockers.

## Calibration: The Core Value

Raw metrics are interesting. **Calibration is valuable.**

When Claude says it's 80% confident a task succeeded, that should mean roughly 80% of similar tasks actually succeeded. If Claude says 80% confident but is only right 50% of the time, that's poorly calibrated. If Claude says 80% and is right 78-82% of the time, that's well calibrated.

The `query_metrics` tool lets you analyze this:

```javascript
query_metrics({
  period: "week",  // day, week, month
  task_type: "fix",  // Optional filter
  outcome: "success"  // Optional filter
})
```

Returns aggregated statistics including success rates by confidence bucket, enabling calibration analysis.

## What Gets Stored

All metrics are stored locally in SQLite at `~/.han/han.db`, or under `$HAN_DATA_DIR` when that is set. **No data leaves your machine.** You control it entirely.

The database contains tables for:

- `tasks` - Task tracking with descriptions, outcomes, and confidence
- `hook_executions` - Hook run results with timing and exit codes
- `frustration_events` - User sentiment and frustration detection

Data can be queried directly with any SQLite client or through the Browse UI.

## The Harness Dimension

Han indexes sessions from every coding agent it bridges. Each session records which one produced it, so a metric can be read per harness instead of averaged across all of them.

| Harness id | Coding agent |
|---|---|
| `claude-code` | Claude Code |
| `omp` | Oh My Pi |
| `opencode` | OpenCode |
| `gemini-cli` | Gemini CLI |
| `kiro` | Kiro CLI |
| `codex` | OpenAI Codex CLI |
| `antigravity` | Google Antigravity |

Those exact strings are the canonical ids. The same value appears in the JSONL event envelope as `harness`, in the `sessions.harness` column, and on `Session.harness` in the GraphQL API.

### Where the harness comes from

The indexer derives a session's harness from its file path, not from the events inside it. A bridge writes to `~/.han/<harness>/projects/<slug>/`, so the directory name is the harness. Anything under `~/.claude/projects` is Claude Code.

Individual events still carry their own `harness` field, and a reader inspecting one event sees it there. That field is not what sets the session's harness. A session cannot legitimately change harness partway through, and a path is something the indexer can trust without parsing file contents. Expect the asymmetry: the event says it, the path decides it.

Sessions recorded before harness tracking existed read as `claude-code`. Claude Code was the only harness Han could index at the time, so the migration backfills those rows rather than leaving them unattributed. There is no NULL harness to work around in a query.

### Filtering by harness in GraphQL

`Session.harness` is a non-null `String` carrying one of the ids above:

```graphql
{
  sessions(first: 20) {
    edges {
      node {
        sessionId
        harness
        messageCount
      }
    }
  }
}
```

Filtering rides the standard `SessionFilter` input, so no new query argument is involved. Counting the sessions from one harness is the same query asking only for `totalCount`:

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

`harness` is a `StringFilter`, so `_eq`, `_ne`, `_in`, `_notIn`, `_contains`, `_startsWith`, `_endsWith`, and `_isNull` all apply, it composes with `_and`, `_or`, and `_not`, and it is sortable through `SessionOrderBy`:

```graphql
{
  sessions(
    first: 50
    filter: { harness: { _in: ["omp", "opencode", "codex"] } }
    orderBy: { harness: ASC }
  ) {
    edges {
      node {
        sessionId
        harness
        projectName
      }
    }
  }
}
```

### Token and cost data across harnesses

Claude Code records token usage in its own transcript, which Han reads directly. No other harness writes a transcript Han parses, so a bridge has to report usage explicitly with a `token_usage` event carrying the model, the input, output, cache read and cache creation token counts, and the cost in USD when the harness computes one. The indexer lifts those counts into the same message columns the Claude Code path fills, so any harness that reports them is covered by the existing token and cost aggregates rather than needing its own.

Coverage is not uniform, so read a cost total as covering the harnesses that report cost rather than all seven. What each harness actually reports today:

| Harness | Sessions | Tool calls | File changes | Tokens and cost |
|---|---|---|---|---|
| `claude-code` | Yes | Yes | Yes | Yes, read from its own transcript |
| `omp` | Yes | Yes | Yes | Yes, via `token_usage` |
| `opencode` | Yes | Yes | Yes | No |
| `gemini-cli` | Yes | Yes | Yes | No |
| `kiro` | Yes | Yes | Yes | No |
| `codex` | Yes | Yes | Yes | No |
| `antigravity` | Yes | Yes | Yes | No |

Closing that gap is a per-bridge change and needs nothing from the indexer. The ingestion path is already there, the `token_usage` event type is harness-agnostic, and the `messages` token columns already exist and are already what the aggregates read. A bridge that starts emitting `token_usage` is counted from its next session with no other change anywhere.

A harness that reports no cost omits the cost field rather than sending zero, which keeps a genuinely free turn distinguishable from an unmeasured one.

## Integration with Hooks

The metrics system integrates with Han's hook execution. When hooks run at session end:

1. Hook results (pass/fail) are recorded automatically
2. These correlate with task confidence estimates
3. Discrepancies highlight calibration issues

If Claude marks a task as "success" with 90% confidence, but the lint hook fails, that's a calibration signal. Over time, these signals improve Claude's ability to accurately assess its own work.

## Practical Usage

You don't need to think about metrics constantly. The system works in the background:

1. **Session starts** - Claude is reminded of recent performance
2. **Task begins** - Claude calls `start_task`
3. **Work happens** - Progress tracked naturally
4. **Task ends** - Outcome and confidence recorded
5. **Session ends** - Hooks validate, metrics updated

The value compounds. After 50 sessions, you have real data on:

- Which task types have highest success rates
- Where confidence tends to be miscalibrated
- Which hooks fail most often
- How productivity trends over time

## Privacy by Design

Everything stays local:

- No cloud storage
- No external APIs
- No telemetry unless you explicitly enable it (see [OpenTelemetry](/docs/metrics/opentelemetry))
- Full control over your data

The metrics exist to help you, not to report on you.

## Getting Started

Metrics are included in the core plugin. The system activates automatically, but you can query it any time:

```bash
# Install core plugin if not already
han plugin install core

# Then in Claude Code, ask:
# "Show me my task metrics for the past week"
# "Which hooks have been failing?"
# "How's my calibration looking?"
```

Claude will call the appropriate query tools and present the data.

## The Long View

Metrics aren't about judgment. They're about learning. A 60% success rate isn't "bad" - it's information. It might mean you're tackling hard problems. It might mean certain patterns need attention. It might mean nothing without more context.

The value is in the trends, the patterns, the calibration over time. After months of tracking, you'll have a real picture of how AI-assisted development works in your specific context.

That's worth knowing.

## Learn More

- [OpenTelemetry Integration](/docs/metrics/opentelemetry) - Export metrics to observability platforms
- [MCP Integrations](/docs/integrations) - Understanding Han's MCP architecture
