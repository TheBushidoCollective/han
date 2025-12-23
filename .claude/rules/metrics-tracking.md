# Metrics Tracking

When working on non-trivial tasks (implementation, fixes, refactoring, research), use the Han metrics tools to track work:

## Starting Tasks

Use `mcp__plugin_core_han__start_task` when beginning work on:
- New feature implementations
- Bug fixes
- Code refactoring
- Research/investigation tasks

```
mcp__plugin_core_han__start_task({
  description: "Brief description of the task",
  type: "implementation" | "fix" | "refactor" | "research"
})
```

## Completing Tasks

Use `mcp__plugin_core_han__complete_task` when finishing:

```
mcp__plugin_core_han__complete_task({
  task_id: "task-xxx",
  outcome: "success" | "partial" | "failure",
  confidence: 0.0-1.0,  // How confident you are in the outcome
  notes: "Optional completion notes"
})
```

## When NOT to Track

Skip tracking for:
- Simple questions/explanations
- Single-line changes
- Trivial fixes (typos, formatting)
- Conversation-only interactions

## Important

The metrics tools are SEPARATE from the TodoWrite tool:
- **TodoWrite**: Shows task progress UI to the user
- **start_task/complete_task**: Records metrics for analysis in the Browse UI
