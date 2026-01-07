---
title: "Know Thyself: Han's Metrics System for Agent Self-Awareness"
description: "How Han tracks task performance, confidence calibration, and hook failures to help Claude Code learn from experience."
date: "2025-12-07"
author: "The Bushido Collective"
tags: ["metrics", "calibration", "performance", "mcp"]
category: "Technical Deep Dive"
---

How do you know if an AI assistant is actually getting better at helping you? Not through feelings or impressions, but through data. Han's metrics system gives Claude Code something rare in AI tooling: self-awareness grounded in measurement.

## The Problem: Uncalibrated Confidence

AI assistants often express confidence that doesn't match reality. "I've fixed the bug" when the tests still fail. "This should work" when it doesn't. Without feedback loops, there's no way to improve.

Han's metrics system creates that feedback loop. When Claude tracks tasks with confidence estimates, then compares those estimates against actual outcomes, patterns emerge. Over time, both you and Claude can see where confidence aligns with reality - and where it doesn't.

## MCP Tools for Task Tracking

The core plugin exposes seven MCP tools for metrics:

| Tool | Purpose |
|------|---------|
| `start_task` | Begin tracking a new task |
| `update_task` | Log progress notes |
| `complete_task` | Mark done with outcome and confidence |
| `fail_task` | Record failure with attempted solutions |
| `query_metrics` | Analyze task performance |
| `query_hook_metrics` | Track hook failures |
| `query_session_metrics` | Session-level statistics |

## How It Works

### Starting a Task

When Claude begins work on something substantive, it calls `start_task`:

```javascript
start_task({
  description: "Fix authentication timeout bug",
  type: "fix",
  estimated_complexity: "moderate"
})
// Returns: { task_id: "task_abc123" }
```

Task types include `implementation`, `fix`, `refactor`, and `research`. Complexity can be `simple`, `moderate`, or `complex`.

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
  outcome: "success",
  confidence: 0.85,
  files_modified: ["src/auth/session.ts"],
  tests_added: 2,
  notes: "Fixed refresh logic, added edge case tests"
})
```

The confidence score (0.0 to 1.0) is the key to calibration. Claude estimates how confident it is that the task actually succeeded. This gets validated against hook results and actual outcomes.

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

Raw metrics are interesting. Calibration is valuable.

When Claude says it's 80% confident a task succeeded, that should mean roughly 80% of similar tasks actually succeeded. If Claude says 80% confident but is only right 50% of the time, that's poorly calibrated. If Claude says 80% and is right 78-82% of the time, that's well calibrated.

The `query_metrics` tool lets you analyze this:

```javascript
query_metrics({
  period: "week",
  task_type: "fix"
})
```

Returns aggregated statistics including success rates by confidence bucket, enabling calibration analysis.

## Hook Metrics

Beyond task tracking, Han tracks hook execution:

```javascript
query_hook_metrics({
  period: "week",
  min_failure_rate: 10
})
```

This shows which hooks fail frequently. A lint hook with 40% failure rate might indicate:

- Overly strict rules
- A specific file pattern that always fails
- A configuration issue worth investigating

You can filter by hook name or minimum failure rate to focus on problematic hooks.

## Session Metrics

For broader patterns, query session-level data:

```javascript
query_session_metrics({
  period: "month",
  limit: 20
})
```

This aggregates across sessions, showing:

- Tasks per session
- Success rates over time
- Common failure patterns
- Productivity trends

## What Gets Stored

All metrics are stored locally in SQLite at `~/.claude/han/han.db`. No data leaves your machine. You control it entirely.

The database contains tables for tasks, hook executions, and frustration events - all queryable with any SQLite client or through the Browse UI.

## Integration with Hooks

The metrics system integrates with Han's hook execution. When hooks run at session end:

1. Hook results (pass/fail) are recorded automatically
2. These correlate with task confidence estimates
3. Discrepancies highlight calibration issues

If Claude marks a task as "success" with 90% confidence, but the lint hook fails, that's a calibration signal. Over time, these signals improve Claude's ability to accurately assess its own work.

## Practical Usage

You don't need to think about metrics constantly. The system works in the background:

1. **Session starts**: Claude is reminded of recent performance
2. **Task begins**: Claude calls `start_task` (guided by hook prompts)
3. **Work happens**: Progress tracked naturally
4. **Task ends**: Outcome and confidence recorded
5. **Session ends**: Hooks validate, metrics updated

The value compounds. After 50 sessions, you have real data on:

- Which task types have highest success rates
- Where confidence tends to be miscalibrated
- Which hooks fail most often
- How productivity trends over time

## Privacy by Design

Everything stays local:

- No cloud storage
- No external APIs
- No telemetry unless you explicitly enable it
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

---

**Get Started:** Metrics are included in the core plugin:

```bash
han plugin install core
```

Or explore the full plugin marketplace at [han.guru](https://han.guru).
