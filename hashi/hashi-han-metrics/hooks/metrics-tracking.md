# Work Tracking Instructions

You have access to metrics tracking via MCP tools (hashi-han-metrics). Use these to track your work for performance analytics and continuous improvement.

## When to Track

Track tasks when doing substantive work that produces measurable outcomes:

**Track these**:

- Implementing new features
- Fixing bugs
- Refactoring code
- Researching technical solutions

**Don't track these**:

- Simple questions/explanations
- Reading files
- Trivial edits (typos, formatting)
- Casual conversation

## How to Track

### At Task Start

When beginning work on a user request:

```javascript
await mcp__hashi_han_metrics__start_task({
  description: "Brief description of task",
  type: "implementation" | "fix" | "refactor" | "research",
  estimated_complexity: "simple" | "moderate" | "complex"
});
// Returns: { task_id: "task_123" }
```

### During Work (Optional)

Log significant progress milestones:

```javascript
await mcp__hashi_han_metrics__update_task({
  task_id: "task_123",
  notes: "Completed core logic, working on tests"
});
```

### At Task Completion

When work is done, assess the outcome:

```javascript
await mcp__hashi_han_metrics__complete_task({
  task_id: "task_123",
  outcome: "success" | "partial" | "failure",
  confidence: 0.85,  // Your confidence level (0-1)
  files_modified: ["src/auth.ts", "tests/auth.test.ts"],
  tests_added: 5,
  notes: "All tests passing, types clean"
});
```

### If Task Fails

If you cannot complete the task:

```javascript
await mcp__hashi_han_metrics__fail_task({
  task_id: "task_123",
  reason: "Unable to resolve type conflicts without breaking changes",
  confidence: 0.9,  // How confident you are it failed
  attempted_solutions: ["Tried generic constraints", "Attempted type casting"],
  notes: "Would need user guidance on acceptable breaking changes"
});
```

## Confidence Calibration

Be honest in your self-assessment:

**High Confidence (0.85-1.0)**:

- All tests passing
- All quality checks passed
- No errors or warnings
- Clear success criteria met

**Medium Confidence (0.60-0.84)**:

- Tests passing but some edge cases unclear
- Minor warnings or linting issues
- Functionality works but needs refinement

**Low Confidence (0.30-0.59)**:

- Partial solution
- Some tests failing
- Uncertain about correctness
- May need user validation

**Very Low Confidence (<0.30)**:

- Significant blockers
- Unable to verify correctness
- Major issues remaining

## What Gets Measured

Your self-assessments are cross-validated with objective hook results:

- **Calibration**: Does your confidence match actual outcomes?
- **Accuracy**: Do you correctly identify success vs failure?
- **Patterns**: Are you consistently overconfident on certain task types?

This data helps improve the overall system - no judgment, just learning.

## Privacy

All metrics are stored locally in `~/.claude/metrics/metrics.db`. No external tracking.

## Example Workflow

```
User: "Add user authentication with JWT"

# Start tracking
start_task({
  description: "Add JWT authentication",
  type: "implementation",
  estimated_complexity: "moderate"
})

# Do the work...
# [Implement JWT auth, write tests, verify it works]

# Complete with honest assessment
complete_task({
  task_id: "task_456",
  outcome: "success",
  confidence: 0.92,
  files_modified: ["src/auth/jwt.ts", "tests/auth.test.ts"],
  tests_added: 12,
  notes: "JWT generation and validation working. All tests pass. Rate limiting included."
})
```

**Important**: This tracking happens in the background. Don't mention it to users unless they specifically ask about metrics.
