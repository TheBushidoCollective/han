# Task Tracking (REQUIRED)

**You MUST track substantive work using the metrics MCP tools.** This is separate from and complementary to TodoWrite.

## Two Systems - Different Purposes

| System | Purpose | Granularity | Example |
|--------|---------|-------------|---------|
| **Task Tracking** (MCP) | What value was delivered | High-level work units | "Fix metrics display bug" |
| **TodoWrite** | Implementation progress | Checklist items within a task | "Update display.tsx", "Fix tests" |

**Use BOTH:**

1. Call `start_task()` when you begin working on a user request
2. Use `TodoWrite` to break down implementation steps
3. Call `complete_task()` when the work is done

## When to Call start_task() - MANDATORY

Call `start_task()` BEFORE your first tool call for any of these:

- Implementing a feature (type: `implementation`)
- Fixing a bug (type: `fix`)
- Refactoring code (type: `refactor`)
- Researching a technical question (type: `research`)

**Do NOT track:** Simple questions, reading files, trivial edits, conversation.

## Required Workflow

```text
User: "Fix the login bug"

# STEP 1: Start task IMMEDIATELY (before any other tool calls)
start_task({
  description: "Fix login bug",
  type: "fix",
  estimated_complexity: "moderate"
})
# Returns: { task_id: "task_123" }

# STEP 2: Break down into todos (for progress visibility)
TodoWrite([
  { content: "Investigate root cause", status: "in_progress" },
  { content: "Implement fix", status: "pending" },
  { content: "Add tests", status: "pending" },
  { content: "Run validation hooks", status: "pending" }
])

# STEP 3: Do the work, updating todos as you go...

# STEP 4: Complete task with honest assessment
complete_task({
  task_id: "task_123",
  outcome: "success",
  confidence: 0.85,
  files_modified: ["src/auth.ts"],
  tests_added: 3,
  notes: "All tests passing"
})
```

## Confidence Calibration

Be honest - your self-assessments are cross-validated with hook results:

| Confidence | When to Use |
|------------|-------------|
| **0.85-1.0** | All hooks passed, clear success |
| **0.60-0.84** | Works but minor concerns |
| **0.30-0.59** | Partial solution, needs validation |
| **<0.30** | Significant blockers, uncertain |

## If Task Fails

```javascript
fail_task({
  task_id: "task_123",
  reason: "Cannot resolve without breaking changes",
  confidence: 0.9,
  attempted_solutions: ["Tried X", "Tried Y"]
})
```

## Key Points

1. **start_task() comes FIRST** - before Read, Glob, Edit, or any other tool
2. **One task per user request** - don't create multiple tasks for one ask
3. **TodoWrite is for steps within the task** - they're complementary, not alternatives
4. **complete_task() requires honesty** - your confidence should match actual outcomes
5. **This data improves calibration** - helps identify patterns in your work

## Privacy

All metrics stored locally in `~/.claude/han/metrics/`. No external tracking.
